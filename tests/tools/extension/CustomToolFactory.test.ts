/**
 * CustomToolFactory Unit Tests
 * Tests the custom tool extension framework with memory efficiency and performance optimizations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCustomTool } from '../../../src/tools/extension/CustomToolFactory.js';
import { BaseTool } from '../../../src/tools/BaseTool.js';
import { z } from 'zod';

// Helper type for the test to correctly handle tool.call with specific input/output types
type ToolWithCall<TInput = any, TOutput = any> = BaseTool & {
  call: (input: TInput) => Promise<TOutput>;
  name: string;
  description: string;
};

describe('CustomToolFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset performance metrics
    if (global.performance) {
      vi.spyOn(global.performance, 'now').mockImplementation(() => Date.now());
    }
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Tool Creation', () => {
    it('should create a custom tool with required properties', () => {
      // Create a simple calculator tool
      type CalcInput = {
        a: number;
        b: number;
        operation: 'add' | 'subtract' | 'multiply' | 'divide';
      };
      
      type CalcOutput = {
        result: number;
      };
      
      const schema = z.object({
        a: z.number(),
        b: z.number(),
        operation: z.enum(['add', 'subtract', 'multiply', 'divide'])
      });

      const tool = createCustomTool<CalcInput, CalcOutput>({
        name: 'calculator',
        description: 'Performs basic arithmetic operations',
        inputSchema: schema,
        execute: async (input) => {
          const { a, b, operation } = input;
          switch (operation) {
            case 'add': return { result: a + b };
            case 'subtract': return { result: a - b };
            case 'multiply': return { result: a * b };
            case 'divide': return { result: a / b };
            default: throw new Error('Unsupported operation');
          }
        }
      });

      expect(tool).toBeDefined();
      const typedTool = tool as ToolWithCall<CalcInput, CalcOutput>;
      expect(typedTool.name).toBe('calculator');
      expect(typedTool.description).toBe('Performs basic arithmetic operations');
      expect(typeof typedTool.call).toBe('function');
    });
  });

  describe('Tool Execution', () => {
    it('should execute custom tool logic correctly', async () => {
      // Setup a test tool
      type FormatterInput = {
        text: string;
        prefix?: string;
        suffix?: string;
      };
      
      type FormatterOutput = {
        formattedText: string;
      };
      
      const schema = z.object({
        text: z.string(),
        prefix: z.string().optional(),
        suffix: z.string().optional()
      });

      const execute = vi.fn().mockImplementation(async (input: FormatterInput) => {
        const { text, prefix = '', suffix = '' } = input;
        return { formattedText: `${prefix}${text}${suffix}` };
      });

      const tool = createCustomTool<FormatterInput, FormatterOutput>({
        name: 'formatter',
        description: 'Formats text with prefix and suffix',
        inputSchema: schema,
        execute
      });

      // Execute the tool
      const typedTool = tool as ToolWithCall<FormatterInput, FormatterOutput>;
      const result = await typedTool.call({
        text: 'hello',
        prefix: '<<',
        suffix: '>>'
      });

      expect(result).toEqual({ formattedText: '<<hello>>' });
      expect(execute).toHaveBeenCalledWith({
        text: 'hello',
        prefix: '<<',
        suffix: '>>'
      });
    });

    it('should validate input with schema', async () => {
      // Setup a tool with strict validation
      const schema = z.object({
        email: z.string().email(),
        count: z.number().int().positive()
      });

      const tool = createCustomTool<{
        text: string;
        prefix?: string;
        suffix?: string;
      }, { formattedText: string }>({
        name: 'validator',
        description: 'Validates email and count',
        inputSchema: schema,
        execute: async (input) => ({
          valid: true,
          input
        })
      });

      // This should throw due to invalid email
      await expect(tool.call({
        email: 'not-an-email',
        count: 5
      })).rejects.toThrow();

      // This should throw due to negative count
      await expect(tool.call({
        email: 'test@example.com',
        count: -1
      })).rejects.toThrow();

      // This should succeed
      const result = await tool.call({
        email: 'test@example.com',
        count: 5
      });

      expect(result).toEqual({
        valid: true,
        input: {
          email: 'test@example.com',
          count: 5
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should use custom error handler when provided', async () => {
      // Setup a tool that throws errors
      const tool = createCustomTool<{
        text: string;
        prefix?: string;
        suffix?: string;
      }, { formattedText: string }>({
        name: 'error-thrower',
        description: 'A tool that throws errors',
        inputSchema: z.object({
          shouldThrow: z.boolean()
        }),
        execute: async (input) => {
          if (input.shouldThrow) {
            throw new Error('Intentional error');
          }
          return { success: true };
        },
        handleError: async (error, input) => {
          return {
            success: false,
            errorHandled: true,
            message: error.message,
            input
          };
        }
      });

      // Execute with error
      const result = await tool.call({
        shouldThrow: true
      });

      expect(result).toEqual({
        success: false,
        errorHandled: true,
        message: 'Intentional error',
        input: { shouldThrow: true }
      });

      // Execute without error
      const successResult = await tool.call({
        shouldThrow: false
      });

      expect(successResult).toEqual({ success: true });
    });

    it('should propagate errors when no handler is provided', async () => {
      // Setup a tool without error handler
      const tool = createCustomTool<{
        text: string;
        prefix?: string;
        suffix?: string;
      }, { formattedText: string }>({
        name: 'error-thrower',
        description: 'A tool that throws errors',
        inputSchema: z.object({
          shouldThrow: z.boolean()
        }),
        execute: async (input) => {
          if (input.shouldThrow) {
            throw new Error('Intentional error');
          }
          return { success: true };
        }
      });

      // Execute with error
      await expect(tool.call({
        shouldThrow: true
      })).rejects.toThrow('Intentional error');

      // Execute without error
      const result = await tool.call({
        shouldThrow: false
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe('Caching', () => {
    it('should cache results when enabled', async () => {
      // Setup a tool with caching
      const execute = vi.fn().mockImplementation(async (input) => ({
        result: input.value * 2,
        timestamp: Date.now()
      }));

      const tool = createCustomTool<{
        text: string;
        prefix?: string;
        suffix?: string;
      }, { formattedText: string }>({
        name: 'doubler',
        description: 'Doubles a value',
        inputSchema: z.object({
          value: z.number()
        }),
        execute,
        cache: {
          enabled: true,
          maxSize: 10,
          ttlMs: 1000 // 1 second TTL
        }
      });

      // First call
      const result1 = await tool.call({ value: 5 });
      expect(result1.result).toBe(10);
      expect(execute).toHaveBeenCalledTimes(1);

      // Reset mock to verify it's not called again
      execute.mockClear();

      // Second call with same input
      const result2 = await tool.call({ value: 5 });
      expect(result2.result).toBe(10);
      expect(execute).not.toHaveBeenCalled();

      // Call with different input
      const result3 = await tool.call({ value: 7 });
      expect(result3.result).toBe(14);
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('should respect cache TTL', async () => {
      // Create a tool with very short TTL
      const execute = vi.fn().mockImplementation(async (input) => ({
        result: input.value * 2,
        timestamp: Date.now()
      }));

      const tool = createCustomTool<{
        text: string;
        prefix?: string;
        suffix?: string;
      }, { formattedText: string }>({
        name: 'doubler',
        description: 'Doubles a value',
        inputSchema: z.object({
          value: z.number()
        }),
        execute,
        cache: {
          enabled: true,
          ttlMs: 50 // 50ms TTL
        }
      });

      // First call
      await tool.call({ value: 5 });
      expect(execute).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Call again
      execute.mockClear();
      await tool.call({ value: 5 });
      
      // Should call execute again because cache expired
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('should use custom key generator when provided', async () => {
      // Setup a tool with custom key generator
      const execute = vi.fn().mockImplementation(async (input) => ({
        result: input.values.reduce((sum, v) => sum + v, 0)
      }));

      // Create a key generator that sorts the values array
      const keyGenerator = (input: { values: number[] }) => {
        return JSON.stringify([...input.values].sort());
      };

      const tool = createCustomTool<{
        text: string;
        prefix?: string;
        suffix?: string;
      }, { formattedText: string }>({
        name: 'summer',
        description: 'Sums an array of values',
        inputSchema: z.object({
          values: z.array(z.number())
        }),
        execute,
        cache: {
          enabled: true,
          keyGenerator
        }
      });

      // First call with [1, 2, 3]
      await tool.call({ values: [1, 2, 3] });
      expect(execute).toHaveBeenCalledTimes(1);

      // Reset mock
      execute.mockClear();

      // Call with [3, 1, 2] - should hit cache due to custom key generator
      await tool.call({ values: [3, 1, 2] });
      expect(execute).not.toHaveBeenCalled();
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry on failures when configured', async () => {
      // Setup a tool that fails on first call
      const execute = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true });

      const tool = createCustomTool<{
        text: string;
        prefix?: string;
        suffix?: string;
      }, { formattedText: string }>({
        name: 'retry-test',
        description: 'Tests retry mechanism',
        inputSchema: z.object({
          id: z.string()
        }),
        execute,
        retry: {
          maxRetries: 1,
          initialDelayMs: 10, // Short delay for testing
          maxDelayMs: 50
        }
      });

      // Execute should eventually succeed after retry
      const result = await tool.call({ id: '123' });
      expect(result).toEqual({ success: true });
      expect(execute).toHaveBeenCalledTimes(2);
    });

    it('should respect maxRetries limit', async () => {
      // Setup a tool that always fails
      const execute = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const tool = createCustomTool<{
        text: string;
        prefix?: string;
        suffix?: string;
      }, { formattedText: string }>({
        name: 'retry-limit-test',
        description: 'Tests retry limits',
        inputSchema: z.object({
          id: z.string()
        }),
        execute,
        retry: {
          maxRetries: 2,
          initialDelayMs: 10 // Short delay for testing
        }
      });

      // Execute should fail after retries are exhausted
      await expect(tool.call({ id: '123' })).rejects.toThrow('Persistent failure');
      expect(execute).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use isRetryable function to determine if retry is needed', async () => {
      // Setup execute function that fails with different errors
      const execute = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Validation error'))
        .mockResolvedValueOnce({ success: true });

      // Only retry on network errors
      const isRetryable = (error: Error) => error.message.includes('Network');

      const tool = createCustomTool<{
        text: string;
        prefix?: string;
        suffix?: string;
      }, { formattedText: string }>({
        name: 'selective-retry',
        description: 'Only retries certain errors',
        inputSchema: z.object({
          id: z.string()
        }),
        execute,
        retry: {
          maxRetries: 3,
          initialDelayMs: 10,
          isRetryable
        }
      });

      // Should retry on network error but not on validation error
      await expect(tool.call({ id: '123' })).rejects.toThrow('Validation error');
      expect(execute).toHaveBeenCalledTimes(2); // Just network error retry + validation error
    });
  });

  describe('Performance Tracking', () => {
    it('should track performance metrics when enabled', async () => {
      // Setup performance tracking
      const processMetrics = vi.fn();

      const tool = createCustomTool<{
        text: string;
        prefix?: string;
        suffix?: string;
      }, { formattedText: string }>({
        name: 'performance-test',
        description: 'Tests performance tracking',
        inputSchema: z.object({
          complexity: z.number()
        }),
        execute: async (input) => {
          // Simulate some processing time
          const start = Date.now();
          while (Date.now() - start < input.complexity * 10) {
            // Busy wait to simulate work
          }
          return { result: input.complexity * 2 };
        },
        tracking: {
          enabled: true,
          metrics: ['latency', 'success_rate'],
          processMetrics
        }
      });

      // Execute the tool
      const result = await tool.call({ complexity: 1 });

      // Should have result and metrics
      expect(result).toHaveProperty('result', 2);
      expect(result).toHaveProperty('_metrics');
      expect(result._metrics).toHaveProperty('latencyMs');
      expect(result._metrics).toHaveProperty('success', true);

      // Should have called the process metrics function
      expect(processMetrics).toHaveBeenCalledWith(expect.objectContaining({
        latencyMs: expect.any(Number),
        success: true
      }));
    });

    it('should track memory usage when enabled and available', async () => {
      // Mock process.memoryUsage if available
      const mockMemoryUsage = {
        heapUsed: 1000000
      };

      // Store original process object
      const originalProcess = global.process;

      // Mock process object with memoryUsage function
      global.process = {
        ...global.process,
        memoryUsage: vi.fn().mockReturnValue(mockMemoryUsage)
      };

      const tool = createCustomTool<{
        text: string;
        prefix?: string;
        suffix?: string;
      }, { formattedText: string }>({
        name: 'memory-test',
        description: 'Tests memory tracking',
        inputSchema: z.object({
          size: z.number()
        }),
        execute: async (input) => {
          // Create a large array to simulate memory usage
          const array = new Array(input.size).fill(0);
          return { result: array.length };
        },
        tracking: {
          enabled: true,
          metrics: ['memory']
        }
      });

      // Mock increased memory usage for second call
      (global.process.memoryUsage as any).mockReturnValueOnce({
        heapUsed: 1000000
      }).mockReturnValueOnce({
        heapUsed: 1500000
      });

      // Execute the tool
      const result = await tool.call({ size: 1000 });

      // Should have memory metrics
      expect(result).toHaveProperty('_metrics');
      expect(result._metrics).toHaveProperty('memoryUsageBytes');

      // Restore original process object
      global.process = originalProcess;
    });
  });

  describe('Memory Efficiency', () => {
    it('should efficiently handle LRU cache eviction', async () => {
      // Setup a tool with small cache size
      const execute = vi.fn().mockImplementation(async (input) => ({
        result: input.id
      }));

      const tool = createCustomTool<{
        text: string;
        prefix?: string;
        suffix?: string;
      }, { formattedText: string }>({
        name: 'lru-test',
        description: 'Tests LRU cache efficiency',
        inputSchema: z.object({
          id: z.string()
        }),
        execute,
        cache: {
          enabled: true,
          maxSize: 3 // Only store 3 results
        }
      });

      // Fill cache with 3 different values
      await tool.call({ id: 'a' });
      await tool.call({ id: 'b' });
      await tool.call({ id: 'c' });
      expect(execute).toHaveBeenCalledTimes(3);

      // Reset mock
      execute.mockClear();

      // Access 'a' and 'b' again to make 'c' the least recently used
      await tool.call({ id: 'a' });
      await tool.call({ id: 'b' });
      expect(execute).not.toHaveBeenCalled();

      // Add a new value 'd' - should evict 'c'
      await tool.call({ id: 'd' });
      expect(execute).toHaveBeenCalledTimes(1);

      // Reset mock
      execute.mockClear();

      // Check cache hits for 'a', 'b', and 'd'
      await tool.call({ id: 'a' });
      await tool.call({ id: 'b' });
      await tool.call({ id: 'd' });
      expect(execute).not.toHaveBeenCalled();

      // 'c' should be evicted and require re-execution
      await tool.call({ id: 'c' });
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });
});
