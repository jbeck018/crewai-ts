/**
 * LongTermMemory implementation
 * Optimized for persistent storage with semantic search capabilities
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseMemory, MemoryItem, MemorySearchParams, MemorySearchResult } from './BaseMemory.js';

export type StorageAdapter = {
  save(key: string, value: any): Promise<void>;
  load(key: string): Promise<any | null>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
};

/**
 * File-based storage adapter implementation
 * In a real implementation, this would use proper file I/O with atomic writes
 */
class InMemoryStorageAdapter implements StorageAdapter {
  private storage = new Map<string, any>();
  
  async save(key: string, value: any): Promise<void> {
    this.storage.set(key, value);
  }
  
  async load(key: string): Promise<any | null> {
    return this.storage.get(key) || null;
  }
  
  async delete(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }
  
  async clear(): Promise<void> {
    this.storage.clear();
  }
  
  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
}

/**
 * Options for configuring LongTermMemory behavior
 */
export interface LongTermMemoryOptions {
  /**
   * Storage adapter to use for persistence
   * If not provided, will use an in-memory adapter
   */
  storageAdapter?: StorageAdapter;
  
  /**
   * Namespace for storage keys to prevent collisions
   * @default 'crewai'
   */
  namespace?: string;
  
  /**
   * Whether to cache loaded items in memory for faster access
   * @default true
   */
  useCache?: boolean;
  
  /**
   * Maximum size of the memory cache
   * @default 1000
   */
  cacheSize?: number;
  
  /**
   * Path to vector database for semantic search
   * If not provided, semantic search will not be available
   */
  vectorDbPath?: string;
  
  /**
   * Maximum age in milliseconds for a memory item before it becomes eligible for archiving
   * @default 30 days
   */
  archiveAgeMs?: number;
}

/**
 * LongTermMemory class for persistent storage of memories
 * Optimized for:
 * - Persistent storage with indexing
 * - Efficient retrieval with caching
 * - Semantic search when available
 */
export class LongTermMemory implements BaseMemory {
  private storage: StorageAdapter;
  private namespace: string;
  private useCache: boolean;
  private cacheSize: number;
  private vectorDbPath?: string;
  private archiveAgeMs: number;
  
  // In-memory cache for faster access
  private cache = new Map<string, MemoryItem>();
  private cacheOrder: string[] = [];
  
  // Index for faster searching
  private contentIndex = new Map<string, Set<string>>();
  private metadataIndex = new Map<string, Map<any, Set<string>>>();
  
  constructor(options: LongTermMemoryOptions = {}) {
    this.storage = options.storageAdapter || new InMemoryStorageAdapter();
    this.namespace = options.namespace || 'crewai';
    this.useCache = options.useCache ?? true;
    this.cacheSize = options.cacheSize || 1000;
    this.vectorDbPath = options.vectorDbPath;
    this.archiveAgeMs = options.archiveAgeMs || 30 * 24 * 60 * 60 * 1000; // 30 days default
    
    // Initialize the memory store
    this.init();
  }
  
  /**
   * Initialize the memory store
   */
  private async init(): Promise<void> {
    // Load the index if it exists
    await this.loadIndex();
  }
  
  /**
   * Add an item to long-term memory with persistence
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
    
    // Save to storage
    await this.storage.save(this.getItemKey(item.id), item);
    
    // Add to cache if enabled
    if (this.useCache) {
      this.addToCache(item);
    }
    
    // Update indexes
    this.indexItem(item);
    
    return item;
  }
  
  /**
   * Search for items in long-term memory with optimized indexing
   */
  async search(params: MemorySearchParams): Promise<MemorySearchResult> {
    const { query, metadata, limit = 10, offset = 0, minRelevance = 0 } = params;
    
    // If we have a vector database and a query, use semantic search
    if (this.vectorDbPath && query && query.length > 0) {
      return this.semanticSearch(query, metadata, limit, offset, minRelevance);
    }
    
    // Otherwise, use index-based search
    return this.indexSearch(query, metadata, limit, offset, minRelevance);
  }
  
  /**
   * Get an item by its ID with caching
   */
  async get(id: string): Promise<MemoryItem | null> {
    // Check cache first if enabled
    if (this.useCache) {
      const cachedItem = this.cache.get(id);
      if (cachedItem) {
        // Update last accessed time
        cachedItem.lastAccessedAt = Date.now();
        // Update cache order
        this.updateCacheOrder(id);
        return cachedItem;
      }
    }
    
    // If not in cache, load from storage
    const item = await this.storage.load(this.getItemKey(id));
    
    if (!item) {
      return null;
    }
    
    // Update last accessed time
    item.lastAccessedAt = Date.now();
    
    // Save the updated item
    await this.storage.save(this.getItemKey(id), item);
    
    // Add to cache if enabled
    if (this.useCache) {
      this.addToCache(item);
    }
    
    return item;
  }
  
  /**
   * Update an existing memory item with delta updates
   */
  async update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null> {
    // Get the existing item
    const existingItem = await this.get(id);
    
    if (!existingItem) {
      return null;
    }
    
    // Update the item
    const updatedItem = {
      ...existingItem,
      ...updates,
      lastAccessedAt: Date.now()
    };
    
    // Remove from index if content or metadata is changing
    if (updates.content || updates.metadata) {
      this.removeFromIndex(existingItem);
    }
    
    // Save the updated item
    await this.storage.save(this.getItemKey(id), updatedItem);
    
    // Update cache if enabled
    if (this.useCache) {
      this.cache.set(id, updatedItem);
      this.updateCacheOrder(id);
    }
    
    // Update index if content or metadata changed
    if (updates.content || updates.metadata) {
      this.indexItem(updatedItem);
    }
    
    return updatedItem;
  }
  
  /**
   * Remove an item from long-term memory
   */
  async remove(id: string): Promise<boolean> {
    // Get the item first to remove from index
    const item = await this.get(id);
    
    if (!item) {
      return false;
    }
    
    // Remove from index
    this.removeFromIndex(item);
    
    // Remove from storage
    const removed = await this.storage.delete(this.getItemKey(id));
    
    // Remove from cache if enabled
    if (this.useCache) {
      this.cache.delete(id);
      this.cacheOrder = this.cacheOrder.filter(itemId => itemId !== id);
    }
    
    return removed;
  }
  
  /**
   * Clear all items from long-term memory
   */
  async clear(): Promise<void> {
    // Clear storage
    await this.storage.clear();
    
    // Clear cache
    this.cache.clear();
    this.cacheOrder = [];
    
    // Clear indexes
    this.contentIndex.clear();
    this.metadataIndex.clear();
  }
  
  /**
   * Reset the memory (clear and initialize)
   */
  async reset(): Promise<void> {
    await this.clear();
    await this.init();
  }
  
  /**
   * Archive old memories to reduce storage size
   * In a real implementation, this would move old items to cold storage
   */
  async archiveOldMemories(): Promise<number> {
    const keys = await this.storage.keys();
    const itemKeys = keys.filter(key => key.startsWith(`${this.namespace}:item:`));
    let archivedCount = 0;
    
    const now = Date.now();
    const cutoffTime = now - this.archiveAgeMs;
    
    for (const key of itemKeys) {
      const item = await this.storage.load(key);
      
      if (item && item.createdAt < cutoffTime) {
        // Archive the item (in a real implementation, this would move it to archive storage)
        await this.remove(item.id);
        archivedCount++;
      }
    }
    
    return archivedCount;
  }
  
  /**
   * Get the storage key for an item
   */
  private getItemKey(id: string): string {
    return `${this.namespace}:item:${id}`;
  }
  
  /**
   * Add an item to the in-memory cache
   */
  private addToCache(item: MemoryItem): void {
    // If cache is at capacity, remove the least recently used item
    if (this.cache.size >= this.cacheSize) {
      const oldestId = this.cacheOrder.shift();
      if (oldestId) {
        this.cache.delete(oldestId);
      }
    }
    
    // Add to cache
    this.cache.set(item.id, item);
    this.cacheOrder.push(item.id);
  }
  
  /**
   * Update the order of items in cache (LRU tracking)
   */
  private updateCacheOrder(id: string): void {
    // Remove from current position
    this.cacheOrder = this.cacheOrder.filter(itemId => itemId !== id);
    // Add to end (most recently used)
    this.cacheOrder.push(id);
  }
  
  /**
   * Index an item for faster searching
   */
  private indexItem(item: MemoryItem): void {
    // Index content (simple word-based indexing)
    const words = item.content.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 2) { // Only index words longer than 2 characters
        const wordSet = this.contentIndex.get(word) || new Set<string>();
        wordSet.add(item.id);
        this.contentIndex.set(word, wordSet);
      }
    }
    
    // Index metadata
    if (item.metadata) {
      for (const [key, value] of Object.entries(item.metadata)) {
        // Skip null or undefined values
        if (value === null || value === undefined) {
          continue;
        }
        
        const keyMap = this.metadataIndex.get(key) || new Map<any, Set<string>>();
        const valueSet = keyMap.get(value) || new Set<string>();
        valueSet.add(item.id);
        keyMap.set(value, valueSet);
        this.metadataIndex.set(key, keyMap);
      }
    }
  }
  
  /**
   * Remove an item from the index
   */
  private removeFromIndex(item: MemoryItem): void {
    // Remove from content index
    const words = item.content.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 2) {
        const wordSet = this.contentIndex.get(word);
        if (wordSet) {
          wordSet.delete(item.id);
          if (wordSet.size === 0) {
            this.contentIndex.delete(word);
          }
        }
      }
    }
    
    // Remove from metadata index
    if (item.metadata) {
      for (const [key, value] of Object.entries(item.metadata)) {
        if (value === null || value === undefined) {
          continue;
        }
        
        const keyMap = this.metadataIndex.get(key);
        if (keyMap) {
          const valueSet = keyMap.get(value);
          if (valueSet) {
            valueSet.delete(item.id);
            if (valueSet.size === 0) {
              keyMap.delete(value);
              if (keyMap.size === 0) {
                this.metadataIndex.delete(key);
              }
            }
          }
        }
      }
    }
  }
  
  /**
   * Search using the index
   */
  private async indexSearch(
    query?: string,
    metadata?: Record<string, any>,
    limit = 10,
    offset = 0,
    minRelevance = 0
  ): Promise<MemorySearchResult> {
    // Find matching item IDs based on query and metadata
    const matchingIds = new Set<string>();
    
    // If we have metadata criteria, find matching items
    if (metadata) {
      let isFirstMetadata = true;
      
      for (const [key, value] of Object.entries(metadata)) {
        const keyMap = this.metadataIndex.get(key);
        if (!keyMap) {
          return { items: [], total: 0 }; // No matches for this key
        }
        
        const valueSet = keyMap.get(value);
        if (!valueSet) {
          return { items: [], total: 0 }; // No matches for this value
        }
        
        if (isFirstMetadata) {
          // For the first metadata criterion, add all matching IDs
          for (const id of valueSet) {
            matchingIds.add(id);
          }
          isFirstMetadata = false;
        } else {
          // For subsequent criteria, keep only IDs that match all criteria
          for (const id of matchingIds) {
            if (!valueSet.has(id)) {
              matchingIds.delete(id);
            }
          }
        }
        
        // Short-circuit if we've eliminated all items
        if (matchingIds.size === 0) {
          return { items: [], total: 0 };
        }
      }
    }
    
    // If we have a query, find matching items by content
    if (query && query.length > 0) {
      const queryWords = query.toLowerCase().split(/\s+/)
        .filter(word => word.length > 2); // Only search for words longer than 2 characters
      
      if (queryWords.length > 0) {
        // Find IDs matching any query word
        const queryMatchingIds = new Set<string>();
        const wordMatches = new Map<string, number>(); // Track how many words match each ID
        
        for (const word of queryWords) {
          const wordSet = this.contentIndex.get(word);
          if (wordSet) {
            for (const id of wordSet) {
              queryMatchingIds.add(id);
              wordMatches.set(id, (wordMatches.get(id) || 0) + 1);
            }
          }
        }
        
        if (metadata) {
          // If we also have metadata criteria, find the intersection
          for (const id of matchingIds) {
            if (!queryMatchingIds.has(id)) {
              matchingIds.delete(id);
            }
          }
        } else {
          // If we only have a query, use the query matching IDs
          for (const id of queryMatchingIds) {
            matchingIds.add(id);
          }
        }
        
        // If we have no matches, return empty result
        if (matchingIds.size === 0) {
          return { items: [], total: 0 };
        }
      }
    }
    
    // If we have no query or metadata, match all items
    if (!query && !metadata) {
      const keys = await this.storage.keys();
      for (const key of keys) {
        if (key.startsWith(`${this.namespace}:item:`)) {
          const id = key.substring(`${this.namespace}:item:`.length);
          matchingIds.add(id);
        }
      }
    }
    
    // Load the matching items
    const matchedItems: MemoryItem[] = [];
    for (const id of matchingIds) {
      const item = await this.get(id);
      if (item) {
        matchedItems.push(item);
      }
    }
    
    // Calculate relevance scores and filter by minimum relevance
    const scoredItems = matchedItems.map(item => {
      // Calculate a simple relevance score based on recency
      const ageMs = Date.now() - item.createdAt;
      const recencyScore = Math.max(0, 1 - (ageMs / this.archiveAgeMs));
      
      // If we have a query, also consider word match count
      let queryScore = 0;
      if (query) {
        const queryWords = query.toLowerCase().split(/\s+/)
          .filter(word => word.length > 2);
        
        // Count how many query words appear in the content
        let matchCount = 0;
        for (const word of queryWords) {
          if (item.content.toLowerCase().includes(word)) {
            matchCount++;
          }
        }
        
        // Calculate query score based on proportion of words matched
        queryScore = queryWords.length > 0 ? matchCount / queryWords.length : 0;
      }
      
      // Combine scores - we weight query score higher than recency
      const relevanceScore = query ? (0.7 * queryScore + 0.3 * recencyScore) : recencyScore;
      
      return {
        ...item,
        relevanceScore
      };
    })
    .filter(item => item.relevanceScore >= minRelevance)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Apply pagination
    const paginatedItems = scoredItems.slice(offset, offset + limit);
    
    return {
      items: paginatedItems,
      total: scoredItems.length
    };
  }
  
  /**
   * Search using semantic vectors
   * This is a placeholder implementation - in a real implementation, this would
   * use a vector database for semantic search
   */
  private async semanticSearch(
    query: string,
    metadata?: Record<string, any>,
    limit = 10,
    offset = 0,
    minRelevance = 0
  ): Promise<MemorySearchResult> {
    // This would use the vector database to perform a semantic search
    // For now, fall back to index search
    return this.indexSearch(query, metadata, limit, offset, minRelevance);
  }
  
  /**
   * Load the index from storage
   */
  private async loadIndex(): Promise<void> {
    // In a real implementation, this would load a persisted index
    // For now, rebuild the index from all items
    const keys = await this.storage.keys();
    const itemKeys = keys.filter(key => key.startsWith(`${this.namespace}:item:`));
    
    for (const key of itemKeys) {
      const item = await this.storage.load(key);
      if (item) {
        this.indexItem(item);
        
        // Add to cache if enabled (up to cache size)
        if (this.useCache && this.cache.size < this.cacheSize) {
          this.addToCache(item);
        }
      }
    }
  }
  
  /**
   * Save the index to storage
   */
  private async saveIndex(): Promise<void> {
    // In a real implementation, this would persist the index
    // For now, do nothing as we rebuild the index on load
  }
}
