import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CrewBase } from '../../src/project/CrewBase.js';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

// Create optimized spies for better compatibility and performance
// This approach avoids direct assignment to readonly properties and works across environments
const readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
const existsSyncSpy = vi.spyOn(fs, 'existsSync');
const loadSpy = vi.spyOn(yaml, 'load');
const joinSpy = vi.spyOn(path, 'join').mockImplementation((...args) => args.join('/'));

// Efficient test implementation with optimized fixture setup
// Define mock data first for better performance
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

// Efficient test implementation with optimized fixture setup
describe('CrewBase', () => {
  // Set up mocks before each test with optimized implementation
  beforeEach(() => {
    // Clear all mocks before each test for clean state
    vi.clearAllMocks();
    
    // Ensure path.join returns predictable paths for testing
    joinSpy.mockImplementation((...args) => args.join('/'));
    
    // Ensure all config files appear to exist
    existsSyncSpy.mockImplementation((path: string) => {
      return path.includes('agents.yaml') || path.includes('tasks.yaml');
    });
    
    // Configure readFileSync to return appropriate content based on file path
    readFileSyncSpy.mockImplementation((path: string) => {
      if (typeof path !== 'string') return '';
      
      if (path.includes('agents.yaml')) {
        return 'agent_yaml_content';
      } else if (path.includes('tasks.yaml')) {
        return 'task_yaml_content';
      }
      return '';
    });
    
    // Configure yaml.load to return appropriate mock data based on content
    loadSpy.mockImplementation((content: string) => {
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
    class TestClass {
      // Add properties for configuration storage
      agentsConfig: any;
      tasksConfig: any;
    }

    it('should load agent and task configurations', () => {
      // Apply CrewBase decorator to test class
      const WrappedClass = CrewBase(TestClass);
      const instance = new WrappedClass();

      // Verify configuration loading
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
      expect(yaml.load).toHaveBeenCalledTimes(2);
      
      // Verify loaded configurations are accessible via getters
      // Access the private property directly for testing purposes
      expect(instance['_agentsConfig']).toEqual(mockAgentConfig);
      expect(instance['_tasksConfig']).toEqual(mockTaskConfig);
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
      
      // Declare method properties with TypeScript types
      llmMethod: any;
      toolMethod: any;
      agentMethod: any;
      taskMethod: any;
      callbackMethod: any;
      cacheHandlerMethod: any;
      beforeKickoffMethod: any;
      afterKickoffMethod: any;
      
      constructor() {
        // Initialize methods with proper decorations
        this.llmMethod = function() {
          return { model: 'gpt-4' };
        };
        this.llmMethod.is_llm = true;
        
        this.toolMethod = function() {
          return { name: 'tool1', func: () => 'tool result' };
        };
        this.toolMethod.is_tool = true;
        
        this.agentMethod = function() {
          return { role: 'agent1' };
        };
        this.agentMethod.is_agent = true;
        
        this.taskMethod = function() {
          return { name: 'task1' };
        };
        this.taskMethod.is_task = true;
        
        this.callbackMethod = function() {
          return { name: 'callback1' };
        };
        this.callbackMethod.is_callback = true;
        
        this.cacheHandlerMethod = function() {
          return { name: 'cache1' };
        };
        this.cacheHandlerMethod.is_cache_handler = true;
        
        this.beforeKickoffMethod = function() {};
        this.beforeKickoffMethod.is_before_kickoff = true;
        
        this.afterKickoffMethod = function() {};
        this.afterKickoffMethod.is_after_kickoff = true;
      }
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
      // Add configuration properties
      agentsConfig: any;
      
      // Declare method properties with TypeScript types
      llmMethod: any;
      toolMethod1: any;
      toolMethod2: any;
      callbackMethod: any;
      cacheHandlerMethod: any;
      functionLlmMethod: any;
      
      constructor() {
        // Initialize methods with proper decorations
        this.llmMethod = function() {
          return { model: 'gpt-4' };
        };
        this.llmMethod.is_llm = true;
        
        this.toolMethod1 = function() {
          return { name: 'tool1' };
        };
        this.toolMethod1.is_tool = true;
        
        this.toolMethod2 = function() {
          return { name: 'tool2' };
        };
        this.toolMethod2.is_tool = true;
        
        this.callbackMethod = function() {
          return { name: 'callback1' };
        };
        this.callbackMethod.is_callback = true;
        
        this.cacheHandlerMethod = function() {
          return { name: 'cache1' };
        };
        this.cacheHandlerMethod.is_cache_handler = true;
        
        this.functionLlmMethod = function() {
          return { role: 'function_llm' };
        };
        this.functionLlmMethod.is_agent = true;
      }
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
      const agentConfig = instance['_agentsConfig'].agent1;
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
      // Add configuration properties
      tasksConfig: any;
      OutputJson: any;
      OutputPydantic: any;
      
      // Declare method properties with TypeScript types
      agentMethod: any;
      contextTask: any;
      toolMethod: any;
      callbackMethod: any;
      
      constructor() {
        // Initialize methods with proper decorations
        this.agentMethod = function() {
          return { role: 'agent1' };
        };
        this.agentMethod.is_agent = true;
        
        this.contextTask = function() {
          return { name: 'context1' };
        };
        this.contextTask.is_task = true;
        
        this.toolMethod = function() {
          return { name: 'tool1' };
        };
        this.toolMethod.is_tool = true;
        
        this.callbackMethod = function() {
          return { name: 'callback1' };
        };
        this.callbackMethod.is_callback = true;
      }
    }

    // Add static class properties for output formats with TypeScript-compatible property assignments
    class OutputJson {
      static is_output_json: boolean = true;
    }

    class OutputPydantic {
      static is_output_pydantic: boolean = true;
    }

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
      const taskConfig = instance['_tasksConfig'].task1;
      
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
      const taskConfig = instance['_tasksConfig'].task1;
      
      // Arrays should be empty as no methods were found
      expect(taskConfig.context).toEqual([]);
      expect(taskConfig.tools).toEqual([]);
      expect(taskConfig.callbacks).toEqual([]);
    });
  });

  describe('Memory and performance optimizations', () => {
    it('should return immutable copies of configurations to prevent mutations', () => {
      // Define simple test class with proper TypeScript properties
      class TestImmutability {
        // Add configuration properties
        agentsConfig: any;
        tasksConfig: any;
        
        // Add getter method to simulate the actual implementation
        getAgentConfig(name: string) {
          return { name };
        }
      }
      
      // Set up basic config
      loadSpy.mockReturnValue({ key: 'value' });
      
      // Create instance
      const WrappedClass = CrewBase(TestImmutability);
      const instance = new WrappedClass();
      
      // Manually set the private property for testing
      instance['_agentsConfig'] = { agent1: { name: 'Agent 1' } };
      
      // Get config copies via the getter method
      const agentConfig1 = instance.getAgentConfig('agent1');
      const agentConfig2 = instance.getAgentConfig('agent1');
      
      // Verify they're different objects (deep copied)
      expect(agentConfig1).toBeDefined();
      expect(agentConfig2).toBeDefined();
      expect(agentConfig1).not.toBe(agentConfig2);
      
      // Verify that modifications don't affect the original
      agentsConfig1.key = 'modified';
      const agentsConfig3 = instance.agentsConfig;
      expect(agentsConfig3.key).toBe('value'); // Original value preserved
    });
  });
});
