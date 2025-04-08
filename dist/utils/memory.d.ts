/**
 * Memory Management System Implementation
 * Provides optimized storage and retrieval of agent memory with semantic search
 */
import { EventHandler } from './events.js';
/**
 * Memory types for different use cases
 */
export declare enum MemoryType {
    FACT = "fact",
    OBSERVATION = "observation",
    REFLECTION = "reflection",
    MESSAGE = "message",
    PLAN = "plan",
    RESULT = "result"
}
/**
 * Memory entry structure
 */
export interface MemoryEntry {
    /**
     * Unique ID for the memory
     */
    id: string;
    /**
     * Content of the memory
     */
    content: string;
    /**
     * Type of memory
     */
    type: MemoryType;
    /**
     * Creation timestamp
     */
    createdAt: number;
    /**
     * Last access timestamp
     */
    lastAccessedAt: number;
    /**
     * Importance score from 0 to 1
     */
    importance: number;
    /**
     * Embedding vector for similarity search
     */
    /**
     * Vector representation of the memory content
     * Can be either a typed array (for performance) or regular array (for compatibility)
     */
    embedding?: number[] | Float32Array;
    /**
     * Associated metadata
     */
    metadata?: Record<string, any>;
    /**
     * Tags for filtering
     */
    tags?: string[];
    /**
     * Source of the memory (e.g., agent ID)
     */
    source?: string;
}
/**
 * Memory filter options
 */
export interface MemoryFilter {
    /**
     * Filter by memory types
     */
    types?: MemoryType[];
    /**
     * Filter by tags (must have all tags)
     */
    tags?: string[];
    /**
     * Filter by source
     */
    source?: string;
    /**
     * Filter by minimum importance
     */
    minImportance?: number;
    /**
     * Filter by time range - start timestamp
     */
    startTime?: number;
    /**
     * Filter by time range - end timestamp
     */
    endTime?: number;
    /**
     * Filter by metadata key-value pairs
     */
    metadata?: Record<string, any>;
    /**
     * Filter function for custom filtering
     */
    customFilter?: (memory: MemoryEntry) => boolean;
}
/**
 * Memory retrieval options
 */
export interface MemoryRetrievalOptions extends MemoryFilter {
    /**
     * Maximum number of memories to retrieve
     */
    limit?: number;
    /**
     * Sort order for retrieval
     */
    sortBy?: 'createdAt' | 'lastAccessedAt' | 'importance' | 'relevance';
    /**
     * Sort direction
     */
    sortDirection?: 'asc' | 'desc';
    /**
     * Query for semantic search
     */
    query?: string;
    /**
     * Whether to update lastAccessedAt when retrieving
     */
    trackAccess?: boolean;
}
/**
 * Search result with relevance score
 */
export interface MemorySearchResult {
    /**
     * The memory entry
     */
    memory: MemoryEntry;
    /**
     * Relevance score (0-1)
     */
    score: number;
}
/**
 * Memory storage options
 */
export interface MemoryManagerOptions {
    /**
     * Maximum number of memories to keep in cache
     * @default 1000
     */
    maxSize?: number;
    /**
     * Whether to use embedding for semantic search
     * @default true
     */
    useEmbeddings?: boolean;
    /**
     * Function to generate embeddings for memory content
     */
    embeddingFunction?: (text: string) => Promise<number[]>;
    /**
     * Automatic pruning settings
     */
    pruning?: {
        /**
         * Whether to enable automatic pruning
         * @default true
         */
        enabled: boolean;
        /**
         * Maximum number of memories before pruning
         * @default 10000
         */
        threshold: number;
        /**
         * Percentage of memories to prune when threshold is reached
         * @default 0.2 (20%)
         */
        pruneRatio: number;
        /**
         * Strategy for pruning
         * - 'lru': Least recently used
         * - 'lfu': Least frequently used
         * - 'importance': Lowest importance score
         * - 'age': Oldest memories
         * @default 'lru'
         */
        strategy: 'lru' | 'lfu' | 'importance' | 'age';
    };
    /**
     * Whether to persist memories
     * @default false
     */
    persist?: boolean;
    /**
     * Path for persisting memories
     */
    persistPath?: string;
}
/**
 * Memory events
 */
export interface MemoryEvents {
    /**
     * Fired when a memory is added
     */
    memoryAdded: MemoryEntry;
    /**
     * Fired when a memory is updated
     */
    memoryUpdated: MemoryEntry;
    /**
     * Fired when a memory is deleted
     */
    memoryDeleted: string;
    /**
     * Fired when memories are pruned
     */
    memoriesPruned: {
        count: number;
        strategy: string;
    };
}
/**
 * Memory manager for efficient storage and retrieval of agent memories
 */
export declare class MemoryManager {
    /**
     * In-memory storage for fast access to memories
     * @private
     */
    private memories;
    /**
     * LRU cache for frequently accessed memories
     * @private
     */
    private cache;
    /**
     * Event emitter for memory lifecycle events
     * @private
     */
    private events;
    private options;
    private accessCounts;
    constructor(options?: MemoryManagerOptions);
    /**
     * Add a new memory with optimized storage and embedding generation
     * @param memory - Memory data to add
     * @returns Promise resolving to the created memory entry
     */
    addMemory(memory: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessedAt'>): Promise<MemoryEntry>;
    /**
     * Update an existing memory
     */
    /**
     * Update an existing memory with optimized type safety
     * @param id - Memory ID to update
     * @param updates - Partial memory updates
     * @returns Promise resolving to the updated memory
     */
    /**
     * Update an existing memory with optimized change tracking
     * @param id - Memory ID to update
     * @param updates - Partial memory updates
     * @returns Promise resolving to the updated memory
     */
    updateMemory(id: string, updates: Partial<Omit<MemoryEntry, 'id' | 'createdAt'>>): Promise<MemoryEntry>;
    /**
     * Delete a memory by ID
     */
    deleteMemory(id: string): boolean;
    /**
     * Get a memory by ID
     * @param id - The ID of the memory to retrieve
     * @param trackAccess - Whether to update last accessed time and access count
     * @returns The memory entry or null if not found
     */
    /**
     * Get a memory by ID with optimized cache handling
     * @param id - The ID of the memory to retrieve
     * @param trackAccess - Whether to update last accessed time and access count
     * @returns The memory entry or null if not found
     */
    getMemory(id: string, trackAccess?: boolean): Promise<MemoryEntry | null>;
    /**
     * Retrieve memories based on filter criteria with optimized filtering
     * @param options - Filtering and sorting options
     * @returns Promise resolving to filtered and sorted memory entries
     */
    retrieveMemories(options?: MemoryRetrievalOptions): Promise<MemoryEntry[]>;
    /**
     * Perform semantic search using embeddings
     * Optimized for performance with vector operations
     * @param query - The text query to search for similar memories
     * @param options - Search options including filters and limits
     * @returns Promise resolving to array of memory results with similarity scores
     */
    semanticSearch(query: string, options?: Omit<MemoryRetrievalOptions, 'query'>): Promise<MemorySearchResult[]>;
    /**
     * Clear all memories with optimized cache handling
     * @returns Promise that resolves when all memories are cleared
     */
    clearMemories(): Promise<void>;
    /**
     * Get memory count
     */
    get count(): number;
    /**
     * Subscribe to memory events
     */
    on<K extends keyof MemoryEvents>(event: K, listener: EventHandler<MemoryEvents[K]>): () => void;
    /**
     * Track memory access with optimized caching and batching
     * @param id - ID of memory to track access for
     * @returns Promise resolving when tracking is complete
     */
    private trackMemoryAccess;
    /**
     * Apply filters to memories
     */
    private applyFilters;
    /**
     * Apply sorting to memories
     */
    private applySorting;
    /**
     * Prune memories based on the configured strategy
     * Implements advanced pruning algorithms for optimal memory management
     * @returns Promise resolving when pruning is complete
     */
    private pruneMemories;
    /**
     * Save memories to persistent storage
     * Simplified implementation - in a real system, this would use a more robust storage solution
     */
    private persistMemories;
    /**
     * Load memories from persistent storage
     * Simplified implementation - in a real system, this would use a more robust storage solution
     */
    private loadMemories;
}
//# sourceMappingURL=memory.d.ts.map