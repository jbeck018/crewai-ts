/**
 * LiteAgent Implementation
 * A lightweight, performance-optimized agent implementation that focuses on minimal resource usage
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseAgent, AgentConfig, TaskExecutionResult } from './BaseAgent.js';
import { BaseTool } from '../tools/BaseTool.js';
import { Task, TaskConfig } from '../task/Task.js';
import { BaseLLM, LLMMessage, LLMResult } from '../llm/BaseLLM.js';

/**
 * LiteAgent configuration options
 * Extends AgentConfig with optimization options specific to LiteAgent
 */
export interface LiteAgentConfig extends AgentConfig {
  /**
   * Maximum cache size for task results
   * @default 100
   */
  maxCacheSize?: number;
  
  /**
   * Whether to enable response caching by task hash
   * @default true
   */
  enableCaching?: boolean;
  
  /**
   * Timeout for task execution in milliseconds
   * @default 60000 (1 minute)
   */
  executionTimeout?: number;
}

/**
 * A lightweight agent implementation optimized for memory efficiency and performance.
 * Implements the BaseAgent interface with minimal resource usage and simpler execution patterns.
 */
export class LiteAgent implements BaseAgent {
  readonly id: string;
  readonly role: string;
  readonly goal: string;
  readonly backstory?: string;
  
  private _llm?: BaseLLM;
  private _functionCallingLlm?: BaseLLM;
  private _tools: BaseTool[] = [];
  private _verbose: boolean;
  private _allowDelegation: boolean;
  private _maxIterations: number;
  private _maxCacheSize: number;
  private _enableCaching: boolean;
  private _executionTimeout: number;
  private _useSystemPrompt: boolean;
  private _systemPrompt?: string;
  
  // Efficient cache implementation using Map instead of object
  private _resultCache: Map<string, TaskExecutionResult> = new Map();
  
  /**
   * Create a new LiteAgent instance
   * @param config Configuration for the agent
   */
  constructor(config: LiteAgentConfig) {
    this.id = uuidv4();
    this.role = config.role;
    this.goal = config.goal;
    this.backstory = config.backstory;
    
    // Initialize LLMs if provided
    if (typeof config.llm === 'string') {
      // Will implement LLM string-to-instance conversion later
      throw new Error('String LLM initialization not yet implemented');
    } else {
      this._llm = config.llm;
    }
    
    if (typeof config.functionCallingLlm === 'string') {
      // Will implement LLM string-to-instance conversion later
      throw new Error('String functionCallingLlm initialization not yet implemented');
    } else {
      this._functionCallingLlm = config.functionCallingLlm;
    }
    
    // Initialize tools
    if (config.tools) {
      this._tools = [...config.tools];
    }
    
    // Set optimization options with sensible defaults
    this._verbose = config.verbose ?? false;
    this._allowDelegation = config.allowDelegation ?? true;
    this._maxIterations = config.maxIterations ?? 10; // LiteAgent uses fewer iterations by default
    this._maxCacheSize = config.maxCacheSize ?? 100;
    this._enableCaching = config.enableCaching ?? true;
    this._executionTimeout = config.executionTimeout ?? 60000; // 1 minute default
    this._useSystemPrompt = config.useSystemPrompt ?? true;
    this._systemPrompt = config.systemPrompt;
  }
  
  /**
   * Execute a task with this agent
   * @param task Task to execute
   * @param context Additional context for the task
   * @param tools Optional tools for the task
   * @returns Promise resolving to TaskExecutionResult
   */
  async executeTask(
    task: Task,
    context?: string,
    tools?: BaseTool[]
  ): Promise<TaskExecutionResult> {
    // Start tracking execution time
    const startTime = Date.now();
    
    // Create a unique hash for the task+context+tools combination for caching
    const taskHash = this._enableCaching ? this._hashTask(task, context, tools) : '';
    
    // Check cache if enabled
    if (this._enableCaching && taskHash) {
      const cachedResult = this._resultCache.get(taskHash);
      if (cachedResult) {
        if (this._verbose) {
          console.log(`[LiteAgent] Using cached result for task: ${task.description}`);
        }
        return cachedResult;
      }
    }
    
    // Check if LLM is configured
    if (!this._llm) {
      throw new Error('LLM not configured for agent');
    }
    
    // Prepare tools for execution
    const combinedTools = tools ? [...this._tools, ...tools] : this._tools;
    
    // Prepare prompt for the LLM
    const prompt = this._createTaskPrompt(task, context, combinedTools);
    
    // Execute the task with a timeout
    try {
      const executionPromise = this._executeTaskWithLLM(prompt, combinedTools);
      const timeoutPromise = new Promise<TaskExecutionResult>((_, reject) => {
        setTimeout(() => reject(new Error('Task execution timed out')), this._executionTimeout);
      });
      
      // Use Promise.race to implement timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      // Add execution time to result metadata
      const resultWithMetadata: TaskExecutionResult = {
        ...result,
        metadata: {
          ...result.metadata,
          executionTime
        }
      };
      
      // Cache the result if caching is enabled
      if (this._enableCaching && taskHash) {
        this._addToCache(taskHash, resultWithMetadata);
      }
      
      return resultWithMetadata;
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this._verbose) {
        console.error(`[LiteAgent] Error executing task: ${errorMessage}`);
      }
      // Define extended metadata type that includes error info
      interface ExtendedMetadata {
        executionTime?: number;
        iterations?: number;
        totalTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
        error?: string;
      }
      
      return {
        output: `Error executing task: ${errorMessage}`,
        metadata: {
          executionTime: Date.now() - startTime,
          error: errorMessage
        } as ExtendedMetadata
      };
    }
  }
  
  /**
   * Get tools for delegating tasks to other agents
   * @param agents Agents that can be delegated to
   * @returns Array of BaseTool instances for delegation
   */
  getDelegationTools(agents: BaseAgent[]): BaseTool[] {
    // If delegation is not allowed, return an empty array
    if (!this._allowDelegation) {
      return [];
    }
    
    // Create a tool for each agent that can be delegated to
    return agents
      .filter(agent => agent.id !== this.id) // Don't create a delegation tool for self
      .map(agent => {
        // Transform agent name to a valid tool name
        const agentName = agent.role.toLowerCase().replace(/\s+/g, '_');
        return {
          name: `delegate_to_${agentName}`,
          description: `Delegate a task to ${agent.role} who has the goal: ${agent.goal}`,
          verbose: this._verbose,
          cacheResults: false, // Delegation results should not be cached
          execute: async (input: any) => {
            if (this._verbose) {
              console.log(`[LiteAgent] Delegating to ${agent.role}: ${input.task}`);
            }
            
            // Create properly structured task object
            const taskConfig = {
              description: input.task,
              expectedOutput: input.expectedOutput || 'Detailed response',
              agent,
              async: false,
              context: [] as string[],
              cachingStrategy: 'none' as const
            };
            
            // Create a proper Task instance
            const delegatedTask = new Task(taskConfig);
            
            // Execute the delegated task
            const result = await agent.executeTask(delegatedTask);
            
            return {
              success: true,
              result: result.output
            };
          },
          getMetadata: () => ({
            name: `delegate_to_${agentName}`,
            description: `Delegate a task to ${agent.role} who has the goal: ${agent.goal}`
          })
        } as BaseTool;
      });
  }
  
  /**
   * Set knowledge for the agent
   * @param knowledge Knowledge sources or embeddings
   */
  async setKnowledge(knowledge: unknown): Promise<void> {
    // Placeholder implementation
    // Will be implemented in a future update
    if (this._verbose) {
      console.log(`[LiteAgent] Knowledge setting not yet implemented`);
    }
  }
  
  /**
   * Create a hash for the task, context, and tools for caching purposes
   * @private
   */
  private _hashTask(task: Task, context?: string, tools?: BaseTool[]): string {
    try {
      // Create a simple object representing the task execution parameters
      const taskObj = {
        taskId: task.id,
        description: task.description,
        expectedOutput: task.expectedOutput,
        context,
        tools: tools?.map(t => t.name).sort() // Only include tool names for simplicity
      };
      
      // Use JSON.stringify for simple hashing - could be improved with a proper hash function
      return JSON.stringify(taskObj);
    } catch (error) {
      // If hashing fails, return an empty string to disable caching for this task
      if (this._verbose) {
        console.error(`[LiteAgent] Error creating task hash: ${error}`);
      }
      return '';
    }
  }
  
  /**
   * Add a result to the cache, managing cache size
   * @private
   */
  private _addToCache(key: string, result: TaskExecutionResult): void {
    if (!key) return; // Skip empty keys for safety
    
    // Add the new result
    this._resultCache.set(key, result);
    
    // Manage cache size - if we exceed the max size, remove the oldest entries
    if (this._resultCache.size > this._maxCacheSize) {
      // Get the first key using the iterator
      const oldestKey = this._resultCache.keys().next().value;
      if (oldestKey) { // Ensure key exists before attempting to delete
        this._resultCache.delete(oldestKey);
      }
    }
  }
  
  /**
   * Create a prompt for the task
   * @private
   */
  private _createTaskPrompt(task: Task, context?: string, tools?: BaseTool[]): string {
    // Build a prompt for the LLM
    let prompt = '';
    
    // Add system prompt if enabled
    if (this._useSystemPrompt && this._systemPrompt) {
      prompt += `${this._systemPrompt}\n\n`;
    }
    
    // Add agent information
    prompt += `You are ${this.role}, with the goal: ${this.goal}.`;
    
    if (this.backstory) {
      prompt += `\nBackstory: ${this.backstory}`;
    }
    
    // Add task description
    prompt += `\n\nTask: ${task.description}`;
    
    // Add expected output if available
    if (task.expectedOutput) {
      prompt += `\nExpected output: ${task.expectedOutput}`;
    }
    
    // Add context if available
    if (context) {
      prompt += `\n\nAdditional Context: ${context}`;
    }
    
    // Add tools if available
    if (tools && tools.length > 0) {
      prompt += '\n\nTools available:';
      for (const tool of tools) {
        prompt += `\n- ${tool.name}: ${tool.description}`;
      }
    }
    
    // Add final instruction
    prompt += '\n\nPlease complete this task to the best of your ability.';
    
    return prompt;
  }
  
  /**
   * Execute the task with the LLM
   * @private
   */
  private async _executeTaskWithLLM(prompt: string, tools: BaseTool[]): Promise<TaskExecutionResult> {
    if (!this._llm) {
      throw new Error('LLM not configured for agent');
    }
    
    // For now, a simple implementation that calls the LLM
    // Future enhancement: add tool usage support
    // Create a user message with the prompt
    const message: LLMMessage = {
      role: 'user',
      content: prompt
    };
    
    // Call the LLM using the complete method
    const response = await this._llm.complete([message]);
    
    // Return the result with optimized metadata handling
    return {
      output: response.content,
      metadata: {
        iterations: 1, // Only one iteration for now
        totalTokens: response.totalTokens,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens
      }
    };
  }
}
