/**
 * ContextualMemoryAdapter
 *
 * Adapts ContextualMemory to implement the BaseMemory interface
 * Optimized for performance with proper type safety
 */
/**
 * Adapter class to make ContextualMemory compatible with BaseMemory interface
 * This adapter implements all required methods of BaseMemory, delegating to the
 * wrapped ContextualMemory instance where possible and providing optimized
 * implementations for unsupported operations.
 */
export class ContextualMemoryAdapter {
    contextualMemory;
    fallbackItems = new Map();
    constructor(contextualMemory) {
        this.contextualMemory = contextualMemory;
    }
    /**
     * Add an item to memory
     * ContextualMemory doesn't directly support this, so we store in a local map
     */
    async add(content, metadata) {
        const item = {
            id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            content,
            metadata,
            createdAt: Date.now(),
            lastAccessedAt: Date.now()
        };
        // Store in our fallback map for future retrieval
        this.fallbackItems.set(item.id, item);
        return item;
    }
    /**
     * Search contextual memory using query parameters
     * Leverages the task-based context building capabilities of ContextualMemory
     */
    async search(params) {
        // Use query as a pseudo-task description for context building
        if (!params.query) {
            return { items: [], total: 0 };
        }
        try {
            // Create a minimal task object using the query
            const pseudoTask = {
                id: `search_${Date.now()}`,
                description: params.query,
                getMetadata: () => params.metadata || {}
            };
            // Build context using ContextualMemory
            // @ts-ignore - ignoring type issues with the pseudo-task
            const context = await this.contextualMemory.buildContextForTask(pseudoTask);
            // Convert context to a memory item
            const item = {
                id: `result_${Date.now()}`,
                content: context,
                metadata: params.metadata,
                createdAt: Date.now(),
                relevanceScore: 1.0 // Highest relevance since it was built specifically for this query
            };
            return {
                items: [item],
                total: 1
            };
        }
        catch (error) {
            console.error('Error searching contextual memory:', error);
            return { items: [], total: 0 };
        }
    }
    /**
     * Get an item by ID from our fallback storage
     */
    async get(id) {
        // Try to get from our fallback storage
        const item = this.fallbackItems.get(id);
        return item || null;
    }
    /**
     * Update an existing memory item in our fallback storage
     */
    async update(id, updates) {
        const item = this.fallbackItems.get(id);
        if (!item) {
            return null;
        }
        // Apply updates with performance optimization
        const updatedItem = {
            ...item,
            ...updates,
            lastAccessedAt: Date.now() // Always update access time
        };
        this.fallbackItems.set(id, updatedItem);
        return updatedItem;
    }
    /**
     * Remove an item from our fallback storage
     */
    async remove(id) {
        return this.fallbackItems.delete(id);
    }
    /**
     * Clear all items from our fallback storage
     */
    async clear() {
        this.fallbackItems.clear();
    }
    /**
     * Reset the memory
     */
    async reset() {
        await this.clear();
    }
}
//# sourceMappingURL=ContextualMemoryAdapter.js.map