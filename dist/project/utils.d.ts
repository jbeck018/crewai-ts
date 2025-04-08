/**
 * Utility functions for the Project module with optimizations.
 */
type MemoizedFunction<T extends (...args: any[]) => any> = T & {
    cache: Map<string, ReturnType<T>>;
    clearCache: () => void;
};
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
export declare function memoize<T extends (...args: any[]) => any>(fn: T): MemoizedFunction<T>;
/**
 * Deep clones an object to prevent mutations.
 * Uses structured cloning for efficient deep copying.
 *
 * @param obj Object to clone
 * @returns Deep cloned copy of the object
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Creates a shallow immutable copy of an object.
 * This is more efficient than deep cloning when deep immutability isn't required.
 *
 * @param obj Object to create an immutable copy of
 * @returns A shallow immutable copy
 */
export declare function shallowImmutable<T extends object>(obj: T): Readonly<T>;
/**
 * Lazily initializes a value only when needed for memory optimization.
 *
 * @param factory A factory function that creates the value
 * @returns An object with a getter that lazily initializes the value
 */
export declare function lazyInit<T>(factory: () => T): {
    readonly value: T;
};
export {};
//# sourceMappingURL=utils.d.ts.map