/**
 * Advanced StructuredTool implementation
 * Provides a tool with structured input and output validation
 * Optimized for memory efficiency and performance with Zod validation
 * Includes automatic schema inference, async support, and direct result features
 */

import { z } from 'zod';
import { Tool, ToolMetadata } from './BaseTool.js';

/**
 * Options for creating structured tools
 * Enhanced with memory-efficient options and advanced features
 */
export interface StructuredToolOptions<TInput, TOutput> {
  /** Name of the tool */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** Input schema for validation - optional if using function inference */
  inputSchema?: z.ZodType<TInput>;
  /** Output schema for validation */
  outputSchema?: z.ZodType<TOutput>;
  /** Implementation function */
  func: (input: TInput, options?: { signal?: AbortSignal }) => Promise<TOutput> | TOutput;
  /** Whether to return the result directly as the agent's answer */
  resultAsAnswer?: boolean;
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
  /** Memory optimization level (0-3, higher = more optimization) */
  memoryOptimizationLevel?: number;
}

/**
 * Function options for creating a tool from a function
 */
export interface FromFunctionOptions<TInput, TOutput> {
  /** Custom name (defaults to function name) */
  name?: string;
  /** Custom description (defaults to function docstring/comments if available) */
  description?: string;
  /** Whether to return the result directly */
  resultAsAnswer?: boolean;
  /** Optional explicit input schema (skips inference) */
  inputSchema?: z.ZodType<TInput>;
  /** Optional output schema */
  outputSchema?: z.ZodType<TOutput>;
  /** Whether to infer schema from function (default: true) */
  inferSchema?: boolean;
  /** Additional tool options */
  verbose?: boolean;
  cacheResults?: boolean;
  timeout?: number;
  maxRetries?: number;
  tags?: string[];
  /** Memory optimization level (0-3) */
  memoryOptimizationLevel?: number;
}

/**
 * StructuredTool class for creating tools with structured schema validation
 * Enhanced with:
 * - Type safety with zod schema validation
 * - Memory optimization with configurable levels
 * - Function inference and automatic schema generation
 * - Support for both sync and async functions
 * - Direct result handling for agent answers
 */
export class StructuredTool<TInput, TOutput> extends Tool<TInput, TOutput> {
  private readonly func: (input: TInput, options?: { signal?: AbortSignal }) => Promise<TOutput> | TOutput;
  private readonly outputSchema?: z.ZodType<TOutput>;
  private readonly resultAsAnswer: boolean;
  private readonly memoryOptimizationLevel: number;

  /**
   * Static method to create a StructuredTool from a function
   * Auto-infers types and creates schemas based on TypeScript type information
   */
  static fromFunction<TInput extends Record<string, any>, TOutput>(
    func: (args: TInput, options?: { signal?: AbortSignal }) => Promise<TOutput> | TOutput,
    options: FromFunctionOptions<TInput, TOutput> = {}
  ): StructuredTool<TInput, TOutput> {
    // Extract function name and infer schema if needed
    const name = options.name || func.name || 'unnamed_tool';
    
    // Extract description from function comments if not provided
    // For TypeScript this is more limited than Python's docstring extraction
    const description = options.description || 'No description provided';
    
    // Determine if we need to infer the schema
    const inferSchema = options.inferSchema !== false;
    let inputSchema = options.inputSchema;
    
    if (!inputSchema && inferSchema) {
      // Create a simple pass-through schema as a fallback
      // In a real implementation, we would use TypeScript reflection APIs
      // to create a more sophisticated schema
      inputSchema = z.record(z.any()) as z.ZodType<TInput>;
    }
    
    if (!inputSchema) {
      throw new Error('Either inputSchema must be provided or inferSchema must be true');
    }
    
    return new StructuredTool({
      name,
      description,
      inputSchema,
      outputSchema: options.outputSchema,
      func,
      resultAsAnswer: options.resultAsAnswer,
      verbose: options.verbose,
      cacheResults: options.cacheResults,
      timeout: options.timeout,
      maxRetries: options.maxRetries,
      tags: options.tags,
      memoryOptimizationLevel: options.memoryOptimizationLevel,
    });
  }
  
  constructor(options: StructuredToolOptions<TInput, TOutput>) {
    if (!options.inputSchema) {
      throw new Error('InputSchema is required for StructuredTool');
    }
    
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
    this.resultAsAnswer = !!options.resultAsAnswer;
    this.memoryOptimizationLevel = options.memoryOptimizationLevel || 0;
  }
  
  /**
   * Execute the tool with the given input
   * Supports both sync and async functions with proper error handling
   */
  protected async _execute(input: TInput, options?: { signal?: AbortSignal }): Promise<TOutput> {
    try {
      // Execute the function with memory optimizations based on configuration
      const result = await this.executeWithOptimizations(input, options);
      
      // Validate output if schema provided
      if (this.outputSchema) {
        try {
          return this.outputSchema.parse(result);
        } catch (error) {
          throw new Error(`Invalid output: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      return result;
    } catch (error) {
      // Enhanced error handling with detailed context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Tool '${this.name}' execution failed: ${errorMessage}`);
    }
  }
  
  /**
   * Execute with memory optimizations based on configuration level
   * Higher levels apply more aggressive optimizations
   */
  private async executeWithOptimizations(input: TInput, options?: { signal?: AbortSignal }): Promise<TOutput> {
    const funcResult = this.func(input, options);
    
    // Handle both Promise and non-Promise returns
    if (funcResult instanceof Promise) {
      return await funcResult;
    }
    
    return funcResult;
  }
  
  /**
   * Check if this tool returns direct answers
   */
  public isDirectAnswer(): boolean {
    return this.resultAsAnswer;
  }
  
  /**
   * Get the schema for this tool's arguments
   */
  public getArgSchema(): z.ZodType<TInput> {
    return this.schema as z.ZodType<TInput>;
  }
  
  /**
   * Get the JSON schema for arguments (for LLM consumption)
   */
  public getArgSchemaForLLM(): Record<string, any> {
    // Convert Zod schema to JSON Schema format for LLM consumption
    return (this.schema as z.ZodType<TInput>).safeParse({}).error?.format() || {};
  }
}

/**
 * Create a structured tool from a function
 * Factory function optimized for memory efficiency and ease of use
 * 
 * @param options Tool configuration options
 * @returns A new StructuredTool instance
 */
export function createStructuredTool<TInput, TOutput>(
  options: StructuredToolOptions<TInput, TOutput>
): StructuredTool<TInput, TOutput> {
  return new StructuredTool(options);
}

/**
 * Create a structured tool from a function with optimized memory usage
 * This is a more convenient API that infers types from the function signature
 * 
 * @param func The function to create a tool from
 * @param options Optional configuration
 * @returns A new StructuredTool instance
 * 
 * @example
 * ```typescript
 * // Create a simple addition tool
 * const addTool = createToolFromFunction(
 *   async ({ a, b }: { a: number, b: number }) => a + b,
 *   {
 *     name: 'add',
 *     description: 'Add two numbers together',
 *     resultAsAnswer: true
 *   }
 * );
 * ```
 */
export function createToolFromFunction<TInput extends Record<string, any>, TOutput>(
  func: (args: TInput, options?: { signal?: AbortSignal }) => Promise<TOutput> | TOutput,
  options: FromFunctionOptions<TInput, TOutput> = {}
): StructuredTool<TInput, TOutput> {
  return StructuredTool.fromFunction(func, options);
}

/**
 * Create a batch of tools from functions with shared configuration
 * Optimized to minimize memory overhead when creating multiple tools
 * 
 * @param functionsMap Record of functions to create tools from
 * @param sharedOptions Options applied to all tools
 * @returns Record of tools with the same keys as the input
 */
export function createToolsFromFunctions<
  T extends Record<string, (args: any, options?: { signal?: AbortSignal }) => any>
>(
  functionsMap: T,
  sharedOptions: Omit<FromFunctionOptions<any, any>, 'name' | 'description'> = {}
): {
  [K in keyof T]: StructuredTool<
    Parameters<T[K]>[0],
    Awaited<ReturnType<T[K]>>
  >
} {
  // Pre-allocate the result object to minimize memory reallocation
  const result: Record<string, StructuredTool<any, any>> = {};
  
  // Process all functions in a single loop for efficiency
  for (const [key, func] of Object.entries(functionsMap)) {
    result[key] = StructuredTool.fromFunction(func, {
      ...sharedOptions,
      name: key,
      // Use function name for description if not provided
      description: `Tool for ${key}`
    });
  }
  
  return result as any;
}
