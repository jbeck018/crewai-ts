/**
 * Task implementation
 * Optimized for efficient execution, context management, and error handling
 */
import { BaseAgent } from '../agent/BaseAgent.js';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export interface TaskConfig {
    description: string;
    agent: BaseAgent;
    expectedOutput?: string;
    context?: string[];
    priority?: TaskPriority;
    async?: boolean;
    tools?: any[];
    kpi?: string;
    cachingStrategy?: 'none' | 'memory' | 'disk' | 'hybrid';
    maxRetries?: number;
    timeoutMs?: number;
}
export interface TaskOutput {
    result: string;
    metadata: {
        taskId: string;
        agentId: string;
        executionTime: number;
        tokenUsage?: {
            prompt: number;
            completion: number;
            total: number;
        };
        iterations?: number;
        cacheHit?: boolean;
        retries?: number;
    };
}
/**
 * Task class that represents work to be done by an agent
 * Optimized for:
 * - Efficient execution tracking
 * - Result caching
 * - Context management
 * - Error handling with retries
 */
export declare class Task {
    readonly id: string;
    readonly description: string;
    readonly agent: BaseAgent;
    readonly expectedOutput?: string;
    readonly context: string[];
    readonly priority: TaskPriority;
    readonly isAsync: boolean;
    readonly tools: any[];
    readonly kpi?: string;
    readonly cachingStrategy: 'none' | 'memory' | 'disk' | 'hybrid';
    readonly maxRetries: number;
    readonly timeoutMs?: number;
    private output?;
    private executionCount;
    private lastExecutionTime;
    private cacheKey?;
    constructor(config: TaskConfig);
    /**
     * Execute the task with the assigned agent
     * Optimized with caching, retries, and timeout management
     */
    execute(context?: string): Promise<TaskOutput>;
    /**
     * Get execution status
     */
    getStatus(): 'pending' | 'completed' | 'failed';
    /**
     * Prepare context by combining existing context with new context
     * Optimized to avoid redundant string operations
     */
    private prepareContext;
    /**
     * Compute a cache key for this task
     * Optimized to use minimal string operations
     */
    private computeCacheKey;
    /**
     * Check if a cached result exists
     */
    private checkCache;
    /**
     * Update the cache with the latest result
     */
    private updateCache;
    toString(): string;
}
//# sourceMappingURL=Task.d.ts.map