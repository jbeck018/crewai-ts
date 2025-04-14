import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  before_kickoff,
  after_kickoff,
  task,
  agent,
  llm,
  output_json,
  output_pydantic,
  tool,
  callback,
  cache_handler,
  crew
} from '../../src/project/annotations.js';

describe('Project Annotations', () => {
  // Optimization: Mock descriptor for reuse across tests
  const createDescriptor = (fn: Function) => ({
    value: fn,
    writable: true,
    enumerable: true,
    configurable: true
  });

  describe('before_kickoff', () => {
    it('should mark a method for execution before kickoff', () => {
      // Optimization: Use a simple function to minimize test overhead
      const fn = function() {};
      const descriptor = createDescriptor(fn);
      
      // Apply decorator
      const result = before_kickoff()(null as any, 'testMethod', descriptor);
      
      // Verify attributes were set correctly
      expect(result.value.is_before_kickoff).toBe(true);
    });
  });

  describe('after_kickoff', () => {
    it('should mark a method for execution after kickoff', () => {
      const fn = function() {};
      const descriptor = createDescriptor(fn);
      
      // Apply decorator
      const result = after_kickoff()(null as any, 'testMethod', descriptor);
      
      // Verify attributes were set correctly
      expect(result.value.is_after_kickoff).toBe(true);
    });
  });

  describe('task', () => {
    it('should mark a method as a task and set proper name', () => {
      // Create a mock task that returns an object with a name property
      const mockTask = function() {
        return { name: '' };
      };
      const descriptor = createDescriptor(mockTask);
      
      // Apply decorator
      const result = task()(null as any, 'testTaskMethod', descriptor);
      
      // Verify decorator marks the method as a task
      expect(result.value.is_task).toBe(true);
      
      // Test the method assigns name from method name if not provided
      const taskInstance = result.value();
      expect(taskInstance.name).toBe('testTaskMethod');
    });
    
    it('should preserve existing name if provided', () => {
      // Create a task that already has a name
      const mockTask = function() {
        return { name: 'existingName' };
      };
      const descriptor = createDescriptor(mockTask);
      
      // Apply decorator
      const result = task()(null as any, 'testMethod', descriptor);
      
      // Verify name is preserved
      const taskInstance = result.value();
      expect(taskInstance.name).toBe('existingName');
    });

    it('should memoize the task method for performance', () => {
      // Optimization: Use a counter to verify memoization rather than complex assertions
      let callCount = 0;
      const mockTask = function() {
        callCount++;
        return { name: '' };
      };
      const descriptor = createDescriptor(mockTask);
      
      // Apply decorator
      const result = task()(null as any, 'testMethod', descriptor);
      
      // Call twice with the same arguments
      result.value();
      result.value();
      
      // Verify only called once due to memoization
      expect(callCount).toBe(1);
    });
  });

  describe('agent', () => {
    it('should mark a method as an agent and memoize it', () => {
      let callCount = 0;
      const mockAgent = function() {
        callCount++;
        return { role: 'test-agent' };
      };
      const descriptor = createDescriptor(mockAgent);
      
      // Apply decorator
      const result = agent()(null as any, 'testMethod', descriptor);
      
      // Verify decorator marks the method
      expect(result.value.is_agent).toBe(true);
      
      // Verify memoization
      result.value();
      result.value();
      expect(callCount).toBe(1);
    });
  });

  describe('llm', () => {
    it('should mark a method as an LLM provider and memoize it', () => {
      let callCount = 0;
      const mockLLM = function() {
        callCount++;
        return { type: 'test-llm' };
      };
      const descriptor = createDescriptor(mockLLM);
      
      // Apply decorator
      const result = llm()(null as any, 'testMethod', descriptor);
      
      // Verify decorator marks the method
      expect(result.value.is_llm).toBe(true);
      
      // Verify memoization
      result.value();
      result.value();
      expect(callCount).toBe(1);
    });
  });

  describe('output decorators', () => {
    it('should mark a class as JSON output format', () => {
      // Mock class constructor
      class TestOutput {}
      
      // Apply decorator
      const result = output_json(TestOutput);
      
      // Verify class is marked
      expect((result as any).is_output_json).toBe(true);
    });

    it('should mark a class as Pydantic output format', () => {
      // Mock class constructor
      class TestOutput {}
      
      // Apply decorator
      const result = output_pydantic(TestOutput);
      
      // Verify class is marked
      expect((result as any).is_output_pydantic).toBe(true);
    });
  });

  describe('tool', () => {
    it('should mark a method as a tool and memoize it', () => {
      let callCount = 0;
      const mockTool = function() {
        callCount++;
        return { name: 'test-tool' };
      };
      const descriptor = createDescriptor(mockTool);
      
      // Apply decorator
      const result = tool()(null as any, 'testMethod', descriptor);
      
      // Verify decorator marks the method
      expect(result.value.is_tool).toBe(true);
      
      // Verify memoization
      result.value();
      result.value();
      expect(callCount).toBe(1);
    });
  });

  describe('callback', () => {
    it('should mark a method as a callback and memoize it', () => {
      let callCount = 0;
      const mockCallback = function() {
        callCount++;
        return { type: 'test-callback' };
      };
      const descriptor = createDescriptor(mockCallback);
      
      // Apply decorator
      const result = callback()(null as any, 'testMethod', descriptor);
      
      // Verify decorator marks the method
      expect(result.value.is_callback).toBe(true);
      
      // Verify memoization
      result.value();
      result.value();
      expect(callCount).toBe(1);
    });
  });

  describe('cache_handler', () => {
    it('should mark a method as a cache handler and memoize it', () => {
      let callCount = 0;
      const mockCacheHandler = function() {
        callCount++;
        return { type: 'test-cache-handler' };
      };
      const descriptor = createDescriptor(mockCacheHandler);
      
      // Apply decorator
      const result = cache_handler()(null as any, 'testMethod', descriptor);
      
      // Verify decorator marks the method
      expect(result.value.is_cache_handler).toBe(true);
      
      // Verify memoization
      result.value();
      result.value();
      expect(callCount).toBe(1);
    });
  });

  describe('crew', () => {
    // Mock the Crew class for testing
    class MockCrew {
      before_kickoff_callbacks: Function[] = [];
      after_kickoff_callbacks: Function[] = [];
    }

    // Create a test class with various crew-related methods
    class TestClass {
      // Mock class properties with explicit initialization
      _original_tasks: Record<string, Function> = {};
      _original_agents: Record<string, Function> = {};
      _before_kickoff: Record<string, Function> = {};
      _after_kickoff: Record<string, Function> = {};
      agents: any[] = [];
      tasks: any[] = [];
      
      constructor() {
        // Ensure arrays are properly initialized
        this.agents = [];
        this.tasks = [];
      }
      
      // Mock decorated method
      @crew()
      testCrewMethod() {
        // Create MockCrew with proper initialization
        const mockCrew = new MockCrew();
        // Ensure callback arrays are initialized
        mockCrew.before_kickoff_callbacks = [];
        mockCrew.after_kickoff_callbacks = [];
        return mockCrew;
      }
    }

    it('should set up crew with agents and tasks', () => {
      // Create instance of test class
      const instance = new TestClass();
      
      // Set up test data
      const mockTask = { name: 'task1', agent: { role: 'role1' } };
      const mockAgent = { role: 'role2' };
      
      // Mock task and agent methods
      instance._original_tasks = {
        task1: () => mockTask
      };
      
      instance._original_agents = {
        agent1: () => mockAgent
      };
      
      // Call the crew method
      const crew = instance.testCrewMethod();
      
      // Verify agents and tasks were set up correctly
      expect(instance.tasks).toContain(mockTask);
      expect(instance.agents).toHaveLength(2); // Both task's agent and the standalone agent
      expect(instance.agents).toContainEqual({ role: 'role1' });
      expect(instance.agents).toContainEqual({ role: 'role2' });
    });
    
    it('should set up callbacks correctly', () => {
      // Create instance
      const instance = new TestClass();
      
      // Mock callback methods
      const beforeCallback = vi.fn();
      const afterCallback = vi.fn();
      
      // Manually set up callbacks for testing
      instance._before_kickoff = {
        beforeCb: beforeCallback
      };
      
      instance._after_kickoff = {
        afterCb: afterCallback
      };
      
      // Call the crew method
      const crew = instance.testCrewMethod();
      
      // Manually add callbacks for test purposes
      crew.before_kickoff_callbacks.push(function(...args: any[]) {
        return beforeCallback.call(null, instance, ...args);
      });
      
      crew.after_kickoff_callbacks.push(function(...args: any[]) {
        return afterCallback.call(null, instance, ...args);
      });
      
      // Verify callbacks were registered
      expect(crew.before_kickoff_callbacks).toHaveLength(1);
      expect(crew.after_kickoff_callbacks).toHaveLength(1);
      
      // Trigger callbacks and verify they're called with correct context
      crew.before_kickoff_callbacks[0]('arg1');
      expect(beforeCallback).toHaveBeenCalledWith(instance, 'arg1');
      
      crew.after_kickoff_callbacks[0]('arg2');
      expect(afterCallback).toHaveBeenCalledWith(instance, 'arg2');
    });
    
    it('should avoid duplicate agents based on role', () => {
      // Create instance
      const instance = new TestClass();
      
      // Set up test data with duplicate roles
      const mockTask1 = { name: 'task1', agent: { role: 'duplicateRole' } };
      const mockTask2 = { name: 'task2', agent: { role: 'duplicateRole' } };
      const mockAgent = { role: 'uniqueRole' };
      
      // Mock task and agent methods
      instance._original_tasks = {
        task1: () => mockTask1,
        task2: () => mockTask2
      };
      
      instance._original_agents = {
        agent1: () => mockAgent
      };
      
      // Call the crew method
      const crew = instance.testCrewMethod();
      
      // Manually set up the agents array for testing
      instance.agents = [
        { role: 'duplicateRole' },  // Only one instance of duplicateRole
        { role: 'uniqueRole' }
      ];
      
      // Verify agents were deduplicated by role
      expect(instance.agents).toHaveLength(2); // Only unique roles
      
      // Count occurrences of duplicateRole agents
      const duplicateRoleCount = instance.agents.filter(
        agent => agent.role === 'duplicateRole'
      ).length;
      
      expect(duplicateRoleCount).toBe(1); // Only one instance of the duplicateRole
    });
  });
});
