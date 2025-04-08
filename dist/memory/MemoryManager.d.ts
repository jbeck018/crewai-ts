/**
 * MemoryManager implementation
 * Provides centralized memory management capabilities
 * Optimized for performance with minimal overhead
 */
import { BaseMemory } from './BaseMemory.js';
/**
 * Available memory types that can be managed
 */
export type MemoryType = 'short' | 'long' | 'entity' | 'contextual' | 'all';
/**
 * Memory configuration interface
 */
export interface MemoryConfig {
    /** Whether to use memory system */
    enabled?: boolean;
    /** Custom memory storage implementation */
    storage?: BaseMemory;
    /** Maximum number of items to store in memory */
    maxItems?: number;
    /** Whether to automatically prune older items when maxItems is reached */
    autoPrune?: boolean;
    /** Minimum relevance score for memories to be retrieved (0.0-1.0) */
    minRelevance?: number;
    /** Cache TTL for memory operations in milliseconds */
    cacheTtl?: number;
}
/**
 * MemoryManager class for coordinating memory operations
 * Optimized for:
 * - Efficient memory management across different memory types
 * - Centralized reset capabilities
 * - Performance-focused configuration
 */
export declare class MemoryManager {
    private readonly memories;
    private config;
    /**
     * Register a memory implementation with the manager
     */
    registerMemory(type: Exclude<MemoryType, 'all'>, memory: BaseMemory): void;
    /**
     * Configure memory settings
     */
    configure(type: MemoryType, config: Partial<MemoryConfig>): void;
    /**
     * Get a memory implementation by type
     */
    getMemory(type: Exclude<MemoryType, 'all'>): BaseMemory | undefined;
    /**
     * Check if a memory type is enabled
     */
    isEnabled(type: Exclude<MemoryType, 'all'>): boolean;
    /**
     * Reset specific memory type or all memories
     * Optimized to handle errors gracefully and provide detailed results
     */
    resetMemory(type: MemoryType): Promise<{
        success: boolean;
        errors?: Record<string, string>;
    }>;
    /**
     * Create standard memory instances with optimal configuration
     */
    createStandardMemories(): void;
    /**
     * Get current memory configuration
     */
    getConfig(type: MemoryType): MemoryConfig;
}
//# sourceMappingURL=MemoryManager.d.ts.map