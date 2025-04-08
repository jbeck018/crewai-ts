/**
 * ShortTermMemory implementation
 * Optimized in-memory storage with efficient retrieval and management
 */
import { BaseMemory, MemoryItem, MemorySearchParams, MemorySearchResult } from './BaseMemory.js';
/**
 * Options for configuring ShortTermMemory behavior
 */
export interface ShortTermMemoryOptions {
    /**
     * Maximum capacity of memory items
     * @default 1000
     */
    capacity?: number;
    /**
     * Whether to use LRU (Least Recently Used) eviction policy
     * @default true
     */
    useLRU?: boolean;
    /**
     * Interval in milliseconds for automatic pruning of old memories
     * If undefined, no automatic pruning occurs
     * @default undefined
     */
    pruneIntervalMs?: number;
    /**
     * Maximum age in milliseconds for a memory item before it becomes eligible for pruning
     * @default 24 hours
     */
    maxAgeMs?: number;
}
/**
 * ShortTermMemory class for efficient in-memory storage
 * Optimized for:
 * - Fast access with in-memory storage
 * - Efficient capacity management with LRU eviction
 * - Automatic pruning of old memories
 */
export declare class ShortTermMemory implements BaseMemory {
    private items;
    private accessOrder;
    private capacity;
    private useLRU;
    private maxAgeMs;
    private pruneIntervalId?;
    constructor(options?: ShortTermMemoryOptions);
    /**
     * Add an item to memory with optimized capacity management
     */
    add(content: string, metadata?: Record<string, any>): Promise<MemoryItem>;
    /**
     * Search for items in memory with optimized relevance scoring
     */
    search(params: MemorySearchParams): Promise<MemorySearchResult>;
    /**
     * Get an item by its ID with LRU tracking
     */
    get(id: string): Promise<MemoryItem | null>;
    /**
     * Update an existing memory item
     */
    update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null>;
    /**
     * Remove an item from memory
     */
    remove(id: string): Promise<boolean>;
    /**
     * Clear all items from memory
     */
    clear(): Promise<void>;
    /**
     * Reset the memory (clear and initialize)
     */
    reset(): Promise<void>;
    /**
     * Clean up resources when no longer needed
     */
    dispose(): void;
    /**
     * Get the current memory size
     */
    get size(): number;
    /**
     * Prune old memories based on maxAgeMs
     * Optimized to minimize iteration over items
     */
    private pruneOldMemories;
    /**
     * Update the access order for LRU tracking
     * Optimized for minimal array operations
     */
    private updateAccessOrder;
    /**
     * Evict an item based on the eviction policy
     * Currently implements LRU (Least Recently Used)
     */
    private evictItem;
}
//# sourceMappingURL=ShortTermMemory.d.ts.map