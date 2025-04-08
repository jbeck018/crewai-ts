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
export class ContextualMemory {
  // Storage for memory items with optimized lookup
  private items: Map<string, MemoryItem> = new Map();
  
  // Metadata index for fast searching
  private metadataIndex: Map<string, Set<string>> = new Map();
  
  // Query cache for optimized repeat access patterns
  private queryCache: Map<string, { result: any, timestamp: number }> = new Map();
  
  // Performance metrics tracking
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    averageQueryTimeMs: 0,
    totalQueries: 0
  };
  
  // Cache TTL in milliseconds
  private readonly cacheTTL: number = 5 * 60 * 1000; // 5 minutes default
  
  /**
   * Creates a new ContextualMemory instance with the specified options
   * @param options Configuration options for memory management
   */
  constructor(private options: ContextualMemoryOptions = {}) {
    // Apply defaults and overrides
    this.cacheTTL = options.cacheTTL || this.cacheTTL;
    
    // Set up automatic cache cleanup
    if (options.autoCacheCleanup !== false) {
      // Schedule cleanup every minute to prevent memory leaks
      setInterval(() => this.cleanCache(), 60 * 1000);
    }
  }
  
  /**
   * Add a memory item to the store with efficient indexing
   * @param id Unique identifier for the memory item
   * @param content The content of the memory item
   * @param metadata Optional metadata for improved retrievability
   * @returns The ID of the added memory item
   */
  async add(id: string, content: string, metadata: Record<string, any> = {}): Promise<string> {
    // Create the memory item with timestamp
    const item: MemoryItem = {
      id,
      content,
      metadata,
      timestamp: Date.now()
    };
    
    // Store the item in main storage
    this.items.set(id, item);
    
    // Index metadata for fast retrieval
    this.indexMetadata(id, metadata);
    
    // Clear query cache to ensure fresh results
    this.queryCache.clear();
    
    return id;
  }
  
  /**
   * Retrieve a memory item by ID with cache optimization
   * @param id The ID of the memory item to retrieve
   * @returns The memory item or null if not found
   */
  async get(id: string): Promise<MemoryItem | null> {
    // Start performance tracking
    const startTime = Date.now();
    
    // Check cache first for optimization
    const cacheKey = `get:${id}`;
    const cached = this.getCachedResult(cacheKey);
    
    if (cached !== null) {
      // Track cache hit
      this.metrics.cacheHits++;
      return cached as MemoryItem;
    }
    
    // Cache miss - retrieve from storage
    this.metrics.cacheMisses++;
    const item = this.items.get(id) || null;
    
    // Update cache with result
    this.cacheResult(cacheKey, item);
    
    // Update performance metrics
    this.updateQueryMetrics(startTime);
    
    return item;
  }
  
  /**
   * Delete a memory item with efficient cleanup
   * @param id The ID of the memory item to delete
   * @returns True if the item was deleted, false otherwise
   */
  async delete(id: string): Promise<boolean> {
    // Check if item exists
    const item = this.items.get(id);
    if (!item) {
      return false;
    }
    
    // Remove from main storage
    this.items.delete(id);
    
    // Remove from metadata index
    this.removeFromMetadataIndex(id, item.metadata);
    
    // Clear related cache entries
    this.queryCache.clear();
    
    return true;
  }
  
  /**
   * Search for memory items by metadata with performance optimizations
   * @param metadata The metadata to search for
   * @param limit Maximum number of results to return
   * @returns Array of matching memory items
   */
  async searchByMetadata(metadata: Record<string, any>, limit: number = 10): Promise<MemoryItem[]> {
    // Start performance tracking
    const startTime = Date.now();
    
    // Create cache key from metadata query
    const cacheKey = `metadata:${JSON.stringify(metadata)}:${limit}`;
    const cached = this.getCachedResult(cacheKey);
    
    if (cached !== null) {
      // Track cache hit
      this.metrics.cacheHits++;
      return cached as MemoryItem[];
    }
    
    // Cache miss - perform search
    this.metrics.cacheMisses++;
    
    // Find matching IDs from metadata index
    const matchingIds = this.findItemsMatchingMetadata(metadata);
    
    // Retrieve actual items and limit results
    const results = Array.from(matchingIds)
      .map(id => this.items.get(id))
      .filter(item => item !== undefined) as MemoryItem[];
    
    const limitedResults = results.slice(0, limit);
    
    // Cache results for future queries
    this.cacheResult(cacheKey, limitedResults);
    
    // Update performance metrics
    this.updateQueryMetrics(startTime);
    
    return limitedResults;
  }
  
  /**
   * Get performance metrics for monitoring
   * @returns Current memory performance metrics
   */
  getMetrics(): ContextualMemoryMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Index metadata for efficient searching
   * @param id Item ID to index
   * @param metadata Metadata to index
   */
  private indexMetadata(id: string, metadata: Record<string, any>): void {
    // Process each metadata key-value pair
    for (const [key, value] of Object.entries(metadata)) {
      // Convert value to string for indexing
      const valueStr = String(value);
      
      // Create index key
      const indexKey = `${key}:${valueStr}`;
      
      // Get or create the set of IDs for this metadata value
      if (!this.metadataIndex.has(indexKey)) {
        this.metadataIndex.set(indexKey, new Set());
      }
      
      // Add ID to the index
      this.metadataIndex.get(indexKey)?.add(id);
    }
  }
  
  /**
   * Remove item from metadata index
   * @param id Item ID to remove
   * @param metadata Metadata to de-index
   */
  private removeFromMetadataIndex(id: string, metadata: Record<string, any>): void {
    // Process each metadata key-value pair
    for (const [key, value] of Object.entries(metadata)) {
      // Convert value to string for indexing
      const valueStr = String(value);
      
      // Create index key
      const indexKey = `${key}:${valueStr}`;
      
      // Remove ID from the index
      const ids = this.metadataIndex.get(indexKey);
      if (ids) {
        ids.delete(id);
        
        // Clean up empty sets
        if (ids.size === 0) {
          this.metadataIndex.delete(indexKey);
        }
      }
    }
  }
  
  /**
   * Find items matching the provided metadata
   * @param metadata Metadata to match
   * @returns Set of matching item IDs
   */
  private findItemsMatchingMetadata(metadata: Record<string, any>): Set<string> {
    // Track potential matches by ID
    const matchCounts = new Map<string, number>();
    const metadataEntries = Object.entries(metadata);
    
    // Early return for empty metadata
    if (metadataEntries.length === 0) {
      return new Set(Array.from(this.items.keys()));
    }
    
    // Count matches for each metadata key-value pair
    for (const [key, value] of metadataEntries) {
      const valueStr = String(value);
      const indexKey = `${key}:${valueStr}`;
      
      const matchingIds = this.metadataIndex.get(indexKey);
      if (matchingIds) {
        for (const id of matchingIds) {
          matchCounts.set(id, (matchCounts.get(id) || 0) + 1);
        }
      }
    }
    
    // Only return items that match all metadata criteria
    const result = new Set<string>();
    for (const [id, count] of matchCounts.entries()) {
      if (count === metadataEntries.length) {
        result.add(id);
      }
    }
    
    return result;
  }
  
  /**
   * Get a cached result with TTL enforcement
   * @param key Cache key
   * @returns Cached result or null if not found
   */
  private getCachedResult(key: string): any | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;
    
    // Check if cache entry has expired
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.queryCache.delete(key);
      return null;
    }
    
    return cached.result;
  }
  
  /**
   * Cache a query result
   * @param key Cache key
   * @param result Result to cache
   */
  private cacheResult(key: string, result: any): void {
    this.queryCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }
  
  /**
   * Update query performance metrics
   * @param startTime Query start timestamp
   */
  private updateQueryMetrics(startTime: number): void {
    const queryTime = Date.now() - startTime;
    
    // Update average query time using weighted average
    this.metrics.totalQueries++;
    const totalQueries = this.metrics.totalQueries;
    
    if (totalQueries === 1) {
      // First query sets the initial average
      this.metrics.averageQueryTimeMs = queryTime;
    } else {
      // Weighted average formula
      this.metrics.averageQueryTimeMs = (
        this.metrics.averageQueryTimeMs * (totalQueries - 1) + queryTime
      ) / totalQueries;
    }
  }
  
  /**
   * Clean expired cache entries to prevent memory leaks
   */
  private cleanCache(): void {
    const now = Date.now();
    
    // Find and remove expired entries
    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.queryCache.delete(key);
      }
    }
  }
}

/**
 * VectorStoreMemory class for optimized vector-based memory operations
 * Efficiently manages embeddings with similarity search capabilities
 */
export class VectorStoreMemory {
  // Storage for vector items with optimized lookup
  private items: Map<string, VectorItem> = new Map();
  
  // Cache for expensive operations
  private queryCache: Map<string, { result: any, timestamp: number }> = new Map();
  
  // Performance metrics tracking
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    averageQueryTimeMs: 0,
    totalQueries: 0
  };
  
  // Cache TTL in milliseconds
  private readonly cacheTTL: number = 5 * 60 * 1000; // 5 minutes default
  
  /**
   * Creates a new VectorStoreMemory instance
   * @param options Configuration options
   */
  constructor(private options: VectorStoreMemoryOptions = {}) {
    // Apply defaults and overrides
    this.cacheTTL = options.cacheTTL || this.cacheTTL;
    
    // Set up automatic cache cleanup
    if (options.autoCacheCleanup !== false) {
      // Schedule cleanup every minute
      setInterval(() => this.cleanCache(), 60 * 1000);
    }
  }
  
  /**
   * Add a vector item to the store
   * @param id Unique identifier
   * @param vector The vector embedding
   * @param content The associated content
   * @param metadata Optional metadata
   * @returns The ID of the added vector item
   */
  async add(id: string, vector: number[], content: string, metadata: Record<string, any> = {}): Promise<string> {
    // Validate vector input
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error('Vector must be a non-empty array of numbers');
    }
    
    // Create the vector item
    const item: VectorItem = {
      id,
      vector,
      content,
      metadata,
      timestamp: Date.now()
    };
    
    // Store the item
    this.items.set(id, item);
    
    // Clear query cache to ensure fresh results
    this.queryCache.clear();
    
    return id;
  }
  
  /**
   * Retrieve a vector item by ID
   * @param id The ID of the vector item to retrieve
   * @returns The vector item or null if not found
   */
  async get(id: string): Promise<VectorItem | null> {
    // Start performance tracking
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = `get:${id}`;
    const cached = this.getCachedResult(cacheKey);
    
    if (cached !== null) {
      // Track cache hit
      this.metrics.cacheHits++;
      return cached as VectorItem;
    }
    
    // Cache miss - retrieve from storage
    this.metrics.cacheMisses++;
    const item = this.items.get(id) || null;
    
    // Update cache with result
    this.cacheResult(cacheKey, item);
    
    // Update performance metrics
    this.updateQueryMetrics(startTime);
    
    return item;
  }
  
  /**
   * Delete a vector item
   * @param id The ID of the vector item to delete
   * @returns True if the item was deleted, false otherwise
   */
  async delete(id: string): Promise<boolean> {
    // Check if item exists
    if (!this.items.has(id)) {
      return false;
    }
    
    // Remove from storage
    this.items.delete(id);
    
    // Clear related cache entries
    this.queryCache.clear();
    
    return true;
  }
  
  /**
   * Perform optimized similarity search
   * @param queryVector The query vector for similarity comparison
   * @param limit Maximum number of results
   * @param scoreThreshold Minimum similarity score threshold
   * @returns Array of matching items with similarity scores
   */
  async similaritySearch(
    queryVector: number[], 
    limit: number = 5, 
    scoreThreshold: number = 0.7
  ): Promise<Array<{item: VectorItem, score: number}>> {
    // Start performance tracking
    const startTime = Date.now();
    
    // Validate query vector
    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      throw new Error('Query vector must be a non-empty array of numbers');
    }
    
    // Create cache key from query parameters
    const cacheKey = `similarity:${queryVector.toString()}:${limit}:${scoreThreshold}`;
    const cached = this.getCachedResult(cacheKey);
    
    if (cached !== null) {
      // Track cache hit
      this.metrics.cacheHits++;
      return cached as Array<{item: VectorItem, score: number}>;
    }
    
    // Cache miss - perform search
    this.metrics.cacheMisses++;
    
    // Calculate similarities for all items
    const results = Array.from(this.items.values())
      .map(item => ({
        item,
        score: this.cosineSimilarity(queryVector, item.vector)
      }))
      .filter(result => result.score >= scoreThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    // Cache results for future queries
    this.cacheResult(cacheKey, results);
    
    // Update performance metrics
    this.updateQueryMetrics(startTime);
    
    return results;
  }
  
  /**
   * Get performance metrics
   * @returns Current vector memory performance metrics
   */
  getMetrics(): VectorStoreMemoryMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Calculate cosine similarity between two vectors
   * Optimized implementation with early returns and minimal operations
   * @param vectorA First vector
   * @param vectorB Second vector
   * @returns Cosine similarity score between 0 and 1
   */
  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    // Ensure both vectors are defined and have proper length
    if (!vectorA || !vectorB || vectorA.length !== vectorB.length || vectorA.length === 0) {
      return 0;
    }
    
    // Single-pass calculation for dot product and magnitudes
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < vectorA.length; i++) {
      // Null safety checks with defaults to 0 for undefined values
      const valA = vectorA[i] ?? 0;
      const valB = vectorB[i] ?? 0;
      dotProduct += valA * valB;
      magnitudeA += valA * valA;
      magnitudeB += valB * valB;
    }
    
    // Avoid division by zero
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }
    
    // Calculate final similarity
    return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
  }
  
  /**
   * Get a cached result with TTL enforcement
   * @param key Cache key
   * @returns Cached result or null if not found
   */
  private getCachedResult(key: string): any | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;
    
    // Check if cache entry has expired
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.queryCache.delete(key);
      return null;
    }
    
    return cached.result;
  }
  
  /**
   * Cache a query result
   * @param key Cache key
   * @param result Result to cache
   */
  private cacheResult(key: string, result: any): void {
    this.queryCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }
  
  /**
   * Update query performance metrics
   * @param startTime Query start timestamp
   */
  private updateQueryMetrics(startTime: number): void {
    const queryTime = Date.now() - startTime;
    
    // Update average query time
    this.metrics.totalQueries++;
    const totalQueries = this.metrics.totalQueries;
    
    if (totalQueries === 1) {
      this.metrics.averageQueryTimeMs = queryTime;
    } else {
      this.metrics.averageQueryTimeMs = (
        this.metrics.averageQueryTimeMs * (totalQueries - 1) + queryTime
      ) / totalQueries;
    }
  }
  
  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.queryCache.delete(key);
      }
    }
  }
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

export interface VectorStoreMemoryMetrics extends ContextualMemoryMetrics {}
