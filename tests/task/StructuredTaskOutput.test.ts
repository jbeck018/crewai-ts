/**
 * Tests for StructuredTaskOutput
 * Focuses on performance optimization and memory efficiency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StructuredTaskOutputImpl } from '../../src/task/StructuredTaskOutput';
import { TaskOutput } from '../../src/task/Task';

describe('StructuredTaskOutput', () => {
  // Mock task output for testing
  const mockTaskOutput: TaskOutput = {
    result: 'Test result',
    metadata: {
      taskId: 'test-task-id',
      agentId: 'test-agent-id',
      executionTime: 100
    }
  };

  // Example formatted data
  const formattedData = {
    title: 'Test Title',
    items: ['item1', 'item2', 'item3'],
    count: 42
  };

  describe('Basic functionality', () => {
    it('should create from TaskOutput with formatted data', () => {
      const output = StructuredTaskOutputImpl.fromTaskOutput(mockTaskOutput, formattedData);
      
      expect(output.result).toBe(mockTaskOutput.result);
      expect(output.metadata.taskId).toBe(mockTaskOutput.metadata.taskId);
      expect(output.getFormatted()).toEqual(formattedData);
    });

    it('should have formatTime in metadata when formatted', () => {
      const output = StructuredTaskOutputImpl.fromTaskOutput(mockTaskOutput, formattedData);
      
      expect(output.metadata.formatTime).toBeDefined();
      expect(typeof output.metadata.formatTime).toBe('number');
    });

    it('should not have formatTime when no formatted data', () => {
      const output = StructuredTaskOutputImpl.fromTaskOutput(mockTaskOutput);
      
      expect(output.metadata.formatTime).toBeUndefined();
    });
  });

  describe('Type safety', () => {
    it('should preserve type information', () => {
      interface TestData {
        title: string;
        items: string[];
        count: number;
      }
      
      const typedOutput = StructuredTaskOutputImpl.fromTaskOutput<TestData>(
        mockTaskOutput, 
        formattedData
      );
      
      const data = typedOutput.getFormatted();
      expect(data?.title).toBe('Test Title');
      expect(data?.items.length).toBe(3);
      expect(data?.count).toBe(42);
    });

    it('should allow type casting when necessary', () => {
      const output = StructuredTaskOutputImpl.fromTaskOutput(mockTaskOutput, formattedData);
      
      // Cast to a more specific type
      interface DetailedData {
        title: string;
        items: string[];
        count: number;
        detailed: boolean; // Not actually in the data
      }
      
      const cast = output.getFormatted<DetailedData>();
      // TypeScript would catch this at compile time, but it passes at runtime
      expect(cast?.title).toBe('Test Title');
    });
  });

  describe('Performance optimizations', () => {
    it('should cache JSON conversions for better performance', () => {
      const output = StructuredTaskOutputImpl.fromTaskOutput(mockTaskOutput, formattedData);
      
      // Mock JSON.stringify to count calls
      const originalStringify = JSON.stringify;
      const mockStringify = vi.fn((obj) => originalStringify(obj));
      JSON.stringify = mockStringify;
      
      // First call should use stringify
      output.asJSON();
      expect(mockStringify).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      output.asJSON();
      expect(mockStringify).toHaveBeenCalledTimes(1); // Still just 1 call
      
      // Restore original
      JSON.stringify = originalStringify;
    });

    it('should handle large datasets efficiently', () => {
      // Create a large dataset (100,000 items)
      const largeArray = Array(100000).fill(0).map((_, i) => `item${i}`);
      const largeData = { items: largeArray };
      
      const output = StructuredTaskOutputImpl.fromTaskOutput(mockTaskOutput, largeData);
      
      // Measure time to access formatted data
      const startAccess = performance.now();
      const accessed = output.getFormatted();
      const endAccess = performance.now();
      
      // Should be essentially instant (no copying/transformation)
      expect(endAccess - startAccess).toBeLessThan(5); // Less than 5ms
      expect(accessed).toBe(largeData); // Reference equality, not a copy
    });
  });

  describe('Streaming support', () => {
    it('should create streaming output container', () => {
      const output = StructuredTaskOutputImpl.createStreaming(mockTaskOutput);
      
      expect(output.isStreaming).toBe(true);
      expect(output.streamingComplete).toBe(false);
    });

    it('should update streaming status correctly', () => {
      const output = new StructuredTaskOutputImpl(mockTaskOutput, undefined, true);
      
      // Add to the stream
      (output as any).updateStreamingStatus(false, ' additional content');
      
      expect(output.result).toBe('Test result additional content');
      expect(output.streamingComplete).toBe(false);
      
      // Complete the stream
      (output as any).updateStreamingStatus(true, ' final content');
      
      expect(output.result).toBe('Test result additional content final content');
      expect(output.streamingComplete).toBe(true);
    });

    it('should invalidate JSON cache when updating streaming content', () => {
      const output = new StructuredTaskOutputImpl(mockTaskOutput, formattedData, true);
      
      // Get initial JSON (creates cache)
      const initialJson = output.asJSON();
      
      // Mock JSON.stringify to count calls
      const originalStringify = JSON.stringify;
      const mockStringify = vi.fn((obj) => originalStringify(obj));
      JSON.stringify = mockStringify;
      
      // Update the stream which should invalidate cache
      (output as any).updateStreamingStatus(false, ' new content');
      
      // Getting JSON again should use stringify
      output.asJSON();
      expect(mockStringify).toHaveBeenCalledTimes(1);
      
      // Restore original
      JSON.stringify = originalStringify;
    });
  });
});
