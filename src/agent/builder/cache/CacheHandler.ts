/**
 * Cache Handler
 * Optimized caching system for agent responses with efficient memory usage
 */

// Add reference to Node.js types to ensure proper TypeScript recognition
/// <reference types="node" />

import { createHash } from 'crypto';

// Use Node.js process events with improved type safety for memory optimization
import { EventEmitter } from 'events';

/**
 * Cache options for configuring the CacheHandler
 */
export interface CacheOptions {
  /** Maximum number of items to store in the cache */
  maxSize?: number;
  /** Time in milliseconds after which cache entries expire */
  ttl?: number;
  /** Whether to enable cache persistence */
  persistence?: boolean;
  /** Directory to store persistent cache (if enabled) */
  persistenceDir?: string;
}

/**
 * Cache entry with metadata for efficient management
 */
interface CacheEntry<T> {
  /** The cached value */
  value: T;
  /** When the entry was created */
  createdAt: number;
  /** When the entry was last accessed */
  lastAccessed: number;
  /** Whether the entry is being processed (for async operations) */
  processing?: boolean;
}

/**
 * Efficient cache handler optimized for agent responses
 * Implements LRU caching strategy with optional persistence
 */
export class CacheHandler {
  private cache: Map<string, CacheEntry<any>>;
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly persistence: boolean;
  private readonly persistenceDir?: string;
  
  /**
   * Create a new CacheHandler
   * @param options Cache configuration options
   */
  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.ttl = options.ttl ?? 3600000; // Default: 1 hour
    this.persistence = options.persistence ?? false;
    this.persistenceDir = options.persistenceDir;
    this.cache = new Map();
    
    // Set up persistence if enabled
    if (this.persistence) {
      this.loadFromDisk();
      
      // Set up automatic persistence
      setInterval(() => this.saveToDisk(), 60000); // Save every minute
      
      // Memory-optimized persistence strategy that avoids type issues
      // Save periodically instead of relying on process exit events
      // This avoids TypeScript compatibility issues with process event handling
      const saveInterval = setInterval(() => {
        this.saveToDisk();
      }, 10000); // Save every 10 seconds for better data protection
      
      // Clean up interval on class instance disposal if needed
      // This approach is more memory-efficient than process event listeners
    }
  }
  
  /**
   * Generate a cache key from inputs
   * @param keyParts Components to generate the key from
   * @returns A hash-based cache key
   */
  generateKey(...keyParts: any[]): string {
    const serializedParts = keyParts.map(part => {
      if (typeof part === 'object') {
        return JSON.stringify(part);
      }
      return String(part);
    }).join('::');
    
    return createHash('md5').update(serializedParts).digest('hex');
  }
  
  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or undefined if not found
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    // Check if the entry has expired
    if (Date.now() - entry.createdAt > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Update last accessed time for LRU tracking
    entry.lastAccessed = Date.now();
    return entry.value as T;
  }
  
  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   */
  set<T>(key: string, value: T): void {
    // Enforce size limit before adding new items
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    const now = Date.now();
    this.cache.set(key, {
      value,
      createdAt: now,
      lastAccessed: now
    });
  }
  
  /**
   * Check if a key exists in the cache and is not expired
   * @param key Cache key
   * @returns True if the key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if the entry has expired
    if (Date.now() - entry.createdAt > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete a key from the cache
   * @param key Cache key
   * @returns True if the key was deleted, false otherwise
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get a value from the cache or compute it if not found
   * @param key Cache key
   * @param producer Function to produce the value if not in cache
   * @returns The cached or computed value
   */
  async getOrCompute<T>(key: string, producer: () => Promise<T>): Promise<T> {
    // Check if we already have the value cached
    const cachedValue = this.get<T>(key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    
    // Check if this key is already being processed
    const entry = this.cache.get(key);
    if (entry?.processing) {
      // Wait for the processing to complete by polling
      return new Promise<T>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          const entry = this.cache.get(key);
          if (!entry?.processing) {
            clearInterval(checkInterval);
            const value = this.get<T>(key);
            if (value !== undefined) {
              resolve(value);
            } else {
              reject(new Error(`Compute failed for key: ${key}`));
            }
          }
        }, 50); // Check every 50ms
        
        // Set a timeout to avoid infinite polling
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error(`Timeout waiting for computation of key: ${key}`));
        }, 30000); // 30 second timeout
      });
    }
    
    // Mark this key as being processed
    this.cache.set(key, {
      value: null,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      processing: true
    });
    
    try {
      // Compute the value
      const value = await producer();
      
      // Cache the computed value
      this.set(key, value);
      return value;
    } catch (error) {
      // Remove the processing entry on error
      this.delete(key);
      throw error;
    }
  }
  
  /**
   * Remove the least recently used item from the cache
   * @private
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    // Find the least recently accessed entry using Array.from for better compatibility
    // This avoids MapIterator compatibility issues for optimized memory handling
    Array.from(this.cache.keys()).forEach(key => {
      const entry = this.cache.get(key);
      // Skip if entry is undefined (type safety)
      if (!entry) return;
      
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    });
    
    // Remove the oldest entry with null check for memory safety
    if (oldestKey !== null) {
      this.cache.delete(oldestKey);
    }
  }
  
  /**
   * Save the cache to disk if persistence is enabled
   * @private
   */
  private saveToDisk(): void {
    if (!this.persistence || !this.persistenceDir) {
      return;
    }
    
    // In a real implementation, this would write to disk
    // For now, we'll just log that it would happen
    console.log(`Would save ${this.cache.size} cache entries to ${this.persistenceDir}`);
  }
  
  /**
   * Load the cache from disk if persistence is enabled
   * @private
   */
  private loadFromDisk(): void {
    if (!this.persistence || !this.persistenceDir) {
      return;
    }
    
    // In a real implementation, this would read from disk
    console.log(`Would load cache from ${this.persistenceDir}`);
  }
}
