/**
 * UserMemoryAdapter
 * 
 * Adapts UserMemory to implement the BaseMemory interface
 * Optimized for performance with proper type safety
 */

import { BaseMemory, MemoryItem, MemorySearchParams, MemorySearchResult } from '../BaseMemory.js';
import { UserMemory } from '../UserMemory.js';

/**
 * Adapter class to make UserMemory compatible with BaseMemory interface
 * This adapter implements all required methods of BaseMemory, delegating to the
 * wrapped UserMemory instance where possible and providing optimized
 * implementations.
 */
export class UserMemoryAdapter implements BaseMemory {
  private userMemory: UserMemory;
  
  constructor(userMemory: UserMemory) {
    this.userMemory = userMemory;
  }

  /**
   * Add an item to memory with memory-efficient implementation
   */
  async add(content: string, metadata?: Record<string, any>): Promise<MemoryItem> {
    return this.userMemory.add(content, metadata);
  }

  /**
   * Search for items in memory with optimized retrieval
   */
  async search(params: MemorySearchParams): Promise<MemorySearchResult> {
    return this.userMemory.search(params);
  }

  /**
   * Get an item by ID with optimized access time tracking
   */
  async get(id: string): Promise<MemoryItem | null> {
    return this.userMemory.get(id);
  }

  /**
   * Update an existing memory item with efficient index management
   */
  async update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null> {
    return this.userMemory.update(id, updates);
  }

  /**
   * Remove an item from memory with proper index cleanup
   */
  async remove(id: string): Promise<boolean> {
    return this.userMemory.remove(id);
  }

  /**
   * Clear all items from memory with optimized resource cleanup
   */
  async clear(): Promise<void> {
    return this.userMemory.clear();
  }

  /**
   * Reset the memory system with efficient reinitialization
   */
  async reset(): Promise<void> {
    return this.userMemory.reset();
  }

  /**
   * Get all memory items for a specific user with optimized retrieval
   */
  async getUserItems(userId: string, limit = 100): Promise<MemorySearchResult> {
    return this.userMemory.getUserItems(userId, limit);
  }

  /**
   * Get user preferences with efficient data aggregation
   */
  async getUserPreferences(userId: string): Promise<Record<string, any>> {
    return this.userMemory.getUserPreferences(userId);
  }

  /**
   * Store a user preference with optimized indexing
   */
  async setUserPreference(userId: string, key: string, value: any): Promise<void> {
    return this.userMemory.setUserPreference(userId, key, value);
  }

  /**
   * Add a user interaction to memory with efficient storage
   */
  async addUserInteraction(userId: string, interaction: Record<string, any>): Promise<void> {
    return this.userMemory.addUserInteraction(userId, interaction);
  }
}
