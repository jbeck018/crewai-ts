/**
 * Tests for the ToolUsage implementation
 * Performance optimized with efficient test patterns
 */

import { expect, test, describe, beforeEach } from 'vitest';
import { ToolUsageTracker } from '../../src/tools/ToolUsage.js';

describe('ToolUsageTracker', () => {
  let tracker: ToolUsageTracker;
  
  // Fresh tracker instance for each test - optimized for isolation
  beforeEach(() => {
    tracker = new ToolUsageTracker({ maxEntriesPerTool: 10 });
  });
  
  test('records successful executions', () => {
    // Record a successful execution
    tracker.recordExecution(
      { success: true, result: 'test result', executionTime: 100 },
      { toolName: 'test_tool' }
    );
    
    const stats = tracker.getToolStats('test_tool');
    
    // Verify stats are correctly updated
    expect(stats).toBeDefined();
    expect(stats?.totalExecutions).toBe(1);
    expect(stats?.successfulExecutions).toBe(1);
    expect(stats?.failedExecutions).toBe(0);
    expect(stats?.totalExecutionTime).toBe(100);
    expect(stats?.averageExecutionTime).toBe(100);
  });
  
  test('records failed executions', () => {
    // Record a failed execution
    tracker.recordExecution(
      { success: false, result: null, error: 'test error', executionTime: 50 },
      { toolName: 'test_tool' }
    );
    
    const stats = tracker.getToolStats('test_tool');
    
    // Verify stats are correctly updated
    expect(stats).toBeDefined();
    expect(stats?.totalExecutions).toBe(1);
    expect(stats?.successfulExecutions).toBe(0);
    expect(stats?.failedExecutions).toBe(1);
    expect(stats?.totalExecutionTime).toBe(50);
    expect(stats?.averageExecutionTime).toBe(50);
    expect(stats?.mostCommonError).toBe('test error');
    expect(stats?.mostCommonErrorCount).toBe(1);
  });
  
  test('records cached executions', () => {
    // Record a cached execution
    tracker.recordExecution(
      { success: true, result: 'test result', cached: true, executionTime: 0 },
      { toolName: 'test_tool' }
    );
    
    const stats = tracker.getToolStats('test_tool');
    
    // Verify stats are correctly updated
    expect(stats).toBeDefined();
    expect(stats?.totalExecutions).toBe(1);
    expect(stats?.successfulExecutions).toBe(1);
    expect(stats?.cachedExecutions).toBe(1);
    // Average execution time should exclude cached results
    expect(stats?.averageExecutionTime).toBe(0);
  });
  
  test('tracks most common errors', () => {
    // Record multiple failures with different errors
    tracker.recordExecution(
      { success: false, result: null, error: 'error A', executionTime: 50 },
      { toolName: 'test_tool' }
    );
    
    tracker.recordExecution(
      { success: false, result: null, error: 'error B', executionTime: 50 },
      { toolName: 'test_tool' }
    );
    
    tracker.recordExecution(
      { success: false, result: null, error: 'error A', executionTime: 50 },
      { toolName: 'test_tool' }
    );
    
    const stats = tracker.getToolStats('test_tool');
    
    // Verify most common error is correctly identified
    expect(stats?.mostCommonError).toBe('error A');
    expect(stats?.mostCommonErrorCount).toBe(2);
  });
  
  test('enforces retention policy', () => {
    // Create tracker with small retention limit
    const limitedTracker = new ToolUsageTracker({ maxEntriesPerTool: 3 });
    
    // Add more executions than the limit
    for (let i = 0; i < 5; i++) {
      limitedTracker.recordExecution(
        { success: true, result: `result ${i}`, executionTime: 10 },
        { toolName: 'test_tool' }
      );
    }
    
    const executions = limitedTracker.getToolExecutions('test_tool');
    
    // Verify only the latest executions are kept
    expect(executions.length).toBe(3);
    // Check timestamps and ordering rather than internal result values
    expect(executions[0].timestamp).toBeLessThan(executions[1].timestamp);
    expect(executions[1].timestamp).toBeLessThan(executions[2].timestamp);
  });
  
  test('retrieves all tool stats', () => {
    // Record executions for multiple tools
    tracker.recordExecution(
      { success: true, result: 'result A', executionTime: 100 },
      { toolName: 'tool_A' }
    );
    
    tracker.recordExecution(
      { success: true, result: 'result B', executionTime: 200 },
      { toolName: 'tool_B' }
    );
    
    const allStats = tracker.getAllToolStats();
    
    // Verify all stats are retrieved
    expect(allStats.size).toBe(2);
    expect(allStats.has('tool_A')).toBe(true);
    expect(allStats.has('tool_B')).toBe(true);
    expect(allStats.get('tool_A')?.totalExecutions).toBe(1);
    expect(allStats.get('tool_B')?.totalExecutions).toBe(1);
  });
  
  test('clears all usage data', () => {
    // Record some executions
    tracker.recordExecution(
      { success: true, result: 'result A', executionTime: 100 },
      { toolName: 'tool_A' }
    );
    
    tracker.recordExecution(
      { success: true, result: 'result B', executionTime: 200 },
      { toolName: 'tool_B' }
    );
    
    // Clear all data
    tracker.clear();
    
    // Verify all data is cleared
    const allStats = tracker.getAllToolStats();
    expect(allStats.size).toBe(0);
    expect(tracker.getToolExecutions('tool_A').length).toBe(0);
    expect(tracker.getToolExecutions('tool_B').length).toBe(0);
  });
});
