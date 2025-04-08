/**
 * BaseMemory interface
 * Defines the foundation for all memory implementations
 */

export interface MemoryItem {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  createdAt: number;
  lastAccessedAt?: number;
  relevanceScore?: number;
}

export interface MemorySearchParams {
  query?: string;
  metadata?: Record<string, any>;
  limit?: number;
  offset?: number;
  minRelevance?: number;
}

export interface MemorySearchResult {
  items: MemoryItem[];
  total: number;
}

/**
 * BaseMemory interface that all memory implementations must implement
 * Optimized for:
 * - Efficient storage and retrieval
 * - Memory management
 * - Context-sensitive searching
 */
export interface BaseMemory {
  /**
   * Add an item to memory
   */
  add(content: string, metadata?: Record<string, any>): Promise<MemoryItem>;
  
  /**
   * Retrieve items from memory based on search parameters
   */
  search(params: MemorySearchParams): Promise<MemorySearchResult>;
  
  /**
   * Get an item by its ID
   */
  get(id: string): Promise<MemoryItem | null>;
  
  /**
   * Update an existing memory item
   */
  update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null>;
  
  /**
   * Remove an item from memory
   */
  remove(id: string): Promise<boolean>;
  
  /**
   * Clear all items from memory
   */
  clear(): Promise<void>;
  
  /**
   * Reset the memory (clear and initialize)
   */
  reset(): Promise<void>;
}
