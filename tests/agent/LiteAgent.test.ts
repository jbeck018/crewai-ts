/**
 * Tests for the LiteAgent class
 * Focused on ensuring optimal performance, memory efficiency, and correct functionality
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiteAgent, LiteAgentConfig } from '../../src/agent/LiteAgent.js';
import { BaseTool } from '../../src/tools/BaseTool.js';
import { Task } from '../../src/task/Task.js';

// Mock LLM for testing with optimized response handling
// Create a mock LLM that matches the BaseLLM interface
const mockLlm: any = {
  id: 'mock-llm',
  temperature: 0.7,
  maxTokens: 1024,
  complete: vi.fn().mockResolvedValue({
    content: 'Mock LLM response',
    totalTokens: 100,
    promptTokens: 50,
    completionTokens: 50
  }),
  completeStreaming: vi.fn(),
  countTokens: vi.fn().mockResolvedValue(100),
  getModelName: () => 'mock-model'
};

// Create a mock tool with minimal overhead
const createMockTool = (name: string): BaseTool => ({
  name,
  description: `Tool for ${name}`,
  verbose: false,
  cacheResults: false,
  execute: vi.fn().mockResolvedValue({ success: true, result: `Result from ${name}` }),
  getMetadata: () => ({
    name,
    description: `Tool for ${name}`
  })
});

// Create a mock task with efficient data structures
const createMockTask = (description: string): Task => {
  // Create a proper TaskConfig object
  const taskConfig = {
    description,
    expectedOutput: 'Detailed analysis',
    agent: {} as any, // Minimal mock, only what's needed
    async: false,
    context: [],
    priority: 'medium' as const,
    cachingStrategy: 'none' as const
  };
  
  // Create Task from TaskConfig
  return new Task(taskConfig);
};

describe('LiteAgent', () => {
  let agent: LiteAgent;
  let defaultConfig: LiteAgentConfig;
  
  // Setup a clean environment before each test
  beforeEach(() => {
    defaultConfig = {
      role: 'Test Agent',
      goal: 'Complete tests efficiently',
      backstory: 'I was created to test the LiteAgent implementation',
      llm: mockLlm,
      tools: [createMockTool('test-tool')]
    };
    
    agent = new LiteAgent(defaultConfig);
    
    // Reset all mocks
    vi.clearAllMocks();
  });
  
  // Clean up after tests
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  test('should initialize with correct properties', () => {
    // Test initialization
    expect(agent.role).toBe('Test Agent');
    expect(agent.goal).toBe('Complete tests efficiently');
    expect(agent.backstory).toBe('I was created to test the LiteAgent implementation');
    
    // Test that a unique ID is generated
    expect(agent.id).toBeDefined();
    expect(typeof agent.id).toBe('string');
    expect(agent.id.length).toBeGreaterThan(0);
  });
  
  test('should execute a task and return a result', async () => {
    // Create a test task
    const task = createMockTask('Test task for execution');
    
    // Execute the task
    const result = await agent.executeTask(task);
    
    // Verify LLM was called
    expect(mockLlm.complete).toHaveBeenCalled();
    
    // Verify result structure
    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('metadata');
    expect(result.output).toBe('Mock LLM response');
    expect(result.metadata).toHaveProperty('iterations');
    expect(result.metadata).toHaveProperty('executionTime');
    expect(result.metadata?.iterations).toBe(1);
  });
  
  test('should use cache for repeated tasks', async () => {
    // Create a test task
    const task = createMockTask('Test task for caching');
    
    // Execute the task twice
    const result1 = await agent.executeTask(task);
    const result2 = await agent.executeTask(task);
    
    // Verify LLM was called only once
    expect(mockLlm.complete).toHaveBeenCalledTimes(1);
    
    // Verify both results are the same
    expect(result1.output).toBe(result2.output);
  });
  
  test('should not use cache when caching is disabled', async () => {
    // Create an agent with caching disabled
    const nonCachingAgent = new LiteAgent({
      ...defaultConfig,
      enableCaching: false
    });
    
    // Create a test task
    const task = createMockTask('Test task without caching');
    
    // Execute the task twice
    await nonCachingAgent.executeTask(task);
    await nonCachingAgent.executeTask(task);
    
    // Verify LLM was called twice
    expect(mockLlm.complete).toHaveBeenCalledTimes(2);
  });
  
  test('should respect max cache size', async () => {
    // Create an agent with small cache size for testing
    const smallCacheAgent = new LiteAgent({
      ...defaultConfig,
      maxCacheSize: 2
    });
    
    // Create three different tasks
    const task1 = createMockTask('Test task 1');
    const task2 = createMockTask('Test task 2');
    const task3 = createMockTask('Test task 3');
    
    // Execute all tasks to fill cache
    await smallCacheAgent.executeTask(task1);
    await smallCacheAgent.executeTask(task2);
    await smallCacheAgent.executeTask(task3);
    
    // Execute task1 again - should call LLM again because it was evicted from cache
    await smallCacheAgent.executeTask(task1);
    
    // Verify LLM was called 4 times (once for each initial task and once more for task1)
    expect(mockLlm.complete).toHaveBeenCalledTimes(4);
  });
  
  test('should handle context and tools in task execution', async () => {
    // Create a test task
    const task = createMockTask('Test task with context and tools');
    const context = 'Additional context information';
    const tools = [createMockTool('special-tool')];
    
    // Execute the task with context and tools
    await agent.executeTask(task, context, tools);
    
    // Verify LLM was called with a prompt containing the context and tool
    const promptArg = mockLlm.complete.mock.calls[0][0][0].content;
    expect(typeof promptArg).toBe('string');
    expect(promptArg).toContain('Additional context information');
    expect(promptArg).toContain('special-tool');
  });
  
  test('should create delegation tools correctly', () => {
    // Create mock agents to delegate to
    const mockAgents = [
      { 
        id: 'agent1', 
        role: 'Helper Agent', 
        goal: 'Assist with tasks',
        executeTask: vi.fn(),
        getDelegationTools: vi.fn(),
        setKnowledge: vi.fn()
      },
      { 
        id: 'agent2', 
        role: 'Analyzer Agent', 
        goal: 'Analyze data',
        executeTask: vi.fn(),
        getDelegationTools: vi.fn(),
        setKnowledge: vi.fn()
      }
    ];
    
    // Get delegation tools
    const delegationTools = agent.getDelegationTools(mockAgents as any);
    
    // Verify tools were created correctly
    expect(delegationTools).toHaveLength(2);
    expect(delegationTools[0].name).toBe('delegate_to_helper_agent');
    expect(delegationTools[1].name).toBe('delegate_to_analyzer_agent');
  });
  
  test('should not create delegation tools when delegation is disabled', () => {
    // Create an agent with delegation disabled
    const nonDelegatingAgent = new LiteAgent({
      ...defaultConfig,
      allowDelegation: false
    });
    
    // Create mock agents to delegate to
    const mockAgents = [
      { id: 'agent1', role: 'Helper Agent', goal: 'Assist with tasks', executeTask: vi.fn() },
      { id: 'agent2', role: 'Analyzer Agent', goal: 'Analyze data', executeTask: vi.fn() }
    ];
    
    // Get delegation tools
    const delegationTools = nonDelegatingAgent.getDelegationTools(mockAgents as any);
    
    // Verify no tools were created
    expect(delegationTools).toHaveLength(0);
  });
  
  test('should handle errors during task execution', async () => {
    // Setup LLM to throw an error
    mockLlm.complete.mockRejectedValueOnce(new Error('Test error'));
    
    // Create a test task
    const task = createMockTask('Test task with error');
    
    // Execute the task
    const result = await agent.executeTask(task);
    
    // Define extended metadata type that includes error field
    interface ExtendedMetadata {
      totalTokens?: number;
      promptTokens?: number;
      completionTokens?: number;
      executionTime?: number;
      iterations?: number;
      error?: string;
    }
    
    // Verify error handling with proper type assertion
    expect(result.output).toContain('Error executing task');
    expect(result).toHaveProperty('metadata');
    const metadata = result.metadata as ExtendedMetadata;
    expect(metadata).toHaveProperty('error');
    expect(metadata.error).toContain('Test error');
  });
});
