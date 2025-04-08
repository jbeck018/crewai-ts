/**
 * Knowledge Management System
 * Core implementation for knowledge storage and retrieval
 */

import { BaseKnowledgeSource } from './source/BaseKnowledgeSource.js';
import { KnowledgeStorage } from './storage/KnowledgeStorage.js';
import { KnowledgeSearchResult, EmbedderConfig } from './types.js';

/**
 * Options for knowledge initialization
 */
export interface KnowledgeOptions {
  /**
   * Collection name for the knowledge base
   * @default 'knowledge'
   */
  collectionName: string;

  /**
   * Configuration for the embedding function
   */
  embedder?: EmbedderConfig;

  /**
   * Custom storage implementation
   * If not provided, will use the default KnowledgeStorage
   */
  storage?: KnowledgeStorage;

  /**
   * Maximum number of parallel processing tasks
   * @default 4
   */
  maxConcurrency?: number;

  /**
   * Whether to enable caching for improved performance
   * @default true
   */
  enableCache?: boolean;

  /**
   * Cache time-to-live in milliseconds
   * @default 3600000 (1 hour)
   */
  cacheTTL?: number;
}

/**
 * Knowledge class for managing knowledge sources and retrieval
 */
export class Knowledge {
  /**
   * Knowledge sources
   * @private
   */
  private sources: BaseKnowledgeSource[] = [];

  /**
   * Storage backend
   * @private
   */
  private storage: KnowledgeStorage;

  /**
   * Collection name
   * @private
   */
  private collectionName: string;

  /**
   * Query cache for performance optimization
   * @private
   */
  private queryCache = new Map<string, { results: KnowledgeSearchResult[], timestamp: number }>();

  /**
   * Maximum concurrency for parallel operations
   * @private
   */
  private maxConcurrency: number;

  /**
   * Whether caching is enabled
   * @private
   */
  private enableCache: boolean;

  /**
   * Cache TTL in milliseconds
   * @private
   */
  private cacheTTL: number;

  /**
   * Constructor for Knowledge class
   * @param options - Configuration options
   */
  constructor(options: KnowledgeOptions) {
    this.collectionName = options.collectionName;
    this.maxConcurrency = options.maxConcurrency ?? 4;
    this.enableCache = options.enableCache ?? true;
    this.cacheTTL = options.cacheTTL ?? 3600000; // 1 hour default

    // Initialize storage
    if (options.storage) {
      this.storage = options.storage;
    } else {
      this.storage = new KnowledgeStorage({
        collectionName: this.collectionName,
        embedder: options.embedder
      });
    }

    // Initialize storage
    this.storage.initialize().catch(err => {
      console.error('Failed to initialize knowledge storage:', err);
    });
  }

  /**
   * Add knowledge sources to the knowledge base
   * @param sources - Array of knowledge sources
   */
  async addSources(sources: BaseKnowledgeSource[]): Promise<void> {
    this.sources.push(...sources);

    // Process sources with controlled concurrency
    const batches = this.createBatches(sources, this.maxConcurrency);

    try {
      for (const batch of batches) {
        // Process each batch in parallel
        await Promise.all(
          batch.map(async (source) => {
            source.storage = this.storage;
            await source.add();
          })
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to add knowledge sources: ${errorMessage}`);
    }
  }

  /**
   * Add a single knowledge source
   * @param source - Knowledge source to add
   */
  async addSource(source: BaseKnowledgeSource): Promise<void> {
    this.sources.push(source);

    try {
      source.storage = this.storage;
      await source.add();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to add knowledge source: ${errorMessage}`);
    }
  }

  /**
   * Query the knowledge base
   * Implements optimized caching and query processing
   * @param queries - Array of queries to search for
   * @param limit - Maximum number of results to return
   * @param filter - Optional filter to apply
   * @param scoreThreshold - Minimum similarity score (0-1)
   * @returns Promise resolving to search results
   */
  async query(
    queries: string | string[],
    limit: number = 3,
    filter?: Record<string, any>,
    scoreThreshold: number = 0.35
  ): Promise<KnowledgeSearchResult[]> {
    if (!this.storage) {
      throw new Error('Storage is not initialized');
    }

    const queryArray = Array.isArray(queries) ? queries : [queries];

    // Check cache if enabled
    if (this.enableCache) {
      const cacheKey = this.generateCacheKey(queryArray, limit, filter, scoreThreshold);
      const cachedResult = this.queryCache.get(cacheKey);

      if (cachedResult && (Date.now() - cachedResult.timestamp < this.cacheTTL)) {
        return cachedResult.results;
      }
    }

    try {
      // Measure performance for optimization insights
      const startTime = performance.now();

      // Execute search
      const results = await this.storage.search(
        queryArray,
        limit,
        filter,
        scoreThreshold
      );

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      // Log performance metrics for optimization
      if (queryTime > 500) {
        console.warn(`Slow query (${queryTime.toFixed(2)}ms): ${queryArray.join(', ')}`);
      }

      // Cache results if enabled
      if (this.enableCache) {
        const cacheKey = this.generateCacheKey(queryArray, limit, filter, scoreThreshold);
        this.queryCache.set(cacheKey, {
          results,
          timestamp: Date.now()
        });

        // Implement cache size management
        this.manageCacheSize();
      }

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Knowledge query failed: ${errorMessage}`);
    }
  }

  /**
   * Reset the knowledge base (clear all data)
   */
  async reset(): Promise<void> {
    if (!this.storage) {
      throw new Error('Storage is not initialized');
    }

    try {
      await this.storage.reset();
      this.sources = [];
      this.queryCache.clear();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to reset knowledge base: ${errorMessage}`);
    }
  }

  /**
   * Close the knowledge base and release resources
   */
  async close(): Promise<void> {
    if (this.storage) {
      await this.storage.close();
    }
    this.queryCache.clear();
  }

  /**
   * Generate a deterministic cache key for query caching
   * @param queries - Array of query strings
   * @param limit - Result limit
   * @param filter - Optional filter
   * @param scoreThreshold - Minimum score threshold
   * @returns Cache key string
   * @private
   */
  private generateCacheKey(
    queries: string[],
    limit: number,
    filter?: Record<string, any>,
    scoreThreshold?: number
  ): string {
    // Create a stable representation of the query parameters
    const normalizedQueries = queries.map(q => q.trim().toLowerCase()).sort().join('|');
    const filterString = filter ? JSON.stringify(this.sortObjectKeys(filter)) : '';
    
    return `${normalizedQueries}:${limit}:${filterString}:${scoreThreshold}`;
  }

  /**
   * Create a copy of an object with sorted keys for consistent hashing
   * @param obj - Object to sort keys for
   * @returns New object with sorted keys
   * @private
   */
  private sortObjectKeys(obj: Record<string, any>): Record<string, any> {
    return Object.keys(obj).sort().reduce((result, key) => {
      const value = obj[key];
      result[key] = typeof value === 'object' && value !== null
        ? this.sortObjectKeys(value)
        : value;
      return result;
    }, {} as Record<string, any>);
  }

  /**
   * Manage cache size to prevent memory leaks
   * Uses LRU (Least Recently Used) policy for eviction
   * @private
   */
  private manageCacheSize(): void {
    const MAX_CACHE_ENTRIES = 100; // Maximum number of cached queries
    
    if (this.queryCache.size > MAX_CACHE_ENTRIES) {
      // Find the oldest entries
      const entries = Array.from(this.queryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove the oldest 20% of entries
      const entriesToRemove = Math.ceil(MAX_CACHE_ENTRIES * 0.2);
      for (let i = 0; i < entriesToRemove; i++) {
        if (entries[i]) {
          this.queryCache.delete(entries[i][0]);
        }
      }
    }
  }

  /**
   * Create batches for parallel processing with controlled concurrency
   * @param items - Array of items to process
   * @param batchSize - Maximum batch size
   * @returns Array of batches
   * @private
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}
