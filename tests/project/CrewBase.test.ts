import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrewBase } from '../../src/project/CrewBase.js';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Mock fs, path, and yaml modules for efficient testing
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true)
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  dirname: vi.fn(() => '/mock/dir')
}));

vi.mock('js-yaml', () => ({
  load: vi.fn()
}));

// Efficient test implementation with optimized fixture setup
describe('CrewBase', () => {
  // Lightweight mock data
  const mockAgentConfig = {
    agent1: {
      llm: 'test_llm',
      tools: ['tool1', 'tool2'],
      function_calling_llm: 'function_llm',
      step_callback: 'callback1',
      cache_handler: 'cache1'
    }
  };

  const mockTaskConfig = {
    task1: {
      context: ['context1'],
      tools: ['tool1'],
      agent: 'agent1',
      output_json: 'output1',
      output_pydantic: 'model1',
      callbacks: ['callback1']
    }
  };

  // Reset mocks before each test for isolation
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up fs mock with optimized implementation
    (fs.readFileSync as jest.Mock).mockImplementation((path) => {
      if (path.includes('agents.yaml')) {
        return 'agent_yaml_content';
      } else if (path.includes('tasks.yaml')) {
        return 'task_yaml_content';
      }
      return '';
    });

    // Set up yaml mock with optimized implementation
    (yaml.load as jest.Mock).mockImplementation((content) => {
      if (content === 'agent_yaml_content') {
        return mockAgentConfig;
      } else if (content === 'task_yaml_content') {
        return mockTaskConfig;
      }
      return {};
    });
  });

  describe('Configuration loading', () => {
    // Test optimizations: Use class that minimizes property access
    class TestClass {}

    it('should load agent and task configurations', () => {
      // Apply CrewBase decorator to test class
      const WrappedClass = CrewBase(TestClass);
      const instance = new WrappedClass();

      // Verify configuration loading
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
      expect(yaml.load).toHaveBeenCalledTimes(2);
      
      // Verify loaded configurations are accessible via getters
      expect(instance.agentsConfig).toEqual(mockAgentConfig);
      expect(instance.tasksConfig).toEqual(mockTaskConfig);
    });

    it('should handle missing configuration files', () => {
      // Simulate missing file error
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        const error = new Error('File not found') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      });

      // Apply CrewBase decorator
      const WrappedClass = CrewBase(TestClass);
      
      // Should not throw error when files are missing
      expect(() => new WrappedClass()).not.toThrow();
      
      // Instance should be created with empty configs
      const instance = new WrappedClass();
      expect(instance.agentsConfig).toEqual({});
      expect(instance.tasksConfig).toEqual({});
    });

    it('should handle other file system errors', () => {
      // Simulate permission error
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        const error = new Error('Permission denied') as NodeJS.ErrnoException;
        error.code = 'EACCES';
        throw error;
      });

      // Should propagate non-ENOENT errors
      const WrappedClass = CrewBase(TestClass);
      expect(() => new WrappedClass()).toThrow();
    });
  });

  describe('Function mapping', () => {
    // Test optimization: Use decorated class with minimal methods
    class TestClassWithDecorators {
      static agents_config = 'custom/agents.yaml';
      static tasks_config = 'custom/tasks.yaml';

      // Mock decorated methods for testing
      llmMethod() {
        return { model: 'gpt-4' };
      }
      llmMethod.is_llm = true;

      toolMethod() {
        return { name: 'tool1', func: () => 'tool result' };
      }
      toolMethod.is_tool = true;

      agentMethod() {
        return { role: 'agent1' };
      }
      agentMethod.is_agent = true;

      taskMethod() {
        return { name: 'task1' };
      }
      taskMethod.is_task = true;

      callbackMethod() {
        return { name: 'callback1' };
      }
      callbackMethod.is_callback = true;

      cacheHandlerMethod() {
        return { name: 'cache1' };
      }
      cacheHandlerMethod.is_cache_handler = true;

      beforeKickoffMethod() {}
      beforeKickoffMethod.is_before_kickoff = true;

      afterKickoffMethod() {}
      afterKickoffMethod.is_after_kickoff = true;
    }

    it('should identify and preserve decorated methods', () => {
      // Mock RequireResolve to avoid filesystem dependency
      global.require = {
        resolve: vi.fn().mockReturnValue('/mock/path/TestClassWithDecorators.js')
      } as any;

      // Apply CrewBase decorator
      const WrappedClass = CrewBase(TestClassWithDecorators);
      const instance = new WrappedClass();

      // Verify function collections
      expect(Object.keys(instance['_originalFunctions']).length).toBeGreaterThan(0);
      expect(Object.keys(instance['_originalTasks']).length).toBeGreaterThan(0);
      expect(Object.keys(instance['_originalAgents']).length).toBeGreaterThan(0);
      expect(Object.keys(instance['_beforeKickoff']).length).toBeGreaterThan(0);
      expect(Object.keys(instance['_afterKickoff']).length).toBeGreaterThan(0);
    });
  });

  describe('Agent variable mapping', () => {
    // Define test class with all necessary decorated methods
    class TestMapAgentVars {
      // Add mock decorated methods
      llmMethod() {
        return { model: 'gpt-4' };
      }
      llmMethod.is_llm = true;

      toolMethod1() {
        return { name: 'tool1' };
      }
      toolMethod1.is_tool = true;

      toolMethod2() {
        return { name: 'tool2' };
      }
      toolMethod2.is_tool = true;

      callbackMethod() {
        return { name: 'callback1' };
      }
      callbackMethod.is_callback = true;

      cacheHandlerMethod() {
        return { name: 'cache1' };
      }
      cacheHandlerMethod.is_cache_handler = true;

      functionLlmMethod() {
        return { role: 'function_llm' };
      }
      functionLlmMethod.is_agent = true;
    }

    it('should map agent variables from configuration', () => {
      // Set up mocks for this test
      (yaml.load as jest.Mock).mockImplementation(() => ({
        agent1: {
          llm: 'llmMethod',
          tools: ['toolMethod1', 'toolMethod2'],
          function_calling_llm: 'functionLlmMethod',
          step_callback: 'callbackMethod',
          cache_handler: 'cacheHandlerMethod'
        }
      }));

      // Create wrapped instance
      const WrappedClass = CrewBase(TestMapAgentVars);
      const instance = new WrappedClass();

      // Verify agent config has been populated with actual object instances
      const agentConfig = instance.agentsConfig.agent1;
      expect(agentConfig.llm).toEqual({ model: 'gpt-4' });
      expect(agentConfig.tools).toHaveLength(2);
      expect(agentConfig.function_calling_llm).toEqual({ role: 'function_llm' });
      expect(agentConfig.step_callback).toEqual({ name: 'callback1' });
      expect(agentConfig.cache_handler).toEqual({ name: 'cache1' });
    });

    it('should handle missing method references gracefully', () => {
      // Set up mocks with nonexistent method references
      (yaml.load as jest.Mock).mockImplementation(() => ({
        agent1: {
          llm: 'nonexistentMethod',
          tools: ['nonexistentTool'],
          function_calling_llm: 'nonexistentLlm'
        }
      }));

      // Creating instance should not throw errors
      const WrappedClass = CrewBase(TestMapAgentVars);
      expect(() => new WrappedClass()).not.toThrow();
    });
  });

  describe('Task variable mapping', () => {
    // Define test class with task-related decorated methods
    class TestMapTaskVars {
      // Add mock decorated methods
      agentMethod() {
        return { role: 'agent1' };
      }
      agentMethod.is_agent = true;

      contextTask() {
        return { name: 'context1' };
      }
      contextTask.is_task = true;

      toolMethod() {
        return { name: 'tool1' };
      }
      toolMethod.is_tool = true;

      callbackMethod() {
        return { name: 'callback1' };
      }
      callbackMethod.is_callback = true;
    }

    // Add static class properties for output formats
    class OutputJson {}
    OutputJson.is_output_json = true;

    class OutputPydantic {}
    OutputPydantic.is_output_pydantic = true;

    beforeEach(() => {
      // Add output classes to prototype for discovery
      TestMapTaskVars.prototype.OutputJson = OutputJson;
      TestMapTaskVars.prototype.OutputPydantic = OutputPydantic;
    });

    it('should map task variables from configuration', () => {
      // Set up mocks for task configuration
      (yaml.load as jest.Mock).mockImplementation((content) => {
        if (content.includes('agents')) {
          return {};
        } else if (content.includes('tasks')) {
          return {
            task1: {
              context: ['contextTask'],
              tools: ['toolMethod'],
              agent: 'agentMethod',
              output_json: 'OutputJson',
              output_pydantic: 'OutputPydantic',
              callbacks: ['callbackMethod']
            }
          };
        }
        return {};
      });

      // Create wrapped instance
      const WrappedClass = CrewBase(TestMapTaskVars);
      const instance = new WrappedClass();

      // Verify task variables mapping
      const taskConfig = instance.tasksConfig.task1;
      
      // Verify context tasks are instantiated
      expect(taskConfig.context).toHaveLength(1);
      expect(taskConfig.context[0]).toEqual({ name: 'context1' });
      
      // Verify tools are instantiated
      expect(taskConfig.tools).toHaveLength(1);
      expect(taskConfig.tools[0]).toEqual({ name: 'tool1' });
      
      // Verify agent is instantiated
      expect(taskConfig.agent).toEqual({ role: 'agent1' });
      
      // Verify callbacks are instantiated
      expect(taskConfig.callbacks).toHaveLength(1);
      expect(taskConfig.callbacks[0]).toEqual({ name: 'callback1' });
    });

    it('should handle missing method references gracefully', () => {
      // Set up mocks with nonexistent method references
      (yaml.load as jest.Mock).mockImplementation(() => ({
        task1: {
          context: ['nonexistentContext'],
          tools: ['nonexistentTool'],
          agent: 'nonexistentAgent',
          callbacks: ['nonexistentCallback']
        }
      }));

      // Creating instance should not throw errors
      const WrappedClass = CrewBase(TestMapTaskVars);
      expect(() => new WrappedClass()).not.toThrow();
      
      // Task config should still contain entries but without successfully mapped values
      const instance = new WrappedClass();
      const taskConfig = instance.tasksConfig.task1;
      
      // Arrays should be empty as no methods were found
      expect(taskConfig.context).toEqual([]);
      expect(taskConfig.tools).toEqual([]);
      expect(taskConfig.callbacks).toEqual([]);
    });
  });

  describe('Memory and performance optimizations', () => {
    it('should return immutable copies of configurations to prevent mutations', () => {
      // Define simple test class
      class TestImmutability {}
      
      // Set up basic config
      (yaml.load as jest.Mock).mockReturnValue({ key: 'value' });
      
      // Create instance
      const WrappedClass = CrewBase(TestImmutability);
      const instance = new WrappedClass();
      
      // Get config copies
      const agentsConfig1 = instance.agentsConfig;
      const agentsConfig2 = instance.agentsConfig;
      
      // Verify they're different objects (deep copied)
      expect(agentsConfig1).not.toBe(agentsConfig2);
      
      // Verify that modifications don't affect the original
      agentsConfig1.key = 'modified';
      const agentsConfig3 = instance.agentsConfig;
      expect(agentsConfig3.key).toBe('value'); // Original value preserved
    });
  });
});
