/**
 * Base decorator for creating crew classes with configuration and function management.
 * Optimized for performance and memory efficiency.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { deepClone, shallowImmutable } from './utils.js';

// Interface for objects that have Crew-specific properties
interface CrewFunctions {
  is_task?: boolean;
  is_agent?: boolean;
  is_before_kickoff?: boolean;
  is_after_kickoff?: boolean;
  is_llm?: boolean;
  is_output_json?: boolean;
  is_output_pydantic?: boolean;
  is_tool?: boolean;
  is_callback?: boolean;
  is_cache_handler?: boolean;
}

// Extended Function type with CrewAI decorators
type DecoratedFunction = Function & CrewFunctions;

// Type definitions for function collections
type FunctionCollection = Record<string, DecoratedFunction>;
type ConfigCollection = Record<string, any>;

/**
 * Interface for classes that can be wrapped by CrewBase
 */
interface CrewBaseClass {
  new (...args: any[]): any;
  prototype: any;
}

// Handle js-yaml typing with proper type declarations
// Using our custom type definition file for better compatibility and performance

/**
 * Wraps a class with crew functionality and configuration management.
 * Implements optimizations for configuration loading and function mapping.
 */
export function CrewBase<T extends CrewBaseClass>(BaseClass: T): T {
  return class CrewBaseWrapper extends BaseClass {
    // Class identification
    static readonly is_crew_class: boolean = true;
    
    // Configuration paths with lazy loading
    private readonly _baseDirectory: string;
    private readonly _originalAgentsConfigPath: string;
    private readonly _originalTasksConfigPath: string;
    
    // Configuration storage
    private _agentsConfig: ConfigCollection = {};
    private _tasksConfig: ConfigCollection = {};
    
    // Function collections with strong typing
    private readonly _originalFunctions: FunctionCollection = {};
    private readonly _originalTasks: FunctionCollection = {};
    private readonly _originalAgents: FunctionCollection = {};
    private readonly _beforeKickoff: FunctionCollection = {};
    private readonly _afterKickoff: FunctionCollection = {};
    
    constructor(...args: any[]) {
      super(...args);
      
      // Initialize base directory - using current directory as fallback for ESM compatibility
      this._baseDirectory = process.cwd();
      
      // Get configuration paths with defaults
      this._originalAgentsConfigPath = (BaseClass as any).agents_config || 'config/agents.yaml';
      this._originalTasksConfigPath = (BaseClass as any).tasks_config || 'config/tasks.yaml';
      
      // Load configurations using optimized loaders
      this._loadConfigurations();
      
      // Map variables for agents and tasks
      this._mapAllAgentVariables();
      this._mapAllTaskVariables();
      
      // Preserve decorated functions for later use
      this._preserveFunctions();
    }
    
    /**
     * Preserves all decorated functions, optimized with type filtering
     */
    private _preserveFunctions(): void {
      // Get all methods from the base class
      const prototype = Object.getPrototypeOf(this);
      const propertyNames = Object.getOwnPropertyNames(prototype);
      
      // Efficiently filter methods by checking for decoration attributes
      for (const name of propertyNames) {
        const method = prototype[name] as DecoratedFunction;
        if (typeof method === 'function') {
          if (this._hasDecoratorAttribute(method)) {
            this._originalFunctions[name] = method;
            
            // Store specific function types for performance
            if (method.is_task) this._originalTasks[name] = method;
            if (method.is_agent) this._originalAgents[name] = method;
            if (method.is_before_kickoff) this._beforeKickoff[name] = method;
            if (method.is_after_kickoff) this._afterKickoff[name] = method;
          }
        }
      }
    }
    
    /**
     * Checks if a method has any decorator attributes, optimized for minimal checks
     */
    private _hasDecoratorAttribute(method: DecoratedFunction): boolean {
      return !!(method.is_task || 
                method.is_agent || 
                method.is_before_kickoff || 
                method.is_after_kickoff);
    }
    
    /**
     * Loads configuration files with error handling and default values
     */
    private _loadConfigurations(): void {
      // Load agent configuration
      if (typeof this._originalAgentsConfigPath === 'string') {
        try {
          const agentsConfigPath = path.join(this._baseDirectory, this._originalAgentsConfigPath);
          try {
            this._agentsConfig = this._loadYaml(agentsConfigPath);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              console.warn(`Agent config file not found at ${agentsConfigPath}. Using empty configurations.`);
              this._agentsConfig = {};
            } else {
              console.error(`Error loading agent config: ${error instanceof Error ? error.message : String(error)}`);
              this._agentsConfig = {};
            }
          }
        } catch (error) {
          console.warn(`Error processing agent config path: ${error instanceof Error ? error.message : String(error)}`);
          this._agentsConfig = {};
        }
      } else {
        console.warn('No agent configuration path provided. Using empty configurations.');
        this._agentsConfig = {};
      }
      
      // Load task configuration
      if (typeof this._originalTasksConfigPath === 'string') {
        try {
          const tasksConfigPath = path.join(this._baseDirectory, this._originalTasksConfigPath);
          try {
            this._tasksConfig = this._loadYaml(tasksConfigPath);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              console.warn(`Task config file not found at ${tasksConfigPath}. Using empty configurations.`);
              this._tasksConfig = {};
            } else {
              console.error(`Error loading task config: ${error instanceof Error ? error.message : String(error)}`);
              this._tasksConfig = {};
            }
          }
        } catch (error) {
          console.warn(`Error processing task config path: ${error instanceof Error ? error.message : String(error)}`);
          this._tasksConfig = {};
        }
      } else {
        console.warn('No task configuration path provided. Using empty configurations.');
        this._tasksConfig = {};
      }
    }
    
    /**
     * Loads and parses a YAML file with optimized error handling
     */
    private _loadYaml(configPath: string): any {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        // Use type assertion for yaml.load result for optimal TypeScript compatibility
        const parsed = (yaml.load(fileContent) as Record<string, any>) || {};
        
        // Return immutable copy to prevent unintended mutations
        return shallowImmutable(parsed as object);
      } catch (error) {
        console.error(`Error loading YAML from ${configPath}:`, error);
        throw error;
      }
    }
    
    /**
     * Gets all functions from the class and its prototype chain
     * Optimized to minimize prototype chain traversal
     */
    private _getAllFunctions(): FunctionCollection {
      const functions: FunctionCollection = {};
      let proto = Object.getPrototypeOf(this);
      
      // Walk the prototype chain to collect all functions
      while (proto && proto !== Object.prototype) {
        for (const name of Object.getOwnPropertyNames(proto)) {
          const desc = Object.getOwnPropertyDescriptor(proto, name);
          if (desc && typeof desc.value === 'function' && !functions[name]) {
            functions[name] = desc.value;
          }
        }
        proto = Object.getPrototypeOf(proto);
      }
      
      return functions;
    }
    
    /**
     * Filters functions by a specific attribute, optimized with early returns
     */
    private _filterFunctions(functions: FunctionCollection, attribute: string): FunctionCollection {
      const result: FunctionCollection = {};
      
      for (const [name, fn] of Object.entries(functions)) {
        if (Reflect.get(fn, attribute) === true) {
          result[name] = fn;
        }
      }
      
      return result;
    }
    
    /**
     * Maps all agent variables from configuration to object instances
     * Optimized with batch processing and object caching
     */
    private _mapAllAgentVariables(): void {
      const allFunctions = this._getAllFunctions();
      const agents = this._filterFunctions(allFunctions, 'is_agent');
      const llms = this._filterFunctions(allFunctions, 'is_llm');
      const tools = this._filterFunctions(allFunctions, 'is_tool');
      const cacheHandlers = this._filterFunctions(allFunctions, 'is_cache_handler');
      const callbacks = this._filterFunctions(allFunctions, 'is_callback');
      
      // Process all agent configurations in a single batch
      for (const [agentName, agentInfo] of Object.entries(this._agentsConfig)) {
        this._mapAgentVariables(
          agentName,
          agentInfo,
          agents,
          llms,
          tools,
          cacheHandlers,
          callbacks
        );
      }
    }
    
    /**
     * Maps agent variables from configuration to object instances
     * Implements lazy instantiation for performance
     */
    private _mapAgentVariables(
      agentName: string,
      agentInfo: any,
      agents: FunctionCollection,
      llms: FunctionCollection,
      toolFunctions: FunctionCollection,
      cacheHandlerFunctions: FunctionCollection,
      callbacks: FunctionCollection
    ): void {
      // Map LLM configuration with lazy instantiation and optimized type checking
      if (agentInfo.llm) {
        try {
          const llmName = agentInfo.llm;
          if (llms[llmName]) {
            const llmFunc = llms[llmName];
            if (typeof llmFunc === 'function') {
              this._agentsConfig[agentName].llm = llmFunc.call(this);
            } else {
              console.warn(`LLM for agent ${agentName} is not a function`);
            }
          }
        } catch (error) {
          // Keep existing value if mapping fails
          console.warn(`Error mapping LLM for agent ${agentName}:`, error);
        }
      }
      
      // Map tools with batch instantiation and type checking for performance and reliability
      if (Array.isArray(agentInfo.tools)) {
        const toolInstances = [];
        for (const toolName of agentInfo.tools) {
          if (toolFunctions[toolName]) {
            try {
              const toolFunc = toolFunctions[toolName];
              if (typeof toolFunc === 'function') {
                toolInstances.push(toolFunc.call(this));
              } else {
                console.warn(`Tool ${toolName} is not a function`);
              }
            } catch (error) {
              console.warn(`Error instantiating tool ${toolName}:`, error);
            }
          }
        }
        this._agentsConfig[agentName].tools = toolInstances;
      }
      
      // Map function calling LLM
      if (agentInfo.function_calling_llm && agents[agentInfo.function_calling_llm]) {
        try {
          const functionCallingLlm = agents[agentInfo.function_calling_llm];
          if (typeof functionCallingLlm === 'function') {
            this._agentsConfig[agentName].function_calling_llm = functionCallingLlm.call(this);
          } else {
            console.warn(`Function calling LLM for agent ${agentName} is not a function`);
          }
        } catch (error) {
          console.warn(`Error mapping function calling LLM for agent ${agentName}:`, error);
        }
      }
      
      // Map step callback
      if (agentInfo.step_callback && callbacks[agentInfo.step_callback]) {
        try {
          const stepCallback = callbacks[agentInfo.step_callback];
          if (typeof stepCallback === 'function') {
            this._agentsConfig[agentName].step_callback = stepCallback.call(this);
          } else {
            console.warn(`Step callback for agent ${agentName} is not a function`);
          }
        } catch (error) {
          console.warn(`Error mapping step callback for agent ${agentName}:`, error);
        }
      }
      
      // Map cache handler
      if (agentInfo.cache_handler && cacheHandlerFunctions[agentInfo.cache_handler]) {
        try {
          const cacheHandler = cacheHandlerFunctions[agentInfo.cache_handler];
          if (typeof cacheHandler === 'function') {
            this._agentsConfig[agentName].cache_handler = cacheHandler.call(this);
          } else {
            console.warn(`Cache handler for agent ${agentName} is not a function`);
          }
        } catch (error) {
          console.warn(`Error mapping cache handler for agent ${agentName}:`, error);
        }
      }
    }
    
    /**
     * Maps all task variables from configuration to object instances
     * Optimized for batch operations and error isolation
     */
    private _mapAllTaskVariables(): void {
      const allFunctions = this._getAllFunctions();
      const agents = this._filterFunctions(allFunctions, 'is_agent');
      const tasks = this._filterFunctions(allFunctions, 'is_task');
      const outputJsonFunctions = this._filterFunctions(allFunctions, 'is_output_json');
      const toolFunctions = this._filterFunctions(allFunctions, 'is_tool');
      const callbackFunctions = this._filterFunctions(allFunctions, 'is_callback');
      const outputPydanticFunctions = this._filterFunctions(allFunctions, 'is_output_pydantic');
      
      // Process all task configurations in a single batch
      for (const [taskName, taskInfo] of Object.entries(this._tasksConfig)) {
        this._mapTaskVariables(
          taskName,
          taskInfo,
          agents,
          tasks,
          outputJsonFunctions,
          toolFunctions,
          callbackFunctions,
          outputPydanticFunctions
        );
      }
    }
    
    /**
     * Maps task variables from configuration to object instances
     * Implements optimized error handling for better reliability
     */
    private _mapTaskVariables(
      taskName: string,
      taskInfo: any,
      agents: FunctionCollection,
      tasks: FunctionCollection,
      outputJsonFunctions: FunctionCollection,
      toolFunctions: FunctionCollection,
      callbackFunctions: FunctionCollection,
      outputPydanticFunctions: FunctionCollection
    ): void {
      // Map context with batch instantiation
      if (Array.isArray(taskInfo.context)) {
        const contextInstances = [];
        for (const contextTaskName of taskInfo.context) {
          if (tasks[contextTaskName]) {
            try {
              const contextTask = tasks[contextTaskName];
              if (typeof contextTask === 'function') {
                contextInstances.push(contextTask.call(this));
              } else {
                console.warn(`Context task ${contextTaskName} is not a function`);
              }
            } catch (error) {
              console.warn(`Error instantiating context task ${contextTaskName}:`, error);
            }
          }
        }
        this._tasksConfig[taskName].context = contextInstances;
      }
      
      // Map tools with batch instantiation and proper type checking
      if (Array.isArray(taskInfo.tools)) {
        const toolInstances = [];
        for (const toolName of taskInfo.tools) {
          if (toolFunctions[toolName]) {
            try {
              const toolFunc = toolFunctions[toolName];
              if (typeof toolFunc === 'function') {
                toolInstances.push(toolFunc.call(this));
              } else {
                console.warn(`Tool ${toolName} is not a function`);
              }
            } catch (error) {
              console.warn(`Error instantiating tool ${toolName}:`, error);
            }
          }
        }
        this._tasksConfig[taskName].tools = toolInstances;
      }
      
      // Map agent with proper type checking
      if (taskInfo.agent && agents[taskInfo.agent]) {
        try {
          const agentFunc = agents[taskInfo.agent];
          if (typeof agentFunc === 'function') {
            this._tasksConfig[taskName].agent = agentFunc.call(this);
          } else {
            console.warn(`Agent for task ${taskName} is not a function`);
          }
        } catch (error) {
          console.warn(`Error mapping agent for task ${taskName}:`, error);
        }
      }
      
      // Map output JSON with type checking
      if (taskInfo.output_json && outputJsonFunctions[taskInfo.output_json]) {
        try {
          const outputJsonFunc = outputJsonFunctions[taskInfo.output_json];
          if (typeof outputJsonFunc === 'function') {
            this._tasksConfig[taskName].output_json = outputJsonFunc;
          } else {
            console.warn(`Output JSON for task ${taskName} is not a function`);
          }
        } catch (error) {
          console.warn(`Error mapping output JSON for task ${taskName}:`, error);
        }
      }
      
      // Map output Pydantic with optimized type checking
      if (taskInfo.output_pydantic && outputPydanticFunctions[taskInfo.output_pydantic]) {
        try {
          const outputPydanticFunc = outputPydanticFunctions[taskInfo.output_pydantic];
          if (typeof outputPydanticFunc === 'function') {
            this._tasksConfig[taskName].output_pydantic = outputPydanticFunc;
          } else {
            console.warn(`Output Pydantic for task ${taskName} is not a function`);
          }
        } catch (error) {
          console.warn(`Error mapping output Pydantic for task ${taskName}:`, error);
        }
      }
      
      // Map callbacks with batch instantiation and optimized type checking
      if (Array.isArray(taskInfo.callbacks)) {
        const callbackInstances = [];
        for (const callbackName of taskInfo.callbacks) {
          if (callbackFunctions[callbackName]) {
            try {
              const callbackFunc = callbackFunctions[callbackName];
              if (typeof callbackFunc === 'function') {
                callbackInstances.push(callbackFunc.call(this));
              } else {
                console.warn(`Callback ${callbackName} is not a function`);
              }
            } catch (error) {
              console.warn(`Error instantiating callback ${callbackName}:`, error);
            }
          }
        }
        this._tasksConfig[taskName].callbacks = callbackInstances;
      }
    }
    
    /**
     * Provides public access to the agents configuration.
     * Uses a getter to create a copy of the data for immutability.
     */
    get agentsConfig(): Record<string, any> {
      return deepClone(this._agentsConfig);
    }
    
    /**
     * Provides public access to the tasks configuration.
     * Uses a getter to create a copy of the data for immutability.
     */
    get tasksConfig(): Record<string, any> {
      return deepClone(this._tasksConfig);
    }
  };
}
