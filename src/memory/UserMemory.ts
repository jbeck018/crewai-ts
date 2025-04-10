/**
 * UserMemory Class
 *
 * A specialized memory implementation for storing user-specific information
 * and preferences with optimized retrieval. Designed to maintain context
 * across conversations and interactions while minimizing memory usage.
 */

import { nanoid } from 'nanoid';
import { BaseMemory, MemoryItem, MemorySearchParams, MemorySearchResult } from './BaseMemory.js';

/**
 * Configuration options for UserMemory
 */
export interface UserMemoryOptions {
  /**
   * Maximum number of items to keep in memory
   * Uses LRU eviction policy when limit is reached
   */
  maxSize?: number;

  /**
   * Enable indexing for faster retrieval
   * Creates optimized search indexes for common user attributes
   */
  enableIndexing?: boolean;

  /**
   * Time in milliseconds after which memory items expire
   * Set to 0 to disable expiration (default)
   */
  expirationMs?: number;

  /**
   * Whether to compress stored content to reduce memory footprint
   */
  useCompression?: boolean;

  /**
   * Custom serializer for memory items
   * Can be used to optimize memory storage further
   */
  serializer?: (item: any) => string;

  /**
   * Custom deserializer for memory items
   */
  deserializer?: (data: string) => any;
}

/**
 * UserMemory: Specialized memory system for storing and retrieving
 * user-specific information with optimized performance.
 *
 * Features:
 * - Memory-efficient storage of user preferences and history
 * - Fast indexed retrieval for common user attributes
 * - Automatic memory management with LRU eviction
 * - Optional content compression
 */
export class UserMemory implements BaseMemory {
  private items: Map<string, MemoryItem>;
  private userIndex: Map<string, Set<string>>; // userid -> memory item ids
  private attributeIndex: Map<string, Map<string, Set<string>>>; // attribute -> value -> item ids
  private lruOrder: string[]; // Most recently used item ids (for eviction)
  private options: Required<UserMemoryOptions>;

  /**
   * Create a new UserMemory instance with optimized data structures
   */
  constructor(options: UserMemoryOptions = {}) {
    // Initialize with default options optimized for performance
    this.options = {
      maxSize: options.maxSize || 1000,
      enableIndexing: options.enableIndexing !== undefined ? options.enableIndexing : true,
      expirationMs: options.expirationMs || 0,
      useCompression: options.useCompression || false,
      serializer: options.serializer || JSON.stringify,
      deserializer: options.deserializer || JSON.parse
    };

    // Use optimized data structures for memory operations
    this.items = new Map<string, MemoryItem>(); // O(1) lookup by id
    this.userIndex = new Map<string, Set<string>>(); // O(1) lookup by userId
    this.attributeIndex = new Map<string, Map<string, Set<string>>>(); // O(1) attribute lookup
    this.lruOrder = []; // Track usage for LRU eviction

    // Pre-allocate common attribute indexes for even faster retrieval
    if (this.options.enableIndexing) {
      ['userId', 'username', 'preference', 'history', 'interaction'].forEach(attr => {
        this.attributeIndex.set(attr, new Map<string, Set<string>>());
      });
    }
  }

  /**
   * Add a memory item with optimized indexing
   * @param content The content to store
   * @param metadata Additional metadata about the content
   * @returns The created memory item
   */
  async add(content: string, metadata?: Record<string, any>): Promise<MemoryItem> {
    // Apply compression if enabled for memory efficiency
    const finalContent = this.options.useCompression 
      ? this.compressContent(content)
      : content;
    
    // Create a new memory item with optimized structure
    const now = Date.now();
    const item: MemoryItem = {
      id: nanoid(),
      content: finalContent,
      metadata: metadata || {},
      createdAt: now,
      lastAccessedAt: now
    };

    // Check if we need to evict items due to size limit
    if (this.items.size >= this.options.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    // Store the item and update indexes
    this.items.set(item.id, item);
    this.lruOrder.push(item.id); // Add to end of LRU list (most recently used)
    
    // Efficiently index the item if indexing is enabled
    if (this.options.enableIndexing && metadata) {
      // Index by userId if present
      const userId = metadata.userId || metadata.user_id;
      if (userId) {
        if (!this.userIndex.has(userId)) {
          this.userIndex.set(userId, new Set<string>());
        }
        this.userIndex.get(userId)!.add(item.id);
      }

      // Index other attributes for optimized retrieval
      Object.entries(metadata).forEach(([key, value]) => {
        // Skip indexing large values or complex objects to save memory
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          return;
        }

        const valueStr = String(value);
        if (!this.attributeIndex.has(key)) {
          this.attributeIndex.set(key, new Map<string, Set<string>>());
        }
        
        const keyIndex = this.attributeIndex.get(key)!;
        if (!keyIndex.has(valueStr)) {
          keyIndex.set(valueStr, new Set<string>());
        }
        
        keyIndex.get(valueStr)!.add(item.id);
      });
    }

    return item;
  }

  /**
   * Search for memory items with optimized retrieval algorithms
   * @param params Search parameters
   * @returns Search results with relevance scores
   */
  async search(params: MemorySearchParams): Promise<MemorySearchResult> {
    const { query, metadata, limit = 10, offset = 0, minRelevance = 0 } = params;
    const results: MemoryItem[] = [];
    const matchingIds = new Set<string>();
    const now = Date.now();

    // Optimize search strategy based on provided parameters
    if (metadata && this.options.enableIndexing) {
      // Most efficient path: Use indexed lookup for metadata
      // First check userId for most common case
      const userId = metadata.userId || metadata.user_id;
      if (userId && this.userIndex.has(userId)) {
        // Get all items for this user
        const userItems = this.userIndex.get(userId)!;
        userItems.forEach(id => matchingIds.add(id));
      }

      // Filter further by other metadata if specified
      let hasOtherMetadata = false;
      Object.entries(metadata).forEach(([key, value]) => {
        // Skip userId as we've already handled it
        if (key === 'userId' || key === 'user_id') return;
        
        hasOtherMetadata = true;
        if (!this.attributeIndex.has(key)) return;
        
        const valueStr = String(value);
        const keyIndex = this.attributeIndex.get(key)!;
        if (!keyIndex.has(valueStr)) return;
        
        const matchingItemsForAttr = keyIndex.get(valueStr)!;
        
        // If this is our first metadata filter besides userId, use all matching items
        if (matchingIds.size === 0 || (userId && matchingIds.size === this.userIndex.get(userId)!.size)) {
          matchingItemsForAttr.forEach(id => matchingIds.add(id));
        } else {
          // Otherwise, perform an intersection to narrow results
          const intersection = new Set<string>();
          for (const id of matchingIds) {
            if (matchingItemsForAttr.has(id)) {
              intersection.add(id);
            }
          }
          // Update matchingIds to the intersection
          matchingIds.clear();
          intersection.forEach(id => matchingIds.add(id));
        }
      });

      // If no metadata matched or no specific metadata was provided besides userId
      // then we either have all items for a userId or need to search all items
      if (matchingIds.size === 0 && !hasOtherMetadata && !userId) {
        // No indexed metadata matched, fall back to searching all items
        this.items.forEach((item, id) => {
          // Skip expired items
          if (this.isExpired(item, now)) return;
          matchingIds.add(id);
        });
      }
    } else {
      // No metadata or indexing disabled - search all items
      this.items.forEach((item, id) => {
        // Skip expired items
        if (this.isExpired(item, now)) return;
        matchingIds.add(id);
      });
    }

    // Apply text search if query is specified
    if (query && query.trim() !== '') {
      const searchTerms = query.toLowerCase().split(/\s+/);
      const filteredIds = new Set<string>();
      
      for (const id of matchingIds) {
        const item = this.items.get(id)!;
        const content = this.options.useCompression 
          ? this.decompressContent(item.content)
          : item.content;
          
        // Simple relevance scoring algorithm (can be extended with more sophisticated approaches)
        let relevanceScore = 0;
        const contentLower = content.toLowerCase();
        
        // Score based on exact match and term frequency
        for (const term of searchTerms) {
          if (contentLower.includes(term)) {
            // Count occurrences for term frequency scoring
            const count = (contentLower.match(new RegExp(term, 'g')) || []).length;
            relevanceScore += 0.5 + (count * 0.1); // Base score + frequency bonus
          }
        }
        
        // Bonus for exact phrase match
        if (contentLower.includes(query.toLowerCase())) {
          relevanceScore += 1.0;
        }
        
        // Add recency bias (more recent items score higher)
        if (item.lastAccessedAt) {
          const recencyScore = Math.min(0.5, (now - item.createdAt) / (1000 * 60 * 60 * 24 * 30));
          relevanceScore += recencyScore;
        }
        
        if (relevanceScore >= minRelevance) {
          // Update the item with the relevance score
          const scoredItem = { ...item, relevanceScore };
          this.items.set(id, scoredItem);
          filteredIds.add(id);
        }
      }
      
      // Update matching IDs to only those that match the text search
      matchingIds.clear();
      filteredIds.forEach(id => matchingIds.add(id));
    }

    // Convert the set of IDs to an array of items
    const matchingItems = Array.from(matchingIds).map(id => this.items.get(id)!);
    
    // Sort by relevance score (if available) or recency
    matchingItems.sort((a, b) => {
      if (a.relevanceScore !== undefined && b.relevanceScore !== undefined) {
        return b.relevanceScore - a.relevanceScore; // Higher scores first
      }
      return (b.lastAccessedAt || b.createdAt) - (a.lastAccessedAt || a.createdAt); // Most recent first
    });

    // Apply pagination
    const paginatedItems = matchingItems.slice(offset, offset + limit);
    
    // Update access times for retrieved items
    paginatedItems.forEach(item => {
      this.updateAccessTime(item.id);
    });

    return {
      items: paginatedItems,
      total: matchingItems.length
    };
  }

  /**
   * Get a specific memory item by ID
   * @param id The ID of the item to retrieve
   * @returns The memory item or null if not found
   */
  async get(id: string): Promise<MemoryItem | null> {
    const item = this.items.get(id);
    if (!item) return null;

    // Check if the item has expired
    if (this.isExpired(item)) {
      this.remove(id); // Clean up expired items
      return null;
    }

    // Update access time (for LRU tracking)
    this.updateAccessTime(id);

    // If compression is enabled, decompress before returning
    if (this.options.useCompression) {
      return {
        ...item,
        content: this.decompressContent(item.content)
      };
    }

    return item;
  }

  /**
   * Update an existing memory item
   * @param id The ID of the item to update
   * @param updates The updates to apply
   * @returns The updated item or null if not found
   */
  async update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null> {
    const item = this.items.get(id);
    if (!item) return null;

    // Check if the item has expired
    if (this.isExpired(item)) {
      this.remove(id); // Clean up expired items
      return null;
    }

    // Update the item in memory
    const updatedItem: MemoryItem = {
      ...item,
      ...updates,
      lastAccessedAt: Date.now()
    };

    // If updating content and compression is enabled, ensure it's compressed
    if (updates.content !== undefined && this.options.useCompression) {
      updatedItem.content = this.compressContent(updates.content);
    }

    // Update metadata indexes if metadata is changing and indexing is enabled
    if (updates.metadata && this.options.enableIndexing) {
      // Remove from existing metadata indexes
      this.removeFromMetadataIndexes(id, item.metadata || {});
      
      // Add to new metadata indexes
      this.addToMetadataIndexes(id, updates.metadata);
    }

    // Update the item
    this.items.set(id, updatedItem);
    this.updateAccessTime(id);

    // If compression is enabled, decompress before returning
    if (this.options.useCompression) {
      return {
        ...updatedItem,
        content: this.decompressContent(updatedItem.content)
      };
    }

    return updatedItem;
  }

  /**
   * Remove an item from memory
   * @param id The ID of the item to remove
   * @returns Whether the item was removed
   */
  async remove(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) return false;

    // Remove from all indexes if indexing is enabled
    if (this.options.enableIndexing && item.metadata) {
      this.removeFromMetadataIndexes(id, item.metadata);
    }

    // Remove from LRU tracking
    const lruIndex = this.lruOrder.indexOf(id);
    if (lruIndex !== -1) {
      this.lruOrder.splice(lruIndex, 1);
    }

    // Remove the item itself
    this.items.delete(id);

    return true;
  }

  /**
   * Clear all items from memory
   */
  async clear(): Promise<void> {
    this.items.clear();
    this.userIndex.clear();
    this.attributeIndex.clear();
    this.lruOrder = [];

    // Reinitialize indexes if needed
    if (this.options.enableIndexing) {
      ['userId', 'username', 'preference', 'history', 'interaction'].forEach(attr => {
        this.attributeIndex.set(attr, new Map<string, Set<string>>());
      });
    }
  }

  /**
   * Reset the memory (clear and reinitialize)
   */
  async reset(): Promise<void> {
    await this.clear();
  }

  /**
   * Get all memory items for a specific user
   * @param userId The user ID to get items for
   * @param limit Maximum number of items to return
   * @returns Memory items for the user
   */
  async getUserItems(userId: string, limit = 100): Promise<MemorySearchResult> {
    return this.search({
      metadata: { userId },
      limit
    });
  }

  /**
   * Get user preferences stored in memory
   * @param userId The user ID to get preferences for
   * @returns Object containing user preferences
   */
  async getUserPreferences(userId: string): Promise<Record<string, any>> {
    const result = await this.search({
      metadata: { userId, type: 'preference' },
      limit: 100
    });

    // Combine all preference items into a single object
    const preferences: Record<string, any> = {};
    for (const item of result.items) {
      try {
        const prefData = this.options.deserializer(item.content);
        Object.assign(preferences, prefData);
      } catch (e) {
        // Skip invalid preference data
        console.warn('Failed to parse preference data:', e);
      }
    }

    return preferences;
  }

  /**
   * Store a user preference
   * @param userId The user ID to store the preference for
   * @param key The preference key
   * @param value The preference value
   */
  async setUserPreference(userId: string, key: string, value: any): Promise<void> {
    const prefData = { [key]: value };
    const content = this.options.serializer(prefData);

    await this.add(content, {
      userId,
      type: 'preference',
      key
    });
  }

  /**
   * Add a user interaction to memory
   * @param userId The user ID
   * @param interaction The interaction details
   */
  async addUserInteraction(userId: string, interaction: Record<string, any>): Promise<void> {
    const content = this.options.serializer(interaction);

    await this.add(content, {
      userId,
      type: 'interaction',
      timestamp: Date.now(),
      ...interaction
    });
  }

  /**
   * Helper: Check if a memory item has expired
   * @private
   */
  private isExpired(item: MemoryItem, currentTime = Date.now()): boolean {
    if (this.options.expirationMs === 0) return false; // No expiration
    
    const lastAccess = item.lastAccessedAt || item.createdAt;
    return currentTime - lastAccess > this.options.expirationMs;
  }

  /**
   * Helper: Update the access time for an item
   * @private
   */
  private updateAccessTime(id: string): void {
    const item = this.items.get(id);
    if (!item) return;

    // Update the last accessed time
    item.lastAccessedAt = Date.now();
    this.items.set(id, item);

    // Update LRU ordering
    const lruIndex = this.lruOrder.indexOf(id);
    if (lruIndex !== -1) {
      this.lruOrder.splice(lruIndex, 1);
    }
    this.lruOrder.push(id); // Move to end (most recently used)
  }

  /**
   * Helper: Evict the least recently used item when max size is reached
   * @private
   */
  private evictLeastRecentlyUsed(): void {
    if (this.lruOrder.length === 0) return;

    const oldestId = this.lruOrder.shift();
    if (oldestId) {
      const item = this.items.get(oldestId);
      if (item && item.metadata && this.options.enableIndexing) {
        this.removeFromMetadataIndexes(oldestId, item.metadata);
      }
      this.items.delete(oldestId);
    }
  }

  /**
   * Helper: Remove an item from metadata indexes
   * @private
   */
  private removeFromMetadataIndexes(id: string, metadata: Record<string, any>): void {
    // Check for userId specifically for the user index
    const userId = metadata.userId || metadata.user_id;
    if (userId && this.userIndex.has(userId)) {
      const userItems = this.userIndex.get(userId)!;
      userItems.delete(id);
      if (userItems.size === 0) {
        this.userIndex.delete(userId);
      }
    }

    // Remove from attribute indexes
    Object.entries(metadata).forEach(([key, value]) => {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        return;
      }

      const valueStr = String(value);
      if (this.attributeIndex.has(key)) {
        const keyIndex = this.attributeIndex.get(key)!;
        if (keyIndex.has(valueStr)) {
          const itemsWithValue = keyIndex.get(valueStr)!;
          itemsWithValue.delete(id);
          if (itemsWithValue.size === 0) {
            keyIndex.delete(valueStr);
          }
        }
      }
    });
  }

  /**
   * Helper: Add an item to metadata indexes
   * @private
   */
  private addToMetadataIndexes(id: string, metadata: Record<string, any>): void {
    // Check for userId specifically for the user index
    const userId = metadata.userId || metadata.user_id;
    if (userId) {
      if (!this.userIndex.has(userId)) {
        this.userIndex.set(userId, new Set<string>());
      }
      this.userIndex.get(userId)!.add(id);
    }

    // Add to attribute indexes
    Object.entries(metadata).forEach(([key, value]) => {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        return;
      }

      const valueStr = String(value);
      if (!this.attributeIndex.has(key)) {
        this.attributeIndex.set(key, new Map<string, Set<string>>());
      }
      
      const keyIndex = this.attributeIndex.get(key)!;
      if (!keyIndex.has(valueStr)) {
        keyIndex.set(valueStr, new Set<string>());
      }
      
      keyIndex.get(valueStr)!.add(id);
    });
  }

  /**
   * Helper: Apply simple compression to content
   * @private
   */
  private compressContent(content: string): string {
    // In a real implementation, use a proper compression algorithm
    // For now, we'll use a simple base64 encoding as a placeholder
    return Buffer.from(content).toString('base64');
  }

  /**
   * Helper: Decompress content
   * @private
   */
  private decompressContent(compressedContent: string): string {
    // Matching the simple compression above
    return Buffer.from(compressedContent, 'base64').toString('utf8');
  }
}
