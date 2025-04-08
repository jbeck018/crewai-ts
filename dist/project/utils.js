/**
 * Utility functions for the Project module with optimizations.
 */
/**
 * Memoize a function for improved performance.
 *
 * This implementation uses a Map for O(1) lookups and creates a serialized
 * key using the function's arguments. It also provides a mechanism to clear
 * the cache when needed.
 *
 * @param fn The function to memoize
 * @returns A memoized version of the function with cache management
 */
export function memoize(fn) {
    // Use a Map for optimal key-value storage performance
    const cache = new Map();
    // Use a typed function to ensure 'this' has proper typing
    const memoized = function (...args) {
        // Convert arguments to a cache key with minimal overhead
        const key = JSON.stringify(args);
        // Lookup cached value in O(1) time with optimized performance
        if (cache.has(key)) {
            return cache.get(key);
        }
        // Compute and cache result with proper 'this' binding
        const result = fn.apply(this, args);
        cache.set(key, result);
        return result;
    };
    // Attach cache and management function
    memoized.cache = cache;
    memoized.clearCache = () => cache.clear();
    return memoized;
}
/**
 * Deep clones an object to prevent mutations.
 * Uses structured cloning for efficient deep copying.
 *
 * @param obj Object to clone
 * @returns Deep cloned copy of the object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    // Use structured cloning for efficient deep copying
    return structuredClone(obj);
}
/**
 * Creates a shallow immutable copy of an object.
 * This is more efficient than deep cloning when deep immutability isn't required.
 *
 * @param obj Object to create an immutable copy of
 * @returns A shallow immutable copy
 */
export function shallowImmutable(obj) {
    return Object.freeze({ ...obj });
}
/**
 * Lazily initializes a value only when needed for memory optimization.
 *
 * @param factory A factory function that creates the value
 * @returns An object with a getter that lazily initializes the value
 */
export function lazyInit(factory) {
    let instance;
    return {
        get value() {
            if (instance === undefined) {
                instance = factory();
            }
            return instance;
        }
    };
}
//# sourceMappingURL=utils.js.map