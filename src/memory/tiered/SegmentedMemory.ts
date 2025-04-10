/**
 * SegmentedMemory implementation
 * Provides tiered memory storage with automatic promotion/demotion
 * between hot, warm, and cold segments based on access patterns
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseMemory, MemoryItem, MemorySearchParams, MemorySearchResult } from '../BaseMemory.js';

/**
 * Options for configuring SegmentedMemory behavior
 */
export interface SegmentedMemoryOptions {
  /**
   * Maximum number of items in hot cache (frequently accessed)
   * @default 100
   */
  hotCacheSize?: number;
  
  /**
   * Maximum number of items in warm cache (occasionally accessed)
   * @default 1000
   */
  warmCacheSize?: number;
  
  /**
   * Maximum time in milliseconds an item can be inactive before being demoted from hot to warm
   * @default 5 minutes
   */
  hotDemotionTimeMs?: number;
  
  /**
   * Maximum time in milliseconds an item can be inactive before being demoted from warm to cold
   * @default 1 hour
   */
  warmDemotionTimeMs?: number;
  
  /**
   * Interval in milliseconds for automatic tier management (promotions/demotions)
   * @default 1 minute
   */
  tierManagementIntervalMs?: number;
  
  /**
   * Whether to track memory usage statistics
   * @default true
   */
  trackStats?: boolean;
  
  /**
   * Whether to prefetch related items when promoting an item
   * @default false
   */
  enablePrefetching?: boolean;
  
  /**
   * Number of related items to prefetch when enablePrefetching is true
   * @default 5
   */
  prefetchCount?: number;
}

/**
 * Memory tiers for segmentation
 */
export type MemoryTier = 'hot' | 'warm' | 'cold';

/**
 * SegmentedMemory class
 * Implements tiered memory storage with automatic promotion/demotion based on access patterns
 */
export class SegmentedMemory implements BaseMemory {
  // Tiered storage
  private hotCache = new Map<string, MemoryItem>();
  private warmCache = new Map<string, MemoryItem>();
  private coldStorage = new Map<string, MemoryItem>();
  
  // Configuration
  private hotCacheSize: number;
  private warmCacheSize: number;
  private hotDemotionTimeMs: number;
  private warmDemotionTimeMs: number;
  private trackStats: boolean;
  private enablePrefetching: boolean;
  private prefetchCount: number;
  
  // Tier management interval
  private tierManagementIntervalId?: NodeJS.Timeout;
  
  // Relation tracking for prefetching
  private itemRelations = new Map<string, Set<string>>(); // Maps items to related items
  
  // Statistics for monitoring performance
  private stats = {
    tiers: {
      hot: { size: 0, hits: 0 },
      warm: { size: 0, hits: 0 },
      cold: { size: 0, hits: 0 }
    },
    promotions: {
      coldToWarm: 0,
      warmToHot: 0
    },
    demotions: {
      hotToWarm: 0,
      warmToCold: 0
    },
    prefetches: 0,
    totalItems: 0
  };
  
  constructor(options: SegmentedMemoryOptions = {}) {
    this.hotCacheSize = options.hotCacheSize ?? 100;
    this.warmCacheSize = options.warmCacheSize ?? 1000;
    this.hotDemotionTimeMs = options.hotDemotionTimeMs ?? 5 * 60 * 1000; // 5 minutes
    this.warmDemotionTimeMs = options.warmDemotionTimeMs ?? 60 * 60 * 1000; // 1 hour
    this.trackStats = options.trackStats ?? true;
    this.enablePrefetching = options.enablePrefetching ?? false;
    this.prefetchCount = options.prefetchCount ?? 5;
    
    // Set up automatic tier management if interval is provided
    const tierManagementIntervalMs = options.tierManagementIntervalMs ?? 60 * 1000; // 1 minute
    this.tierManagementIntervalId = setInterval(() => {
      this.manageTiers();
    }, tierManagementIntervalMs);
    
    // Initialize stats
    if (this.trackStats) {
      this.updateStats();
    }
  }
  
  /**
   * Add a memory item
   * New items are always inserted into hot cache first
   */
  async add(content: string, metadata?: Record<string, any>): Promise<MemoryItem> {
    // Create a new memory item
    const item: MemoryItem = {
      id: uuidv4(),
      content,
      metadata,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };
    
    // Check if we need to make room in hot cache
    this.ensureHotCacheCapacity();
    
    // Add the item to hot cache
    this.hotCache.set(item.id, item);
    
    // Update statistics
    if (this.trackStats) {
      this.stats.totalItems++;
      this.stats.tiers.hot.size = this.hotCache.size;
      this.updateStats();
    }
    
    return item;
  }
  
  /**
   * Search for memory items across all tiers
   */
  async search(params: MemorySearchParams): Promise<MemorySearchResult> {
    const { query, metadata, limit = 10, offset = 0, minRelevance = 0 } = params;
    
    // Collect items from all tiers
    const allItems: MemoryItem[] = [];
    
    // Helper function to filter items
    const filterItem = (item: MemoryItem): boolean => {
      // Filter by metadata if provided
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          if (item.metadata?.[key] !== value) {
            return false;
          }
        }
      }
      
      // If no query is provided, include all items that match metadata
      if (!query) {
        return true;
      }
      
      // Simple text matching for now
      return item.content.toLowerCase().includes(query.toLowerCase());
    };
    
    // Check hot cache first (most relevant items)
    for (const item of this.hotCache.values()) {
      if (filterItem(item)) {
        allItems.push(item);
      }
    }
    
    // Then check warm cache
    for (const item of this.warmCache.values()) {
      if (filterItem(item)) {
        allItems.push(item);
      }
    }
    
    // Finally check cold storage
    for (const item of this.coldStorage.values()) {
      if (filterItem(item)) {
        allItems.push(item);
      }
    }
    
    // Calculate relevance scores
    const scoredItems = allItems.map(item => {
      let score = 0;
      
      if (query) {
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
        
        // Base score on occurrence count and position
        score = count * 0.1;
        
        // Boost score if query appears at the beginning
        if (content.startsWith(queryLower)) {
          score += 0.2;
        }
        
        // Boost score based on recency
        const recencyBoost = 1 - Math.min(1, (Date.now() - item.createdAt) / (30 * 24 * 60 * 60 * 1000));
        score += recencyBoost * 0.3;
        
        // Tier-based boosting
        if (this.hotCache.has(item.id)) {
          score += 0.3; // Hot items get highest boost
        } else if (this.warmCache.has(item.id)) {
          score += 0.1; // Warm items get medium boost
        }
      } else {
        // If no query, score based on recency
        score = 1 - Math.min(1, (Date.now() - item.createdAt) / (30 * 24 * 60 * 60 * 1000));
      }
      
      return { item, score };
    });
    
    // Filter by minimum relevance
    const filteredItems = scoredItems
      .filter(({ score }) => score >= minRelevance)
      .sort((a, b) => b.score - a.score);
    
    // Apply pagination
    const paginatedItems = filteredItems
      .slice(offset, offset + limit)
      .map(({ item }) => {
        // Update access time and promote item (important for tiered memory management)
        this.accessItem(item.id);
        return item;
      });
    
    return {
      items: paginatedItems,
      total: filteredItems.length
    };
  }
  
  /**
   * Get a memory item by ID
   * Updates access time and promotes item if found
   */
  async get(id: string): Promise<MemoryItem | null> {
    return this.accessItem(id);
  }
  
  /**
   * Update a memory item
   */
  async update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null> {
    // Find the item
    const item = this.findItem(id);
    
    if (!item) {
      return null;
    }
    
    // Update item properties
    const updatedItem = {
      ...item,
      ...updates,
      updatedAt: Date.now(),
      lastAccessedAt: Date.now()
    };
    
    // Update in appropriate tier
    if (this.hotCache.has(id)) {
      this.hotCache.set(id, updatedItem);
    } else if (this.warmCache.has(id)) {
      // Promote to hot when updated
      this.ensureHotCacheCapacity();
      this.hotCache.set(id, updatedItem);
      this.warmCache.delete(id);
      
      if (this.trackStats) {
        this.stats.promotions.warmToHot++;
      }
    } else if (this.coldStorage.has(id)) {
      // Promote to warm when updated
      this.ensureWarmCacheCapacity();
      this.warmCache.set(id, updatedItem);
      this.coldStorage.delete(id);
      
      if (this.trackStats) {
        this.stats.promotions.coldToWarm++;
      }
    }
    
    // Update access stats
    if (this.trackStats) {
      this.updateStats();
    }
    
    return updatedItem;
  }
  
  /**
   * Remove a memory item
   */
  async remove(id: string): Promise<boolean> {
    let removed = false;
    
    // Remove from all tiers
    if (this.hotCache.delete(id)) {
      removed = true;
    }
    
    if (this.warmCache.delete(id)) {
      removed = true;
    }
    
    if (this.coldStorage.delete(id)) {
      removed = true;
    }
    
    // Remove from relation tracking
    this.itemRelations.delete(id);
    
    // Also remove references to this item from other items' relations
    for (const [relatedId, relations] of this.itemRelations.entries()) {
      if (relations.has(id)) {
        relations.delete(id);
      }
    }
    
    // Update statistics
    if (removed && this.trackStats) {
      this.stats.totalItems--;
      this.updateStats();
    }
    
    return removed;
  }
  
  /**
   * Clear all memory items
   */
  async clear(): Promise<void> {
    this.hotCache.clear();
    this.warmCache.clear();
    this.coldStorage.clear();
    this.itemRelations.clear();
    
    // Reset statistics
    if (this.trackStats) {
      this.stats = {
        tiers: {
          hot: { size: 0, hits: 0 },
          warm: { size: 0, hits: 0 },
          cold: { size: 0, hits: 0 }
        },
        promotions: {
          coldToWarm: 0,
          warmToHot: 0
        },
        demotions: {
          hotToWarm: 0,
          warmToCold: 0
        },
        prefetches: 0,
        totalItems: 0
      };
    }
  }
  
  /**
   * Reset the memory
   */
  async reset(): Promise<void> {
    await this.clear();
  }
  
  /**
   * Clean up resources when disposing
   */
  dispose(): void {
    if (this.tierManagementIntervalId) {
      clearInterval(this.tierManagementIntervalId);
      this.tierManagementIntervalId = undefined;
    }
  }
  
  /**
   * Get the total number of items across all tiers
   */
  get size(): number {
    return this.hotCache.size + this.warmCache.size + this.coldStorage.size;
  }
  
  /**
   * Get memory performance statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * Get memory tier distribution
   */
  getTierDistribution(): { hot: number; warm: number; cold: number } {
    return {
      hot: this.hotCache.size,
      warm: this.warmCache.size,
      cold: this.coldStorage.size
    };
  }
  
  /**
   * Add a relation between two items
   * Used for prefetching related items
   */
  addRelation(sourceId: string, targetId: string): boolean {
    // Check if both items exist
    const sourceItem = this.findItem(sourceId);
    const targetItem = this.findItem(targetId);
    
    if (!sourceItem || !targetItem) {
      return false;
    }
    
    // Initialize relation set if it doesn't exist
    if (!this.itemRelations.has(sourceId)) {
      this.itemRelations.set(sourceId, new Set());
    }
    
    // Add relation
    this.itemRelations.get(sourceId)!.add(targetId);
    
    return true;
  }
  
  /**
   * Manage tiers by promoting and demoting items based on access patterns
   */
  private manageTiers(): void {
    const now = Date.now();
    
    // Demote items from hot to warm based on last access time
    const hotDemotionCutoff = now - this.hotDemotionTimeMs;
    const itemsToDemoteToWarm: MemoryItem[] = [];
    
    for (const [id, item] of this.hotCache.entries()) {
      if ((item.lastAccessedAt ?? item.createdAt) < hotDemotionCutoff) {
        itemsToDemoteToWarm.push(item);
        this.hotCache.delete(id);
      }
    }
    
    // Demote items from warm to cold based on last access time
    const warmDemotionCutoff = now - this.warmDemotionTimeMs;
    const itemsToDemoteToCold: MemoryItem[] = [];
    
    for (const [id, item] of this.warmCache.entries()) {
      if ((item.lastAccessedAt ?? item.createdAt) < warmDemotionCutoff) {
        itemsToDemoteToCold.push(item);
        this.warmCache.delete(id);
      }
    }
    
    // Move demoted items to their new tiers
    for (const item of itemsToDemoteToWarm) {
      this.warmCache.set(item.id, item);
      
      if (this.trackStats) {
        this.stats.demotions.hotToWarm++;
      }
    }
    
    for (const item of itemsToDemoteToCold) {
      this.coldStorage.set(item.id, item);
      
      if (this.trackStats) {
        this.stats.demotions.warmToCold++;
      }
    }
    
    // Update statistics
    if (this.trackStats) {
      this.updateStats();
    }
  }
  
  /**
   * Find an item across all tiers
   */
  private findItem(id: string): MemoryItem | null {
    // Check each tier
    return this.hotCache.get(id) || this.warmCache.get(id) || this.coldStorage.get(id) || null;
  }
  
  /**
   * Access an item, update its access time, and promote it to appropriate tier
   */
  private accessItem(id: string): MemoryItem | null {
    let item: MemoryItem | undefined;
    let tier: MemoryTier | null = null;
    
    // Check which tier contains the item
    if (this.hotCache.has(id)) {
      item = this.hotCache.get(id);
      tier = 'hot';
      
      if (this.trackStats) {
        this.stats.tiers.hot.hits++;
      }
    } else if (this.warmCache.has(id)) {
      item = this.warmCache.get(id);
      tier = 'warm';
      
      if (this.trackStats) {
        this.stats.tiers.warm.hits++;
      }
      
      // Promote from warm to hot
      this.warmCache.delete(id);
      this.ensureHotCacheCapacity();
      this.hotCache.set(id, item!);
      
      if (this.trackStats) {
        this.stats.promotions.warmToHot++;
      }
    } else if (this.coldStorage.has(id)) {
      item = this.coldStorage.get(id);
      tier = 'cold';
      
      if (this.trackStats) {
        this.stats.tiers.cold.hits++;
      }
      
      // Promote from cold to warm
      this.coldStorage.delete(id);
      this.ensureWarmCacheCapacity();
      this.warmCache.set(id, item!);
      
      if (this.trackStats) {
        this.stats.promotions.coldToWarm++;
      }
    }
    
    if (!item) {
      return null;
    }
    
    // Update access time
    item.lastAccessedAt = Date.now();
    
    // Prefetch related items if enabled
    if (this.enablePrefetching && tier !== 'hot') {
      this.prefetchRelatedItems(id);
    }
    
    // Update statistics
    if (this.trackStats) {
      this.updateStats();
    }
    
    return item;
  }
  
  /**
   * Prefetch related items
   */
  private prefetchRelatedItems(id: string): void {
    const relations = this.itemRelations.get(id);
    if (!relations || relations.size === 0) {
      return;
    }
    
    // Get the most important related items
    const relatedIds = Array.from(relations).slice(0, this.prefetchCount);
    
    for (const relatedId of relatedIds) {
      const item = this.findItem(relatedId);
      if (item) {
        // Promote related items by one tier
        if (this.coldStorage.has(relatedId)) {
          this.coldStorage.delete(relatedId);
          this.ensureWarmCacheCapacity();
          this.warmCache.set(relatedId, item);
          
          if (this.trackStats) {
            this.stats.prefetches++;
            this.stats.promotions.coldToWarm++;
          }
        } else if (this.warmCache.has(relatedId)) {
          this.warmCache.delete(relatedId);
          this.ensureHotCacheCapacity();
          this.hotCache.set(relatedId, item);
          
          if (this.trackStats) {
            this.stats.prefetches++;
            this.stats.promotions.warmToHot++;
          }
        }
      }
    }
  }
  
  /**
   * Ensure hot cache has capacity for a new item
   */
  private ensureHotCacheCapacity(): void {
    if (this.hotCache.size >= this.hotCacheSize) {
      // Find the least recently accessed item in hot cache
      let oldestId: string | null = null;
      let oldestTime = Infinity;
      
      for (const [id, item] of this.hotCache.entries()) {
        const accessTime = item.lastAccessedAt ?? item.createdAt;
        if (accessTime < oldestTime) {
          oldestTime = accessTime;
          oldestId = id;
        }
      }
      
      if (oldestId) {
        // Demote to warm cache
        const item = this.hotCache.get(oldestId)!;
        this.hotCache.delete(oldestId);
        this.ensureWarmCacheCapacity();
        this.warmCache.set(oldestId, item);
        
        if (this.trackStats) {
          this.stats.demotions.hotToWarm++;
        }
      }
    }
  }
  
  /**
   * Ensure warm cache has capacity for a new item
   */
  private ensureWarmCacheCapacity(): void {
    if (this.warmCache.size >= this.warmCacheSize) {
      // Find the least recently accessed item in warm cache
      let oldestId: string | null = null;
      let oldestTime = Infinity;
      
      for (const [id, item] of this.warmCache.entries()) {
        const accessTime = item.lastAccessedAt ?? item.createdAt;
        if (accessTime < oldestTime) {
          oldestTime = accessTime;
          oldestId = id;
        }
      }
      
      if (oldestId) {
        // Demote to cold storage
        const item = this.warmCache.get(oldestId)!;
        this.warmCache.delete(oldestId);
        this.coldStorage.set(oldestId, item);
        
        if (this.trackStats) {
          this.stats.demotions.warmToCold++;
        }
      }
    }
  }
  
  /**
   * Update memory statistics
   */
  private updateStats(): void {
    if (!this.trackStats) return;
    
    this.stats.tiers.hot.size = this.hotCache.size;
    this.stats.tiers.warm.size = this.warmCache.size;
    this.stats.tiers.cold.size = this.coldStorage.size;
  }
}
