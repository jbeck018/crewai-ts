/**
 * StructuredTool implementation
 * Provides a tool with structured input and output validation
 * Optimized with performance-focused validation and schema generation
 */

import { z } from 'zod';
import { Tool, ToolMetadata } from './BaseTool.js';

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
  func: (input: TInput, options?: { signal?: AbortSignal }) => Promise<TOutput>;
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
export class StructuredTool<TInput, TOutput> extends Tool<TInput, TOutput> {
  private readonly func: (input: TInput, options?: { signal?: AbortSignal }) => Promise<TOutput>;
  private readonly outputSchema?: z.ZodType<TOutput>;
  
  constructor(options: StructuredToolOptions<TInput, TOutput>) {
    super({
      name: options.name,
      description: options.description,
      schema: options.inputSchema,
      verbose: options.verbose,
      cacheResults: options.cacheResults,
      timeout: options.timeout,
      maxRetries: options.maxRetries,
      tags: options.tags,
    });
    
    this.func = options.func;
    this.outputSchema = options.outputSchema;
  }
  
  /**
   * Execute the tool with the given input
   * Validates both input (handled by base class) and output
   */
  protected async _execute(input: TInput, options?: { signal?: AbortSignal }): Promise<TOutput> {
    // Execute the function
    const result = await this.func(input, options);
    
    // Validate output if schema provided
    if (this.outputSchema) {
      try {
        return this.outputSchema.parse(result);
      } catch (error) {
        throw new Error(`Invalid output: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return result;
  }
}

/**
 * Create a structured tool from a function
 * Factory function optimized for ease of use
 */
export function createStructuredTool<TInput, TOutput>(
  options: StructuredToolOptions<TInput, TOutput>
): StructuredTool<TInput, TOutput> {
  return new StructuredTool(options);
}
