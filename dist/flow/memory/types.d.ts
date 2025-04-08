/**
 * Memory types for the Flow system - Performance optimized and compatible with Python implementation
 */
/**
 * ContextualMemory class for optimized memory operations
 * This implementation includes performance enhancements:
 * - Multi-level caching strategy
 * - Efficient metadata indexing
 * - Memory-optimized data structures
 */
export declare class ContextualMemory {
    private options;
    private items;
    private metadataIndex;
    private queryCache;
    private metrics;
    private readonly cacheTTL;
    /**
     * Creates a new ContextualMemory instance with the specified options
     * @param options Configuration options for memory management
     */
    constructor(options?: ContextualMemoryOptions);
    /**
     * Add a memory item to the store with efficient indexing
     * @param id Unique identifier for the memory item
     * @param content The content of the memory item
     * @param metadata Optional metadata for improved retrievability
     * @returns The ID of the added memory item
     */
    add(id: string, content: string, metadata?: Record<string, any>): Promise<string>;
    /**
     * Retrieve a memory item by ID with cache optimization
     * @param id The ID of the memory item to retrieve
     * @returns The memory item or null if not found
     */
    get(id: string): Promise<MemoryItem | null>;
    /**
     * Delete a memory item with efficient cleanup
     * @param id The ID of the memory item to delete
     * @returns True if the item was deleted, false otherwise
     */
    delete(id: string): Promise<boolean>;
    /**
     * Search for memory items by metadata with performance optimizations
     * @param metadata The metadata to search for
     * @param limit Maximum number of results to return
     * @returns Array of matching memory items
     */
    searchByMetadata(metadata: Record<string, any>, limit?: number): Promise<MemoryItem[]>;
    /**
     * Get performance metrics for monitoring
     * @returns Current memory performance metrics
     */
    getMetrics(): ContextualMemoryMetrics;
    /**
     * Index metadata for efficient searching
     * @param id Item ID to index
     * @param metadata Metadata to index
     */
    private indexMetadata;
    /**
     * Remove item from metadata index
     * @param id Item ID to remove
     * @param metadata Metadata to de-index
     */
    private removeFromMetadataIndex;
    /**
     * Find items matching the provided metadata
     * @param metadata Metadata to match
     * @returns Set of matching item IDs
     */
    private findItemsMatchingMetadata;
    /**
     * Get a cached result with TTL enforcement
     * @param key Cache key
     * @returns Cached result or null if not found
     */
    private getCachedResult;
    /**
     * Cache a query result
     * @param key Cache key
     * @param result Result to cache
     */
    private cacheResult;
    /**
     * Update query performance metrics
     * @param startTime Query start timestamp
     */
    private updateQueryMetrics;
    /**
     * Clean expired cache entries to prevent memory leaks
     */
    private cleanCache;
}
/**
 * VectorStoreMemory class for optimized vector-based memory operations
 * Efficiently manages embeddings with similarity search capabilities
 */
export declare class VectorStoreMemory {
    private options;
    private items;
    private queryCache;
    private metrics;
    private readonly cacheTTL;
    /**
     * Creates a new VectorStoreMemory instance
     * @param options Configuration options
     */
    constructor(options?: VectorStoreMemoryOptions);
    /**
     * Add a vector item to the store
     * @param id Unique identifier
     * @param vector The vector embedding
     * @param content The associated content
     * @param metadata Optional metadata
     * @returns The ID of the added vector item
     */
    add(id: string, vector: number[], content: string, metadata?: Record<string, any>): Promise<string>;
    /**
     * Retrieve a vector item by ID
     * @param id The ID of the vector item to retrieve
     * @returns The vector item or null if not found
     */
    get(id: string): Promise<VectorItem | null>;
    /**
     * Delete a vector item
     * @param id The ID of the vector item to delete
     * @returns True if the item was deleted, false otherwise
     */
    delete(id: string): Promise<boolean>;
    /**
     * Perform optimized similarity search
     * @param queryVector The query vector for similarity comparison
     * @param limit Maximum number of results
     * @param scoreThreshold Minimum similarity score threshold
     * @returns Array of matching items with similarity scores
     */
    similaritySearch(queryVector: number[], limit?: number, scoreThreshold?: number): Promise<Array<{
        item: VectorItem;
        score: number;
    }>>;
    /**
     * Get performance metrics
     * @returns Current vector memory performance metrics
     */
    getMetrics(): VectorStoreMemoryMetrics;
    /**
     * Calculate cosine similarity between two vectors
     * Optimized implementation with early returns and minimal operations
     * @param vectorA First vector
     * @param vectorB Second vector
     * @returns Cosine similarity score between 0 and 1
     */
    private cosineSimilarity;
    /**
     * Get a cached result with TTL enforcement
     * @param key Cache key
     * @returns Cached result or null if not found
     */
    private getCachedResult;
    /**
     * Cache a query result
     * @param key Cache key
     * @param result Result to cache
     */
    private cacheResult;
    /**
     * Update query performance metrics
     * @param startTime Query start timestamp
     */
    private updateQueryMetrics;
    /**
     * Clean expired cache entries
     */
    private cleanCache;
}
/**
 * Interfaces for memory system
 */
export interface MemoryItem {
    id: string;
    content: string;
    metadata: Record<string, any>;
    timestamp: number;
}
export interface VectorItem extends MemoryItem {
    vector: number[];
}
export interface ContextualMemoryOptions {
    cacheTTL?: number;
    autoCacheCleanup?: boolean;
}
export interface VectorStoreMemoryOptions {
    cacheTTL?: number;
    autoCacheCleanup?: boolean;
}
export interface ContextualMemoryMetrics {
    cacheHits: number;
    cacheMisses: number;
    averageQueryTimeMs: number;
    totalQueries: number;
}
export interface VectorStoreMemoryMetrics extends ContextualMemoryMetrics {
}
//# sourceMappingURL=types.d.ts.map