/**
 * Knowledge Storage Implementation
 * Provides optimized vector storage and retrieval with caching
 */

import { BaseKnowledgeStorage } from './BaseKnowledgeStorage.js';
import { 
  KnowledgeChunk, 
  KnowledgeFilter, 
  KnowledgeSearchResult, 
  EmbedderConfig,
  KnowledgeStorageOptions 
} from '../types.js';
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
function sanitizeCollectionName(name: string): string {
  // Replace characters that might cause issues with databases
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

/**
 * Generate a deterministic ID for content deduplication
 * @param content - Content to generate ID from
 * @returns Unique ID
 */
function generateContentId(content: string): string {
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
  private collectionName: string;

  /**
   * Whether the storage has been initialized
   * @private
   */
  private initialized = false;

  /**
   * Tiered storage implementation with hot/warm/cold access patterns
   * - hotCache: Most frequently accessed chunks for immediate access
   * - warmStorage: Recently accessed chunks still kept in memory
   * - coldStorage: All chunks (complete collection)
   * @private
   */
  private hotCache = new Map<string, KnowledgeChunk>(); // Frequently accessed
  private warmStorage = new Map<string, KnowledgeChunk>(); // Recently accessed
  private coldStorage = new Map<string, KnowledgeChunk>(); // Complete collection
  
  /**
   * Access frequency tracking for implementing LFU (Least Frequently Used) policy
   * @private
   */
  private accessFrequency = new Map<string, number>();
  
  /**
   * Content hash map for fast content-based deduplication
   * Maps content hash to chunk ID
   * @private
   */
  private contentHashMap = new Map<string, string>();

  /**
   * Cache for query results with LRU eviction
   * @private
   */
  private queryCache: Cache<KnowledgeSearchResult[]>;

  /**
   * Embedding configuration
   * @private
   */
  private embeddingConfig: Required<EmbedderConfig> & {
    embeddingFunction: ((text: string) => Promise<number[] | Float32Array>) | null;
  };

  /**
   * Memory-mapped database client (to be initialized)
   * @private
   */
  private dbClient: any = null;

  /**
   * Database collection reference (to be initialized)
   * @private
   */
  private collection: any = null;

  /**
   * Constructor for KnowledgeStorage
   * @param options - Configuration options
   */
  constructor(options: KnowledgeStorageOptions = {}) {
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
    } as Required<EmbedderConfig>;

    // Initialize query cache
    this.queryCache = new Cache<KnowledgeSearchResult[]>({
      maxSize: 100,  // Maximum number of cached queries
      ttl: 3600000   // 1 hour TTL
    });
  }

  /**
   * Initialize the storage backend
   * This performs database connection and collection setup
   */
  async initialize(): Promise<void> {
    try {
      // Check if already initialized
      if (this.initialized) return;

      // Placeholder for database initialization
      // In a real implementation, this would initialize chromadb or another vector database
      // For this TypeScript port, we'll simulate vector storage in memory
      // with the necessary interfaces for a complete implementation

      console.log(`Initializing knowledge storage with collection: ${this.collectionName}`);

      // Mark as initialized
      this.initialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize knowledge storage: ${errorMessage}`);
    }
  }

  /**
   * Add a single knowledge chunk to the storage
   * Implements optimized storage with content deduplication
   * @param chunk - Knowledge chunk to add
   */
  async addChunk(chunk: KnowledgeChunk): Promise<void> {
    await this.ensureInitialized();
    
    try {
      // Skip if content is missing
      if (!chunk.content) {
        console.warn('Skipping chunk with no content');
        return;
      }
      
      // Generate content hash for deduplication
      const contentHash = this.generateContentHash(chunk.content);
      
      // Check for existing content
      const existingId = this.contentHashMap.get(contentHash);
      if (existingId) {
        // Content already exists, we can skip this chunk
        console.debug(`Skipping duplicate content with hash ${contentHash}`);
        return;
      }
      
      // Generate embeddings if not already present
      if (!chunk.embedding) {
        const embeddings = await this.generateEmbeddings([chunk.content]);
        if (embeddings && embeddings.length > 0) {
          chunk.embedding = embeddings[0];
        }
      }

      // Ensure chunk has an ID
      if (!chunk.id) {
        chunk.id = generateContentId(chunk.content);
      }

      // Store content hash mapping for future deduplication
      this.contentHashMap.set(contentHash, chunk.id);
      
      // Store in cold storage (complete collection)
      this.coldStorage.set(chunk.id, chunk);
      
      // Clear query cache for this specific chunk
      this.queryCache.delete(chunk.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to add knowledge chunk: ${errorMessage}`);
    }
  }

  /**
   * Add multiple knowledge chunks in a batch operation
   * Implements optimized batch processing for better performance
   * with content deduplication and tiered storage
   * @param chunks - Array of knowledge chunks to add
   */
  async addChunks(chunks: KnowledgeChunk[]): Promise<void> {
    await this.ensureInitialized();
    
    if (!chunks || chunks.length === 0) return;
    
    try {
      // Process chunks in optimal batch sizes for better performance
      const BATCH_SIZE = 100; // Optimal batch size for vector operations
      const batches = this.createBatches(chunks, BATCH_SIZE);
      
      // Track statistics for performance monitoring
      let totalChunks = 0;
      let uniqueChunks = 0;
      let duplicateChunks = 0;
      
      // Content hash set for deduplication within this batch operation
      const processedContentHashes = new Set<string>();
      
      for (const batch of batches) {
        // Step 1: Perform content-based deduplication and prepare chunks needing embeddings
        const dedupedBatch: KnowledgeChunk[] = [];
        const chunksNeedingEmbeddings: string[] = [];
        const chunkIndices: number[] = [];
        
        for (const chunk of batch) {
          totalChunks++;
          
          if (!chunk.content) {
            // Skip chunks with no content
            continue;
          }
          
          // Generate content hash for deduplication
          const contentHash = this.generateContentHash(chunk.content);
          
          // Check for existing content in our global map
          const existingId = this.contentHashMap.get(contentHash);
          if (existingId) {
            // Duplicate content detected, skip this chunk
            duplicateChunks++;
            continue;
          }
          
          // Check for duplicates within this batch
          if (processedContentHashes.has(contentHash)) {
            duplicateChunks++;
            continue;
          }
          
          // Mark as processed to avoid duplicates within this batch
          processedContentHashes.add(contentHash);
          
          // Ensure chunk has an ID
          if (!chunk.id) {
            chunk.id = generateContentId(chunk.content);
          }
          
          // Store content hash mapping for future deduplication
          this.contentHashMap.set(contentHash, chunk.id);
          
          // Add to deduped batch
          dedupedBatch.push(chunk);
          uniqueChunks++;
          
          // Check if this chunk needs an embedding
          if (!chunk.embedding) {
            chunksNeedingEmbeddings.push(chunk.content);
            chunkIndices.push(dedupedBatch.length - 1);
          }
        }
        
        // Step 2: Generate embeddings in a single batch for better performance
        if (chunksNeedingEmbeddings.length > 0) {
          const embeddings = await this.generateEmbeddings(chunksNeedingEmbeddings);
          
          // Assign embeddings to the corresponding chunks
          for (let i = 0; i < chunkIndices.length && i < embeddings.length; i++) {
            const index = chunkIndices[i];
            // Extra safety check to ensure index is valid
            if (typeof index === 'number' && index >= 0 && index < dedupedBatch.length) {
                  // Type assertion to ensure safe usage
              const embedding = embeddings[i];
              const targetChunk = dedupedBatch[index];
              if (Array.isArray(embedding) && targetChunk) {
                targetChunk.embedding = embedding;
              }
            }
          }
        }
        
        // Step 3: Store chunks in tiered storage
        for (const chunk of dedupedBatch) {
          // Add to cold storage (complete collection)
          this.coldStorage.set(chunk.id, chunk);
        }
      }
      
      // Clear query cache since the knowledge base has changed
      this.queryCache.clear();
      
      console.log(`Knowledge batch processing: Added ${uniqueChunks} unique chunks out of ${totalChunks} total (${duplicateChunks} duplicates removed)`);
    } catch (error) {
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
  private async ensureInitialized(): Promise<void> {
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
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
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
  private generateSearchCacheKey(
    queries: string[],
    limit: number,
    filter?: KnowledgeFilter,
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
   * Apply metadata filters to chunks
   * @param chunks - Array of chunks to filter
   * @param filter - Filter to apply
   * @returns Filtered chunks
   * @private
   */
  private applyFilter(chunks: KnowledgeChunk[], filter: KnowledgeFilter): KnowledgeChunk[] {
    return chunks.filter(chunk => {
      // If chunk has no metadata or metadata is empty, it can't match any filter
      if (!chunk.metadata || Object.keys(chunk.metadata).length === 0) {
        return false;
      }

      // Check if all filter conditions are met
      return Object.entries(filter).every(([key, value]) => {
        // Handle nested filters with dot notation (e.g., 'author.name')
        const keys = key.split('.');
        let currentValue: any = chunk.metadata;

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
            ? propValue.some((v: any) => value.includes(v))
            : value.includes(propValue);
        } else if (typeof value === 'object' && value !== null) {
          // Handle range queries or complex objects
          // Special case for ranges with $gt, $lt, etc.
          const typedValue = value as Record<string, any>;
          if ('$gt' in typedValue && propValue <= typedValue.$gt) return false;
          if ('$lt' in typedValue && propValue >= typedValue.$lt) return false;
          if ('$gte' in typedValue && propValue < typedValue.$gte) return false;
          if ('$lte' in typedValue && propValue > typedValue.$lte) return false;
          if ('$ne' in typedValue && propValue === typedValue.$ne) return false;
          return true;
        } else {
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
  private calculateCosineSimilarity(
    a: Float32Array | number[],
    b: Float32Array | number[]
  ): number {
    // Type safety checks
    if (!a || !b) return 0;
    
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
  private dotProduct(a: Float32Array | number[], b: Float32Array | number[]): number {
    // Type and null safety checks
    if (!a || !b) return 0;
    
    const len = Math.min(a.length, b.length);
    if (len === 0) return 0;
    
    // Optimization: Choose specialized implementation based on input types
    // This avoids type checking in the hot loop for better performance
    
    // Case 1: Both are Float32Array - fastest path
    if (a instanceof Float32Array && b instanceof Float32Array) {
      return this.dotProductFloat32(a, b, len);
    }
    
    // Case 2: First is Float32Array, second is number[]
    if (a instanceof Float32Array) {
      return this.dotProductMixed(a, b as number[], len);
    }
    
    // Case 3: Second is Float32Array, first is number[]
    if (b instanceof Float32Array) {
      return this.dotProductMixed(b, a as number[], len);
    }
    
    // Case 4: Both are number[] - fallback path
    return this.dotProductNumberArray(a as number[], b as number[], len);
  }
  
  /**
   * Type guard to check if an object is a valid KnowledgeChunk
   * This ensures type safety when working with potentially unknown types
   * @param obj The object to check
   * @returns True if the object is a valid KnowledgeChunk
   */
  private isKnowledgeChunk(obj: unknown): obj is KnowledgeChunk {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      'id' in obj &&
      typeof (obj as KnowledgeChunk).id === 'string' &&
      'content' in obj &&
      typeof (obj as KnowledgeChunk).content === 'string'
    );
  }

  /**
   * Specialized dot product for Float32Array inputs
   * Uses aggressive loop unrolling with SIMD-friendly operations
   */
  /**
   * Convert any vector type to a standard number array for compatibility
   * Implements optimized conversion with cache utilization
   * @param vector Input vector as Float32Array, number[] or unknown
   * @returns Standard number array representation
   */
  private toNumberArray(vector: Float32Array | number[] | unknown): number[] {
    if (!vector) return [];
    
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
    
    // Handle Array input with proper type safety
    if (Array.isArray(vector)) {
      // For regular arrays, ensure all elements are numbers with optimal type conversion
      const length = vector.length;
      const result = new Array<number>(length);
      
      // Manual unrolling for better performance on modern CPUs
      // This optimization improves vectorization opportunities
      const blockSize = 8;
      let i = 0;
    
      // Process blocks of 8 elements at once
      while (i + blockSize <= length) {
        // Explicit type conversion for each element
        result[i] = typeof vector[i] === 'number' ? vector[i] as number : Number(vector[i]);
        result[i+1] = typeof vector[i+1] === 'number' ? vector[i+1] as number : Number(vector[i+1]);
        result[i+2] = typeof vector[i+2] === 'number' ? vector[i+2] as number : Number(vector[i+2]);
        result[i+3] = typeof vector[i+3] === 'number' ? vector[i+3] as number : Number(vector[i+3]);
        result[i+4] = typeof vector[i+4] === 'number' ? vector[i+4] as number : Number(vector[i+4]);
        result[i+5] = typeof vector[i+5] === 'number' ? vector[i+5] as number : Number(vector[i+5]);
        result[i+6] = typeof vector[i+6] === 'number' ? vector[i+6] as number : Number(vector[i+6]);
        result[i+7] = typeof vector[i+7] === 'number' ? vector[i+7] as number : Number(vector[i+7]);
        i += blockSize;
      }
    
      // Process remaining elements
      while (i < length) {
        result[i] = typeof vector[i] === 'number' ? vector[i] as number : Number(vector[i]);
        i++;
      }
      
      return result;
    }
  
    // Default case: return empty array for unrecognized input types
    return [];
  }
  
  private dotProductFloat32(a: Float32Array, b: Float32Array, len: number): number {
    let sum = 0;
    const blockSize = 8; // Larger block size for Float32Array (SIMD-friendly)
    let i = 0;
    
    // Safety guard: check if both TypedArrays are properly defined
    if (!a || !b || len === 0) return 0;
    
    // Process in blocks of 8 for better vectorization
    // Type-specific optimization with null safety checks
    while (i + blockSize <= len) {
      // Fetch all values first with optional chaining to ensure safety
      const a0 = a[i] ?? 0;
      const a1 = a[i+1] ?? 0;
      const a2 = a[i+2] ?? 0;
      const a3 = a[i+3] ?? 0;
      const a4 = a[i+4] ?? 0;
      const a5 = a[i+5] ?? 0;
      const a6 = a[i+6] ?? 0;
      const a7 = a[i+7] ?? 0;
      
      const b0 = b[i] ?? 0;
      const b1 = b[i+1] ?? 0;
      const b2 = b[i+2] ?? 0;
      const b3 = b[i+3] ?? 0;
      const b4 = b[i+4] ?? 0;
      const b5 = b[i+5] ?? 0;
      const b6 = b[i+6] ?? 0;
      const b7 = b[i+7] ?? 0;
      
      // Perform multiplication after safe value extraction
      sum += (a0 * b0) + (a1 * b1) + (a2 * b2) + (a3 * b3) + 
             (a4 * b4) + (a5 * b5) + (a6 * b6) + (a7 * b7);
      
      i += blockSize;
    }
    
    // Process remaining elements in smaller blocks with safety checks
    while (i + 4 <= len) {
      // Fetch values safely
      const a0 = a[i] ?? 0;
      const a1 = a[i+1] ?? 0;
      const a2 = a[i+2] ?? 0;
      const a3 = a[i+3] ?? 0;
      
      const b0 = b[i] ?? 0;
      const b1 = b[i+1] ?? 0;
      const b2 = b[i+2] ?? 0;
      const b3 = b[i+3] ?? 0;
      
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
  private dotProductNumberArray(a: number[], b: number[], len: number): number {
    let sum = 0;
    const blockSize = 4; // Smaller block size with added safety checks
    let i = 0;
    
    // Process blocks with null safety
    while (i + blockSize <= len) {
      const a0 = a[i] ?? 0;
      const a1 = a[i+1] ?? 0;
      const a2 = a[i+2] ?? 0;
      const a3 = a[i+3] ?? 0;
      
      const b0 = b[i] ?? 0;
      const b1 = b[i+1] ?? 0;
      const b2 = b[i+2] ?? 0;
      const b3 = b[i+3] ?? 0;
      
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
  private dotProductMixed(float32Arr: Float32Array, numArr: number[], len: number): number {
    let sum = 0;
    const blockSize = 4;
    let i = 0;
    
    // Safety guard
    if (!float32Arr || !numArr || len === 0) return 0;
    
    // Process in blocks with comprehensive null checks for both arrays
    while (i + blockSize <= len) {
      // Extract all values first with null safety
      const a0 = float32Arr[i] ?? 0;
      const a1 = float32Arr[i+1] ?? 0;
      const a2 = float32Arr[i+2] ?? 0;
      const a3 = float32Arr[i+3] ?? 0;
      
      const b0 = numArr[i] ?? 0;
      const b1 = numArr[i+1] ?? 0;
      const b2 = numArr[i+2] ?? 0;
      const b3 = numArr[i+3] ?? 0;
      
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
  private magnitude(vector: Float32Array | number[]): number {
    // Safety check for input
    if (!vector || vector.length === 0) return 0;
    
    let sum = 0;
    const length = vector.length;
    const blockSize = 4;
    let i = 0;
    
    // Process 4 elements at a time with loop unrolling for better performance
    while (i + blockSize <= length) {
      // Safe access with fallback to zero for potentially undefined values
      const v0 = vector[i] || 0;
      const v1 = vector[i+1] || 0;
      const v2 = vector[i+2] || 0;
      const v3 = vector[i+3] || 0;
      
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
  private normalizeVector(vector: Float32Array | number[]): void {
    // Safety check for input
    if (!vector || vector.length === 0) return;
    
    const mag = this.magnitude(vector);
    if (mag === 0) return; // Avoid division by zero
    
    // Calculate inverse magnitude once (multiplication is faster than division)
    const invMag = 1 / mag;
    const length = vector.length;
    
    // Type guard to ensure type safety and optimize for performance
    if (vector instanceof Float32Array) {
      // Using type-safe manual unrolling for performance optimization
      // Process blocks of 4 elements at a time for better CPU cache utilization
      // This approach maintains both type safety and performance
      
      // Pre-compute loop bounds for optimization
      const blockSize = 4;
      const blockLoopLimit = length - (length % blockSize);
      
      // Optimized block processing with safe bounds checking
      for (let i = 0; i < blockLoopLimit; i += blockSize) {
        // TypeScript needs type assertions to recognize that these operations are safe
        // Type assertions eliminate lint errors while maintaining optimized memory layout
        vector[i] = Number(vector[i]) * invMag;
        vector[i+1] = Number(vector[i+1]) * invMag;
        vector[i+2] = Number(vector[i+2]) * invMag;
        vector[i+3] = Number(vector[i+3]) * invMag;
      }
      
      // Safe processing for remaining elements with explicit bounds check
      for (let i = blockLoopLimit; i < length; i++) {
        vector[i] = Number(vector[i]) * invMag;
      }
    } else {
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
  async search(
    query: string[],
    limit: number = 3,
    filter?: KnowledgeFilter,
    scoreThreshold: number = 0.35
  ): Promise<KnowledgeSearchResult[]> {
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
      // Get all chunks from coldStorage which contains the complete collection
      let filteredChunks = Array.from(this.coldStorage.values());
      
      // Apply metadata filters if provided
      if (filter && Object.keys(filter).length > 0) {
        filteredChunks = this.applyFilter(filteredChunks, filter);
      }
      
      // Calculate similarity for each chunk against each query embedding
      // For multiple queries, we use the maximum similarity score
      const results: KnowledgeSearchResult[] = [];
      
      // Ensure we're working with properly typed KnowledgeChunks
      for (const chunk of filteredChunks) {
        // Type guard to ensure we're working with KnowledgeChunk
        if (!this.isKnowledgeChunk(chunk) || !chunk.embedding) continue;
        
        // Calculate maximum similarity across all query embeddings
        let maxScore = 0;
        for (const queryEmbedding of queryEmbeddings) {
          // Convert embeddings to strongly-typed number[] for compatibility with all operations
          // This preserves both type safety and performance optimizations
          const compatibleEmbedding = this.toNumberArray(chunk.embedding);
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
    } catch (error) {
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
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }
    
    try {
      // If a custom embedding function is provided, use it
      if (this.embeddingConfig && this.embeddingConfig.embeddingFunction) {
        // Process texts in batches for better memory efficiency
        const BATCH_SIZE = 32; // Optimal batch size for embedding API calls
        const batches = this.createBatches(texts, BATCH_SIZE);
        const allEmbeddings: number[][] = [];
        
        for (const batch of batches) {
          const embeddingFunc = this.embeddingConfig.embeddingFunction;
          // Safe mapping with null checks
          const batchPromises = batch.map((text: string) => {
            if (embeddingFunc) {
              return embeddingFunc(text).then(result => {
                // Convert Float32Array to number[] if needed
                return Array.isArray(result) ? result : Array.from(result);
              });
            }
            // Fallback if undefined (should never happen)
            return Promise.resolve([] as number[]);
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
      const embeddings: number[][] = new Array(texts.length);
      
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate embeddings: ${errorMessage}`);
    }
  }
  
  /**
   * Simple hash function for strings that's fast and deterministic
   * @param text - Text to hash
   * @returns A numeric hash value
   */
  private simpleStringHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Generate a content hash for deduplication
   * Uses a fast algorithm optimized for memory efficiency
   * @param content - Content to hash
   * @returns Hash string
   * @private
   */
  private generateContentHash(content: string): string {
    // Simple but fast hashing algorithm for content-based IDs
    let hash = 0;
    // Use only the first 1000 characters for faster processing of large content
    const sampleContent = content.substring(0, 1000);
    
    for (let i = 0; i < sampleContent.length; i++) {
      const char = sampleContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${Math.abs(hash).toString(16)}`;
  }

  /**
   * Reset the storage (clear all data)
   */
  async reset(): Promise<void> {
    await this.ensureInitialized();
    
    try {
      // Clear all tiered storage structures
      this.hotCache.clear();
      this.warmStorage.clear();
      this.coldStorage.clear();
      this.contentHashMap.clear();
      this.accessFrequency.clear();
      
      // Clear query cache
      this.queryCache.clear();
      
      // In a real implementation, this would also clear the vector database
      
      console.log(`Knowledge storage reset for collection: ${this.collectionName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to reset knowledge storage: ${errorMessage}`);
    }
  }
  
  /**
   * Delete specific chunks by ID
   * @param ids - Array of chunk IDs to delete
   */
  async deleteChunks(ids: string[]): Promise<void> {
    await this.ensureInitialized();
    
    if (!ids || ids.length === 0) return;
    
    try {
      // Delete chunks from all storage tiers
      for (const id of ids) {
        // Get the chunk from cold storage to check its content hash
        const chunk = this.coldStorage.get(id);
        if (chunk && chunk.content) {
          // Remove content hash mapping for better garbage collection
          const contentHash = this.generateContentHash(chunk.content);
          this.contentHashMap.delete(contentHash);
        }
        
        // Remove from all tiers
        this.hotCache.delete(id);
        this.warmStorage.delete(id);
        this.coldStorage.delete(id);
        
        // Clean up access frequency tracking
        this.accessFrequency.delete(id);
      }
      
      // Clear query cache since the knowledge base has changed
      this.queryCache.clear();
      
      // In a real implementation, this would also delete from the vector database
      console.log(`Deleted ${ids.length} chunks from collection ${this.collectionName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete knowledge chunks: ${errorMessage}`);
    }
  }
  
  /**
   * Get chunks by ID with tiered access patterns
   * Implements optimized fetching strategy with memory-efficient batch processing
   * @param ids - Array of chunk IDs to retrieve
   * @returns Array of knowledge chunks
   */
  async getChunks(ids: string[]): Promise<KnowledgeChunk[]> {
    await this.ensureInitialized();
    
    if (!ids || ids.length === 0) return [];
    
    try {
      // Use Maps for O(1) lookups and better memory efficiency
      const resultMap = new Map<string, KnowledgeChunk>();
      const missingIds = new Set<string>();
      
      // Filter out invalid IDs
      const validIds = ids.filter(id => id !== null && id !== undefined);
      
      // OPTIMIZATION: Process in batches for better memory usage with large ID arrays
      const BATCH_SIZE = 500;
      const batchCount = Math.ceil(validIds.length / BATCH_SIZE);
      
      for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, validIds.length);
        const batchIds = validIds.slice(startIdx, endIdx);
        
        // OPTIMIZATION: First pass - check hot cache (fastest) with minimal processing
        for (const id of batchIds) {
          const chunk = this.hotCache.get(id);
          if (chunk) {
            // Hot cache hit - increment counter and add to results
            const currentFreq = this.accessFrequency.get(id) || 0;
            this.accessFrequency.set(id, currentFreq + 1);
            resultMap.set(id, chunk);
          } else {
            // Not in hot cache - track for next pass
            missingIds.add(id);
          }
        }
        
        // OPTIMIZATION: Second pass - only check warm storage for IDs not in hot cache
        const coldIds = new Set<string>();
        for (const id of missingIds) {
          const chunk = this.warmStorage.get(id);
          if (chunk) {
            // Update access metrics
            const currentFreq = this.accessFrequency.get(id) || 0;
            const newFreq = currentFreq + 1;
            this.accessFrequency.set(id, newFreq);
            
            // OPTIMIZATION: Promote to hot cache if frequently accessed
            if (newFreq >= 3) {
              this.hotCache.set(id, chunk);
              // Keep hot cache optimized for performance
              this.manageHotCacheSize();
            }
            
            resultMap.set(id, chunk);
            missingIds.delete(id);
          } else {
            // Mark for cold storage check
            coldIds.add(id);
          }
        }
        
        // OPTIMIZATION: Final pass - only check cold storage for remaining IDs
        for (const id of coldIds) {
          const chunk = this.coldStorage.get(id);
          if (chunk) {
            // Update metrics
            const currentFreq = this.accessFrequency.get(id) || 0;
            const newFreq = currentFreq + 1;
            this.accessFrequency.set(id, newFreq);
            
            // OPTIMIZATION: Always promote from cold to warm storage on access
            this.warmStorage.set(id, chunk);
            
            // OPTIMIZATION: Direct promotion to hot cache if frequently accessed
            if (newFreq >= 3) {
              this.hotCache.set(id, chunk);
              this.manageHotCacheSize();
            }
            
            resultMap.set(id, chunk);
            missingIds.delete(id);
          }
        }
      }
      
      // Preserve original order of IDs in the result array with type safety
      // First filter ensures we only process valid IDs that have results
      // Map with type guard ensures we don't need non-null assertions
      return validIds
        .filter(id => typeof id === 'string' && resultMap.has(id))
        .map(id => {
          // Since we filtered for existence above, this is guaranteed to be defined
          // But we'll add a fallback for complete type safety
          const chunk = resultMap.get(id);
          return chunk || null;
        })
        .filter((chunk): chunk is KnowledgeChunk => chunk !== null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get knowledge chunks: ${errorMessage}`);
    }
  }
  
  /**
   * Manage hot cache size to maintain performance
   * Uses LFU (Least Frequently Used) eviction policy with memory optimization
   * @private
   */
  private manageHotCacheSize(): void {
    const MAX_HOT_CACHE_SIZE = 100; // Optimal size for performance
    
    // Early exit if cache size is within limits
    if (this.hotCache.size <= MAX_HOT_CACHE_SIZE) {
      return;
    }
    
    // Create frequency buckets for more efficient eviction
    // This approach is faster than full sorting for large caches
    const frequencyBuckets: Map<number, string[]> = new Map();
    let minFrequency = Number.MAX_SAFE_INTEGER;
    
    // Organize items by access frequency
    for (const id of this.hotCache.keys()) {
      if (typeof id === 'string') { // Type safety check
        const frequency = this.accessFrequency.get(id) || 0;
        
        // Track minimum frequency for quick eviction
        minFrequency = Math.min(minFrequency, frequency);
        
        // Add to appropriate frequency bucket
        const bucket = frequencyBuckets.get(frequency) || [];
        bucket.push(id);
        frequencyBuckets.set(frequency, bucket);
      }
    }
    
    // Calculate number of items to remove (20% of max size)
    const removeCount = Math.ceil(MAX_HOT_CACHE_SIZE * 0.2);
    let removedCount = 0;
    
    // Start removing from lowest frequency bucket
    let currentFrequency = minFrequency;
    
    while (removedCount < removeCount && frequencyBuckets.size > 0) {
      const bucket = frequencyBuckets.get(currentFrequency);
      
      if (bucket && bucket.length > 0) {
        // Remove items from current frequency bucket
        while (bucket.length > 0 && removedCount < removeCount) {
          const id = bucket.pop();
          if (id) { // Type safety check
            this.hotCache.delete(id);
            removedCount++;
          }
        }
        
        // Clean up empty buckets
        if (bucket.length === 0) {
          frequencyBuckets.delete(currentFrequency);
        }
      } else {
        // Move to next frequency level if current bucket is empty
        frequencyBuckets.delete(currentFrequency);
        currentFrequency++;
      }
    }
  }
  
  /**
   * Get all chunks in the storage
   * @returns Array of all knowledge chunks
   */
  async getAllChunks(): Promise<KnowledgeChunk[]> {
    await this.ensureInitialized();
    
    try {
      // Return all chunks from cold storage (complete collection)
      return Array.from(this.coldStorage.values());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get all knowledge chunks: ${errorMessage}`);
    }
  }
  
  /**
   * Create a new collection (if supported by the backend)
   * @param collectionName - Name of the collection to create
   */
  async createCollection(collectionName: string): Promise<void> {
    try {
      // Sanitize collection name
      const sanitizedName = sanitizeCollectionName(collectionName);
      
      console.log(`Creating collection: ${sanitizedName}`);
      
      // In a real implementation, this would create a new collection in the vector database
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create collection: ${errorMessage}`);
    }
  }
  
  /**
   * Delete a collection (if supported by the backend)
   * @param collectionName - Name of the collection to delete
   */
  async deleteCollection(collectionName: string): Promise<void> {
    try {
      // Sanitize collection name
      const sanitizedName = sanitizeCollectionName(collectionName);
      
      console.log(`Deleting collection: ${sanitizedName}`);
      
      // If we're deleting the current collection, reset our storage
      if (sanitizedName === this.collectionName) {
        await this.reset();
      }
      
      // In a real implementation, this would delete the collection from the vector database
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete collection: ${errorMessage}`);
    }
  }
  
  /**
   * List all collections (if supported by the backend)
   * @returns Array of collection names
   */
  async listCollections(): Promise<string[]> {
    try {
      // In a real implementation, this would list collections from the vector database
      // For now, just return the current collection
      return [this.collectionName];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list collections: ${errorMessage}`);
    }
  }
  
  /**
   * Close the storage connection and release resources
   */
  async close(): Promise<void> {
    try {
      // Clear all storage tiers to free up resources
      this.hotCache.clear();
      this.warmStorage.clear();
      this.coldStorage.clear();
      this.contentHashMap.clear();
      this.accessFrequency.clear();
      this.queryCache.clear();
      
      // Mark as uninitialized
      this.initialized = false;
      
      // In a real implementation, this would close connections to the vector database
      console.log(`Closed knowledge storage for collection: ${this.collectionName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to close knowledge storage: ${errorMessage}`);
    }
  }
}
