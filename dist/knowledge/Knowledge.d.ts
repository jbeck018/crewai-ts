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
export declare class Knowledge {
    /**
     * Knowledge sources
     * @private
     */
    private sources;
    /**
     * Storage backend
     * @private
     */
    private storage;
    /**
     * Collection name
     * @private
     */
    private collectionName;
    /**
     * Query cache for performance optimization
     * @private
     */
    private queryCache;
    /**
     * Maximum concurrency for parallel operations
     * @private
     */
    private maxConcurrency;
    /**
     * Whether caching is enabled
     * @private
     */
    private enableCache;
    /**
     * Cache TTL in milliseconds
     * @private
     */
    private cacheTTL;
    /**
     * Constructor for Knowledge class
     * @param options - Configuration options
     */
    constructor(options: KnowledgeOptions);
    /**
     * Add knowledge sources to the knowledge base
     * @param sources - Array of knowledge sources
     */
    addSources(sources: BaseKnowledgeSource[]): Promise<void>;
    /**
     * Add a single knowledge source
     * @param source - Knowledge source to add
     */
    addSource(source: BaseKnowledgeSource): Promise<void>;
    /**
     * Query the knowledge base
     * Implements optimized caching and query processing
     * @param queries - Array of queries to search for
     * @param limit - Maximum number of results to return
     * @param filter - Optional filter to apply
     * @param scoreThreshold - Minimum similarity score (0-1)
     * @returns Promise resolving to search results
     */
    query(queries: string | string[], limit?: number, filter?: Record<string, any>, scoreThreshold?: number): Promise<KnowledgeSearchResult[]>;
    /**
     * Reset the knowledge base (clear all data)
     */
    reset(): Promise<void>;
    /**
     * Close the knowledge base and release resources
     */
    close(): Promise<void>;
    /**
     * Generate a deterministic cache key for query caching
     * @param queries - Array of query strings
     * @param limit - Result limit
     * @param filter - Optional filter
     * @param scoreThreshold - Minimum score threshold
     * @returns Cache key string
     * @private
     */
    private generateCacheKey;
    /**
     * Create a copy of an object with sorted keys for consistent hashing
     * @param obj - Object to sort keys for
     * @returns New object with sorted keys
     * @private
     */
    private sortObjectKeys;
    /**
     * Manage cache size to prevent memory leaks
     * Uses LRU (Least Recently Used) policy for eviction
     * @private
     */
    private manageCacheSize;
    /**
     * Create batches for parallel processing with controlled concurrency
     * @param items - Array of items to process
     * @param batchSize - Maximum batch size
     * @returns Array of batches
     * @private
     */
    private createBatches;
}
//# sourceMappingURL=Knowledge.d.ts.map