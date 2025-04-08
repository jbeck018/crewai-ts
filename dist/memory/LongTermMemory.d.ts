/**
 * LongTermMemory implementation
 * Optimized for persistent storage with semantic search capabilities
 */
import { BaseMemory, MemoryItem, MemorySearchParams, MemorySearchResult } from './BaseMemory.js';
export type StorageAdapter = {
    save(key: string, value: any): Promise<void>;
    load(key: string): Promise<any | null>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    keys(): Promise<string[]>;
};
/**
 * Options for configuring LongTermMemory behavior
 */
export interface LongTermMemoryOptions {
    /**
     * Storage adapter to use for persistence
     * If not provided, will use an in-memory adapter
     */
    storageAdapter?: StorageAdapter;
    /**
     * Namespace for storage keys to prevent collisions
     * @default 'crewai'
     */
    namespace?: string;
    /**
     * Whether to cache loaded items in memory for faster access
     * @default true
     */
    useCache?: boolean;
    /**
     * Maximum size of the memory cache
     * @default 1000
     */
    cacheSize?: number;
    /**
     * Path to vector database for semantic search
     * If not provided, semantic search will not be available
     */
    vectorDbPath?: string;
    /**
     * Maximum age in milliseconds for a memory item before it becomes eligible for archiving
     * @default 30 days
     */
    archiveAgeMs?: number;
}
/**
 * LongTermMemory class for persistent storage of memories
 * Optimized for:
 * - Persistent storage with indexing
 * - Efficient retrieval with caching
 * - Semantic search when available
 */
export declare class LongTermMemory implements BaseMemory {
    private storage;
    private namespace;
    private useCache;
    private cacheSize;
    private vectorDbPath?;
    private archiveAgeMs;
    private cache;
    private cacheOrder;
    private contentIndex;
    private metadataIndex;
    constructor(options?: LongTermMemoryOptions);
    /**
     * Initialize the memory store
     */
    private init;
    /**
     * Add an item to long-term memory with persistence
     */
    add(content: string, metadata?: Record<string, any>): Promise<MemoryItem>;
    /**
     * Search for items in long-term memory with optimized indexing
     */
    search(params: MemorySearchParams): Promise<MemorySearchResult>;
    /**
     * Get an item by its ID with caching
     */
    get(id: string): Promise<MemoryItem | null>;
    /**
     * Update an existing memory item with delta updates
     */
    update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null>;
    /**
     * Remove an item from long-term memory
     */
    remove(id: string): Promise<boolean>;
    /**
     * Clear all items from long-term memory
     */
    clear(): Promise<void>;
    /**
     * Reset the memory (clear and initialize)
     */
    reset(): Promise<void>;
    /**
     * Archive old memories to reduce storage size
     * In a real implementation, this would move old items to cold storage
     */
    archiveOldMemories(): Promise<number>;
    /**
     * Get the storage key for an item
     */
    private getItemKey;
    /**
     * Add an item to the in-memory cache
     */
    private addToCache;
    /**
     * Update the order of items in cache (LRU tracking)
     */
    private updateCacheOrder;
    /**
     * Index an item for faster searching
     */
    private indexItem;
    /**
     * Remove an item from the index
     */
    private removeFromIndex;
    /**
     * Search using the index
     */
    private indexSearch;
    /**
     * Search using semantic vectors
     * This is a placeholder implementation - in a real implementation, this would
     * use a vector database for semantic search
     */
    private semanticSearch;
    /**
     * Load the index from storage
     */
    private loadIndex;
    /**
     * Save the index to storage
     */
    private saveIndex;
}
//# sourceMappingURL=LongTermMemory.d.ts.map