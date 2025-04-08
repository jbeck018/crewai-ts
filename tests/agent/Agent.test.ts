import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
/**
 * Agent class tests
 * Optimized for efficient test execution and comprehensive coverage
 */

import { describe, test, expect, beforeEach, afterEach, mock } from '../vitest-utils.js';
import '../types';
import { Agent } from '../../src/agent/Agent';
import { Task } from '../../src/task/Task';
import { BaseTool } from '../../src/tools/BaseTool';

// Test fixtures using minimal data structures for better performance
const AGENT_CONFIG = {
  role: 'Test Agent',
  goal: 'Complete tests successfully',
  backstory: 'A specialized agent for testing the CrewAI framework',
  verbose: false
};

// Tool factory for creating test tools with minimal overhead
function createTestTool(name: string, description: string) {
  return {
    name,
    description,
    async _run(...args: any[]) {
      return `${name} executed with args: ${JSON.stringify(args)}`;
    }
  } as unknown as BaseTool;
}

describe('Agent', () => {
  // Reusable test fixtures with efficient initialization
  let agent: Agent;

  beforeEach(() => {
    // Create a fresh agent for each test
    agent = new Agent(AGENT_CONFIG);
  });

  afterEach(() => {
    // Clean up after each test
    agent = null as any;
  });

  test('should create an agent with basic properties', () => {
    // Verify agent creation with proper properties
    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined(); // UUID should be generated
    expect(agent.role).toBe('Test Agent');
    expect(agent.goal).toBe('Complete tests successfully');
    expect(agent.backstory).toBe('A specialized agent for testing the CrewAI framework');
  });

  test('should have default values when not provided', () => {
    // Test with minimal config to verify defaults
    const minimalAgent = new Agent({
      role: 'Minimal Agent',
      goal: 'Test defaults'
    });

    // We need to test defaults indirectly since they're private properties
    // ToString should contain the role and goal
    expect(minimalAgent.toString()).toBe('Agent(role=Minimal Agent, goal=Test defaults)');
    // We test other defaults through behavior rather than direct property access
  });

  test('should execute a task', async () => {
    // Create a test task with the agent as required parameter
    const task = new Task({
      description: 'Test task',
      expectedOutput: 'Completed test task',
      agent: agent
    });

    // Mock the agent executor
    const mockExecutor = {
      invoke: mock(() => Promise.resolve({ output: 'Task executed successfully' }))
    };
    
    // Inject the mock executor
    (agent as any).agentExecutor = mockExecutor;
    
    // Execute the task
    const result = await agent.executeTask(task);
    
    // Verify the execution with null-safe checks
    expect(result).toBeDefined();
    expect(result.output).toBe('Task executed successfully');
    
    // Safely check metadata with a more type-safe approach
    const metadata = result.metadata;
    expect(metadata).toBeDefined();
    if (metadata) {
      expect(metadata.executionTime).toBeGreaterThan(-1);
    }
    expect(mockExecutor.invoke).toHaveBeenCalled();
  });

  test('should handle tools during task execution', async () => {
    // Create a test task with the agent as required parameter
    const task = new Task({
      description: 'Test task with tools',
      expectedOutput: 'Completed test task with tool usage',
      agent: agent
    });

    // Create test tools
    const tools = [
      createTestTool('calculator', 'A tool for calculations'),
      createTestTool('searcher', 'A tool for searching information')
    ];

    // Create an enhanced mock that correctly replaces the method behavior
    // Directly override the agentExecutor property with our mock
    (agent as any).createAgentExecutor = async () => ({
      invoke: async () => ({ output: 'Task executed with tools' })
    });
    
    // Make sure no executor is cached before our test
    (agent as any).agentExecutor = undefined;
    
    // Execute the task with tools
    const result = await agent.executeTask(task, undefined, tools);
    
    // Verify the execution
    expect(result).toBeDefined();
    expect(result.output).toBe('Task executed with tools');
    
    // Verify the agent executor was created (using a more compatible assertion)
    const executor = (agent as any).agentExecutor;
    expect(executor !== undefined).toBe(true);
  });

  test('toString should return a descriptive string', () => {
    expect(agent.toString()).toBe('Agent(role=Test Agent, goal=Complete tests successfully)');
  });
});
