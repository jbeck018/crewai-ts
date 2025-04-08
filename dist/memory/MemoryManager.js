/**
 * MemoryManager implementation
 * Provides centralized memory management capabilities
 * Optimized for performance with minimal overhead
 */
import { ContextualMemory } from './ContextualMemory.js';
import { ContextualMemoryAdapter } from './adapters/ContextualMemoryAdapter.js';
import { EntityMemory } from './EntityMemory.js';
import { LongTermMemory } from './LongTermMemory.js';
import { ShortTermMemory } from './ShortTermMemory.js';
/**
 * MemoryManager class for coordinating memory operations
 * Optimized for:
 * - Efficient memory management across different memory types
 * - Centralized reset capabilities
 * - Performance-focused configuration
 */
export class MemoryManager {
    memories = new Map();
    config = {
        short: { enabled: true, maxItems: 1000, autoPrune: true },
        long: { enabled: true, maxItems: 10000, autoPrune: true, minRelevance: 0.7 },
        entity: { enabled: true, maxItems: 5000, autoPrune: true },
        contextual: { enabled: true, maxItems: 500, autoPrune: true, minRelevance: 0.6 },
        all: { enabled: true }
    };
    /**
     * Register a memory implementation with the manager
     */
    registerMemory(type, memory) {
        this.memories.set(type, memory);
    }
    /**
     * Configure memory settings
     */
    configure(type, config) {
        if (type === 'all') {
            // Apply config to all memory types except 'all'
            const memoryTypes = ['short', 'long', 'entity', 'contextual'];
            for (const memType of memoryTypes) {
                this.config[memType] = { ...this.config[memType], ...config };
            }
        }
        else {
            this.config[type] = { ...this.config[type], ...config };
        }
    }
    /**
     * Get a memory implementation by type
     */
    getMemory(type) {
        return this.memories.get(type);
    }
    /**
     * Check if a memory type is enabled
     */
    isEnabled(type) {
        return this.config[type]?.enabled ?? false;
    }
    /**
     * Reset specific memory type or all memories
     * Optimized to handle errors gracefully and provide detailed results
     */
    async resetMemory(type) {
        const errors = {};
        try {
            if (type === 'all') {
                // Reset all registered memories
                const resetPromises = Array.from(this.memories.entries()).map(async ([memType, memory]) => {
                    try {
                        await memory.reset();
                        return { type: memType, success: true };
                    }
                    catch (error) {
                        errors[memType] = error instanceof Error ? error.message : String(error);
                        return { type: memType, success: false };
                    }
                });
                await Promise.all(resetPromises);
            }
            else {
                // Reset specific memory type
                const memory = this.memories.get(type);
                if (!memory) {
                    return {
                        success: false,
                        errors: { [type]: `Memory type '${type}' is not registered` }
                    };
                }
                await memory.reset();
            }
            return Object.keys(errors).length > 0
                ? { success: false, errors }
                : { success: true };
        }
        catch (error) {
            return {
                success: false,
                errors: {
                    general: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }
    /**
     * Create standard memory instances with optimal configuration
     */
    createStandardMemories() {
        if (this.isEnabled('short')) {
            // Performance-optimized configuration with proper type safety
            this.registerMemory('short', new ShortTermMemory({
                capacity: this.config.short.maxItems || 1000,
                pruneIntervalMs: this.config.short.autoPrune ? 60000 : undefined,
                useLRU: true // Enable LRU for better performance
            }));
        }
        if (this.isEnabled('long')) {
            // Performance-optimized configuration with proper type safety
            this.registerMemory('long', new LongTermMemory({
                cacheSize: this.config.long.maxItems || 1000,
                archiveAgeMs: this.config.long.autoPrune ? 30 * 24 * 60 * 60 * 1000 : undefined, // 30 days if autoPrune is enabled
                useCache: true // Enable caching for better performance
            }));
        }
        if (this.isEnabled('entity')) {
            // Performance-optimized configuration with proper type safety
            this.registerMemory('entity', new EntityMemory({
                maxEntities: this.config.entity.maxItems || 500,
                useCache: true, // Enable caching for better performance
                cacheSize: Math.min(this.config.entity.maxItems || 500, 1000) // Optimize cache size
            }));
        }
        if (this.isEnabled('contextual')) {
            // Check if required memory instances exist
            const shortMemory = this.getMemory('short');
            const longMemory = this.getMemory('long');
            const entityMemory = this.getMemory('entity');
            if (shortMemory && longMemory && entityMemory) {
                // Performance-optimized configuration with proper type safety
                const contextualMemory = new ContextualMemory({
                    maxContextLength: this.config.contextual.maxItems || 10000,
                    defaultRelevanceThreshold: this.config.contextual.minRelevance || 0.35,
                    useCache: true, // Enable caching for performance
                    cacheTtlMs: 5 * 60 * 1000, // 5 minute cache for performance
                    useAsyncFetch: true // Enable async for better performance
                }, shortMemory, longMemory, entityMemory);
                // Wrap with adapter to satisfy BaseMemory interface requirements
                const contextualMemoryAdapter = new ContextualMemoryAdapter(contextualMemory);
                this.registerMemory('contextual', contextualMemoryAdapter);
            }
        }
    }
    /**
     * Get current memory configuration
     */
    getConfig(type) {
        return type === 'all'
            ? { ...this.config.all }
            : { ...this.config[type] };
    }
}
//# sourceMappingURL=MemoryManager.js.map