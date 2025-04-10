/**
 * TaskOutputFormatter
 * Implements structured output format controls with schema validation
 * Optimized for:
 * - Minimal memory overhead
 * - Efficient schema validation
 * - Reusable data transformations
 * - Zero runtime validation cost for known schemas
 */

import { z } from 'zod';

/**
 * TaskOutputSchema interface for custom schema definitions
 * Uses TypeScript's structural typing to avoid runtime overhead
 */
export interface TaskOutputSchema<T = any> {
  validate(data: unknown): T;
  parse(data: unknown): T;
  safeParse(data: unknown): { success: boolean; data?: T; error?: Error };
}

/**
 * ZodOutputSchema - Zod-based schema implementation
 * Provides efficient schema validation with minimal runtime overhead
 */
export class ZodOutputSchema<T> implements TaskOutputSchema<T> {
  private schema: z.ZodType<T>;

  constructor(schema: z.ZodType<T>) {
    this.schema = schema;
  }

  validate(data: unknown): T {
    return this.schema.parse(data);
  }

  parse(data: unknown): T {
    return this.schema.parse(data);
  }

  safeParse(data: unknown): { success: boolean; data?: T; error?: Error } {
    const result = this.schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: new Error(result.error.message) };
    }
  }
}

/**
 * InterfaceOutputSchema - Interface-based schema implementation
 * Uses TypeScript interfaces for zero runtime validation overhead
 * Only provides type checking at compile time
 */
export class InterfaceOutputSchema<T> implements TaskOutputSchema<T> {
  // This is intentionally minimal to avoid runtime overhead
  validate(data: unknown): T {
    return data as T;
  }

  parse(data: unknown): T {
    return data as T;
  }

  safeParse(data: unknown): { success: boolean; data?: T; error?: Error } {
    try {
      return { success: true, data: data as T };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }
}

/**
 * TaskOutputFormatter - Main class to format task outputs
 * Provides methods to validate, transform, and format task outputs
 */
export class TaskOutputFormatter<T = any> {
  private schema: TaskOutputSchema<T>;

  constructor(schema: TaskOutputSchema<T>) {
    this.schema = schema;
  }

  /**
   * Format raw output to structured data
   * Optimized for minimal object creation and memory usage
   */
  format(rawOutput: string): T {
    let parsed: unknown;
    
    try {
      // Try to parse as JSON first
      parsed = JSON.parse(rawOutput);
    } catch {
      // If not valid JSON, treat as plain text
      parsed = rawOutput;
    }

    return this.schema.parse(parsed);
  }

  /**
   * Safely format output with error handling
   * Returns either the formatted output or null with error information
   */
  safeFormat(rawOutput: string): { success: boolean; data?: T; error?: Error } {
    try {
      const data = this.format(rawOutput);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * Create a formatter with a Zod schema
   * Provides full validation but has runtime overhead
   */
  static fromZodSchema<T>(schema: z.ZodType<T>): TaskOutputFormatter<T> {
    return new TaskOutputFormatter(new ZodOutputSchema(schema));
  }

  /**
   * Create a formatter with a TypeScript interface
   * Zero runtime validation overhead but no runtime type checking
   */
  static fromInterface<T>(): TaskOutputFormatter<T> {
    return new TaskOutputFormatter(new InterfaceOutputSchema<T>());
  }
}

/**
 * Function to create a output formatter with a specific schema
 * Convenience function for common use cases
 */
export function createOutputFormatter<T>(schema: z.ZodType<T>): TaskOutputFormatter<T> {
  return TaskOutputFormatter.fromZodSchema(schema);
}
