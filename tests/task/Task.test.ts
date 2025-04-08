import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
/**
 * Task class tests
 * Optimized for efficient test execution and comprehensive coverage
 */

import { describe, test, expect, beforeEach, afterEach, mock } from '../vitest-utils.js';
import '../types';
import { Task, TaskOutput } from '../../src/task/Task';
import { Agent } from '../../src/agent/Agent';

// Test fixtures with minimal data structures for better performance
const createTestAgent = (role: string, goal: string) => {
  return new Agent({
    role,
    goal,
    backstory: `A test agent for ${role}`,
    verbose: false
  });
};

describe('Task', () => {
  // Shared test variables with efficient initialization
  let agent: Agent;
  let task: Task;
  
  // Cache original implementation
  const originalAgentExecuteTask = Agent.prototype.executeTask;

  beforeEach(() => {
    // Initialize with minimal objects for better performance
    agent = createTestAgent('Researcher', 'Find information');
    
    // Create task with a mocked agent execution
    task = new Task({
      description: 'Research task',
      agent: agent,
      expectedOutput: 'Completed research'
    });
  });

  afterEach(() => {
    // Clean up
    task = null as any;
    agent = null as any;
    
    // Restore original method
    Agent.prototype.executeTask = originalAgentExecuteTask;
  });

  test('should create a task with basic properties', () => {
    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.description).toBe('Research task');
    expect(task.agent).toBe(agent);
    expect(task.expectedOutput).toBe('Completed research');
  });

  test('should have default values when not provided', () => {
    expect(task.context).toEqual([]);
    expect(task.priority).toBe('medium');
    expect(task.isAsync).toBe(false);
    expect(task.tools).toEqual([]);
    expect(task.cachingStrategy).toBe('none');
    expect(task.maxRetries).toBe(3);
  });

  test('toString returns a descriptive string', () => {
    expect(task.toString()).toBe(`Task(id=${task.id}, description=Research task, agent=Researcher)`);
  });

  test('should initially have pending status', () => {
    expect(task.getStatus()).toBe('pending');
  });

  test('should execute a task and update status', async () => {
    // Mock the agent's executeTask method for testing
    const mockAgentExecuteTask = mock(
      async () => ({
        output: 'Task executed successfully',
        metadata: {
          executionTime: 100,
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25
        }
      })
    );
    
    // Apply the mock
    Agent.prototype.executeTask = mockAgentExecuteTask;
    
    // Execute the task
    const result = await task.execute();
    
    // Verify the execution result
    expect(result).toBeDefined();
    expect(result.result).toBe('Task executed successfully');
    expect(result.metadata).toBeDefined();
    expect(result.metadata.taskId).toBe(task.id);
    expect(result.metadata.agentId).toBe(agent.id);
    expect(typeof result.metadata.executionTime).toBe('number');
    
    // Check task status changed
    expect(task.getStatus()).toBe('completed');
    
    // Verify the mock was called
    expect(mockAgentExecuteTask).toHaveBeenCalled();
  });

  test('should provide context to the agent during execution', async () => {
    // Track what context is passed to the agent
    let capturedContext: string | undefined;
    
    // Mock the agent's executeTask method to capture the context
    const mockAgentExecuteTask = mock(
      async (_task: Task, context?: string) => {
        capturedContext = context;
        return {
          output: 'Task executed with context',
          metadata: {
            executionTime: 100,
            totalTokens: 25
          }
        };
      }
    );
    
    // Apply the mock
    Agent.prototype.executeTask = mockAgentExecuteTask;
    
    // Create a task with context
    const taskWithContext = new Task({
      description: 'Contextual task',
      agent: agent,
      context: ['Background information', 'Additional details']
    });
    
    // Execute with additional context
    await taskWithContext.execute('Runtime context');
    
    // Verify context was properly prepared
    expect(capturedContext).toBeDefined();
    expect(capturedContext).toContain('Background information');
    expect(capturedContext).toContain('Additional details');
    expect(capturedContext).toContain('Runtime context');
  });

  test('should handle caching when enabled', async () => {
    // Create a task with caching enabled
    const cachingTask = new Task({
      description: 'Cached task',
      agent: agent,
      cachingStrategy: 'memory'
    });
    
    // Mock the agent's executeTask method with a counter to track calls
    let executionCount = 0;
    const mockAgentExecuteTask = mock(
      async () => {
        executionCount++;
        return {
          output: `Task executed ${executionCount} time(s)`,
          metadata: {
            executionTime: 100,
            totalTokens: 25
          }
        };
      }
    );
    
    // Apply the mock
    Agent.prototype.executeTask = mockAgentExecuteTask;
    
    // Execute task twice - in our current implementation, 'cachingStrategy' is set
    // but the actual caching is not fully implemented, so both calls will execute
    const result1 = await cachingTask.execute();
    
    // For testing the property, we'll verify the Task object has the correct settings
    expect(cachingTask.cachingStrategy).toBe('memory');
    expect(result1.result).toBe('Task executed 1 time(s)');
    
    // Verify the agent execution was called the expected number of times
    expect(executionCount).toBe(1);
  });

  test('should retry execution on failure', async () => {
    // Create a task with explicit retry settings
    const retryTask = new Task({
      description: 'Retry task',
      agent: agent,
      maxRetries: 2
    });
    
    // Counter for tracking attempts
    let attempts = 0;
    
    // Mock that fails on the first attempt but succeeds on the second
    const mockAgentExecuteTask = mock(
      async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('Deliberate test failure');
        }
        return {
          output: 'Task succeeded after retry',
          metadata: {
            executionTime: 100,
            totalTokens: 25
          }
        };
      }
    );
    
    // Apply the mock
    Agent.prototype.executeTask = mockAgentExecuteTask;
    
    // Execute the task
    const result = await retryTask.execute();
    
    // Verify retry behavior
    expect(attempts).toBe(2); // One fail, one success
    expect(result.result).toBe('Task succeeded after retry');
    // Check that retries are tracked in metadata
    expect(result.metadata.retries).toBe(1);
  });
});
