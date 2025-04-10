/**
 * Base Embedder Abstract Class
 * 
 * Defines the interface and common functionality for all embedders
 * with optimized performance and memory characteristics
 */

import { EmbedderConfig } from '../types.js';

/**
 * Base Embedder Options
 */
export interface BaseEmbedderOptions extends EmbedderConfig {
  /**
   * Cache size for embeddings (number of items)
   * @default 1000
   */
  cacheSize?: number;

  /**
   * Cache TTL in milliseconds
   * @default 3600000 (1 hour)
   */
  cacheTTL?: number;

  /**
   * Maximum batch size for embedding requests
   * @default 16
   */
  batchSize?: number;

  /**
   * Maximum concurrent requests
   * @default 4
   */
  maxConcurrency?: number;

  /**
   * Retry configuration
   */
  retry?: {
    /**
     * Maximum number of retries
     * @default 3
     */
    maxRetries?: number;

    /**
     * Initial backoff time in milliseconds
     * @default 1000
     */
    initialBackoff?: number;

    /**
     * Maximum backoff time in milliseconds
     * @default 30000
     */
    maxBackoff?: number;
  };

  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Cache Entry for embeddings
 */
interface CacheEntry {
  embedding: Float32Array;
  timestamp: number;
}

/**
 * Abstract base class for all embedders
 * Implements common functionality with optimized performance
 */
export abstract class BaseEmbedder {
  /**
   * Configuration options for the embedder
   */
  protected options: Required<BaseEmbedderOptions>;

  /**
   * In-memory LRU cache for embeddings
   */
  protected cache: Map<string, CacheEntry>;

  /**
   * Constructor for BaseEmbedder
   * @param options Embedder configuration options
   */
  constructor(options: BaseEmbedderOptions = {}) {
    // Set defaults optimized for performance and memory usage
    this.options = {
      model: options.model || 'all-MiniLM-L6-v2',
      dimensions: options.dimensions || 384,
      normalize: options.normalize !== undefined ? options.normalize : true,
      provider: options.provider || 'openai',
      embeddingFunction: options.embeddingFunction,
      cacheSize: options.cacheSize || 1000,
      cacheTTL: options.cacheTTL || 3600000, // 1 hour default
      batchSize: options.batchSize || 16,
      maxConcurrency: options.maxConcurrency || 4,
      retry: {
        maxRetries: options.retry?.maxRetries || 3,
        initialBackoff: options.retry?.initialBackoff || 1000,
        maxBackoff: options.retry?.maxBackoff || 30000
      },
      debug: options.debug || false
    };

    // Initialize cache
    this.cache = new Map<string, CacheEntry>();
  }

  /**
   * Generate embeddings for a single text
   * @param text Text to embed
   * @returns Promise resolving to Float32Array of embeddings
   */
  async embed(text: string): Promise<Float32Array> {
    if (!text || text.trim() === '') {
      if (this.options.debug) {
        console.warn('Empty text provided for embedding, returning zero vector');
      }
      return new Float32Array(this.options.dimensions);
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(text);
    const cachedItem = this.getCachedEmbedding(cacheKey);
    
    if (cachedItem) {
      return cachedItem;
    }

    try {
      // Get embedding from implementation
      const embedding = await this.embedText(text);
      
      // Cache result
      this.cacheEmbedding(cacheKey, embedding);
      
      return embedding;
    } catch (error) {
      if (this.options.debug) {
        console.error('Error generating embedding:', error);
      }
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts with efficient batching
   * @param texts Array of texts to embed
   * @returns Promise resolving to array of Float32Array embeddings
   */
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    // Filter empty texts
    const validTexts = texts.filter(text => text && text.trim() !== '');
    
    if (validTexts.length === 0) {
      if (this.options.debug) {
        console.warn('No valid texts provided for batch embedding');
      }
      return [];
    }

    // Check cache for all texts first
    const cacheResults: (Float32Array | null)[] = validTexts.map(text => {
      const cacheKey = this.generateCacheKey(text);
      return this.getCachedEmbedding(cacheKey);
    });

    // If all results are cached, return them
    if (cacheResults.every(result => result !== null)) {
      return cacheResults as Float32Array[];
    }

    // Find texts that need embedding
    const textsToEmbed: { text: string; index: number }[] = validTexts
      .map((text, index) => ({ text, index }))
      .filter((item, index) => cacheResults[index] === null);

    // Create optimal batches
    const batches = this.createBatches(
      textsToEmbed,
      this.options.batchSize
    );

    // Process batches with controlled concurrency
    const batchResults: { index: number; embedding: Float32Array }[] = [];

    try {
      // Process batch in sequence for API rate limit compliance
      for (const batch of batches) {
        const batchPromises = batch.map(async item => {
          try {
            const embedding = await this.embedText(item.text);
            // Cache the result
            this.cacheEmbedding(this.generateCacheKey(item.text), embedding);
            return { index: item.index, embedding };
          } catch (error) {
            if (this.options.debug) {
              console.error(`Error embedding text at index ${item.index}:`, error);
            }
            // Return zero vector for failed embeddings
            return {
              index: item.index,
              embedding: new Float32Array(this.options.dimensions)
            };
          }
        });

        // Wait for all embeddings in this batch
        const results = await Promise.all(batchPromises);
        batchResults.push(...results);
      }

      // Combine cached and new results
      const combinedResults: Float32Array[] = new Array(validTexts.length);
      
      // Add cached results
      cacheResults.forEach((result, index) => {
        if (result !== null) {
          combinedResults[index] = result;
        }
      });
      
      // Add new results
      batchResults.forEach(result => {
        combinedResults[result.index] = result.embedding;
      });

      return combinedResults;
    } catch (error) {
      if (this.options.debug) {
        console.error('Error in batch embedding:', error);
      }
      throw error;
    }
  }

  /**
   * Abstract method to be implemented by provider-specific embedders
   * @param text Text to embed
   * @returns Promise resolving to embedding vectors
   */
  protected abstract embedText(text: string): Promise<Float32Array>;

  /**
   * Generate a deterministic cache key for a text
   * @param text Text to generate key for
   * @returns Cache key
   */
  protected generateCacheKey(text: string): string {
    // Simple hash function for cache key
    const normalizedText = text.trim().toLowerCase();
    
    // Fast string hashing algorithm (djb2)
    let hash = 5381;
    for (let i = 0; i < normalizedText.length; i++) {
      hash = ((hash << 5) + hash) + normalizedText.charCodeAt(i);
    }
    
    return `${this.options.provider}:${this.options.model}:${hash}`;
  }

  /**
   * Get a cached embedding
   * @param cacheKey Cache key
   * @returns Cached embedding or null if not found
   */
  protected getCachedEmbedding(cacheKey: string): Float32Array | null {
    const cachedItem = this.cache.get(cacheKey);
    
    if (!cachedItem) {
      return null;
    }
    
    // Check if cache entry has expired
    if (Date.now() - cachedItem.timestamp > this.options.cacheTTL) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return cachedItem.embedding;
  }

  /**
   * Cache an embedding
   * @param cacheKey Cache key
   * @param embedding Embedding to cache
   */
  protected cacheEmbedding(cacheKey: string, embedding: Float32Array): void {
    // Manage cache size before adding new item
    if (this.cache.size >= this.options.cacheSize) {
      this.evictCacheItems();
    }
    
    this.cache.set(cacheKey, {
      embedding,
      timestamp: Date.now()
    });
  }

  /**
   * Evict items from cache using LRU policy
   */
  protected evictCacheItems(): void {
    // Evict 20% of cache entries (LRU strategy)
    const entriesToRemove = Math.ceil(this.options.cacheSize * 0.2);
    
    if (entriesToRemove <= 0) {
      return;
    }
    
    // Sort by timestamp (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest entries
    for (let i = 0; i < Math.min(entriesToRemove, entries.length); i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Create batches for parallel processing with controlled concurrency
   * @param items Array of items to process
   * @param batchSize Maximum batch size
   * @returns Array of batches
   */
  protected createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Normalize a vector to unit length
   * @param vector Vector to normalize
   * @returns Normalized vector
   */
  protected normalizeVector(vector: number[] | Float32Array): Float32Array {
    // Convert to Float32Array if needed
    const float32Vector = Array.isArray(vector) 
      ? new Float32Array(vector)
      : vector;
    
    if (float32Vector.length === 0) {
      return new Float32Array(this.options.dimensions);
    }
    
    // Calculate magnitude
    let magnitude = 0;
    for (let i = 0; i < float32Vector.length; i++) {
      magnitude += float32Vector[i] * float32Vector[i];
    }
    magnitude = Math.sqrt(magnitude);
    
    // Avoid division by zero
    if (magnitude === 0) {
      return float32Vector;
    }
    
    // Normalize in-place for better performance
    for (let i = 0; i < float32Vector.length; i++) {
      float32Vector[i] /= magnitude;
    }
    
    return float32Vector;
  }

  /**
   * Clear the embedding cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the current cache size
   * @returns Number of items in cache
   */
  public getCacheSize(): number {
    return this.cache.size;
  }
}
