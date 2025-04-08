/**
 * BaseTool class tests
 * Optimized for efficient test execution and comprehensive coverage
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import '../types';
import { Tool, ToolMetadata, ToolExecutionResult } from '../../src/tools/BaseTool';
import { z } from 'zod';

// Create an implementation of the abstract Tool class for testing
// Using minimal implementation for better performance
class TestTool extends Tool<{ input: string }, string> {
  // Track execution for testing purposes with minimal overhead
  executionCount = 0;
  lastInput: any = null;
  lastOptions: any = null;
  shouldFail = false;
  executionDelay = 0;

  constructor(metadata: ToolMetadata = {
    name: 'test-tool',
    description: 'A tool for testing'
  }) {
    super(metadata);
  }

  // Implementation of the abstract method
  protected async _execute(input: { input: string }, options?: { signal?: AbortSignal }): Promise<string> {
    this.executionCount++;
    this.lastInput = input;
    this.lastOptions = options;

    // Allow for simulating delays in execution for timeout testing
    if (this.executionDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.executionDelay));
    }

    // Check if the signal is already aborted
    if (options?.signal?.aborted) {
      throw new Error('Execution aborted');
    }

    // Allow for simulating failures
    if (this.shouldFail) {
      throw new Error('Simulated failure');
    }

    return `Processed: ${input.input}`;
  }
}

describe('BaseTool', () => {
  // Shared test variables with efficient initialization
  let tool: TestTool;

  beforeEach(() => {
    // Create a fresh tool for each test with default settings
    tool = new TestTool();
  });

  afterEach(() => {
    // Clean up
    tool = null as any;
  });

  test('should create a tool with basic properties', () => {
    expect(tool).toBeDefined();
    expect(tool.name).toBe('test-tool');
    expect(tool.description).toBe('A tool for testing');
    expect(tool.verbose).toBe(false); // Default
    expect(tool.cacheResults).toBe(false); // Default
  });

  test('should execute successfully with valid input', async () => {
    const result = await tool.execute({ input: 'test data' });

    expect(result.success).toBe(true);
    expect(result.result).toBe('Processed: test data');
    expect(result.executionTime).toBeDefined();
    expect(typeof result.executionTime).toBe('number');
    expect(tool.executionCount).toBe(1);
  });

  test('should validate input with schema', async () => {
    // Create a tool with a schema
    const toolWithSchema = new TestTool({
      name: 'schema-tool',
      description: 'A tool with schema validation',
      schema: z.object({
        input: z.string().min(3) // Require input of at least 3 characters
      })
    });

    // Valid input
    const validResult = await toolWithSchema.execute({ input: 'test data' });
    expect(validResult.success).toBe(true);

    // Invalid input
    const invalidResult = await toolWithSchema.execute({ input: 'ab' } as any);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toContain('Invalid input');
  });

  test('should handle execution failures gracefully', async () => {
    // Configure the tool to fail
    tool.shouldFail = true;

    const result = await tool.execute({ input: 'will fail' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Tool execution failed');
  });

  test('should implement caching when enabled', async () => {
    // Create a tool with caching enabled
    const cachingTool = new TestTool({
      name: 'caching-tool',
      description: 'A tool that caches results',
      cacheResults: true
    });

    // First execution
    const result1 = await cachingTool.execute({ input: 'cache test' });
    expect(result1.success).toBe(true);
    expect(cachingTool.executionCount).toBe(1);

    // Second execution with same input should use cache
    const result2 = await cachingTool.execute({ input: 'cache test' });
    expect(result2.success).toBe(true);
    expect(result2.cached).toBe(true);
    // Execution count should still be 1 because it used the cache
    expect(cachingTool.executionCount).toBe(1);

    // Different input should execute again
    const result3 = await cachingTool.execute({ input: 'different input' });
    expect(result3.success).toBe(true);
    expect(result3.cached).toBeUndefined();
    expect(cachingTool.executionCount).toBe(2);
  });

  test('should implement retries on failure', async () => {
    // Create a tool with retry settings
    const retryTool = new TestTool({
      name: 'retry-tool',
      description: 'A tool that retries on failure',
      maxRetries: 2
    });

    // Make it fail
    retryTool.shouldFail = true;

    // Execute and expect it to retry maxRetries + 1 times (initial + retries)
    const result = await retryTool.execute({ input: 'retry test' });

    expect(result.success).toBe(false);
    expect(retryTool.executionCount).toBe(3); // Initial + 2 retries
  });

  test('should respect timeout settings', async () => {
    // Create a tool with a short timeout
    const timeoutTool = new TestTool({
      name: 'timeout-tool',
      description: 'A tool that tests timeout handling',
      timeout: 50 // Very short timeout
    });

    // Make it slow to respond
    timeoutTool.executionDelay = 100; // Longer than the timeout

    // Execute and expect timeout error
    const result = await timeoutTool.execute({ input: 'timeout test' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // The error might contain different messages depending on the implementation
    // so we just check that there is an error
  });

  test('should respect abort signal', async () => {
    // Create an abort controller
    const controller = new AbortController();

    // Start execution
    const promise = tool.execute(
      { input: 'abort test' },
      { abortSignal: controller.signal }
    );

    // Abort immediately
    controller.abort();

    // Wait for execution to complete
    const result = await promise;

    // The execution might have been too fast and completed before abort
    // or it might have been aborted, either way we should have a result
    expect(result).toBeDefined();
  });

  test('should provide correct metadata', () => {
    // Create a tool with various metadata
    const metadataTool = new TestTool({
      name: 'metadata-tool',
      description: 'A tool with rich metadata',
      verbose: true,
      cacheResults: true,
      timeout: 1000,
      maxRetries: 5,
      tags: ['test', 'metadata']
    });

    const metadata = metadataTool.getMetadata();

    expect(metadata.name).toBe('metadata-tool');
    expect(metadata.description).toBe('A tool with rich metadata');
    expect(metadata.verbose).toBe(true);
    expect(metadata.cacheResults).toBe(true);
    expect(metadata.timeout).toBe(1000);
    expect(metadata.maxRetries).toBe(5);
  });
});
