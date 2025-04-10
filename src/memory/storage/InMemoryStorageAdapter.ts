/**
 * InMemoryStorageAdapter
 * 
 * An in-memory implementation of the StorageAdapter interface
 * Optimized for performance in development environments
 */

import { BaseStorageAdapter, StorageAdapterOptions } from './StorageAdapter.js';

/**
 * InMemoryStorageAdapter Options
 */
export interface InMemoryStorageOptions extends StorageAdapterOptions {
  /**
   * Maximum number of items to store in memory
   * When exceeded, least recently used items are evicted
   */
  maxItems?: number;
  
  /**
   * Whether to persist items between process restarts (if localStorage is available)
   */
  persistent?: boolean;
}

/**
 * InMemoryStorageAdapter implements the StorageAdapter interface
 * using an in-memory Map with optional LRU eviction
 */
export class InMemoryStorageAdapter extends BaseStorageAdapter {
  private storage = new Map<string, { value: any; timestamp: number; }>(); 
  private accessOrder: string[] = []; // For LRU tracking
  private maxItems: number;
  private persistent: boolean;
  
  constructor(options: InMemoryStorageOptions = {}) {
    super(options);
    this.maxItems = options.maxItems || 10000;
    this.persistent = options.persistent || false;
    
    // If persistent is enabled, try to load items from localStorage
    if (this.persistent) {
      this.loadFromPersistence();
    }
  }
  
  /**
   * Save a value with optimized memory usage
   */
  async save(key: string, value: any): Promise<void> {
    const namespacedKey = this.getNamespacedKey(key);
    
    // Create storage item with metadata
    const item = {
      value,
      timestamp: Date.now()
    };
    
    // Check if we need to evict items (LRU policy)
    if (this.storage.size >= this.maxItems && !this.storage.has(namespacedKey)) {
      this.evictLRU();
    }
    
    // Store the item
    this.storage.set(namespacedKey, item);
    
    // Update access order for LRU tracking
    this.updateAccessOrder(namespacedKey);
    
    // Persist if enabled
    if (this.persistent) {
      this.persistToDisk();
    }
  }
  
  /**
   * Load a value with optimized retrieval
   */
  async load(key: string): Promise<any | null> {
    const namespacedKey = this.getNamespacedKey(key);
    const item = this.storage.get(namespacedKey);
    
    if (!item) return null;
    
    // Check if item has expired
    if (this.isExpired(item.timestamp)) {
      // Remove expired item
      await this.delete(key);
      return null;
    }
    
    // Update access order for LRU tracking
    this.updateAccessOrder(namespacedKey);
    
    return item.value;
  }
  
  /**
   * Delete a value with cleanup
   */
  async delete(key: string): Promise<boolean> {
    const namespacedKey = this.getNamespacedKey(key);
    const deleted = this.storage.delete(namespacedKey);
    
    if (deleted) {
      // Remove from access order tracking
      this.accessOrder = this.accessOrder.filter(k => k !== namespacedKey);
      
      // Persist changes if enabled
      if (this.persistent) {
        this.persistToDisk();
      }
    }
    
    return deleted;
  }
  
  /**
   * Clear all values
   */
  async clear(): Promise<void> {
    this.storage.clear();
    this.accessOrder = [];
    
    // Clear persistence if enabled
    if (this.persistent) {
      this.clearPersistence();
    }
  }
  
  /**
   * Get all keys with namespace removed
   */
  async keys(): Promise<string[]> {
    const prefix = `${this.options.namespace}:`;
    const allKeys = Array.from(this.storage.keys());
    
    // Remove namespace from keys and filter out expired items
    const validKeys: string[] = [];
    
    for (const key of allKeys) {
      // Remove namespace prefix
      if (key.startsWith(prefix)) {
        const baseKey = key.substring(prefix.length);
        const item = this.storage.get(key);
        
        // Only include non-expired items
        if (item && !this.isExpired(item.timestamp)) {
          validKeys.push(baseKey);
        } else if (item) {
          // Clean up expired items
          this.storage.delete(key);
          this.accessOrder = this.accessOrder.filter(k => k !== key);
        }
      }
    }
    
    return validKeys;
  }
  
  /**
   * Get memory usage statistics
   */
  getStats(): { size: number; memoryUsage: number } {
    const size = this.storage.size;
    
    // Estimate memory usage in bytes (rough approximation)
    let memoryUsage = 0;
    for (const [key, item] of this.storage.entries()) {
      memoryUsage += key.length * 2; // String size (2 bytes per char)
      memoryUsage += 8; // timestamp (number = 8 bytes)
      
      // Estimate value size
      const valueStr = JSON.stringify(item.value);
      memoryUsage += valueStr ? valueStr.length * 2 : 0;
    }
    
    return { size, memoryUsage };
  }
  
  /**
   * Helper: Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }
  
  /**
   * Helper: Evict least recently used item
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    
    // Get the least recently used key
    const oldestKey = this.accessOrder.shift();
    if (oldestKey) {
      this.storage.delete(oldestKey);
      
      // Persist changes if enabled
      if (this.persistent) {
        this.persistToDisk();
      }
    }
  }
  
  /**
   * Helper: Persist to disk (if possible)
   */
  private persistToDisk(): void {
    // Only try if we're in a browser environment with localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        // Convert storage to a serializable format
        const serializableData: Record<string, { value: string; timestamp: number; }> = {};
        
        for (const [key, item] of this.storage.entries()) {
          serializableData[key] = {
            value: this.serialize(item.value),
            timestamp: item.timestamp
          };
        }
        
        // Store data
        localStorage.setItem(
          `${this.options.namespace}_storage`, 
          JSON.stringify(serializableData)
        );
        
        // Store access order
        localStorage.setItem(
          `${this.options.namespace}_access_order`,
          JSON.stringify(this.accessOrder)
        );
      } catch (e) {
        if (this.options.debug) {
          console.error('Failed to persist memory to localStorage:', e);
        }
      }
    }
  }
  
  /**
   * Helper: Load from persistence
   */
  private loadFromPersistence(): void {
    // Only try if we're in a browser environment with localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        // Load storage data
        const storageData = localStorage.getItem(`${this.options.namespace}_storage`);
        if (storageData) {
          const parsed = JSON.parse(storageData);
          
          // Rebuild storage
          for (const [key, itemData] of Object.entries(parsed)) {
            const item = itemData as { value: string; timestamp: number; };
            
            // Skip expired items
            if (this.isExpired(item.timestamp)) continue;
            
            this.storage.set(key, {
              value: this.deserialize(item.value),
              timestamp: item.timestamp
            });
          }
        }
        
        // Load access order
        const accessOrderData = localStorage.getItem(`${this.options.namespace}_access_order`);
        if (accessOrderData) {
          this.accessOrder = JSON.parse(accessOrderData);
          
          // Filter out any keys that don't exist in storage
          this.accessOrder = this.accessOrder.filter(key => this.storage.has(key));
        }
      } catch (e) {
        if (this.options.debug) {
          console.error('Failed to load memory from localStorage:', e);
        }
      }
    }
  }
  
  /**
   * Helper: Clear persistence data
   */
  private clearPersistence(): void {
    // Only try if we're in a browser environment with localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(`${this.options.namespace}_storage`);
        localStorage.removeItem(`${this.options.namespace}_access_order`);
      } catch (e) {
        if (this.options.debug) {
          console.error('Failed to clear persisted memory:', e);
        }
      }
    }
  }
}
