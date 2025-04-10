/**
 * OptimizedMemoryCache implementation
 * Uses WeakRef for large memory items to allow garbage collection
 * and minimize memory pressure while maintaining performance
 */

// Constants for optimization
const LARGE_OBJECT_THRESHOLD = 50000; // ~50KB in rough string or object equivalent

/**
 * Approximates the size of an object in memory
 * This is an estimation to determine if an object exceeds the threshold for weak reference storage
 */
function approximateSize(value: any): number {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'string') {
    // String size in bytes (2 bytes per character in JavaScript)
    return value.length * 2;
  }
  
  if (typeof value === 'number') return 8; // 64-bit float
  if (typeof value === 'boolean') return 4; // boolean
  
  if (Array.isArray(value)) {
    // Sum the approximate sizes of array elements plus overhead
    return value.reduce((size, item) => size + approximateSize(item), 0) + 32;
  }
  
  if (typeof value === 'object') {
    // Calculate the size of object properties plus overhead
    let size = 32; // object overhead
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        // Key size (string) + value size
        size += (key.length * 2) + approximateSize(value[key]);
      }
    }
    return size;
  }
  
  // Default size for other types
  return 8;
}

/**
 * Options for configuring OptimizedMemoryCache behavior
 */
export interface OptimizedMemoryCacheOptions {
  /**
   * Size threshold (in approximate bytes) for storing items as weak references
   * Items larger than this threshold will be stored as weak references
   * @default 50000 (~50KB)
   */
  largeObjectThreshold?: number;
  
  /**
   * Whether to track memory usage statistics
   * @default true
   */
  trackStats?: boolean;
}

/**
 * Memory cache item with metadata
 */
export interface MemoryCacheItem<T> {
  value: T;
  createdAt: number;
  lastAccessedAt: number;
  size: number;
  isWeak: boolean;
}

/**
 * OptimizedMemoryCache class
 * Provides efficient memory caching with weak references for large objects
 * to allow garbage collection when memory pressure is high
 */
export class OptimizedMemoryCache<T = any> {
  private strongCache = new Map<string, MemoryCacheItem<T>>();
  private weakCache = new Map<string, WeakRef<MemoryCacheItem<T>>>();
  private registry = new FinalizationRegistry<string>((key: string) => {
    // Clean up when object is garbage collected
    this.weakCache.delete(key);
    if (this.trackStats) {
      this.stats.weakRefs--;
      this.stats.evictions++;
    }
  });
  
  private largeObjectThreshold: number;
  private trackStats: boolean;
  
  // Memory usage statistics
  private stats = {
    strongRefs: 0,
    weakRefs: 0,
    hits: 0,
    misses: 0,
    evictions: 0
  };
  
  constructor(options: OptimizedMemoryCacheOptions = {}) {
    this.largeObjectThreshold = options.largeObjectThreshold ?? LARGE_OBJECT_THRESHOLD;
    this.trackStats = options.trackStats ?? true;
  }
  
  /**
   * Store a value in the cache
   * Large objects are stored as weak references to allow garbage collection
   */
  set(key: string, value: T): void {
    // Approximate object size to determine storage strategy
    const approximatedSize = approximateSize(value);
    
    // Create cache item with metadata
    const item: MemoryCacheItem<T> = {
      value,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      size: approximatedSize,
      isWeak: approximatedSize > this.largeObjectThreshold
    };
    
    // Store large objects as weak references
    if (item.isWeak) {
      const weakRef = new WeakRef(item);
      this.weakCache.set(key, weakRef);
      this.registry.register(item, key);
      
      if (this.trackStats) {
        this.stats.weakRefs++;
      }
    } else {
      // Store small objects directly for fast access
      this.strongCache.set(key, item);
      
      if (this.trackStats) {
        this.stats.strongRefs++;
      }
    }
  }
  
  /**
   * Retrieve a value from the cache, handling both strong and weak references
   */
  get(key: string): T | undefined {
    // Check strong cache first
    const strongItem = this.strongCache.get(key);
    if (strongItem) {
      // Update access time
      strongItem.lastAccessedAt = Date.now();
      
      if (this.trackStats) {
        this.stats.hits++;
      }
      
      return strongItem.value;
    }
    
    // Check weak cache if not found in strong cache
    const weakRef = this.weakCache.get(key);
    if (weakRef) {
      const item = weakRef.deref();
      
      if (item) {
        // Object still exists, update access time
        item.lastAccessedAt = Date.now();
        
        if (this.trackStats) {
          this.stats.hits++;
        }
        
        return item.value;
      }
      
      // Object has been garbage collected, clean up reference
      this.weakCache.delete(key);
    }
    
    if (this.trackStats) {
      this.stats.misses++;
    }
    
    // Key not found or reference was garbage collected
    return undefined;
  }
  
  /**
   * Remove an item from the cache
   */
  delete(key: string): boolean {
    const hadStrong = this.strongCache.delete(key);
    const hadWeak = this.weakCache.has(key);
    
    if (hadWeak) {
      this.weakCache.delete(key);
      
      if (this.trackStats) {
        this.stats.weakRefs--;
      }
    }
    
    if (hadStrong && this.trackStats) {
      this.stats.strongRefs--;
    }
    
    return hadStrong || hadWeak;
  }
  
  /**
   * Check if a key exists in the cache
   * Note: This doesn't guarantee the item still exists if it's a weak reference
   */
  has(key: string): boolean {
    return this.strongCache.has(key) || this.weakCache.has(key);
  }
  
  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.strongCache.clear();
    this.weakCache.clear();
    
    if (this.trackStats) {
      this.stats.strongRefs = 0;
      this.stats.weakRefs = 0;
    }
  }
  
  /**
   * Get the number of items in the cache
   * Note: This may include weak references to objects that have been garbage collected
   */
  get size(): number {
    return this.strongCache.size + this.weakCache.size;
  }
  
  /**
   * Get memory usage statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * Execute a function for each item in the strong cache
   * Skips weak references as they may have been garbage collected
   */
  forEach(callback: (value: T, key: string) => void): void {
    this.strongCache.forEach((item, key) => {
      callback(item.value, key);
    });
  }
  
  /**
   * Get all keys in the cache (both strong and weak)
   */
  keys(): string[] {
    return [
      ...Array.from(this.strongCache.keys()),
      ...Array.from(this.weakCache.keys())
    ];
  }
  
  /**
   * Get all values from the strong cache
   * (Excludes weak references as they may have been garbage collected)
   */
  values(): T[] {
    return Array.from(this.strongCache.values()).map(item => item.value);
  }
}
