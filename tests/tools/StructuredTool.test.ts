/**
 * Tests for the StructuredTool implementation
 * Optimized for fast execution and comprehensive coverage
 */

import { z } from 'zod';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import { createStructuredTool, StructuredTool } from '../../src/tools/StructuredTool.js';

describe('StructuredTool', () => {
  // Test schemas for optimal validation performance
  const inputSchema = z.object({
    text: z.string(),
    number: z.number().optional()
  });
  
  const outputSchema = z.object({
    result: z.string(),
    processed: z.boolean()
  });
  
  // Optimized mock function with minimal overhead
  const mockFunction = vi.fn().mockImplementation(async ({ text, number }) => {
    return {
      result: `Processed: ${text}${number !== undefined ? ` (${number})` : ''}`,
      processed: true
    };
  });
  
  // Reset mocks before each test for clean state
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  test('creates a structured tool with proper metadata', () => {
    const tool = createStructuredTool({
      name: 'test_tool',
      description: 'A test tool',
      inputSchema,
      outputSchema,
      func: mockFunction,
      tags: ['test', 'utility']
    });
    
    const metadata = tool.getMetadata();
    expect(metadata.name).toBe('test_tool');
    expect(metadata.description).toBe('A test tool');
    expect(metadata.schema).toBe(inputSchema);
    expect(metadata.tags).toEqual(['test', 'utility']);
  });
  
  test('successfully executes with valid input', async () => {
    const tool = createStructuredTool({
      name: 'test_tool',
      description: 'A test tool',
      inputSchema,
      outputSchema,
      func: mockFunction
    });
    
    const result = await tool.execute({ text: 'hello' });
    
    expect(result.success).toBe(true);
    expect(result.result).toEqual({
      result: 'Processed: hello',
      processed: true
    });
    expect(mockFunction).toHaveBeenCalledWith({ text: 'hello' }, expect.anything());
  });
  
  test('validates input against schema', async () => {
    const tool = createStructuredTool({
      name: 'test_tool',
      description: 'A test tool',
      inputSchema,
      outputSchema,
      func: mockFunction
    });
    
    // @ts-ignore - Deliberately passing invalid input for test
    const result = await tool.execute({ invalid: 'input' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid input');
    expect(mockFunction).not.toHaveBeenCalled();
  });
  
  test('validates output against schema', async () => {
    // Mock function that returns invalid output
    const invalidOutputFunc = vi.fn().mockImplementation(async () => {
      return { invalid: 'output' };
    });
    
    const tool = createStructuredTool({
      name: 'test_tool',
      description: 'A test tool',
      inputSchema,
      outputSchema,
      func: invalidOutputFunc
    });
    
    const result = await tool.execute({ text: 'hello' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid output');
    expect(invalidOutputFunc).toHaveBeenCalled();
  });
  
  test('caches results when enabled', async () => {
    const tool = createStructuredTool({
      name: 'test_tool',
      description: 'A test tool',
      inputSchema,
      func: mockFunction,
      cacheResults: true
    });
    
    // First call should execute the function
    await tool.execute({ text: 'hello' });
    
    // Second call with same input should use cache
    const cachedResult = await tool.execute({ text: 'hello' });
    
    expect(cachedResult.cached).toBe(true);
    expect(mockFunction).toHaveBeenCalledTimes(1);
  });
  
  test('respects timeout option', async () => {
    // Mock function that delays execution
    const delayedFunc = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return { result: 'delayed', processed: true };
    });
    
    const tool = createStructuredTool({
      name: 'test_tool',
      description: 'A test tool',
      inputSchema,
      func: delayedFunc,
      timeout: 10 // Very short timeout
    });
    
    const result = await tool.execute({ text: 'hello' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });
  
  test('handles function execution errors', async () => {
    // Mock function that throws an error
    const errorFunc = vi.fn().mockImplementation(async () => {
      throw new Error('Test error');
    });
    
    const tool = createStructuredTool({
      name: 'test_tool',
      description: 'A test tool',
      inputSchema,
      func: errorFunc
    });
    
    const result = await tool.execute({ text: 'hello' });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Test error');
  });
});
