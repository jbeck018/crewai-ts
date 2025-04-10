/**
 * OptimizedShortTermMemory implementation
 * Enhanced version of ShortTermMemory with comprehensive memory optimizations
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseMemory, MemoryItem, MemorySearchParams, MemorySearchResult } from './BaseMemory.js';
import { OptimizedMemoryCache } from './cache/OptimizedMemoryCache.js';
import { RetentionPolicyFactory } from './retention/RetentionPolicy.js';
import { DeduplicatedContentStorage } from './deduplication/DeduplicatedContentStorage.js';

/**
 * Options for configuring OptimizedShortTermMemory behavior
 */
export interface OptimizedShortTermMemoryOptions {
  /**
   * Maximum capacity of memory items
   * @default 1000
   */
  capacity?: number;
  
  /**
   * Whether to use LRU (Least Recently Used) eviction policy
   * @default true
   */
  useLRU?: boolean;
  
  /**
   * Interval in milliseconds for automatic pruning of old memories
   * If undefined, no automatic pruning occurs
   * @default undefined
   */
  pruneIntervalMs?: number;
  
  /**
   * Maximum age in milliseconds for a memory item before it becomes eligible for pruning
   * @default 24 hours
   */
  maxAgeMs?: number;
  
  /**
   * Whether to use weak references for large memory items
   * @default true
   */
  useWeakReferences?: boolean;
  
  /**
   * Size threshold for considering an item "large" (in approximate bytes)
   * @default 50000 (~50KB)
   */
  largeObjectThreshold?: number;
  
  /**
   * Whether to use content deduplication for similar content
   * @default true
   */
  enableDeduplication?: boolean;
  
  /**
   * Whether to track memory usage statistics
   * @default true
   */
  trackStats?: boolean;
}

/**
 * OptimizedShortTermMemory class for efficient in-memory storage
 * Enhanced with weak references, content deduplication, and optimized data structures
 */
export class OptimizedShortTermMemory implements BaseMemory {
  // Use optimized cache for storing memory items with weak references for large items
  private itemCache: OptimizedMemoryCache<MemoryItem>;
  
  // Use deduplicated storage for content to minimize redundant storage
  private contentStore: DeduplicatedContentStorage;
  
  // Use Map for fast id-based lookups (more efficient than a regular object)
  private idToContentRef = new Map<string, string>();
  
  // Access order for LRU tracking with capacity management
  private accessOrder: string[] = [];
  
  // Configuration
  private capacity: number;
  private useLRU: boolean;
  private maxAgeMs: number;
  private pruneIntervalId?: NodeJS.Timeout;
  private trackStats: boolean;
  
  // Retention policy for automatic memory management
  private retentionPolicy = RetentionPolicyFactory.createTimeBasedPolicy(
    24 * 60 * 60 * 1000, // 24 hours default
    'lastAccessedAt'
  );
  
  constructor(options: OptimizedShortTermMemoryOptions = {}) {
    // Initialize configuration
    this.capacity = options.capacity ?? 1000;
    this.useLRU = options.useLRU ?? true;
    this.maxAgeMs = options.maxAgeMs ?? 24 * 60 * 60 * 1000; // 24 hours default
    this.trackStats = options.trackStats ?? true;
    
    // Create optimized cache with weak reference support
    this.itemCache = new OptimizedMemoryCache<MemoryItem>({
      largeObjectThreshold: options.largeObjectThreshold,
      trackStats: this.trackStats
    });
    
    // Initialize deduplicated content storage
    this.contentStore = new DeduplicatedContentStorage({
      trackStats: this.trackStats,
      useBloomFilter: true,
      hashAlgorithm: 'sha256'
    });
    
    // Update retention policy with configured maxAgeMs
    this.retentionPolicy = RetentionPolicyFactory.createTimeBasedPolicy(
      this.maxAgeMs,
      'lastAccessedAt'
    );
    
    // Set up automatic pruning if interval is provided
    if (options.pruneIntervalMs) {
      this.pruneIntervalId = setInterval(() => {
        this.pruneOldMemories();
      }, options.pruneIntervalMs);
    }
  }
  
  /**
   * Add an item to memory with optimized capacity management and deduplication
   */
  async add(content: string, metadata?: Record<string, any>): Promise<MemoryItem> {
    // Store content with deduplication
    const contentId = this.contentStore.store(content);
    
    // Create new memory item (without storing the actual content)
    const item: MemoryItem = {
      id: uuidv4(),
      content: '', // Placeholder, actual content is in contentStore
      metadata,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };
    
    // Map item ID to content reference
    this.idToContentRef.set(item.id, contentId);
    
    // Check if we need to make room for the new item
    if (this.accessOrder.length >= this.capacity) {
      this.evictItem();
    }
    
    // Add the item to cache
    this.itemCache.set(item.id, item);
    
    // Update access order
    if (this.useLRU) {
      this.accessOrder.push(item.id);
    }
    
    // Return a complete item (with content included)
    return {
      ...item,
      content: content
    };
  }
  
  /**
   * Search for items in memory with optimized relevance scoring
   */
  async search(params: MemorySearchParams): Promise<MemorySearchResult> {
    const { query, metadata, limit = 10, offset = 0, minRelevance = 0 } = params;
    
    // Collect all item IDs
    const itemIds = this.accessOrder.length > 0 ? 
      this.accessOrder.slice() : // Use access order if available
      Array.from(this.idToContentRef.keys()); // Otherwise get all keys
    
    // Filter and score items
    const matchingItems: Array<{ item: MemoryItem, score: number }> = [];
    
    for (const id of itemIds) {
      // Get item from cache
      const item = await this.get(id);
      if (!item) continue;
      
      // Filter by metadata if provided
      if (metadata) {
        let matchesMetadata = true;
        for (const [key, value] of Object.entries(metadata)) {
          if (item.metadata?.[key] !== value) {
            matchesMetadata = false;
            break;
          }
        }
        if (!matchesMetadata) continue;
      }
      
      // Calculate relevance score
      let score = 0;
      
      if (query) {
        // If no query, include all items that match metadata
        if (!query || item.content.toLowerCase().includes(query.toLowerCase())) {
          // Simple text matching score
          const content = item.content.toLowerCase();
          const queryLower = query.toLowerCase();
          
          // Count occurrences
          let count = 0;
          let pos = content.indexOf(queryLower);
          while (pos !== -1) {
            count++;
            pos = content.indexOf(queryLower, pos + 1);
          }
          
          // Base score on occurrence count
          score = count * 0.1;
          
          // Boost score if query appears at beginning
          if (content.startsWith(queryLower)) {
            score += 0.2;
          }
          
          // Boost score based on recency
          const ageMs = Date.now() - item.createdAt;
          const recencyScore = Math.max(0, 1 - (ageMs / this.maxAgeMs));
          score += recencyScore * 0.2;
          
          // Add item if it meets minimum relevance
          if (score >= minRelevance) {
            matchingItems.push({ item, score });
          }
        }
      } else {
        // If no query, score based on recency only
        const ageMs = Date.now() - item.createdAt;
        score = Math.max(0, 1 - (ageMs / this.maxAgeMs));
        
        if (score >= minRelevance) {
          matchingItems.push({ item, score });
        }
      }
    }
    
    // Sort by score (descending) and apply pagination
    matchingItems.sort((a, b) => b.score - a.score);
    
    const paginatedItems = matchingItems
      .slice(offset, offset + limit)
      .map(({ item }) => item);
    
    // For each returned item, update access information
    const now = Date.now();
    for (const item of paginatedItems) {
      item.lastAccessedAt = now;
      this.itemCache.set(item.id, item);
      this.updateAccessOrder(item.id);
    }
    
    return {
      items: paginatedItems,
      total: matchingItems.length
    };
  }
  
  /**
   * Get an item by its ID with LRU tracking
   */
  async get(id: string): Promise<MemoryItem | null> {
    // Get the item from cache
    let item = this.itemCache.get(id);
    
    if (!item) {
      return null;
    }
    
    // Retrieve content from content store
    const contentId = this.idToContentRef.get(id);
    if (contentId) {
      const content = this.contentStore.retrieve(contentId);
      if (content) {
        item = {
          ...item,
          content: content
        };
      }
    }
    
    // Update lastAccessedAt and access order if using LRU
    item.lastAccessedAt = Date.now();
    this.itemCache.set(id, item);
    
    if (this.useLRU) {
      this.updateAccessOrder(id);
    }
    
    return item;
  }
  
  /**
   * Update an existing memory item
   */
  async update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null> {
    // Get the current item
    const item = await this.get(id);
    
    if (!item) {
      return null;
    }
    
    // If content is being updated, handle deduplication
    if (updates.content) {
      // Remove old content reference
      const oldContentId = this.idToContentRef.get(id);
      if (oldContentId) {
        this.contentStore.remove(oldContentId);
      }
      
      // Store new content with deduplication
      const newContentId = this.contentStore.store(updates.content);
      this.idToContentRef.set(id, newContentId);
    }
    
    // Create updated item
    const updatedItem: MemoryItem = {
      ...item,
      ...updates,
      id, // Ensure ID isn't changed
      createdAt: item.createdAt, // Ensure creation date isn't changed
      lastAccessedAt: Date.now() // Update access time
    };
    
    // Save to cache without content to minimize memory footprint
    const itemForCache = { ...updatedItem };
    if (updates.content) {
      itemForCache.content = ''; // Don't store content in cache
    }
    this.itemCache.set(id, itemForCache);
    
    // Update access order if using LRU
    if (this.useLRU) {
      this.updateAccessOrder(id);
    }
    
    return updatedItem;
  }
  
  /**
   * Remove an item from memory
   */
  async remove(id: string): Promise<boolean> {
    // Get content reference for removal
    const contentId = this.idToContentRef.get(id);
    
    // Remove from item cache
    let removed = false;
    if (this.itemCache.delete(id)) {
      removed = true;
    }
    
    // Remove from content store if we have a reference
    if (contentId) {
      this.contentStore.remove(contentId);
      this.idToContentRef.delete(id);
    }
    
    // Remove from access order if using LRU
    if (this.useLRU) {
      this.accessOrder = this.accessOrder.filter(itemId => itemId !== id);
    }
    
    return removed;
  }
  
  /**
   * Clear all items from memory
   */
  async clear(): Promise<void> {
    this.itemCache.clear();
    this.contentStore.clear();
    this.idToContentRef.clear();
    this.accessOrder = [];
  }
  
  /**
   * Reset the memory (clear and initialize)
   */
  async reset(): Promise<void> {
    await this.clear();
  }
  
  /**
   * Clean up resources when no longer needed
   */
  dispose(): void {
    if (this.pruneIntervalId) {
      clearInterval(this.pruneIntervalId);
      this.pruneIntervalId = undefined;
    }
  }
  
  /**
   * Get the current memory size
   */
  get size(): number {
    return this.idToContentRef.size;
  }
  
  /**
   * Get memory statistics
   */
  getStats(): Record<string, any> {
    if (!this.trackStats) {
      return { size: this.size };
    }
    
    return {
      size: this.size,
      cacheStats: this.itemCache.getStats(),
      contentStats: this.contentStore.getStats(),
      accessOrderSize: this.accessOrder.length
    };
  }
  
  /**
   * Prune old memories based on maxAgeMs
   * Optimized to minimize iteration over items
   */
  private pruneOldMemories(): void {
    const now = Date.now();
    const cutoffTime = now - this.maxAgeMs;
    
    // Use retention policy to identify items to remove
    const itemsToCheck = [...this.idToContentRef.keys()];
    const itemsToRemove: string[] = [];
    
    for (const id of itemsToCheck) {
      const item = this.itemCache.get(id);
      if (item && (item.lastAccessedAt ?? item.createdAt) < cutoffTime) {
        itemsToRemove.push(id);
      }
    }
    
    // Remove the old items
    for (const id of itemsToRemove) {
      this.remove(id);
    }
  }
  
  /**
   * Update the access order for LRU tracking
   * Optimized for minimal array operations
   */
  private updateAccessOrder(id: string): void {
    // Remove the ID from its current position
    this.accessOrder = this.accessOrder.filter(itemId => itemId !== id);
    // Add it to the end (most recently used)
    this.accessOrder.push(id);
  }
  
  /**
   * Evict an item based on the eviction policy
   * Currently implements LRU (Least Recently Used)
   */
  private evictItem(): void {
    if (this.useLRU && this.accessOrder.length > 0) {
      // Get the least recently used item
      const idToRemove = this.accessOrder.shift();
      if (idToRemove) {
        this.remove(idToRemove);
      }
    } else {
      // If not using LRU, remove a random item
      const keys = Array.from(this.idToContentRef.keys());
      if (keys.length > 0) {
        const randomIndex = Math.floor(Math.random() * keys.length);
        const keyToDelete = keys[randomIndex];
        if (keyToDelete) {
          this.remove(keyToDelete);
        }
      }
    }
  }
}
