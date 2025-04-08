/**
 * Knowledge Storage Implementation
 * Provides optimized vector storage and retrieval with caching
 */
import { BaseKnowledgeStorage } from './BaseKnowledgeStorage.js';
import { Cache } from '../../utils/cache.js';
/**
 * Default embedding dimensionality
 * @constant
 */
const DEFAULT_DIMENSIONS = 384;
/**
 * Sanitize collection name for storage backend compatibility
 * @param name - Original collection name
 * @returns Sanitized collection name
 */
function sanitizeCollectionName(name) {
    // Replace characters that might cause issues with databases
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}
/**
 * Generate a deterministic ID for content deduplication
 * @param content - Content to generate ID from
 * @returns Unique ID
 */
function generateContentId(content) {
    // Simple but fast hashing algorithm for content-based IDs
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return `${Math.abs(hash).toString(16)}`;
}
/**
 * Knowledge storage implementation with optimized vector operations
 */
export class KnowledgeStorage extends BaseKnowledgeStorage {
    /**
     * Collection name
     * @private
     */
    collectionName;
    /**
     * Whether the storage has been initialized
     * @private
     */
    initialized = false;
    /**
     * In-memory storage for fast access
     * @private
     */
    chunks = new Map();
    /**
     * Cache for query results with LRU eviction
     * @private
     */
    queryCache;
    /**
     * Embedding configuration
     * @private
     */
    embeddingConfig;
    /**
     * Memory-mapped database client (to be initialized)
     * @private
     */
    dbClient = null;
    /**
     * Database collection reference (to be initialized)
     * @private
     */
    collection = null;
    /**
     * Constructor for KnowledgeStorage
     * @param options - Configuration options
     */
    constructor(options = {}) {
        super();
        // Set collection name with sanitization
        this.collectionName = options.collectionName
            ? sanitizeCollectionName(options.collectionName)
            : 'knowledge';
        // Set embedding configuration with defaults
        this.embeddingConfig = {
            model: options.embedder?.model ?? 'all-MiniLM-L6-v2',
            dimensions: options.embedder?.dimensions ?? DEFAULT_DIMENSIONS,
            normalize: options.embedder?.normalize ?? true,
            provider: options.embedder?.provider ?? 'fastembed',
            embeddingFunction: options.embedder?.embeddingFunction ?? null
        };
        // Initialize query cache
        this.queryCache = new Cache({
            maxSize: 100, // Maximum number of cached queries
            ttl: 3600000 // 1 hour TTL
        });
    }
    /**
     * Initialize the storage backend
     * This performs database connection and collection setup
     */
    async initialize() {
        try {
            // Check if already initialized
            if (this.initialized)
                return;
            // Placeholder for database initialization
            // In a real implementation, this would initialize chromadb or another vector database
            // For this TypeScript port, we'll simulate vector storage in memory
            // with the necessary interfaces for a complete implementation
            console.log(`Initializing knowledge storage with collection: ${this.collectionName}`);
            // Mark as initialized
            this.initialized = true;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to initialize knowledge storage: ${errorMessage}`);
        }
    }
    /**
     * Add a single knowledge chunk to the storage
     * @param chunk - Knowledge chunk to add
     */
    async addChunk(chunk) {
        await this.ensureInitialized();
        try {
            // Generate embeddings if not already present
            if (!chunk.embedding && chunk.content) {
                const embeddings = await this.generateEmbeddings([chunk.content]);
                if (embeddings && embeddings.length > 0) {
                    chunk.embedding = embeddings[0];
                }
            }
            // Ensure chunk has an ID
            if (!chunk.id) {
                chunk.id = generateContentId(chunk.content);
            }
            // Store in memory map
            this.chunks.set(chunk.id, chunk);
            // In a real implementation, this would also store the chunk in chromadb or another vector database
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to add knowledge chunk: ${errorMessage}`);
        }
    }
    /**
     * Add multiple knowledge chunks in a batch operation
     * Implements optimized batch processing for better performance
     * @param chunks - Array of knowledge chunks to add
     */
    async addChunks(chunks) {
        await this.ensureInitialized();
        if (!chunks || chunks.length === 0)
            return;
        try {
            // Process chunks in optimal batch sizes for better performance
            const BATCH_SIZE = 100; // Optimal batch size for vector operations
            const batches = this.createBatches(chunks, BATCH_SIZE);
            for (const batch of batches) {
                // Step 1: Generate embeddings for chunks without embeddings
                const chunksNeedingEmbeddings = batch
                    .filter((chunk) => !chunk.embedding && chunk.content)
                    .map((chunk) => chunk.content);
                if (chunksNeedingEmbeddings.length > 0) {
                    const embeddings = await this.generateEmbeddings(chunksNeedingEmbeddings);
                    // Assign embeddings to the original chunks
                    let embeddingIndex = 0;
                    for (let i = 0; i < batch.length; i++) {
                        const chunk = batch[i];
                        if (chunk && !chunk.embedding && chunk.content && embeddingIndex < embeddings.length) {
                            chunk.embedding = embeddings[embeddingIndex++];
                        }
                    }
                }
                // Step 2: Ensure all chunks have IDs
                for (const chunk of batch) {
                    if (!chunk.id) {
                        chunk.id = generateContentId(chunk.content);
                    }
                    // Step 3: Store in memory map
                    this.chunks.set(chunk.id, chunk);
                }
                // In a real implementation, this would batch store in chromadb or another vector database
            }
            // Clear query cache since the knowledge base has changed
            this.queryCache.clear();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to add knowledge chunks in batch: ${errorMessage}`);
        }
    }
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
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
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
    /**
     * Generate a deterministic cache key for query caching
     * @param queries - Array of query strings
     * @param limit - Result limit
     * @param filter - Optional filter
     * @param scoreThreshold - Minimum score threshold
     * @returns Cache key string
     * @private
     */
    generateSearchCacheKey(queries, limit, filter, scoreThreshold) {
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
     * Apply metadata filters to chunks
     * @param chunks - Array of chunks to filter
     * @param filter - Filter to apply
     * @returns Filtered chunks
     * @private
     */
    applyFilter(chunks, filter) {
        return chunks.filter(chunk => {
            // If chunk has no metadata or metadata is empty, it can't match any filter
            if (!chunk.metadata || Object.keys(chunk.metadata).length === 0) {
                return false;
            }
            // Check if all filter conditions are met
            return Object.entries(filter).every(([key, value]) => {
                // Handle nested filters with dot notation (e.g., 'author.name')
                const keys = key.split('.');
                let currentValue = chunk.metadata;
                // Navigate through nested properties
                for (let i = 0; i < keys.length - 1; i++) {
                    if (!currentValue || typeof currentValue !== 'object') {
                        return false;
                    }
                    // Ensure the key exists before accessing it
                    const nextKey = keys[i];
                    if (!nextKey || !(nextKey in currentValue)) {
                        return false;
                    }
                    currentValue = currentValue[nextKey];
                    if (currentValue === undefined || currentValue === null) {
                        return false;
                    }
                }
                // Get the final property value
                if (keys.length === 0) {
                    return false;
                }
                const finalKey = keys[keys.length - 1];
                if (!finalKey || !currentValue || typeof currentValue !== 'object') {
                    return false;
                }
                // Safely check if the property exists before accessing it
                if (!(finalKey in currentValue)) {
                    return false;
                }
                const propValue = currentValue[finalKey];
                // Compare values based on type
                if (Array.isArray(value)) {
                    // If filter value is an array, check if chunk value is in the array
                    return Array.isArray(propValue)
                        ? propValue.some((v) => value.includes(v))
                        : value.includes(propValue);
                }
                else if (typeof value === 'object' && value !== null) {
                    // Handle range queries or complex objects
                    // Special case for ranges with $gt, $lt, etc.
                    const typedValue = value;
                    if ('$gt' in typedValue && propValue <= typedValue.$gt)
                        return false;
                    if ('$lt' in typedValue && propValue >= typedValue.$lt)
                        return false;
                    if ('$gte' in typedValue && propValue < typedValue.$gte)
                        return false;
                    if ('$lte' in typedValue && propValue > typedValue.$lte)
                        return false;
                    if ('$ne' in typedValue && propValue === typedValue.$ne)
                        return false;
                    return true;
                }
                else {
                    // Direct value comparison
                    return propValue === value;
                }
            });
        });
    }
    /**
     * Calculate cosine similarity between two vectors
     * Optimized implementation for Float32Array and number[] types
     * @param a - First vector
     * @param b - Second vector
     * @returns Similarity score between 0 and 1
     * @private
     */
    calculateCosineSimilarity(a, b) {
        // Type safety checks
        if (!a || !b)
            return 0;
        if (a.length !== b.length) {
            // Instead of throwing, return 0 for better fault tolerance
            console.warn('Vectors must have the same dimensionality');
            return 0;
        }
        // For normalized vectors, cosine similarity is just the dot product
        if (this.embeddingConfig && this.embeddingConfig.normalize) {
            return this.dotProduct(a, b);
        }
        // For non-normalized vectors, calculate full cosine similarity
        const dotProduct = this.dotProduct(a, b);
        const magnitudeA = this.magnitude(a);
        const magnitudeB = this.magnitude(b);
        // Avoid division by zero
        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }
        return dotProduct / (magnitudeA * magnitudeB);
    }
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
    dotProduct(a, b) {
        // Type and null safety checks
        if (!a || !b)
            return 0;
        const len = Math.min(a.length, b.length);
        if (len === 0)
            return 0;
        // Optimization: Choose specialized implementation based on input types
        // This avoids type checking in the hot loop for better performance
        // Case 1: Both are Float32Array - fastest path
        if (a instanceof Float32Array && b instanceof Float32Array) {
            return this.dotProductFloat32(a, b, len);
        }
        // Case 2: First is Float32Array, second is number[]
        if (a instanceof Float32Array) {
            return this.dotProductMixed(a, b, len);
        }
        // Case 3: Second is Float32Array, first is number[]
        if (b instanceof Float32Array) {
            return this.dotProductMixed(b, a, len);
        }
        // Case 4: Both are number[] - fallback path
        return this.dotProductNumberArray(a, b, len);
    }
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
    toNumberArray(vector) {
        if (!vector)
            return [];
        if (vector instanceof Float32Array) {
            // Convert Float32Array to number[] with performance optimization
            // Use direct iteration instead of Array.from for better performance
            const length = vector.length;
            const result = new Array(length);
            // Using blocked copy for better cache utilization
            const blockSize = 16; // Optimal for most CPU cache lines
            let i = 0;
            // Process in blocks
            while (i + blockSize <= length) {
                for (let j = 0; j < blockSize; j++) {
                    result[i + j] = vector[i + j];
                }
                i += blockSize;
            }
            // Process remaining elements
            while (i < length) {
                result[i] = vector[i];
                i++;
            }
            return result;
        }
        return vector;
    }
    dotProductFloat32(a, b, len) {
        let sum = 0;
        const blockSize = 8; // Larger block size for Float32Array (SIMD-friendly)
        let i = 0;
        // Safety guard: check if both TypedArrays are properly defined
        if (!a || !b || len === 0)
            return 0;
        // Process in blocks of 8 for better vectorization
        // Type-specific optimization with null safety checks
        while (i + blockSize <= len) {
            // Fetch all values first with optional chaining to ensure safety
            const a0 = a[i] ?? 0;
            const a1 = a[i + 1] ?? 0;
            const a2 = a[i + 2] ?? 0;
            const a3 = a[i + 3] ?? 0;
            const a4 = a[i + 4] ?? 0;
            const a5 = a[i + 5] ?? 0;
            const a6 = a[i + 6] ?? 0;
            const a7 = a[i + 7] ?? 0;
            const b0 = b[i] ?? 0;
            const b1 = b[i + 1] ?? 0;
            const b2 = b[i + 2] ?? 0;
            const b3 = b[i + 3] ?? 0;
            const b4 = b[i + 4] ?? 0;
            const b5 = b[i + 5] ?? 0;
            const b6 = b[i + 6] ?? 0;
            const b7 = b[i + 7] ?? 0;
            // Perform multiplication after safe value extraction
            sum += (a0 * b0) + (a1 * b1) + (a2 * b2) + (a3 * b3) +
                (a4 * b4) + (a5 * b5) + (a6 * b6) + (a7 * b7);
            i += blockSize;
        }
        // Process remaining elements in smaller blocks with safety checks
        while (i + 4 <= len) {
            // Fetch values safely
            const a0 = a[i] ?? 0;
            const a1 = a[i + 1] ?? 0;
            const a2 = a[i + 2] ?? 0;
            const a3 = a[i + 3] ?? 0;
            const b0 = b[i] ?? 0;
            const b1 = b[i + 1] ?? 0;
            const b2 = b[i + 2] ?? 0;
            const b3 = b[i + 3] ?? 0;
            sum += (a0 * b0) + (a1 * b1) + (a2 * b2) + (a3 * b3);
            i += 4;
        }
        // Final elements with explicit safety checks
        while (i < len) {
            const aVal = a[i] ?? 0;
            const bVal = b[i] ?? 0;
            sum += aVal * bVal;
            i++;
        }
        return sum;
    }
    /**
     * Specialized dot product for number[] inputs
     * Includes additional null safety checks
     */
    dotProductNumberArray(a, b, len) {
        let sum = 0;
        const blockSize = 4; // Smaller block size with added safety checks
        let i = 0;
        // Process blocks with null safety
        while (i + blockSize <= len) {
            const a0 = a[i] ?? 0;
            const a1 = a[i + 1] ?? 0;
            const a2 = a[i + 2] ?? 0;
            const a3 = a[i + 3] ?? 0;
            const b0 = b[i] ?? 0;
            const b1 = b[i + 1] ?? 0;
            const b2 = b[i + 2] ?? 0;
            const b3 = b[i + 3] ?? 0;
            sum += (a0 * b0) + (a1 * b1) + (a2 * b2) + (a3 * b3);
            i += blockSize;
        }
        // Process remaining elements
        while (i < len) {
            sum += (a[i] ?? 0) * (b[i] ?? 0);
            i++;
        }
        return sum;
    }
    /**
     * Specialized dot product for mixed Float32Array and number[] inputs
     * Optimized for this specific case
     */
    dotProductMixed(float32Arr, numArr, len) {
        let sum = 0;
        const blockSize = 4;
        let i = 0;
        // Safety guard
        if (!float32Arr || !numArr || len === 0)
            return 0;
        // Process in blocks with comprehensive null checks for both arrays
        while (i + blockSize <= len) {
            // Extract all values first with null safety
            const a0 = float32Arr[i] ?? 0;
            const a1 = float32Arr[i + 1] ?? 0;
            const a2 = float32Arr[i + 2] ?? 0;
            const a3 = float32Arr[i + 3] ?? 0;
            const b0 = numArr[i] ?? 0;
            const b1 = numArr[i + 1] ?? 0;
            const b2 = numArr[i + 2] ?? 0;
            const b3 = numArr[i + 3] ?? 0;
            // Perform calculations with guaranteed safe values
            sum += (a0 * b0) + (a1 * b1) + (a2 * b2) + (a3 * b3);
            i += blockSize;
        }
        // Process remaining elements with explicit safety checks
        while (i < len) {
            const aVal = float32Arr[i] ?? 0;
            const bVal = numArr[i] ?? 0;
            sum += aVal * bVal;
            i++;
        }
        return sum;
    }
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
    magnitude(vector) {
        // Safety check for input
        if (!vector || vector.length === 0)
            return 0;
        let sum = 0;
        const length = vector.length;
        const blockSize = 4;
        let i = 0;
        // Process 4 elements at a time with loop unrolling for better performance
        while (i + blockSize <= length) {
            // Safe access with fallback to zero for potentially undefined values
            const v0 = vector[i] || 0;
            const v1 = vector[i + 1] || 0;
            const v2 = vector[i + 2] || 0;
            const v3 = vector[i + 3] || 0;
            // Square and add each component
            sum += v0 * v0 + v1 * v1 + v2 * v2 + v3 * v3;
            i += blockSize;
        }
        // Handle remaining elements individually
        while (i < length) {
            const val = vector[i] || 0;
            sum += val * val;
            i++;
        }
        return Math.sqrt(sum);
    }
    /**
     * Normalize a vector in-place to unit length
     * @param vector - Vector to normalize
     * @private
     */
    /**
     * Normalize a vector to unit length in-place with optimized implementation
     * Contains safety checks and type-specific handling for better performance
     */
    normalizeVector(vector) {
        // Safety check for input
        if (!vector || vector.length === 0)
            return;
        const mag = this.magnitude(vector);
        if (mag === 0)
            return; // Avoid division by zero
        // Calculate inverse magnitude once (multiplication is faster than division)
        const invMag = 1 / mag;
        const length = vector.length;
        // Type guard to ensure type safety and optimize for performance
        if (vector instanceof Float32Array) {
            // Use optimized loop unrolling for Float32Array
            const blockSize = 4;
            let i = 0;
            // Process blocks of 4 elements with loop unrolling
            // All elements in Float32Array are guaranteed to be numbers, but add safety checks
            while (i + blockSize <= length) {
                // Float32Array values are always defined, but add safety for TypeScript type checking
                if (i < length)
                    vector[i] = vector[i] * invMag;
                if (i + 1 < length)
                    vector[i + 1] = vector[i + 1] * invMag;
                if (i + 2 < length)
                    vector[i + 2] = vector[i + 2] * invMag;
                if (i + 3 < length)
                    vector[i + 3] = vector[i + 3] * invMag;
                i += blockSize;
            }
            // Handle remaining elements
            while (i < length) {
                if (i < length)
                    vector[i] = vector[i] * invMag;
                i++;
            }
        }
        else {
            // For regular number arrays, ensure safe access with explicit checks and optimal performance
            for (let i = 0; i < length; i++) {
                const value = vector[i];
                if (value !== undefined) {
                    vector[i] = value * invMag;
                }
            }
        }
    }
    /**
     * Search for knowledge chunks based on semantic similarity
     * Implements optimized vector search algorithms matching Python implementation
     * @param query - Text queries to search for
     * @param limit - Maximum number of results to return
     * @param filter - Optional filter to apply to the search
     * @param scoreThreshold - Minimum similarity score (0-1) to include in results
     * @returns Array of search results sorted by relevance
     */
    async search(query, limit = 3, filter, scoreThreshold = 0.35) {
        await this.ensureInitialized();
        if (!query || query.length === 0) {
            return [];
        }
        try {
            // Check cache for identical query
            const cacheKey = this.generateSearchCacheKey(query, limit, filter, scoreThreshold);
            const cachedResults = await this.queryCache.get(cacheKey);
            if (cachedResults !== undefined) {
                return cachedResults;
            }
            // Generate query embeddings
            const queryEmbeddings = await this.generateEmbeddings(query);
            if (!queryEmbeddings || queryEmbeddings.length === 0) {
                return [];
            }
            // Get all chunks that satisfy the filter
            let filteredChunks = Array.from(this.chunks.values());
            // Apply metadata filters if provided
            if (filter && Object.keys(filter).length > 0) {
                filteredChunks = this.applyFilter(filteredChunks, filter);
            }
            // Calculate similarity for each chunk against each query embedding
            // For multiple queries, we use the maximum similarity score
            const results = [];
            for (const chunk of filteredChunks) {
                if (!chunk.embedding)
                    continue;
                // Calculate maximum similarity across all query embeddings
                let maxScore = 0;
                for (const queryEmbedding of queryEmbeddings) {
                    // Convert embeddings to number[] for compatibility with all operations
                    const compatibleEmbedding = this.toNumberArray(chunk.embedding || []);
                    const compatibleQueryEmbedding = this.toNumberArray(queryEmbedding);
                    const score = this.calculateCosineSimilarity(compatibleQueryEmbedding, compatibleEmbedding);
                    maxScore = Math.max(maxScore, score);
                }
                // Only include results above the threshold
                if (maxScore >= scoreThreshold) {
                    results.push({
                        id: chunk.id,
                        context: chunk.content,
                        metadata: chunk.metadata || {},
                        score: maxScore
                    });
                }
            }
            // Sort by similarity score (descending)
            results.sort((a, b) => b.score - a.score);
            // Apply limit
            const limitedResults = limit > 0 ? results.slice(0, limit) : results;
            // Cache the results
            await this.queryCache.set(cacheKey, limitedResults);
            return limitedResults;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Knowledge search failed: ${errorMessage}`);
        }
    }
    /**
     * Generate embeddings for text using the configured embedding function
     * Implements optimized vector generation
     * @param texts - Array of texts to generate embeddings for
     * @returns Promise resolving to array of embeddings
     */
    async generateEmbeddings(texts) {
        if (!texts || texts.length === 0) {
            return [];
        }
        try {
            // If a custom embedding function is provided, use it
            if (this.embeddingConfig && this.embeddingConfig.embeddingFunction) {
                // Process texts in batches for better memory efficiency
                const BATCH_SIZE = 32; // Optimal batch size for embedding API calls
                const batches = this.createBatches(texts, BATCH_SIZE);
                const allEmbeddings = [];
                for (const batch of batches) {
                    const embeddingFunc = this.embeddingConfig.embeddingFunction;
                    // Safe mapping with null checks
                    const batchPromises = batch.map((text) => {
                        if (embeddingFunc) {
                            return embeddingFunc(text);
                        }
                        // Fallback if undefined (should never happen)
                        return Promise.resolve([]);
                    });
                    const batchEmbeddings = await Promise.all(batchPromises);
                    allEmbeddings.push(...batchEmbeddings);
                }
                // Ensure proper return type compatibility
                return allEmbeddings;
            }
            // For the TypeScript port, we'll return optimized dummy embeddings
            // In a real implementation, this would call an embedding API or local model
            const dimensions = this.embeddingConfig?.dimensions || DEFAULT_DIMENSIONS;
            const shouldNormalize = this.embeddingConfig?.normalize ?? true;
            // Pre-allocate the array of embeddings for better performance
            const embeddings = new Array(texts.length);
            for (let t = 0; t < texts.length; t++) {
                const embedding = new Array(dimensions).fill(0);
                const text = texts[t];
                // Use a deterministic embedding based on text hash for reproducibility
                // This is faster and more consistent than random values
                for (let i = 0; i < dimensions; i++) {
                    // Simple hash function to get deterministic values
                    const hashCode = this.simpleStringHash(`${text}-${i}`);
                    embedding[i] = (hashCode % 200 - 100) / 100; // Values between -1 and 1
                }
                // Normalize if configured
                if (shouldNormalize) {
                    this.normalizeVector(embedding);
                }
                embeddings[t] = embedding;
            }
            return embeddings;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to generate embeddings: ${errorMessage}`);
        }
    }
    /**
     * Simple hash function for strings that's fast and deterministic
     * @param text - Text to hash
     * @returns A numeric hash value
     */
    simpleStringHash(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }
    /**
     * Reset the storage (clear all data)
     */
    async reset() {
        await this.ensureInitialized();
        try {
            // Clear in-memory storage
            this.chunks.clear();
            // Clear query cache
            this.queryCache.clear();
            // In a real implementation, this would also clear the vector database
            console.log(`Knowledge storage reset for collection: ${this.collectionName}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to reset knowledge storage: ${errorMessage}`);
        }
    }
    /**
     * Delete specific chunks by ID
     * @param ids - Array of chunk IDs to delete
     */
    async deleteChunks(ids) {
        await this.ensureInitialized();
        if (!ids || ids.length === 0)
            return;
        try {
            // Delete chunks from in-memory storage
            for (const id of ids) {
                this.chunks.delete(id);
            }
            // Clear query cache since the knowledge base has changed
            this.queryCache.clear();
            // In a real implementation, this would also delete from the vector database
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to delete knowledge chunks: ${errorMessage}`);
        }
    }
    /**
     * Get chunks by ID
     * @param ids - Array of chunk IDs to retrieve
     * @returns Array of knowledge chunks
     */
    async getChunks(ids) {
        await this.ensureInitialized();
        if (!ids || ids.length === 0)
            return [];
        try {
            const chunks = [];
            for (const id of ids) {
                const chunk = this.chunks.get(id);
                if (chunk) {
                    chunks.push(chunk);
                }
            }
            return chunks;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to get knowledge chunks: ${errorMessage}`);
        }
    }
    /**
     * Get all chunks in the storage
     * @returns Array of all knowledge chunks
     */
    async getAllChunks() {
        await this.ensureInitialized();
        try {
            return Array.from(this.chunks.values());
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to get all knowledge chunks: ${errorMessage}`);
        }
    }
    /**
     * Create a new collection (if supported by the backend)
     * @param collectionName - Name of the collection to create
     */
    async createCollection(collectionName) {
        try {
            // Sanitize collection name
            const sanitizedName = sanitizeCollectionName(collectionName);
            console.log(`Creating collection: ${sanitizedName}`);
            // In a real implementation, this would create a new collection in the vector database
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to create collection: ${errorMessage}`);
        }
    }
    /**
     * Delete a collection (if supported by the backend)
     * @param collectionName - Name of the collection to delete
     */
    async deleteCollection(collectionName) {
        try {
            // Sanitize collection name
            const sanitizedName = sanitizeCollectionName(collectionName);
            console.log(`Deleting collection: ${sanitizedName}`);
            // If we're deleting the current collection, reset our storage
            if (sanitizedName === this.collectionName) {
                await this.reset();
            }
            // In a real implementation, this would delete the collection from the vector database
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to delete collection: ${errorMessage}`);
        }
    }
    /**
     * List all collections (if supported by the backend)
     * @returns Array of collection names
     */
    async listCollections() {
        try {
            // In a real implementation, this would list collections from the vector database
            // For now, just return the current collection
            return [this.collectionName];
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to list collections: ${errorMessage}`);
        }
    }
    /**
     * Close the storage connection and release resources
     */
    async close() {
        try {
            // Clear in-memory storage to free up resources
            this.chunks.clear();
            this.queryCache.clear();
            // Mark as uninitialized
            this.initialized = false;
            // In a real implementation, this would close connections to the vector database
            console.log(`Closed knowledge storage for collection: ${this.collectionName}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to close knowledge storage: ${errorMessage}`);
        }
    }
}
//# sourceMappingURL=KnowledgeStorage.js.map