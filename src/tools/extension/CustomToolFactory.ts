/**
 * Custom Tool Factory
 * Provides a flexible framework for creating and extending tools
 * with proper typing, validation, and performance optimizations
 */

import { z } from 'zod';
import { BaseTool } from '../BaseTool.js';
import { createStructuredTool } from '../StructuredTool.js';

/**
 * Interface for custom tool options
 */
export interface CustomToolOptions<TInput = any, TOutput = any> {
  /**
   * Name of the tool
   */
  name: string;

  /**
   * Description of the tool functionality
   */
  description: string;

  /**
   * Input schema for validation
   */
  inputSchema: z.ZodType<TInput>;

  /**
   * Function to execute when the tool is called
   */
  execute: (input: TInput) => Promise<TOutput>;

  /**
   * Optional function to handle errors
   */
  handleError?: (error: Error, input: TInput) => Promise<TOutput>;

  /**
   * Optional cache configuration
   */
  cache?: {
    /**
     * Whether to enable caching
     */
    enabled: boolean;

    /**
     * Maximum cache size
     */
    maxSize?: number;

    /**
     * Cache TTL in milliseconds
     */
    ttlMs?: number;

    /**
     * Function to create a cache key from input
     */
    keyGenerator?: (input: TInput) => string;
  };

  /**
   * Optional retry configuration
   */
  retry?: {
    /**
     * Maximum number of retries
     */
    maxRetries?: number;

    /**
     * Initial delay in milliseconds
     */
    initialDelayMs?: number;

    /**
     * Maximum delay in milliseconds
     */
    maxDelayMs?: number;

    /**
     * Function to determine if an error is retryable
     */
    isRetryable?: (error: Error) => boolean;
  };

  /**
   * Optional performance tracking
   */
  tracking?: {
    /**
     * Whether to track performance metrics
     */
    enabled: boolean;

    /**
     * What metrics to track
     */
    metrics?: Array<'latency' | 'memory' | 'success_rate'>;

    /**
     * Function to process metrics
     */
    processMetrics?: (metrics: Record<string, any>) => void;
  };
}

/**
 * Create a LRU cache implementation
 */
class LRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 100, ttlMs = 3600000) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check for expiration
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to the front of the LRU (by deleting and reinserting)
    this.cache.delete(key);
    this.cache.set(key, {
      value: entry.value,
      timestamp: Date.now()
    });

    return entry.value;
  }

  set(key: K, value: V): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      // Find oldest entry
      let oldestKey: K | null = null;
      let oldestTime = Date.now();

      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }

      // Delete oldest entry
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  clearExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Performance metrics tracker
 */
class PerformanceTracker {
  private metrics: Record<string, any> = {};
  private startTime = 0;
  private startMemory = 0;
  private options: CustomToolOptions['tracking'];

  constructor(options: CustomToolOptions['tracking']) {
    this.options = options;
  }

  start(): void {
    if (!this.options?.enabled) return;

    this.startTime = performance.now();

    // Track memory if available and requested
    if (this.options.metrics?.includes('memory') && global.process?.memoryUsage) {
      this.startMemory = global.process.memoryUsage().heapUsed;
    }
  }

  end(success: boolean): Record<string, any> {
    if (!this.options?.enabled) return {};

    // Track latency
    if (this.options.metrics?.includes('latency')) {
      this.metrics.latencyMs = performance.now() - this.startTime;
    }

    // Track memory if available and requested
    if (this.options.metrics?.includes('memory') && global.process?.memoryUsage) {
      const endMemory = global.process.memoryUsage().heapUsed;
      this.metrics.memoryUsageBytes = endMemory - this.startMemory;
    }

    // Track success rate
    if (this.options.metrics?.includes('success_rate')) {
      this.metrics.success = success;
    }

    // Process metrics if callback provided
    if (this.options.processMetrics) {
      this.options.processMetrics(this.metrics);
    }

    return this.metrics;
  }

  getMetrics(): Record<string, any> {
    return this.metrics;
  }
}

/**
 * Default cache key generator
 */
function defaultKeyGenerator<T>(input: T): string {
  try {
    return JSON.stringify(input);
  } catch (error) {
    // For non-serializable inputs, use a stable hash
    const inputStr = String(input);
    let hash = 0;
    for (let i = 0; i < inputStr.length; i++) {
      const char = inputStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return String(hash);
  }
}

/**
 * Implementation of a retry mechanism with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: NonNullable<CustomToolOptions['retry']>
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelay = options.initialDelayMs ?? 1000;
  const maxDelay = options.maxDelayMs ?? 30000;
  const isRetryable = options.isRetryable ?? (() => true);

  let attempt = 0;
  let lastError: Error;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (!isRetryable(lastError) || attempt >= maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        maxDelay,
        initialDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5)
      );

      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }

  throw lastError!;
}

/**
 * Creates a custom tool with the provided options
 */
export function createCustomTool<TInput, TOutput>(
  options: CustomToolOptions<TInput, TOutput>
): BaseTool {
  // Optional cache setup
  let cache: LRUCache<string, TOutput> | null = null;
  let keyGenerator = defaultKeyGenerator;

  if (options.cache?.enabled) {
    cache = new LRUCache<string, TOutput>(
      options.cache.maxSize,
      options.cache.ttlMs
    );

    if (options.cache.keyGenerator) {
      // Use type assertion to ensure type compatibility
      keyGenerator = options.cache.keyGenerator as typeof defaultKeyGenerator;
    }
  }

  // Create the tool with the structured tool factory
  return createStructuredTool({
    name: options.name,
    description: options.description,
    inputSchema: options.inputSchema,
    func: async (input: TInput): Promise<TOutput> => {
      // Create performance tracker if needed
      const tracker = options.tracking?.enabled
        ? new PerformanceTracker(options.tracking)
        : null;

      // Start tracking if enabled
      tracker?.start();

      try {
        // Check cache first if enabled
        if (cache) {
          const cacheKey = keyGenerator(input);
          const cachedResult = cache.get(cacheKey);

          if (cachedResult) {
            // Add metrics for cached results if tracking enabled
            if (tracker) {
              tracker.end(true);
              return {
                ...cachedResult,
                _metrics: {
                  ...tracker.getMetrics(),
                  fromCache: true
                }
              } as unknown as TOutput;
            }
            return cachedResult;
          }
        }

        // Execute with retry if configured
        let result: TOutput;

        if (options.retry) {
          result = await withRetry(
            () => options.execute(input),
            options.retry
          );
        } else {
          result = await options.execute(input);
        }

        // Store in cache if enabled
        if (cache) {
          const cacheKey = keyGenerator(input);
          cache.set(cacheKey, result);
        }

        // End tracking if enabled with success
        if (tracker) {
          const metrics = tracker.end(true);
          return {
            ...result,
            _metrics: metrics
          } as unknown as TOutput;
        }

        return result;
      } catch (error) {
        // End tracking with failure
        tracker?.end(false);

        // Use custom error handler if provided
        if (options.handleError) {
          return options.handleError(
            error instanceof Error ? error : new Error(String(error)),
            input
          );
        }

        // Re-throw the error if no handler
        throw error;
      }
    }
  });
}
