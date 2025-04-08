/**
 * Cache implementation
 * Optimized for efficient caching with minimal overhead
 */
/**
 * Cache class for efficient data caching
 * Optimized for:
 * - Fast access with Map data structure
 * - Memory efficiency with LRU eviction
 * - Flexibility with TTL expiration
 */
export class Cache {
    cache = new Map();
    maxSize;
    ttl;
    useLRU;
    namespace;
    storageType;
    serialize;
    deserialize;
    customStorage;
    constructor(options = {}) {
        this.maxSize = options.maxSize ?? 1000;
        this.ttl = options.ttl ?? 0;
        this.useLRU = options.useLRU ?? true;
        this.namespace = options.namespace ?? 'crewai-cache';
        this.storageType = options.storageType ?? 'memory';
        this.serialize = options.serialize ?? JSON.stringify;
        this.deserialize = options.deserialize ?? JSON.parse;
        this.customStorage = options.customStorage;
        // Validate options
        if (this.storageType === 'custom' && !this.customStorage) {
            throw new Error('customStorage is required when storageType is custom');
        }
        // Initialize from persistent storage if applicable
        if (this.storageType !== 'memory') {
            this.initFromStorage();
        }
    }
    /**
     * Get a value from the cache
     */
    async get(key) {
        // For non-memory storage, retrieve from storage
        if (this.storageType !== 'memory') {
            return this.getFromStorage(key);
        }
        const fullKey = this.getFullKey(key);
        const entry = this.cache.get(fullKey);
        // If entry doesn't exist or is expired, return undefined
        if (!entry || (entry.expires && entry.expires < Date.now())) {
            if (entry) {
                // Remove expired entry
                this.cache.delete(fullKey);
            }
            return undefined;
        }
        // Update last accessed time if using LRU
        if (this.useLRU) {
            entry.lastAccessed = Date.now();
            this.cache.set(fullKey, entry);
        }
        return entry.value;
    }
    /**
     * Set a value in the cache
     */
    async set(key, value, options) {
        const fullKey = this.getFullKey(key);
        const ttl = options?.ttl ?? this.ttl;
        const entry = {
            value,
            lastAccessed: Date.now(),
            expires: ttl ? Date.now() + ttl : undefined
        };
        // For non-memory storage
        if (this.storageType !== 'memory') {
            await this.setInStorage(key, entry);
            return;
        }
        // Ensure we don't exceed max size
        if (this.cache.size >= this.maxSize && !this.cache.has(fullKey)) {
            this.evict();
        }
        this.cache.set(fullKey, entry);
    }
    /**
     * Check if a key exists in the cache and is not expired
     */
    async has(key) {
        // For non-memory storage
        if (this.storageType !== 'memory') {
            const value = await this.getFromStorage(key);
            return value !== undefined;
        }
        const fullKey = this.getFullKey(key);
        const entry = this.cache.get(fullKey);
        if (!entry) {
            return false;
        }
        // Check if expired
        if (entry.expires && entry.expires < Date.now()) {
            this.cache.delete(fullKey);
            return false;
        }
        return true;
    }
    /**
     * Delete a key from the cache
     */
    async delete(key) {
        const fullKey = this.getFullKey(key);
        // For non-memory storage
        if (this.storageType !== 'memory') {
            await this.deleteFromStorage(key);
            return true;
        }
        return this.cache.delete(fullKey);
    }
    /**
     * Clear all entries from the cache
     */
    async clear() {
        if (this.storageType !== 'memory') {
            // For browser storage, we need to iterate through all keys
            // and remove those with our namespace
            await this.clearStorage();
            return;
        }
        this.cache.clear();
    }
    /**
     * Get all keys in the cache
     */
    keys() {
        if (this.storageType !== 'memory') {
            // For non-memory storage, we'd need to list all keys
            // This is a simplified implementation
            throw new Error('keys() method is not supported for non-memory storage');
        }
        const prefixLength = this.getFullKey('').length;
        return Array.from(this.cache.keys()).map(key => key.substring(prefixLength));
    }
    /**
     * Get the number of entries in the cache
     */
    size() {
        if (this.storageType !== 'memory') {
            // For non-memory storage, we'd need to count all keys
            // This is a simplified implementation
            throw new Error('size() method is not supported for non-memory storage');
        }
        // Remove expired entries first
        this.removeExpiredEntries();
        return this.cache.size;
    }
    /**
     * Evict entries based on the eviction policy
     */
    evict() {
        if (this.cache.size === 0) {
            return;
        }
        // Remove expired entries first
        const removed = this.removeExpiredEntries();
        if (removed > 0 || this.cache.size < this.maxSize) {
            return;
        }
        // If still at capacity, use LRU policy if enabled
        if (this.useLRU) {
            let oldest = null;
            for (const entry of this.cache.entries()) {
                if (!oldest || entry[1].lastAccessed < oldest[1].lastAccessed) {
                    oldest = entry;
                }
            }
            if (oldest) {
                this.cache.delete(oldest[0]);
            }
        }
        else {
            // If LRU is not enabled, just remove a random entry
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
    }
    /**
     * Remove all expired entries from the cache
     * Returns the number of entries removed
     */
    removeExpiredEntries() {
        if (this.ttl === 0) {
            return 0; // No expiration
        }
        const now = Date.now();
        let count = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expires && entry.expires < now) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }
    /**
     * Get the full key with namespace
     */
    getFullKey(key) {
        return `${this.namespace}:${key}`;
    }
    /**
     * Initialize cache from storage
     */
    async initFromStorage() {
        // This is a simplified implementation
        // In a real implementation, we would load all keys from storage
        // with our namespace and populate the cache
        // For browser storage
        if (this.storageType === 'localStorage' || this.storageType === 'sessionStorage') {
            // Implementation would depend on the environment
            // Skip for now as it requires browser APIs
        }
        else if (this.storageType === 'custom' && this.customStorage) {
            // Custom storage initialization would be implementation-specific
        }
    }
    /**
     * Get a value from storage
     */
    async getFromStorage(key) {
        const fullKey = this.getFullKey(key);
        let serializedData = null;
        try {
            if (this.storageType === 'localStorage') {
                // Implementation would depend on the environment
                if (typeof localStorage !== 'undefined') {
                    serializedData = localStorage.getItem(fullKey);
                }
            }
            else if (this.storageType === 'sessionStorage') {
                // Implementation would depend on the environment
                if (typeof sessionStorage !== 'undefined') {
                    serializedData = sessionStorage.getItem(fullKey);
                }
            }
            else if (this.storageType === 'custom' && this.customStorage) {
                serializedData = await this.customStorage.getItem(fullKey);
            }
            if (!serializedData) {
                return undefined;
            }
            // Parse the serialized data
            const parsed = JSON.parse(serializedData);
            // Check if expired
            if (parsed.expires && parsed.expires < Date.now()) {
                await this.deleteFromStorage(key);
                return undefined;
            }
            return this.deserialize(parsed.value);
        }
        catch (e) {
            // If there's an error reading from storage, remove the key
            await this.deleteFromStorage(key);
            return undefined;
        }
    }
    /**
     * Set a value in storage
     */
    async setInStorage(key, entry) {
        const fullKey = this.getFullKey(key);
        // Serialize the entry
        const serializedValue = this.serialize(entry.value);
        const serializedEntry = JSON.stringify({
            value: serializedValue,
            expires: entry.expires,
            lastAccessed: entry.lastAccessed
        });
        try {
            if (this.storageType === 'localStorage') {
                // Implementation would depend on the environment
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(fullKey, serializedEntry);
                }
            }
            else if (this.storageType === 'sessionStorage') {
                // Implementation would depend on the environment
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem(fullKey, serializedEntry);
                }
            }
            else if (this.storageType === 'custom' && this.customStorage) {
                await this.customStorage.setItem(fullKey, serializedEntry);
            }
        }
        catch (e) {
            // If storage is full, evict some entries
            // This is a simplified implementation
            console.error('Error setting item in storage:', e);
        }
    }
    /**
     * Delete a value from storage
     */
    async deleteFromStorage(key) {
        const fullKey = this.getFullKey(key);
        try {
            if (this.storageType === 'localStorage') {
                // Implementation would depend on the environment
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem(fullKey);
                }
            }
            else if (this.storageType === 'sessionStorage') {
                // Implementation would depend on the environment
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.removeItem(fullKey);
                }
            }
            else if (this.storageType === 'custom' && this.customStorage) {
                await this.customStorage.removeItem(fullKey);
            }
        }
        catch (e) {
            console.error('Error removing item from storage:', e);
        }
    }
    /**
     * Clear all values with our namespace from storage
     */
    async clearStorage() {
        try {
            // This is a simplified implementation
            // In a real implementation, we would iterate through all keys
            // and remove those with our namespace
            if (this.storageType === 'localStorage') {
                // Implementation would depend on the environment
                if (typeof localStorage !== 'undefined') {
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith(this.namespace + ':')) {
                            localStorage.removeItem(key);
                        }
                    }
                }
            }
            else if (this.storageType === 'sessionStorage') {
                // Implementation would depend on the environment
                if (typeof sessionStorage !== 'undefined') {
                    for (let i = sessionStorage.length - 1; i >= 0; i--) {
                        const key = sessionStorage.key(i);
                        if (key && key.startsWith(this.namespace + ':')) {
                            sessionStorage.removeItem(key);
                        }
                    }
                }
            }
            else if (this.storageType === 'custom' && this.customStorage) {
                // Custom storage would need its own implementation for clearing
                // This is not a standard interface
            }
        }
        catch (e) {
            console.error('Error clearing storage:', e);
        }
    }
}
/**
 * Create a global memoization cache for function results
 */
export function memoize(fn, options = {}) {
    const cache = new Cache({
        ttl: options.ttl,
        maxSize: options.maxSize
    });
    const keyFn = options.keyFn ?? ((...args) => JSON.stringify(args));
    return ((...args) => {
        const key = keyFn(...args);
        return (async () => {
            const cached = await cache.get(key);
            if (cached !== undefined) {
                return cached;
            }
            const result = await fn(...args);
            await cache.set(key, result);
            return result;
        })();
    });
}
/**
 * Singleton cache instance for global use
 */
export const globalCache = new Cache();
//# sourceMappingURL=cache.js.map