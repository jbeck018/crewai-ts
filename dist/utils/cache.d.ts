/**
 * Cache implementation
 * Optimized for efficient caching with minimal overhead
 */
export interface CacheOptions<T = any> {
    /**
     * Maximum number of items to store in the cache
     * @default 1000
     */
    maxSize?: number;
    /**
     * Default TTL (Time To Live) in milliseconds
     * Set to 0 for no expiration
     * @default 0
     */
    ttl?: number;
    /**
     * Whether to use LRU (Least Recently Used) eviction policy
     * @default true
     */
    useLRU?: boolean;
    /**
     * Function to serialize values before storing
     * Useful for complex objects that need string serialization
     */
    serialize?: (value: T) => string;
    /**
     * Function to deserialize values after retrieval
     * Paired with serialize function
     */
    deserialize?: (data: string) => T;
    /**
     * Storage backend to use
     * @default 'memory'
     */
    storageType?: 'memory' | 'localStorage' | 'sessionStorage' | 'custom';
    /**
     * Custom storage implementation
     * Required if storageType is 'custom'
     */
    customStorage?: {
        getItem: (key: string) => string | null | Promise<string | null>;
        setItem: (key: string, value: string) => void | Promise<void>;
        removeItem: (key: string) => void | Promise<void>;
    };
    /**
     * Namespace to prefix all cache keys
     * @default 'crewai-cache'
     */
    namespace?: string;
}
/**
 * Cache class for efficient data caching
 * Optimized for:
 * - Fast access with Map data structure
 * - Memory efficiency with LRU eviction
 * - Flexibility with TTL expiration
 */
export declare class Cache<T = any> {
    private cache;
    private maxSize;
    private ttl;
    private useLRU;
    private namespace;
    private storageType;
    private serialize;
    private deserialize;
    private customStorage?;
    constructor(options?: CacheOptions<T>);
    /**
     * Get a value from the cache
     */
    get(key: string): Promise<T | undefined>;
    /**
     * Set a value in the cache
     */
    set(key: string, value: T, options?: {
        ttl?: number;
    }): Promise<void>;
    /**
     * Check if a key exists in the cache and is not expired
     */
    has(key: string): Promise<boolean>;
    /**
     * Delete a key from the cache
     */
    delete(key: string): Promise<boolean>;
    /**
     * Clear all entries from the cache
     */
    clear(): Promise<void>;
    /**
     * Get all keys in the cache
     */
    keys(): string[];
    /**
     * Get the number of entries in the cache
     */
    size(): number;
    /**
     * Evict entries based on the eviction policy
     */
    private evict;
    /**
     * Remove all expired entries from the cache
     * Returns the number of entries removed
     */
    private removeExpiredEntries;
    /**
     * Get the full key with namespace
     */
    private getFullKey;
    /**
     * Initialize cache from storage
     */
    private initFromStorage;
    /**
     * Get a value from storage
     */
    private getFromStorage;
    /**
     * Set a value in storage
     */
    private setInStorage;
    /**
     * Delete a value from storage
     */
    private deleteFromStorage;
    /**
     * Clear all values with our namespace from storage
     */
    private clearStorage;
}
/**
 * Create a global memoization cache for function results
 */
export declare function memoize<T extends (...args: any[]) => any>(fn: T, options?: {
    /** Cache key generator function */
    keyFn?: (...args: Parameters<T>) => string;
    /** Time-to-live in milliseconds */
    ttl?: number;
    /** Maximum cache size */
    maxSize?: number;
}): T;
/**
 * Singleton cache instance for global use
 */
export declare const globalCache: Cache<any>;
//# sourceMappingURL=cache.d.ts.map