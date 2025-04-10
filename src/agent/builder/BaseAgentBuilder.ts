/**
 * Base Agent Builder
 * Abstract base class for agent builders that provides a foundation for creating agents
 * with optimized performance and memory usage
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { BaseAgent, AgentConfig } from '../BaseAgent.js';
import { BaseTool } from '../../tools/BaseTool.js';
import { Task } from '../../task/Task.js';
import { BaseLLM } from '../../llm/BaseLLM.js';
import { BaseKnowledgeSource } from '../../knowledge/source/BaseKnowledgeSource.js';
import { MutableAgentProperties, AgentBuilderState } from './types/index.js';

// These will be implemented later, for now create placeholder types
class CacheHandler {
  getOrCompute<T>(key: string, producer: () => Promise<T>): Promise<T> {
    return producer();
  }
}

class ToolsHandler {
  setCache(cache: CacheHandler): void {}
  addTool(tool: BaseTool): void {}
  addTools(tools: BaseTool[]): void {}
}

/**
 * Type for a function that can be called to validate a tool
 */
export type ToolValidator = (tool: any) => BaseTool | null;

/**
 * Base Agent Builder class that provides core functionality for building agents
 * Optimized for performance and memory efficiency
 */
export abstract class BaseAgentBuilder implements Omit<BaseAgent, 'executeTask' | 'getDelegationTools'>, AgentBuilderState {
  readonly id: string;
  readonly originalRole: string;
  readonly originalGoal: string;
  readonly originalBackstory?: string;
  
  // Implementing getters/setters for mutable properties that are readonly in the interface
  private _role: string;
  private _goal: string;
  private _backstory?: string;
  
  get role(): string {
    return this._role;
  }
  
  get goal(): string {
    return this._goal;
  }
  
  get backstory(): string | undefined {
    return this._backstory;
  }

  // Configuration properties
  protected _verbose: boolean;
  protected _allowDelegation: boolean;
  protected _maxIterations: number;
  protected _maxRpm?: number;
  protected _memory: boolean;
  protected _cache: boolean;
  protected _tools: BaseTool[];
  protected _llm?: BaseLLM | string;
  protected _functionCallingLlm?: BaseLLM | string;
  protected _knowledgeSources?: BaseKnowledgeSource[];
  protected _knowledgeStorage?: any; // Will be properly typed later
  protected _systemPrompt?: string;
  protected _useSystemPrompt: boolean;

  // Original values are now defined as readonly properties in the class signature

  // Handlers and utilities
  protected _cacheHandler?: CacheHandler;
  protected _toolsHandler: ToolsHandler;
  protected _logger: any; // Will be properly typed later
  protected _rpmController?: any; // Will be properly typed later

  // Weakmap for storing agent executors to avoid memory leaks
  private static _agentExecutors = new WeakMap<BaseAgentBuilder, any>();

  /**
   * Constructor for the BaseAgentBuilder
   * @param config Configuration for the agent
   */
  constructor(config: AgentConfig) {
    // Generate a unique ID for the agent
    this.id = uuidv4();
    
    // Set original immutable properties
    this.originalRole = config.role;
    this.originalGoal = config.goal;
    this.originalBackstory = config.backstory;
    
    // Set mutable properties
    this._role = config.role;
    this._goal = config.goal;
    this._backstory = config.backstory;
    this._llm = config.llm;
    this._functionCallingLlm = config.functionCallingLlm;
    this._verbose = config.verbose ?? false;
    this._allowDelegation = config.allowDelegation ?? true;
    this._maxIterations = config.maxIterations ?? 15;
    this._maxRpm = config.maxRpm;
    this._memory = config.memory ?? true;
    this._cache = config.memory ?? false;
    this._systemPrompt = config.systemPrompt;
    this._useSystemPrompt = config.useSystemPrompt ?? true;
    
    // Initialize handlers
    this._toolsHandler = new ToolsHandler();
    this._tools = this.validateTools(config.tools || []);
    
    // Set up cache if needed
    if (this._cache) {
      this._cacheHandler = new CacheHandler();
      this._toolsHandler.setCache(this._cacheHandler);
    }
  }

  /**
   * Execute a task with this agent
   * Abstract method to be implemented by subclasses
   */
  abstract executeTask(task: Task, context?: string, tools?: BaseTool[]): Promise<any>;

  /**
   * Get tools for delegating tasks to other agents
   * Abstract method to be implemented by subclasses
   */
  abstract getDelegationTools(agents: BaseAgent[]): BaseTool[];

  /**
   * Set knowledge for the agent
   * @param knowledge Knowledge sources or embeddings
   */
  async setKnowledge(knowledge: unknown): Promise<void> {
    // Implementation for setting agent knowledge would go here
    // This would connect to a vector store or other knowledge base
  }

  /**
   * Create an agent executor for the agent
   * This is lazily initialized when needed
   */
  protected abstract createAgentExecutor(tools?: BaseTool[], task?: Task): Promise<any>;

  /**
   * Generate a unique key for this agent based on its configuration
   * Used for caching purposes
   */
  get key(): string {
    const hashContent = `${this.role}:${this.goal}:${this.backstory || ''}`;
    return createHash('md5').update(hashContent).digest('hex');
  }

  /**
   * Create a deep copy of the Agent
   * Optimized to avoid unnecessary duplication of resources
   */
  copy(): BaseAgentBuilder {
    // This is a placeholder - subclasses will implement proper copying
    throw new Error('copy() must be implemented by subclasses');
  }

  /**
   * Interpolate inputs into the agent description and backstory
   * @param inputs Values to interpolate into the agent template strings
   */
  interpolateInputs(inputs: Record<string, any>): void {
    if (inputs && Object.keys(inputs).length > 0) {
      this._role = this.interpolateString(this.originalRole, inputs);
      this._goal = this.interpolateString(this.originalGoal, inputs);
      
      if (this.originalBackstory) {
        this._backstory = this.interpolateString(this.originalBackstory, inputs);
      }
    }
  }

  /**
   * Set the cache handler for the agent
   * @param cacheHandler An instance of the CacheHandler class
   */
  setCacheHandler(cacheHandler: CacheHandler): void {
    this._toolsHandler = new ToolsHandler();
    if (this._cache) {
      this._cacheHandler = cacheHandler;
      this._toolsHandler.setCache(cacheHandler);
    }
    this.createAgentExecutor();
  }

  /**
   * Set the RPM controller for the agent
   * @param rpmController An instance of the RPMController class
   */
  setRpmController(rpmController: any): void {
    if (!this._rpmController) {
      this._rpmController = rpmController;
      this.createAgentExecutor();
    }
  }

  /**
   * Validate and process the tools provided to the agent
   * Ensures each tool meets required criteria and converts non-BaseTool to BaseTool
   * 
   * @param tools List of tools to validate
   * @returns List of validated BaseTool instances
   */
  protected validateTools(tools: any[]): BaseTool[] {
    const validatedTools: BaseTool[] = [];
    
    for (const tool of tools) {
      // Fast path: tool is already a BaseTool
      if (this.isBaseTool(tool)) {
        validatedTools.push(tool);
        continue;
      }
      
      // Check if it has the necessary properties to be converted to a BaseTool
      if (this.canBeConvertedToTool(tool)) {
        validatedTools.push(this.convertToBaseTool(tool));
        continue;
      }
      
      throw new Error(
        `Tool validation failed: ${JSON.stringify(tool)}. ` +
        `Tools must be an instance of BaseTool or have 'name', 'func', and 'description' properties.`
      );
    }
    
    return validatedTools;
  }

  /**
   * Check if an object is a BaseTool instance
   * @param obj Object to check
   * @returns True if the object is a BaseTool instance
   */
  private isBaseTool(obj: any): obj is BaseTool {
    return obj && 
           typeof obj === 'object' && 
           'name' in obj && 
           'description' in obj && 
           typeof obj.execute === 'function';
  }

  /**
   * Check if an object can be converted to a BaseTool
   * @param obj Object to check
   * @returns True if the object can be converted to a BaseTool
   */
  private canBeConvertedToTool(obj: any): boolean {
    return obj && 
           typeof obj === 'object' && 
           'name' in obj && 
           'description' in obj && 
           'func' in obj && 
           typeof obj.func === 'function';
  }

  /**
   * Convert an object to a BaseTool instance
   * @param obj Object to convert
   * @returns BaseTool instance
   */
  private convertToBaseTool(obj: any): BaseTool {
    // This is a simplified implementation
    // In practice, you would create a proper BaseTool implementation
    const customTool = {
      name: obj.name,
      description: obj.description,
      verbose: false,
      cacheResults: false,
      execute: async (input: any) => {
        return await obj.func(input);
      },
      getMetadata: () => ({
        name: obj.name,
        description: obj.description
      })
    } as unknown as BaseTool;
    
    return customTool;
  }

  /**
   * Interpolate a string with values from an object
   * @param str String to interpolate
   * @param values Values to interpolate
   * @returns Interpolated string
   */
  private interpolateString(str: string, values: Record<string, any>): string {
    return str.replace(/\{([^}]+)\}/g, (match, key) => {
      const value = values[key.trim()];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * String representation of the agent
   */
  toString(): string {
    return `Agent(id=${this.id}, role=${this.role})`;
  }
}
