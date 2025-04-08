/**
 * StructuredTool implementation
 * Provides a tool with structured input and output validation
 * Optimized with performance-focused validation and schema generation
 */
import { z } from 'zod';
import { Tool } from './BaseTool.js';
/**
 * Options for creating structured tools
 */
export interface StructuredToolOptions<TInput, TOutput> {
    /** Name of the tool */
    name: string;
    /** Description of what the tool does */
    description: string;
    /** Input schema for validation */
    inputSchema: z.ZodType<TInput>;
    /** Output schema for validation */
    outputSchema?: z.ZodType<TOutput>;
    /** Implementation function */
    func: (input: TInput, options?: {
        signal?: AbortSignal;
    }) => Promise<TOutput>;
    /** Additional metadata */
    verbose?: boolean;
    /** Cache results for identical inputs */
    cacheResults?: boolean;
    /** Timeout in milliseconds */
    timeout?: number;
    /** Number of retry attempts */
    maxRetries?: number;
    /** Categories/tags for grouping tools */
    tags?: string[];
}
/**
 * StructuredTool class for creating tools with structured schema validation
 * Optimized for:
 * - Type safety with zod schema validation
 * - Performance-optimized validation
 * - Function-based tool creation
 */
export declare class StructuredTool<TInput, TOutput> extends Tool<TInput, TOutput> {
    private readonly func;
    private readonly outputSchema?;
    constructor(options: StructuredToolOptions<TInput, TOutput>);
    /**
     * Execute the tool with the given input
     * Validates both input (handled by base class) and output
     */
    protected _execute(input: TInput, options?: {
        signal?: AbortSignal;
    }): Promise<TOutput>;
}
/**
 * Create a structured tool from a function
 * Factory function optimized for ease of use
 */
export declare function createStructuredTool<TInput, TOutput>(options: StructuredToolOptions<TInput, TOutput>): StructuredTool<TInput, TOutput>;
//# sourceMappingURL=StructuredTool.d.ts.map