/**
 * Base Embedder Abstract Class
 * 
 * Defines the interface and common functionality for all embedders
 * with optimized performance and memory characteristics
 */

import { EmbedderConfig } from '../types.js';
import LRUCache from 'lru-cache';

/**
 * Base Embedder Options
 */
export interface BaseEmbedderOptions {
  /**
   * Model to use for embeddings
   */
  model?: string;

  /**
   * Provider of the embedding service
   */
  provider?: string;

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
   * API key for provider-specific authentication
   */
  apiKey?: string;

  /**
   * API URL for HuggingFace
   */
  apiUrl?: string;

  /**
   * Whether to use local inference
   */
  useLocal?: boolean;

  /**
   * Local model path
   */
  localModelPath?: string;

  /**
   * Maximum sequence length
   * @default 512
   */
  maxLength?: number;

  /**
   * Whether to use average pooling
   * @default true
   */
  useAveragePooling?: boolean;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

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

  /**
   * Embedding function to use
   */
  embeddingFunction?: (text: string) => Promise<Float32Array>;

  /**
   * Whether to normalize the embeddings
   * @default false
   */
  normalize?: boolean;

  /**
   * Dimensions of the embeddings
   */
  dimensions?: number;
}

/**
 * Cache entry interface
 */
interface CacheEntry {
  embedding: Float32Array;
  timestamp: number;
}

/**
 * Abstract base class for all embedders
 * Implements common functionality with optimized performance
 */
export abstract class BaseEmbedder<T extends BaseEmbedderOptions = BaseEmbedderOptions> {
  protected client: any;
  protected _model: string;
  protected retryOptions: Required<{
    maxRetries: number;
    initialBackoff: number;
    maxBackoff: number;
  }>;
  protected cache: Map<string, Float32Array> = new Map();

  constructor(public readonly options: T) {
    const defaultRetry = {
      maxRetries: 3,
      initialBackoff: 1000,
      maxBackoff: 30000
    };

    this.options = {
      ...options,
      model: options.model || 'text-embedding-3-small',
      provider: options.provider || 'unknown',
      retry: options.retry || defaultRetry,
      debug: options.debug ?? false,
      dimensions: options.dimensions ?? 768,
      cacheSize: options.cacheSize ?? 1000,
      cacheTTL: options.cacheTTL ?? 3600000,
      batchSize: options.batchSize ?? 16,
      maxConcurrency: options.maxConcurrency ?? 4,
      apiKey: options.apiKey ?? '',
      apiUrl: options.apiUrl ?? '',
      useLocal: options.useLocal ?? false,
      localModelPath: options.localModelPath ?? '',
      maxLength: options.maxLength ?? 512,
      useAveragePooling: options.useAveragePooling ?? true,
      timeout: options.timeout ?? 30000,
      embeddingFunction: options.embeddingFunction || ((text: string) => Promise.resolve(new Float32Array(this.options.dimensions!))),
      normalize: options.normalize ?? false
    };

    this._model = this.options.model || 'text-embedding-3-small';
    this.retryOptions = this.options.retry as Required<{
      maxRetries: number;
      initialBackoff: number;
      maxBackoff: number;
    }>;
  }

  public abstract embed(text: string): Promise<Float32Array>;

  public abstract embedBatch(texts: string[]): Promise<Float32Array[]>;

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.retryOptions.maxRetries,
    initialBackoff: number = this.retryOptions.initialBackoff,
    maxBackoff: number = this.retryOptions.maxBackoff
  ): Promise<T> {
    let currentBackoff = initialBackoff;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (this.isTransientError(lastError)) {
          if (attempt === maxRetries - 1) {
            throw lastError;
          }
          
          await new Promise(resolve => setTimeout(resolve, currentBackoff));
          currentBackoff = Math.min(currentBackoff * 2, maxBackoff);
        } else {
          throw lastError;
        }
      }
    }
    
    throw lastError || new Error('Unknown error during operation');
  }

  protected async executeBatchWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.retryOptions.maxRetries,
    initialBackoff: number = this.retryOptions.initialBackoff,
    maxBackoff: number = this.retryOptions.maxBackoff
  ): Promise<T> {
    return await this.executeWithRetry(operation, maxRetries, initialBackoff, maxBackoff);
  }

  protected isTransientError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    return (
      // Network errors
      message.includes('etimedout') || 
      message.includes('econnreset') || 
      message.includes('econnrefused') ||
      message.includes('network error') ||
      message.includes('aborted') ||
      message.includes('timeout') ||
      // Rate limiting and server errors
      message.includes('rate limit') || 
      message.includes('too many requests') ||
      message.includes('429') ||
      message.includes('500') ||
      message.includes('503')
    );
  }

  protected normalizeVector(vector: Float32Array): Float32Array {
    if (!vector || vector.length === 0) {
      throw new Error('Vector is required and must have at least one element');
    }

    let magnitude = 0;
    for (let i = 0; i < vector.length; i++) {
      const value = vector[i];
      if (value === undefined) {
        throw new Error('Vector contains undefined values');
      }
      magnitude += value * value;
    }
    magnitude = Math.sqrt(magnitude);

    if (magnitude === 0) {
      return vector;
    }

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      const value = vector[i];
      if (value === undefined) {
        throw new Error('Vector contains undefined values');
      }
      normalized[i] = value / magnitude;
    }

    return normalized;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheSize(): number {
    return this.cache.size;
  }

  protected generateCacheKey(text: string): string {
    if (!text) {
      throw new Error('Text is required for cache key generation');
    }
    return `${this._model}-${text}`;
  }

  protected async embedText(text: string): Promise<Float32Array> {
    if (!text) {
      if (this.options.debug) {
        console.warn('Empty text provided for embedding, returning zero vector');
      }
      return new Float32Array(this.options.dimensions!);
    }

    const cacheKey = this.generateCacheKey(text);
    const cached = this.getCachedEmbedding(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const embedding = await this.embed(text);
      if (!embedding) {
        throw new Error('Embedding function returned undefined');
      }
      // Ensure embedding is Float32Array
      const embeddingArray = embedding instanceof Float32Array ? embedding : new Float32Array(embedding);
      this.cache.set(cacheKey, embeddingArray);
      return embeddingArray;
    } catch (error) {
      console.error(`Embedding failed:`, error);
      return new Float32Array(this.options.dimensions!);
    }
  }

  protected async embedTexts(texts: string[]): Promise<Float32Array[]> {
    if (!texts?.length) {
      return [];
    }

    const batchSize = this.options.batchSize!;
    const numBatches = Math.ceil(texts.length / batchSize);
    const results: Float32Array[] = [];

    for (let i = 0; i < numBatches; i++) {
      const batch = texts.slice(i * batchSize, (i + 1) * batchSize);
      try {
        const embeddings = await this.embedBatch(batch);
        if (!embeddings) {
          throw new Error('EmbedBatch returned undefined');
        }
        results.push(...embeddings);
      } catch (error) {
        console.error(`Batch embedding failed:`, error);
        const zeroVector = new Float32Array(this.options.dimensions!);
        results.push(...Array(batch.length).fill(zeroVector));
      }
    }

    return results;
  }

  protected getCachedEmbedding(cacheKey: string): Float32Array | null {
    if (!cacheKey) {
      return null;
    }

    const cachedItem = this.cache.get(cacheKey);
    if (!cachedItem) {
      return null;
    }

    return cachedItem;
  }

  protected async batchProcess<T>(
    items: string[],
    batchSize: number,
    processFn: (batch: string[]) => Promise<T[]>
  ): Promise<T[]> {
    if (!items?.length) {
      return [];
    }

    const results: T[] = [];
    const numBatches = Math.ceil(items.length / batchSize);

    for (let i = 0; i < numBatches; i++) {
      const batch = items.slice(i * batchSize, (i + 1) * batchSize);
      const batchResults = await processFn(batch);
      results.push(...batchResults);
    }

    return results;
  }
}
