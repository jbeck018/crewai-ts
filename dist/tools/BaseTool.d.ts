/**
 * BaseTool interface
 * Defines the foundation for all tools used by agents
 */
import { z } from 'zod';
export interface ToolMetadata {
    name: string;
    description: string;
    schema?: z.ZodType;
    verbose?: boolean;
    cacheResults?: boolean;
    timeout?: number;
    maxRetries?: number;
    tags?: string[];
}
export interface ToolExecutionResult<T = unknown> {
    success: boolean;
    result: T;
    error?: string;
    executionTime?: number;
    cached?: boolean;
}
/**
 * BaseTool interface that all tools must implement
 * Optimized for:
 * - Type safety with zod schema validation
 * - Execution tracking
 * - Error handling
 */
export interface BaseTool<TInput = unknown, TOutput = unknown> {
    readonly name: string;
    readonly description: string;
    readonly schema?: z.ZodType;
    readonly verbose: boolean;
    readonly cacheResults: boolean;
    /**
     * Execute the tool with the given input
     * @param input Tool input parameters
     * @param options Optional execution options
     */
    execute(input: TInput, options?: {
        timeout?: number;
        abortSignal?: AbortSignal;
    }): Promise<ToolExecutionResult<TOutput>>;
    /**
     * Get the tool metadata for agent consumption
     */
    getMetadata(): ToolMetadata;
}
/**
 * Base implementation for tools
 * Provides common functionality for all tools
 */
export declare abstract class Tool<TInput = unknown, TOutput = unknown> implements BaseTool<TInput, TOutput> {
    readonly name: string;
    readonly description: string;
    readonly schema?: z.ZodType;
    readonly verbose: boolean;
    readonly cacheResults: boolean;
    private readonly timeout?;
    private readonly maxRetries;
    private cache;
    constructor(metadata: ToolMetadata);
    /**
     * Execute the tool with the given input
     * Handles validation, caching, and error handling
     */
    execute(input: TInput, options?: {
        timeout?: number;
        abortSignal?: AbortSignal;
    }): Promise<ToolExecutionResult<TOutput>>;
    /**
     * Get the tool metadata for agent consumption
     */
    getMetadata(): ToolMetadata;
    /**
     * Generate a cache key for a given input
     */
    protected getCacheKey(input: TInput): string;
    /**
     * Create a combined AbortSignal that aborts when either source signal aborts
     */
    private createCombinedAbortSignal;
    /**
     * Tool implementation to be provided by subclasses
     */
    protected abstract _execute(input: TInput, options?: {
        signal?: AbortSignal;
    }): Promise<TOutput>;
}
//# sourceMappingURL=BaseTool.d.ts.map