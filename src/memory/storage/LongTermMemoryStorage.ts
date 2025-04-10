/**
 * Storage adapter for long-term memory
 * Optimized for memory efficiency and persistent storage
 */
import fs from 'fs';
import path from 'path';
import LRUCache from 'lru-cache';

// Memory item interface with efficient structure
export interface MemoryItem {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
  embeddings?: Float32Array; // Memory-efficient storage using Float32Array
}

/**
 * Long-term memory storage implementation
 * Uses efficient file I/O, caching, and memory-optimized data structures
 */
export class LongTermMemoryStorage {
  private dbPath: string;
  private cache: LRUCache<string, MemoryItem>;
  
  /**
   * Initialize storage with optimized caching
   * @param dbPath Optional custom database path
   */
  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), '.crewai', 'long_term_memory.json');
    
    // Initialize LRU cache with memory constraints
    this.cache = new LRUCache<string, MemoryItem>({
      max: 100, // Maximum items in cache
      maxSize: 5 * 1024 * 1024, // 5MB max cache size
      sizeCalculation: (value) => {
        // Estimate memory size in bytes - Float32Array is 4 bytes per element
        const embeddingSize = value.embeddings ? value.embeddings.length * 4 : 0;
        return JSON.stringify(value).length + embeddingSize;
      },
      ttl: 1000 * 60 * 60 // 1 hour TTL
    });
    
    this.ensureStorageExists();
  }
  
  /**
   * Ensure storage directory exists
   */
  private ensureStorageExists(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, JSON.stringify([]));
    }
  }
  
  /**
   * Save a memory item
   * @param item Memory item to save (with or without ID)
   * @returns Saved memory item with ID
   */
  async save(item: Omit<MemoryItem, 'id' | 'timestamp'> & { id?: string, timestamp?: number }): Promise<MemoryItem> {
    const items = await this.loadAll();
    
    // Check if item already exists
    const existingIndex = item.id ? items.findIndex(i => i.id === item.id) : -1;
    
    // Create a proper memory item with all required fields
    const memoryItem: MemoryItem = {
      id: item.id || `mem_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      content: item.content,
      metadata: item.metadata || {},
      timestamp: item.timestamp || Date.now(),
      embeddings: item.embeddings
    };
    
    if (existingIndex >= 0) {
      // Update existing item
      items[existingIndex] = memoryItem;
    } else {
      // Add new item
      items.push(memoryItem);
    }
    
    // Serialization helper function for Float32Array
    const serializer = (key: string, value: any) => {
      if (value instanceof Float32Array) {
        return {
          type: 'Float32Array',
          data: Array.from(value)
        };
      }
      return value;
    };
    
    // Write to storage
    await fs.promises.writeFile(this.dbPath, JSON.stringify(items, serializer, 2));
    
    // Update cache
    this.cache.set(memoryItem.id, memoryItem);
    
    return memoryItem;
  }
  
  /**
   * Load all memory items
   * @returns Array of memory items
   */
  async loadAll(): Promise<MemoryItem[]> {
    try {
      const data = await fs.promises.readFile(this.dbPath, 'utf8');
      
      // Deserialize JSON with proper handling of Float32Array
      const deserializer = (_key: string, value: any) => {
        if (value && value.type === 'Float32Array' && Array.isArray(value.data)) {
          return new Float32Array(value.data);
        }
        return value;
      };
      
      const items: MemoryItem[] = JSON.parse(data || '[]', deserializer);
      
      // Update cache with all items
      items.forEach(item => {
        this.cache.set(item.id, item);
      });
      
      return items;
    } catch (error) {
      console.error('Error loading memory items:', error);
      return [];
    }
  }
  
  /**
   * Get a memory item by ID
   * Uses efficient caching for performance
   * @param id Memory item ID
   * @returns Memory item or null if not found
   */
  async getById(id: string): Promise<MemoryItem | null> {
    // Check cache first
    const cachedItem = this.cache.get(id);
    if (cachedItem) {
      return cachedItem;
    }
    
    const items = await this.loadAll();
    const item = items.find(i => i.id === id);
    
    return item || null;
  }
  
  /**
   * Delete a memory item by ID
   * @param id Memory item ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const items = await this.loadAll();
    const initialLength = items.length;
    
    const filteredItems = items.filter(item => item.id !== id);
    
    if (filteredItems.length === initialLength) {
      return false; // Item not found
    }
    
    await fs.promises.writeFile(this.dbPath, JSON.stringify(filteredItems, null, 2));
    this.cache.delete(id);
    
    return true;
  }
  
  /**
   * Clear all memory items
   */
  async clear(): Promise<void> {
    await fs.promises.writeFile(this.dbPath, JSON.stringify([]));
    this.cache.clear();
  }
  
  /**
   * Search memory items by content
   * Simple text-based search implementation
   * @param query Search query
   * @param limit Maximum number of results (optional)
   * @returns Matching memory items
   */
  async search(query: string, limit?: number): Promise<MemoryItem[]> {
    const items = await this.loadAll();
    
    // Simple text search implementation
    const matchingItems = items
      .filter(item => item.content.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
    
    return limit ? matchingItems.slice(0, limit) : matchingItems;
  }
}
