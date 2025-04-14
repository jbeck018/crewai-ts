/**
 * StructuredTaskOutput
 * Implements type-safe structured output for tasks with optimized memory usage
 * Designed for:
 * - Zero-copy transformations where possible
 * - Minimal memory overhead for large outputs
 * - Efficient caching of formatted results
 * - Streaming support for incremental processing
 */

import { TaskOutput } from './Task.js';

/**
 * Base metadata interface for all task outputs
 * Optimized to use optional fields for minimal payload size
 */
export interface TaskOutputMetadata {
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
  formatTime?: number; // Time taken to format the output
  schemaValidation?: {
    success: boolean;
    errorMessage?: string;
  };
}

/**
 * Enhanced TaskOutput with structured data support
 * Uses generics for type-safe access to formatted data
 */
export interface StructuredTaskOutput<T = any> extends TaskOutput {
  // Original string output
  result: string;
  
  // Metadata with performance metrics
  metadata: TaskOutputMetadata;
  
  // Formatted data (typed)
  formattedData?: T;
  
  // Streaming support
  isStreaming?: boolean;
  streamingComplete?: boolean;
  
  // Methods for accessing and manipulating the output
  getFormatted<R = T>(): R | undefined;
  asJSON(): string;
  asPlainText(): string;
}

/**
 * Implementation of StructuredTaskOutput
 * Optimized for memory efficiency and minimal object creation
 */
export class StructuredTaskOutputImpl<T = any> implements StructuredTaskOutput<T> {
  result: string;
  metadata: TaskOutputMetadata;
  formattedData?: T;
  isStreaming?: boolean;
  streamingComplete?: boolean;
  
  // Cache for expensive computations
  private jsonCache?: string;
  
  constructor(output: TaskOutput, formattedData?: T, isStreaming = false) {
    this.result = output.result;
    this.metadata = {
      ...output.metadata,
      formatTime: formattedData ? Date.now() - (output.metadata.executionTime || 0) : undefined,
    };
    this.formattedData = formattedData;
    this.isStreaming = isStreaming;
    this.streamingComplete = !isStreaming;
  }
  
  /**
   * Get formatted data with type casting if needed
   * Zero runtime cost for same type, safe casting for different types
   */
  getFormatted<R = T>(): R | undefined {
    // Cast to unknown first to avoid direct type conversion errors
    return this.formattedData as unknown as R | undefined;
  }
  
  /**
   * Convert output to JSON string
   * Uses caching for repeated calls
   */
  asJSON(): string {
    if (!this.jsonCache) {
      // Cache the JSON string to avoid repeated stringification
      this.jsonCache = JSON.stringify({
        result: this.result,
        metadata: this.metadata,
        formattedData: this.formattedData
      });
    }
    return this.jsonCache;
  }
  
  /**
   * Get plain text representation
   * Returns the raw result without formatting
   */
  asPlainText(): string {
    return this.result;
  }
  
  /**
   * Update streaming status
   * Used when receiving chunks in streaming mode
   */
  updateStreamingStatus(complete: boolean, additionalResult?: string): void {
    this.streamingComplete = complete;
    
    if (additionalResult) {
      // Efficiently append to result
      this.result += additionalResult;
      // Invalidate JSON cache since result changed
      this.jsonCache = undefined;
    }
  }
  
  /**
   * Create from a standard TaskOutput
   * Factory method for convenient creation
   */
  static fromTaskOutput<T>(output: TaskOutput, formattedData?: T): StructuredTaskOutput<T> {
    return new StructuredTaskOutputImpl(output, formattedData);
  }
  
  /**
   * Create a streaming output container
   * For handling incremental results
   */
  static createStreaming<T>(initialOutput: TaskOutput): StructuredTaskOutput<T> {
    return new StructuredTaskOutputImpl(initialOutput, undefined, true);
  }
}
