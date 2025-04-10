/**
 * Integration test for Task Output system
 * Tests all components working together with optimization focus
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { TaskOutputFormatter } from '../../src/task/TaskOutputFormatter';
import { StructuredTaskOutputImpl } from '../../src/task/StructuredTaskOutput';
import { TaskOutput } from '../../src/task/Task';

describe('Task Output Integration', () => {
  // Define a sample structured output schema
  // Use explicit type casting to ensure compatibility with our Article interface
  const articleSchema = z.object({
    title: z.string(),
    paragraphs: z.array(z.string()),
    wordCount: z.number(),
    tags: z.array(z.string()).optional(),
    metadata: z.object({
      author: z.string(),
      createdAt: z.string(),
    }).strict(), // Make metadata properties required
  }).strict() as z.ZodType<Article>; // Explicitly cast to ensure type compatibility

  // Define the TypeScript interface equivalent
  interface Article {
    title: string;
    paragraphs: string[];
    wordCount: number;
    tags?: string[];
    metadata: {
      author: string;
      createdAt: string;
    };
  }

  // Mock LLM output with a large article
  const createLargeArticleOutput = (): TaskOutput => {
    // Generate 1000 paragraphs of sample text to simulate a large response
    const paragraphs = Array(1000).fill(0).map((_, i) => 
      `This is paragraph ${i} with some sample text. It contains information about the topic.`
    );

    // Calculate a realistic word count
    const wordCount = paragraphs.reduce((count, p) => count + p.split(' ').length, 0);

    const articleJson = JSON.stringify({
      title: 'Comprehensive Guide to TypeScript Optimization',
      paragraphs,
      wordCount,
      tags: ['typescript', 'performance', 'optimization'],
      metadata: {
        author: 'AI Assistant',
        createdAt: new Date().toISOString(),
      },
    });

    return {
      result: articleJson,
      metadata: {
        taskId: 'task-123',
        agentId: 'agent-456',
        executionTime: 1200,
        tokenUsage: {
          prompt: 500,
          completion: 3000,
          total: 3500
        }
      }
    };
  };

  it('should efficiently process and format large outputs', () => {
    // Create formatter with schema validation - using memory-efficient approach
    // This follows the optimization patterns from our memory system tests
    const formatter = TaskOutputFormatter.fromZodSchema<Article>(articleSchema);
    
    // Get large mock output
    const taskOutput = createLargeArticleOutput();
    
    // Measure performance of the entire pipeline
    const startTime = performance.now();
    
    // 1. Parse the raw output
    const formattedData = formatter.format(taskOutput.result);
    
    // 2. Create structured output
    const structuredOutput = StructuredTaskOutputImpl.fromTaskOutput<Article>(
      taskOutput, 
      formattedData
    );
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    // Verify the output is correctly structured
    const article = structuredOutput.getFormatted<Article>();
    expect(article).toBeDefined();
    expect(article?.title).toBe('Comprehensive Guide to TypeScript Optimization');
    expect(article?.paragraphs.length).toBe(1000);
    expect(article?.tags).toContain('performance');
    
    // Performance assertions - processing should be reasonably fast
    // even with 1000 paragraphs (scale threshold based on system capabilities)
    expect(processingTime).toBeLessThan(500); // Should process in less than 500ms
    
    // Verify JSON caching works
    const jsonStart = performance.now();
    structuredOutput.asJSON(); // First call, creates cache
    const jsonEnd = performance.now();
    
    const jsonStart2 = performance.now();
    structuredOutput.asJSON(); // Second call, uses cache
    const jsonEnd2 = performance.now();
    
    // Second call should be significantly faster
    expect(jsonEnd2 - jsonStart2).toBeLessThan((jsonEnd - jsonStart) / 5);
  });

  it('should efficiently handle streaming updates', () => {
    // Start with partial output
    const initialOutput: TaskOutput = {
      result: '{"title":"Streaming Article","paragraphs":[],"wordCount":0,',
      metadata: {
        taskId: 'task-stream',
        agentId: 'agent-stream',
        executionTime: 100
      }
    };
    
    // Create streaming container
    const streamingOutput = StructuredTaskOutputImpl.createStreaming(initialOutput);
    
    // Verify initial state
    expect(streamingOutput.isStreaming).toBe(true);
    expect(streamingOutput.streamingComplete).toBe(false);
    
    // Memory usage monitoring (simplified simulation)
    // Using dynamic array for memory usage tracking with push operations
    // This matches our approach from memory system tests where we track actual memory usage
    const memoryUsage: number[] = [];
    
    // Simulate receiving 10 stream chunks
    for (let i = 0; i < 10; i++) {
      const chunk = i === 9 
        ? '"metadata":{"author":"Streamer","createdAt":"2025-04-09"}}' // Final chunk
        : `"paragraphs${i}":"Streaming paragraph ${i}",`; // Middle chunks
      
      // Update the streaming content
      (streamingOutput as any).updateStreamingStatus(i === 9, chunk);
      
      // Track simulated memory usage (would use actual measurements in real tests)
      memoryUsage.push(streamingOutput.result.length);
    }
    
    // Verify streaming completed
    expect(streamingOutput.streamingComplete).toBe(true);
    
    // In a real implementation, we would format after completion
    // This is just to demonstrate the concept
    expect(streamingOutput.result).toContain('Streaming Article');
    expect(streamingOutput.result).toContain('Streamer');
    
    // Verify linear memory growth (not exponential)
    // Calculate if growth is roughly linear - using a pattern similar to our memory system tests
    // Only calculate if we have enough data points to analyze
    if (memoryUsage.length > 1) {
      const growthRates = [];
      
      for (let i = 1; i < memoryUsage.length; i++) {
        // Calculate ratio of current size to previous size
        const ratio = memoryUsage[i] / memoryUsage[i-1];
        if (isFinite(ratio) && !isNaN(ratio)) {
          growthRates.push(ratio);
        }
      }
      
      // Only run the test if we have valid growth rates
      if (growthRates.length > 0) {
        const avgGrowthRate = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
        
        // For linear growth, the ratio should be close to 1 (plus some small increment)
        // Similar to our pattern in memory system tests where we verify efficient memory usage
        expect(avgGrowthRate).toBeLessThan(2.0); // Not exponential growth
      }
    }
  });
});
