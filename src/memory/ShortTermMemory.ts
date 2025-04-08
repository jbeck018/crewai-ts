/**
 * ShortTermMemory implementation
 * Optimized in-memory storage with efficient retrieval and management
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseMemory, MemoryItem, MemorySearchParams, MemorySearchResult } from './BaseMemory.js';

/**
 * Options for configuring ShortTermMemory behavior
 */
export interface ShortTermMemoryOptions {
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
}

/**
 * ShortTermMemory class for efficient in-memory storage
 * Optimized for:
 * - Fast access with in-memory storage
 * - Efficient capacity management with LRU eviction
 * - Automatic pruning of old memories
 */
export class ShortTermMemory implements BaseMemory {
  private items: Map<string, MemoryItem> = new Map();
  private accessOrder: string[] = [];
  private capacity: number;
  private useLRU: boolean;
  private maxAgeMs: number;
  private pruneIntervalId?: NodeJS.Timeout;
  
  constructor(options: ShortTermMemoryOptions = {}) {
    this.capacity = options.capacity ?? 1000;
    this.useLRU = options.useLRU ?? true;
    this.maxAgeMs = options.maxAgeMs ?? 24 * 60 * 60 * 1000; // 24 hours default
    
    // Set up automatic pruning if interval is provided
    if (options.pruneIntervalMs) {
      this.pruneIntervalId = setInterval(() => {
        this.pruneOldMemories();
      }, options.pruneIntervalMs);
    }
  }
  
  /**
   * Add an item to memory with optimized capacity management
   */
  async add(content: string, metadata?: Record<string, any>): Promise<MemoryItem> {
    // Create new memory item
    const item: MemoryItem = {
      id: uuidv4(),
      content,
      metadata,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };
    
    // Check if we need to make room for the new item
    if (this.items.size >= this.capacity) {
      this.evictItem();
    }
    
    // Add the new item
    this.items.set(item.id, item);
    
    // Update access order
    if (this.useLRU) {
      this.accessOrder.push(item.id);
    }
    
    return item;
  }
  
  /**
   * Search for items in memory with optimized relevance scoring
   */
  async search(params: MemorySearchParams): Promise<MemorySearchResult> {
    const { query, metadata, limit = 10, offset = 0, minRelevance = 0 } = params;
    
    // Filter and score items based on search criteria
    const matchingItems = Array.from(this.items.values())
      .filter(item => {
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
        
        // Simple text matching for now - in a real implementation, this would use
        // more sophisticated text matching or vector embeddings
        return item.content.toLowerCase().includes(query.toLowerCase());
      })
      .map(item => {
        // Calculate relevance score
        // This is a simple implementation - a real implementation would use
        // more sophisticated relevance scoring
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
          
          // Basic relevance score based on occurrence count and recency
          score = count * 0.5;
          
          // Boost score based on recency
          const ageMs = Date.now() - item.createdAt;
          const recencyBoost = Math.max(0, 1 - (ageMs / this.maxAgeMs));
          score += recencyBoost * 0.5;
        } else {
          // If no query, score based on recency only
          const ageMs = Date.now() - item.createdAt;
          score = Math.max(0, 1 - (ageMs / this.maxAgeMs));
        }
        
        // Update the item with the calculated score
        return {
          ...item,
          relevanceScore: score
        };
      })
      // Filter by minimum relevance
      .filter(item => (item.relevanceScore ?? 0) >= minRelevance)
      // Sort by relevance score (descending)
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
    
    // Apply pagination
    const paginatedItems = matchingItems.slice(offset, offset + limit);
    
    // Update lastAccessedAt for retrieved items
    if (this.useLRU) {
      const now = Date.now();
      for (const item of paginatedItems) {
        // Update the item in the map
        this.items.set(item.id, {
          ...item,
          lastAccessedAt: now
        });
        
        // Update access order
        this.updateAccessOrder(item.id);
      }
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
    const item = this.items.get(id);
    
    if (!item) {
      return null;
    }
    
    // Update lastAccessedAt and access order if using LRU
    if (this.useLRU) {
      item.lastAccessedAt = Date.now();
      this.items.set(id, item);
      this.updateAccessOrder(id);
    }
    
    return item;
  }
  
  /**
   * Update an existing memory item
   */
  async update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null> {
    const item = this.items.get(id);
    
    if (!item) {
      return null;
    }
    
    // Update the item
    const updatedItem = {
      ...item,
      ...updates,
      lastAccessedAt: Date.now()
    };
    
    this.items.set(id, updatedItem);
    
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
    // Remove from items map
    const removed = this.items.delete(id);
    
    // Remove from access order if using LRU
    if (removed && this.useLRU) {
      this.accessOrder = this.accessOrder.filter(itemId => itemId !== id);
    }
    
    return removed;
  }
  
  /**
   * Clear all items from memory
   */
  async clear(): Promise<void> {
    this.items.clear();
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
    return this.items.size;
  }
  
  /**
   * Prune old memories based on maxAgeMs
   * Optimized to minimize iteration over items
   */
  private pruneOldMemories(): void {
    const now = Date.now();
    const cutoffTime = now - this.maxAgeMs;
    
    // Find items older than the cutoff time
    const itemsToRemove: string[] = [];
    
    for (const [id, item] of this.items.entries()) {
      if (item.createdAt < cutoffTime) {
        itemsToRemove.push(id);
      }
    }
    
    // Remove the old items
    for (const id of itemsToRemove) {
      this.items.delete(id);
      // Also remove from access order if using LRU
      if (this.useLRU) {
        this.accessOrder = this.accessOrder.filter(itemId => itemId !== id);
      }
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
        this.items.delete(idToRemove);
      }
    } else {
      // If not using LRU, remove a random item
      const keys = Array.from(this.items.keys());
      if (keys.length > 0) {
        const randomIndex = Math.floor(Math.random() * keys.length);
        this.items.delete(keys[randomIndex]);
      }
    }
  }
}
