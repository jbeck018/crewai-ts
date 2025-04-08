/**
 * CacheTools implementation
 * Provides tools for interacting with the caching system
 * Optimized for performance with minimal memory overhead
 */
/**
 * Create a set of cache manipulation tools
 * Optimized with structured validation and efficient cache operations
 */
export declare function createCacheTools(): (import("../StructuredTool.js").StructuredTool<{
    key: string;
    namespace?: string | undefined;
}, any> | import("../StructuredTool.js").StructuredTool<{
    key: string;
    value?: any;
    namespace?: string | undefined;
    ttl?: number | undefined;
}, {
    success: boolean;
    key: string;
    namespace: string;
}>)[];
//# sourceMappingURL=CacheTools.d.ts.map