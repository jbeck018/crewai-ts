/**
 * Knowledge Management System
 * Core implementation for knowledge storage and retrieval
 */
import { KnowledgeStorage } from './storage/KnowledgeStorage.js';
/**
 * Knowledge class for managing knowledge sources and retrieval
 */
export class Knowledge {
    /**
     * Knowledge sources
     * @private
     */
    sources = [];
    /**
     * Storage backend
     * @private
     */
    storage;
    /**
     * Collection name
     * @private
     */
    collectionName;
    /**
     * Query cache for performance optimization
     * @private
     */
    queryCache = new Map();
    /**
     * Maximum concurrency for parallel operations
     * @private
     */
    maxConcurrency;
    /**
     * Whether caching is enabled
     * @private
     */
    enableCache;
    /**
     * Cache TTL in milliseconds
     * @private
     */
    cacheTTL;
    /**
     * Constructor for Knowledge class
     * @param options - Configuration options
     */
    constructor(options) {
        this.collectionName = options.collectionName;
        this.maxConcurrency = options.maxConcurrency ?? 4;
        this.enableCache = options.enableCache ?? true;
        this.cacheTTL = options.cacheTTL ?? 3600000; // 1 hour default
        // Initialize storage
        if (options.storage) {
            this.storage = options.storage;
        }
        else {
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
    async addSources(sources) {
        this.sources.push(...sources);
        // Process sources with controlled concurrency
        const batches = this.createBatches(sources, this.maxConcurrency);
        try {
            for (const batch of batches) {
                // Process each batch in parallel
                await Promise.all(batch.map(async (source) => {
                    source.storage = this.storage;
                    await source.add();
                }));
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to add knowledge sources: ${errorMessage}`);
        }
    }
    /**
     * Add a single knowledge source
     * @param source - Knowledge source to add
     */
    async addSource(source) {
        this.sources.push(source);
        try {
            source.storage = this.storage;
            await source.add();
        }
        catch (error) {
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
    async query(queries, limit = 3, filter, scoreThreshold = 0.35) {
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
            const results = await this.storage.search(queryArray, limit, filter, scoreThreshold);
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Knowledge query failed: ${errorMessage}`);
        }
    }
    /**
     * Reset the knowledge base (clear all data)
     */
    async reset() {
        if (!this.storage) {
            throw new Error('Storage is not initialized');
        }
        try {
            await this.storage.reset();
            this.sources = [];
            this.queryCache.clear();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to reset knowledge base: ${errorMessage}`);
        }
    }
    /**
     * Close the knowledge base and release resources
     */
    async close() {
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
    generateCacheKey(queries, limit, filter, scoreThreshold) {
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
    sortObjectKeys(obj) {
        return Object.keys(obj).sort().reduce((result, key) => {
            const value = obj[key];
            result[key] = typeof value === 'object' && value !== null
                ? this.sortObjectKeys(value)
                : value;
            return result;
        }, {});
    }
    /**
     * Manage cache size to prevent memory leaks
     * Uses LRU (Least Recently Used) policy for eviction
     * @private
     */
    manageCacheSize() {
        const MAX_CACHE_ENTRIES = 100; // Maximum number of cached queries
        if (this.queryCache.size > MAX_CACHE_ENTRIES) {
            // Find the oldest entries
            const entries = Array.from(this.queryCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            // Performance-optimized cache cleanup with proper null safety
            const entriesToRemove = Math.ceil(MAX_CACHE_ENTRIES * 0.2);
            // First filter valid entries to avoid null checks in the loop - better performance
            const validEntries = entries.filter(entry => entry && entry[0]);
            // Remove the oldest 20% of entries safely
            for (let i = 0; i < Math.min(entriesToRemove, validEntries.length); i++) {
                // Safe delete with definite assignment
                const key = validEntries[i][0];
                if (key) { // Extra safety check
                    this.queryCache.delete(key);
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
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
}
//# sourceMappingURL=Knowledge.js.map