/**
 * ContextualMemoryAdapter
 *
 * Adapts ContextualMemory to implement the BaseMemory interface
 * Optimized for performance with proper type safety
 */
import { BaseMemory, MemoryItem, MemorySearchParams, MemorySearchResult } from '../BaseMemory.js';
import { ContextualMemory } from '../ContextualMemory.js';
/**
 * Adapter class to make ContextualMemory compatible with BaseMemory interface
 * This adapter implements all required methods of BaseMemory, delegating to the
 * wrapped ContextualMemory instance where possible and providing optimized
 * implementations for unsupported operations.
 */
export declare class ContextualMemoryAdapter implements BaseMemory {
    private contextualMemory;
    private fallbackItems;
    constructor(contextualMemory: ContextualMemory);
    /**
     * Add an item to memory
     * ContextualMemory doesn't directly support this, so we store in a local map
     */
    add(content: string, metadata?: Record<string, any>): Promise<MemoryItem>;
    /**
     * Search contextual memory using query parameters
     * Leverages the task-based context building capabilities of ContextualMemory
     */
    search(params: MemorySearchParams): Promise<MemorySearchResult>;
    /**
     * Get an item by ID from our fallback storage
     */
    get(id: string): Promise<MemoryItem | null>;
    /**
     * Update an existing memory item in our fallback storage
     */
    update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null>;
    /**
     * Remove an item from our fallback storage
     */
    remove(id: string): Promise<boolean>;
    /**
     * Clear all items from our fallback storage
     */
    clear(): Promise<void>;
    /**
     * Reset the memory
     */
    reset(): Promise<void>;
}
//# sourceMappingURL=ContextualMemoryAdapter.d.ts.map