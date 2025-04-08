/**
 * Knowledge Storage Implementation
 * Provides optimized vector storage and retrieval with caching
 */
import { BaseKnowledgeStorage } from './BaseKnowledgeStorage.js';
import { KnowledgeChunk, KnowledgeFilter, KnowledgeSearchResult, KnowledgeStorageOptions } from '../types.js';
/**
 * Knowledge storage implementation with optimized vector operations
 */
export declare class KnowledgeStorage extends BaseKnowledgeStorage {
    /**
     * Collection name
     * @private
     */
    private collectionName;
    /**
     * Whether the storage has been initialized
     * @private
     */
    private initialized;
    /**
     * In-memory storage for fast access
     * @private
     */
    private chunks;
    /**
     * Cache for query results with LRU eviction
     * @private
     */
    private queryCache;
    /**
     * Embedding configuration
     * @private
     */
    private embeddingConfig;
    /**
     * Memory-mapped database client (to be initialized)
     * @private
     */
    private dbClient;
    /**
     * Database collection reference (to be initialized)
     * @private
     */
    private collection;
    /**
     * Constructor for KnowledgeStorage
     * @param options - Configuration options
     */
    constructor(options?: KnowledgeStorageOptions);
    /**
     * Initialize the storage backend
     * This performs database connection and collection setup
     */
    initialize(): Promise<void>;
    /**
     * Add a single knowledge chunk to the storage
     * @param chunk - Knowledge chunk to add
     */
    addChunk(chunk: KnowledgeChunk): Promise<void>;
    /**
     * Add multiple knowledge chunks in a batch operation
     * Implements optimized batch processing for better performance
     * @param chunks - Array of knowledge chunks to add
     */
    addChunks(chunks: KnowledgeChunk[]): Promise<void>;
    /**
     * Search for knowledge chunks based on semantic similarity
     * Implements optimized vector search algorithms
     * @param query - Text queries to search for
     * @param limit - Maximum number of results to return
     * @param filter - Optional filter to apply to the search
     * @param scoreThreshold - Minimum similarity score (0-1) to include in results
     * @returns Array of search results sorted by relevance
     */
    /**
     * Ensure that the storage has been initialized
     * @private
     */
    private ensureInitialized;
    /**
     * Create batches for parallel processing with controlled concurrency
     * @param items - Array of items to process
     * @param batchSize - Maximum batch size
     * @returns Array of batches
     * @private
     */
    private createBatches;
    /**
     * Generate a deterministic cache key for query caching
     * @param queries - Array of query strings
     * @param limit - Result limit
     * @param filter - Optional filter
     * @param scoreThreshold - Minimum score threshold
     * @returns Cache key string
     * @private
     */
    private generateSearchCacheKey;
    /**
     * Create a copy of an object with sorted keys for consistent hashing
     * @param obj - Object to sort keys for
     * @returns New object with sorted keys
     * @private
     */
    private sortObjectKeys;
    /**
     * Apply metadata filters to chunks
     * @param chunks - Array of chunks to filter
     * @param filter - Filter to apply
     * @returns Filtered chunks
     * @private
     */
    private applyFilter;
    /**
     * Calculate cosine similarity between two vectors
     * Optimized implementation for Float32Array and number[] types
     * @param a - First vector
     * @param b - Second vector
     * @returns Similarity score between 0 and 1
     * @private
     */
    private calculateCosineSimilarity;
    /**
     * Calculate dot product between two vectors
     * SIMD-compatible implementation for better performance
     * @param a - First vector
     * @param b - Second vector
     * @returns Dot product value
     * @private
     */
    /**
     * Optimized dot product calculation for Float32Array and number[] types
     * Uses loop unrolling for better performance and ensures type safety
     */
    /**
     * Highly optimized dot product calculation for vector operations
     * Handles both Float32Array and number[] with type-specific optimization paths
     * @param a - First vector
     * @param b - Second vector
     * @returns Optimized dot product value
     */
    private dotProduct;
    /**
     * Specialized dot product for Float32Array inputs
     * Uses aggressive loop unrolling with SIMD-friendly operations
     */
    /**
     * Convert any vector type to a standard number array for compatibility
     * Implements optimized conversion with cache utilization
     * @param vector Input vector as Float32Array or number[]
     * @returns Standard number array representation
     */
    private toNumberArray;
    private dotProductFloat32;
    /**
     * Specialized dot product for number[] inputs
     * Includes additional null safety checks
     */
    private dotProductNumberArray;
    /**
     * Specialized dot product for mixed Float32Array and number[] inputs
     * Optimized for this specific case
     */
    private dotProductMixed;
    /**
     * Calculate magnitude (L2 norm) of a vector
     * @param vector - Vector to calculate magnitude for
     * @returns Magnitude value
     * @private
     */
    /**
     * Calculate magnitude (L2 norm) of a vector with optimized implementation
     * Uses loop unrolling and safety checks for better performance
     */
    private magnitude;
    /**
     * Normalize a vector in-place to unit length
     * @param vector - Vector to normalize
     * @private
     */
    /**
     * Normalize a vector to unit length in-place with optimized implementation
     * Contains safety checks and type-specific handling for better performance
     */
    private normalizeVector;
    /**
     * Search for knowledge chunks based on semantic similarity
     * Implements optimized vector search algorithms matching Python implementation
     * @param query - Text queries to search for
     * @param limit - Maximum number of results to return
     * @param filter - Optional filter to apply to the search
     * @param scoreThreshold - Minimum similarity score (0-1) to include in results
     * @returns Array of search results sorted by relevance
     */
    search(query: string[], limit?: number, filter?: KnowledgeFilter, scoreThreshold?: number): Promise<KnowledgeSearchResult[]>;
    /**
     * Generate embeddings for text using the configured embedding function
     * Implements optimized vector generation
     * @param texts - Array of texts to generate embeddings for
     * @returns Promise resolving to array of embeddings
     */
    generateEmbeddings(texts: string[]): Promise<number[][]>;
    /**
     * Simple hash function for strings that's fast and deterministic
     * @param text - Text to hash
     * @returns A numeric hash value
     */
    private simpleStringHash;
    /**
     * Reset the storage (clear all data)
     */
    reset(): Promise<void>;
    /**
     * Delete specific chunks by ID
     * @param ids - Array of chunk IDs to delete
     */
    deleteChunks(ids: string[]): Promise<void>;
    /**
     * Get chunks by ID
     * @param ids - Array of chunk IDs to retrieve
     * @returns Array of knowledge chunks
     */
    getChunks(ids: string[]): Promise<KnowledgeChunk[]>;
    /**
     * Get all chunks in the storage
     * @returns Array of all knowledge chunks
     */
    getAllChunks(): Promise<KnowledgeChunk[]>;
    /**
     * Create a new collection (if supported by the backend)
     * @param collectionName - Name of the collection to create
     */
    createCollection(collectionName: string): Promise<void>;
    /**
     * Delete a collection (if supported by the backend)
     * @param collectionName - Name of the collection to delete
     */
    deleteCollection(collectionName: string): Promise<void>;
    /**
     * List all collections (if supported by the backend)
     * @returns Array of collection names
     */
    listCollections(): Promise<string[]>;
    /**
     * Close the storage connection and release resources
     */
    close(): Promise<void>;
}
//# sourceMappingURL=KnowledgeStorage.d.ts.map