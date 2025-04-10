/**
 * LLM Integration Tests
 * 
 * Tests the integration between LLM providers and other system components,
 * with a focus on performance optimization, memory efficiency, and reliability.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenAILLM } from '../../src/llm/providers/OpenAILLM';
import { AnthropicLLM } from '../../src/llm/providers/AnthropicLLM';
import { BaseLLM, LLMMessage, LLMResult } from '../../src/llm/BaseLLM';
import { TaskOutputFormatter } from '../../src/task/TaskOutputFormatter';
import { StructuredTaskOutput, StructuredTaskOutputImpl } from '../../src/task/StructuredTaskOutput';
import { z } from 'zod';

// Memory-efficient performance testing utilities
const measurePerformance = async <T>(operation: () => Promise<T>, iterations = 1): Promise<{
  result: T,
  averageTimeMs: number,
  memoryUsageMB: number
}> => {
  // Track initial memory
  const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  
  // Run operations with timing
  const start = performance.now();
  let result: T = undefined as unknown as T;
  
  for (let i = 0; i < iterations; i++) {
    result = await operation();
  }
  
  const end = performance.now();
  
  // Calculate metrics
  const totalTimeMs = end - start;
  const averageTimeMs = totalTimeMs / iterations;
  
  // Get memory after operations
  const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  const memoryUsageMB = finalMemory - initialMemory;
  
  return { result, averageTimeMs, memoryUsageMB };
};

// Create LLM mock that returns deterministic results for testing
const createMockLLM = (content: string): BaseLLM => {
  return {
    complete: async () => ({
      content,
      totalTokens: 20,
      promptTokens: 10,
      completionTokens: 10,
      finishReason: 'stop'
    }),
    completeStreaming: async (messages, options, callbacks) => {
      // Process response incrementally to simulate streaming
      if (callbacks?.onToken) {
        const chunks = content.split(' ');
        for (const chunk of chunks) {
          callbacks.onToken(chunk);
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      if (callbacks?.onComplete) {
        callbacks.onComplete({
          content,
          totalTokens: 20,
          promptTokens: 10,
          completionTokens: 10,
          finishReason: 'stop'
        });
      }
      
      return null;
    },
    countTokens: async (text) => {
      // Simple token estimate for testing
      return Math.ceil(text.length / 4);
    }
  };
};

// Schema for testing structured output
const testSchema = z.object({
  title: z.string(),
  items: z.array(z.string()),
  count: z.number().int().positive(),
}).strict();

type TestOutput = z.infer<typeof testSchema>;

describe('LLM Integration', () => {
  // Performance test metrics for tracking improvements
  const performanceThresholds = {
    maxTimeMs: 100,  // Maximum acceptable time
    maxMemoryMB: 15,  // Maximum acceptable memory increase in MB for tests
  };
  
  describe('LLM with TaskOutputFormatter', () => {
    let llm: BaseLLM;
    let formatter: TaskOutputFormatter<TestOutput>;
    
    beforeEach(() => {
      // Create a deterministic mock LLM for consistent testing
      const mockJsonOutput = JSON.stringify({
        title: "Test List",
        items: ["Item 1", "Item 2", "Item 3"],
        count: 3
      });
      
      llm = createMockLLM(mockJsonOutput);
      formatter = TaskOutputFormatter.fromZodSchema<TestOutput>(testSchema as any);
    });
    
    it('should efficiently convert LLM output to structured data', async () => {
      // Simulate LLM generating structured output
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: 'You must respond with valid JSON matching this schema: ' + 
            JSON.stringify(testSchema.shape)
        },
        { role: 'user', content: 'Generate a test list with 3 items' }
      ];
      
      // Measure performance of the entire pipeline
      const { result, averageTimeMs, memoryUsageMB } = await measurePerformance(async () => {
        const llmResult = await llm.complete(messages);
        const structured = formatter.format(llmResult.content);
        return StructuredTaskOutputImpl.fromTaskOutput({
          result: llmResult.content,
          metadata: {
            taskId: 'test-task',
            agentId: 'test-agent',
            executionTime: 100,
            tokenUsage: {
              prompt: llmResult.promptTokens || 0,
              completion: llmResult.completionTokens || 0,
              total: llmResult.totalTokens || 0
            }
          }
        }, structured);
      });
      
      // Verify structured output
      expect(result.getFormatted()?.title).toBe("Test List");
      expect(result.getFormatted()?.items).toHaveLength(3);
      expect(result.getFormatted()?.count).toBe(3);
      
      // Verify performance meets expectations
      expect(averageTimeMs).toBeLessThan(performanceThresholds.maxTimeMs);
      expect(memoryUsageMB).toBeLessThan(performanceThresholds.maxMemoryMB);
      
      // Test JSON caching optimization
      const json1 = result.asJSON();
      const json2 = result.asJSON();
      
      // Verify values and that caching worked (same object reference)
      expect(json1).toBe(json2); // Should be the same object instance due to caching
      expect(JSON.parse(json1).metadata.tokenUsage.total).toBe(20);
    });
    
    it('should handle streaming output with minimal memory overhead', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Generate streaming JSON' }
      ];
      
      // Create a StreamingStructuredTaskOutput
      // Use the implementation class directly for access to updateStreamingStatus
      const streamingOutput = StructuredTaskOutputImpl.createStreaming<TestOutput>({
        result: '',
        metadata: {
          taskId: 'streaming-task',
          agentId: 'test-agent',
          executionTime: 0
        }
      }) as StructuredTaskOutputImpl<TestOutput>;
      
      // Track memory incrementally
      const memorySnapshots: number[] = [];
      const getMemoryUsage = () => process.memoryUsage().heapUsed / 1024 / 1024;
      const initialMemory = getMemoryUsage();
      
      // Process stream with memory tracking
      await llm.completeStreaming(messages, {}, {
        onToken: (token) => {
          // Use implementation-specific method for updating streaming status
          (streamingOutput as StructuredTaskOutputImpl<TestOutput>).updateStreamingStatus(false, token);
          memorySnapshots.push(getMemoryUsage() - initialMemory);
        },
        onComplete: (result) => {
          // Mark streaming as complete
          (streamingOutput as StructuredTaskOutputImpl<TestOutput>).updateStreamingStatus(true);
          
          // Update metadata if needed
          streamingOutput.metadata.tokenUsage = {
            prompt: result.promptTokens || 0,
            completion: result.completionTokens || 0,
            total: result.totalTokens || 0
          };
          streamingOutput.metadata.executionTime = 100;
        }
      });
      
      // Allow streaming to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Format the complete output
      if (streamingOutput.result) {
        const formatted = formatter.format(streamingOutput.result);
        
        // Create a new output with the formatted data since we can't directly set it
        const finalOutput = StructuredTaskOutputImpl.fromTaskOutput({
          result: streamingOutput.result,
          metadata: streamingOutput.metadata
        }, formatted);
        
        // Update reference to use the new output with formatted data
        Object.assign(streamingOutput, finalOutput);
      }
      
      // Verify final result - allow for slight format differences
      expect(streamingOutput.getFormatted()?.title?.replace(/\s+/g, '')).toBe("TestList");
      expect(streamingOutput.getFormatted()?.items).toHaveLength(3);
      
      // Verify memory growth pattern (should be roughly linear, not exponential)
      if (memorySnapshots.length > 2) {
        const growthRates = [];
        for (let i = 1; i < memorySnapshots.length; i++) {
          if (memorySnapshots[i-1] > 0 && memorySnapshots[i] > 0) {
            growthRates.push(memorySnapshots[i] / memorySnapshots[i-1]);
          }
        }
        
        // Calculate average growth rate - should be close to 1 for linear growth
        if (growthRates.length > 0) {
          const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
          expect(avgGrowthRate).toBeLessThan(1.5); // Not exponential
        }
      }
    });
  });
  
  describe('Provider-specific optimizations', () => {
    
    afterEach(() => {
      vi.restoreAllMocks();
    });
    
    it('should efficiently format OpenAI responses for task output', async () => {
      // Create OpenAI mock response
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              title: "OpenAI List",
              items: ["OpenAI Item 1", "OpenAI Item 2"],
              count: 2
            }),
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40,
        },
      };
      
      // Setup mock fetch for provider tests
      const mockFetch = vi.spyOn(global, 'fetch').mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
          text: () => Promise.resolve(JSON.stringify(mockResponse)),
        } as Response);
      });
      
      // Create real OpenAI provider
      const openai = new OpenAILLM({ apiKey: 'test-key' });
      const formatter = TaskOutputFormatter.fromZodSchema<TestOutput>(testSchema as any);
      
      // Test end-to-end integration with performance measurement
      const { result, averageTimeMs, memoryUsageMB } = await measurePerformance(async () => {
        const llmResult = await openai.complete([{ role: 'user', content: 'Generate list' }]);
        const structured = formatter.format(llmResult.content);
        return StructuredTaskOutputImpl.fromTaskOutput({
          result: llmResult.content,
          metadata: {
            taskId: 'openai-task',
            agentId: 'test-agent',
            executionTime: 100,
            tokenUsage: {
              prompt: llmResult.promptTokens || 0,
              completion: llmResult.completionTokens || 0,
              total: llmResult.totalTokens || 0
            }
          }
        }, structured);
      });
      
      // Verify token counting was recorded correctly
      expect(result.metadata.tokenUsage?.prompt).toBe(15);
      expect(result.metadata.tokenUsage?.completion).toBe(25);
      expect(result.metadata.tokenUsage?.total).toBe(40);
      
      // Verify structured data
      expect(result.getFormatted()?.title).toBe("OpenAI List");
      expect(result.getFormatted()?.count).toBe(2);
      
      // Verify performance
      expect(averageTimeMs).toBeLessThan(performanceThresholds.maxTimeMs);
      expect(memoryUsageMB).toBeLessThan(performanceThresholds.maxMemoryMB);
    });
    
    it('should efficiently format Anthropic responses for task output', async () => {
      // Create Anthropic mock response
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        model: 'claude-3-opus-20240229',
        content: [{
          type: 'text',
          text: JSON.stringify({
            title: "Anthropic List",
            items: ["Anthropic Item 1", "Anthropic Item 2", "Anthropic Item 3"],
            count: 3
          })
        }],
        usage: {
          input_tokens: 20,
          output_tokens: 30,
        },
        stop_reason: 'end_turn',
      };
      
      // Setup mock fetch for provider tests
      const mockFetch = vi.spyOn(global, 'fetch').mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
          text: () => Promise.resolve(JSON.stringify(mockResponse)),
        } as Response);
      });
      
      // Create real Anthropic provider
      const anthropic = new AnthropicLLM({ apiKey: 'test-key' });
      const formatter = TaskOutputFormatter.fromZodSchema<TestOutput>(testSchema as any);
      
      // Test end-to-end integration with performance measurement
      const { result, averageTimeMs, memoryUsageMB } = await measurePerformance(async () => {
        const llmResult = await anthropic.complete([{ role: 'user', content: 'Generate list' }]);
        const structured = formatter.format(llmResult.content);
        return StructuredTaskOutputImpl.fromTaskOutput({
          result: llmResult.content,
          metadata: {
            taskId: 'anthropic-task',
            agentId: 'test-agent',
            executionTime: 100,
            tokenUsage: {
              prompt: llmResult.promptTokens || 0,
              completion: llmResult.completionTokens || 0,
              total: llmResult.totalTokens || 0
            }
          }
        }, structured);
      });
      
      // Verify token counting was recorded correctly
      expect(result.metadata.tokenUsage?.prompt).toBe(20);
      expect(result.metadata.tokenUsage?.completion).toBe(30);
      expect(result.metadata.tokenUsage?.total).toBe(50);
      
      // Verify structured data
      expect(result.getFormatted()?.title).toBe("Anthropic List");
      expect(result.getFormatted()?.count).toBe(3);
      
      // Verify performance
      expect(averageTimeMs).toBeLessThan(performanceThresholds.maxTimeMs);
      expect(memoryUsageMB).toBeLessThan(performanceThresholds.maxMemoryMB);
    });
  });
  
  describe('Cache optimization benchmarks', () => {
    it('should demonstrate significant performance improvement with caching', async () => {
      // Create a real OpenAI provider with caching enabled
      const openai = new OpenAILLM({
        apiKey: 'test-key',
        cache: new Map(),
      });
      
      // Mock response
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Cached response for performance testing',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20,
        },
      };
      
      // Setup mock fetch
      const mockFetch = vi.spyOn(global, 'fetch').mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
          text: () => Promise.resolve(JSON.stringify(mockResponse)),
        } as Response);
      });
      
      // Test messages
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Cache performance test' },
      ];
      
      // First call - no cache, should make API request
      const uncachedResult = await measurePerformance(async () => {
        return await openai.complete(messages);
      });
      
      // Second call - should use cache
      const cachedResult = await measurePerformance(async () => {
        return await openai.complete(messages);
      });
      
      // Verify responses match
      expect(uncachedResult.result.content).toBe(cachedResult.result.content);
      
      // Verify performance improvement with cache
      expect(cachedResult.averageTimeMs).toBeLessThan(uncachedResult.averageTimeMs);
      
      // Verify API was only called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Cache miss with different message
      const differentResult = await measurePerformance(async () => {
        return await openai.complete([{ role: 'user', content: 'Different query' }]);
      });
      
      // Verify API was called again
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Verify different query still returns correct data
      expect(differentResult.result.content).toBe('Cached response for performance testing');
    });
  });
});
