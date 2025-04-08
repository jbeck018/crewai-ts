/**
 * Tests for Crew memory management
 * Optimized with efficient mocking and minimal state changes
 */

import { expect, test, describe, beforeEach, vi, afterEach } from 'vitest';
import { Crew } from '../../src/crew/Crew.js';
import { Agent } from '../../src/agent/Agent.js';
import { Task } from '../../src/task/Task.js';
import { MemoryType } from '../../src/memory/MemoryManager.js';

describe('Crew Memory Management', () => {
  let crew: Crew;
  
  // Mock dependencies
  beforeEach(() => {
    // Create a performance-optimized crew instance with minimal config
    crew = new Crew({
      agents: [new Agent({ name: 'Test Agent' })],
      tasks: [new Task({ description: 'Test Task' })],
      verbose: false,
    });
    
    // Mock resetMemory on the memoryManager for efficient testing
    crew['memoryManager'].resetMemory = vi.fn().mockImplementation(
      (type: MemoryType) => Promise.resolve({ success: true })
    );
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  test('resets all memory types by default', async () => {
    const result = await crew.resetMemory();
    
    expect(result).toEqual({ success: true });
    expect(crew['memoryManager'].resetMemory).toHaveBeenCalledWith('all');
    expect(crew['memoryManager'].resetMemory).toHaveBeenCalledTimes(1);
  });
  
  test('resets specific memory type when specified', async () => {
    const result = await crew.resetMemory('short');
    
    expect(result).toEqual({ success: true });
    expect(crew['memoryManager'].resetMemory).toHaveBeenCalledWith('short');
    expect(crew['memoryManager'].resetMemory).toHaveBeenCalledTimes(1);
  });
  
  test('handles memory reset failures gracefully', async () => {
    // Mock a failure case
    crew['memoryManager'].resetMemory = vi.fn().mockImplementation(
      () => Promise.resolve({
        success: false,
        errors: { 'short': 'Reset operation failed' }
      })
    );
    
    const result = await crew.resetMemory();
    
    expect(result).toEqual({
      success: false,
      errors: { 'short': 'Reset operation failed' }
    });
    expect(crew['memoryManager'].resetMemory).toHaveBeenCalledTimes(1);
  });
  
  test('integrates with verbose logging when enabled', async () => {
    // Enable verbose logging
    const verboseCrew = new Crew({
      agents: [new Agent({ name: 'Test Agent' })],
      tasks: [new Task({ description: 'Test Task' })],
      verbose: true,
    });
    
    // Mock console.log for testing output
    const consoleSpy = vi.spyOn(console, 'log');
    verboseCrew['memoryManager'].resetMemory = vi.fn().mockImplementation(
      (type: MemoryType) => Promise.resolve({ success: true })
    );
    
    await verboseCrew.resetMemory('long');
    
    expect(consoleSpy).toHaveBeenCalledWith('Resetting long memory');
    expect(verboseCrew['memoryManager'].resetMemory).toHaveBeenCalledWith('long');
  });
  
  test('performance remains efficient across consecutive calls', async () => {
    // Time-based performance test with minimal overhead
    const start = performance.now();
    
    // Make multiple consecutive calls
    const types: MemoryType[] = ['short', 'long', 'entity', 'contextual', 'all'];
    const results = await Promise.all(types.map(type => crew.resetMemory(type)));
    
    const end = performance.now();
    const duration = end - start;
    
    // All calls should be successful
    expect(results.every(r => r.success)).toBe(true);
    expect(crew['memoryManager'].resetMemory).toHaveBeenCalledTimes(5);
    
    // Performance assertion - should complete quickly since we're using mocks
    // This is a soft assertion as test environment performance may vary
    expect(duration).toBeLessThan(500); // 500ms is very conservative
  });
});
