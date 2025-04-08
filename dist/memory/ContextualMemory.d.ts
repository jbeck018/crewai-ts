/**
 * ContextualMemory implementation
 * Combines different memory types to build comprehensive context for agent tasks
 *
 * Optimized for:
 * - Parallel memory retrieval for faster context building
 * - Intelligent context aggregation with deduplication
 * - Relevance-based context prioritization
 * - Efficient caching of frequently accessed contexts
 */
import { Task } from '../task/Task.js';
import { BaseMemory } from './BaseMemory.js';
import { EntityMemory } from './EntityMemory.js';
import { LongTermMemory } from './LongTermMemory.js';
import { ShortTermMemory } from './ShortTermMemory.js';
/**
 * Options for configuring ContextualMemory behavior
 */
export interface ContextualMemoryOptions {
    /**
     * Whether to use caching for context building
     * @default true
     */
    useCache?: boolean;
    /**
     * Cache TTL in milliseconds
     * @default 5 minutes
     */
    cacheTtlMs?: number;
    /**
     * Maximum context length in characters
     * @default 10000
     */
    maxContextLength?: number;
    /**
     * Whether to use asynchronous context fetch
     * @default true
     */
    useAsyncFetch?: boolean;
    /**
     * Separator for different context sections
     * @default '\n\n'
     */
    sectionSeparator?: string;
    /**
     * Default limit for memory search operations
     * @default 5
     */
    defaultSearchLimit?: number;
    /**
     * Default relevance threshold for memory search
     * @default 0.35
     */
    defaultRelevanceThreshold?: number;
    /**
     * Optional function to format context sections
     */
    sectionFormatter?: (title: string, content: string[]) => string;
    /**
     * User memory provider name
     * @default undefined
     */
    memoryProvider?: string;
}
/**
 * ContextualMemory class for building comprehensive context from different memory types
 *
 * Optimized for:
 * - Parallel retrieval from different memory sources
 * - Deduplication of similar information
 * - Relevance-based prioritization
 * - Efficient caching
 */
export declare class ContextualMemory {
    private stm;
    private ltm;
    private em;
    private um?;
    private memoryProvider?;
    private useCache;
    private cacheTtlMs;
    private maxContextLength;
    private useAsyncFetch;
    private sectionSeparator;
    private defaultSearchLimit;
    private defaultRelevanceThreshold;
    private sectionFormatter?;
    private contextCache;
    constructor(options: ContextualMemoryOptions | undefined, stm: ShortTermMemory, ltm: LongTermMemory, em: EntityMemory, um?: BaseMemory);
    /**
     * Builds comprehensive context for a task by aggregating information
     * from different memory sources
     *
     * @param task The task to build context for
     * @param additionalContext Optional additional context to include
     * @returns Formatted context string optimized for agent consumption
     */
    buildContextForTask(task: Task, additionalContext?: string): Promise<string>;
    /**
     * Fetches recent insights from short-term memory related to the query
     *
     * @param query The search query
     * @returns Formatted short-term memory context
     */
    private fetchShortTermContext;
    /**
     * Fetches historical data from long-term memory that is relevant to the task
     *
     * @param query The search query
     * @returns Formatted long-term memory context
     */
    private fetchLongTermContext;
    /**
     * Fetches relevant entity information from entity memory related to the query
     *
     * @param query The search query
     * @returns Formatted entity memory context
     */
    private fetchEntityContext;
    /**
     * Fetches relevant user information from user memory related to the query
     *
     * @param query The search query
     * @returns Formatted user memory context
     */
    private fetchUserContext;
    /**
     * Ensures context length doesn't exceed maximum length by prioritizing
     * the most relevant information
     *
     * @param context The full context string
     * @returns Optimized context within length limits
     */
    private optimizeContextLength;
    /**
     * Gets cached context if available and not expired
     *
     * @param query The query to get cached context for
     * @returns Cached context or undefined if not found or expired
     */
    private getCachedContext;
    /**
     * Caches built context for future reuse
     *
     * @param query The query the context was built for
     * @param context The built context to cache
     */
    private cacheContext;
    /**
     * Generates a cache key for a query
     *
     * @param query The query to generate a key for
     * @returns Cache key
     */
    private generateCacheKey;
    /**
     * Removes oldest cache entries if the cache is too large
     */
    private pruneCache;
}
//# sourceMappingURL=ContextualMemory.d.ts.map