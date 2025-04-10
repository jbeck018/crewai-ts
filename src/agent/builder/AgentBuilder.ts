/**
 * Agent Builder
 * Concrete implementation of BaseAgentBuilder for creating optimized agents
 */

import { BaseAgentBuilder } from './BaseAgentBuilder.js';
import { AgentConfig, BaseAgent, TaskExecutionResult } from '../BaseAgent.js';
import { BaseTool } from '../../tools/BaseTool.js';
import { Task } from '../../task/Task.js';
import { CrewAgentExecutorMixin } from './CrewAgentExecutorMixin.js';
import { BaseLLM } from '../../llm/BaseLLM.js';

/**
 * Result of a token counting operation
 */
interface TokenCount {
  prompt: number;
  completion: number;
  total: number;
}

/**
 * Execution stats for tracking performance metrics
 */
interface ExecutionStats {
  startTime?: number;
  endTime?: number;
  tokenCount: TokenCount;
  iterations: number;
}

/**
 * Complete agent implementation with optimized execution and memory management
 */
export class AgentBuilder extends BaseAgentBuilder {
  // Agent executor for running tasks
  private agentExecutor?: any;
  
  // Stats for performance tracking
  private executionStats: ExecutionStats = {
    tokenCount: { prompt: 0, completion: 0, total: 0 },
    iterations: 0
  };
  
  /**
   * Constructor for the AgentBuilder
   * @param config Configuration for the agent
   */
  constructor(config: AgentConfig) {
    super(config);
  }
  
  /**
   * Execute a task with this agent
   * Optimized with token tracking and efficient resource usage
   * @param task Task to execute
   * @param context Additional context for the task
   * @param tools Optional tools for the task
   */
  async executeTask(
    task: Task,
    context?: string,
    tools?: BaseTool[]
  ): Promise<TaskExecutionResult> {
    // Reset stats for this execution
    this.resetExecutionStats();
    
    // Start tracking execution time
    this.executionStats.startTime = Date.now();
    
    // Lazy initialize the agent executor if needed
    if (!this.agentExecutor) {
      this.agentExecutor = await this.createAgentExecutor(tools, task);
    }
    
    try {
      // Create executor mixin for managing memory and feedback
      const executorMixin = new CrewAgentExecutorMixin(
        this as unknown as BaseAgent, // Type cast is needed here
        task,
        undefined, // No crew for now
        {
          maxIterations: this._maxIterations,
          memory: this._memory,
          humanInTheLoop: false, // Default to no human interaction
        }
      );
      
      // Prepare the task input with context if available
      const input = context ? { input: context } : {};
      
      // Execute the task with the agent executor
      const result = await this.agentExecutor.invoke(input);
      
      // Process the result through the mixin
      const processedResult = await executorMixin.processResult({
        text: result.output || result
      });
      
      // Update execution stats
      this.executionStats.endTime = Date.now();
      this.executionStats.iterations = executorMixin.getIterations();
      
      // Extract token usage from the result if available
      if (result.tokenUsage) {
        this.executionStats.tokenCount = {
          prompt: result.tokenUsage.prompt_tokens || 0,
          completion: result.tokenUsage.completion_tokens || 0,
          total: result.tokenUsage.total_tokens || 0
        };
      }
      
      return {
        output: processedResult.text,
        metadata: {
          executionTime: this.getExecutionTime(),
          iterations: this.executionStats.iterations,
          totalTokens: this.executionStats.tokenCount.total,
          promptTokens: this.executionStats.tokenCount.prompt,
          completionTokens: this.executionStats.tokenCount.completion,
        }
      };
    } catch (error) {
      // Handle errors gracefully
      console.error(`Error executing task with agent ${this.role}:`, error);
      throw error;
    }
  }
  
  /**
   * Get tools for delegating tasks to other agents
   * Creates optimized tool representations of other agents
   * @param agents Agents that can be delegated to
   */
  getDelegationTools(agents: BaseAgent[]): BaseTool[] {
    // If delegation is not allowed, return empty array
    if (!this._allowDelegation) {
      return [];
    }
    
    return agents.map(agent => {
      // Don't create a delegation tool for this agent itself
      if (agent.id === this.id) {
        return null;
      }
      
      // Create a tool that delegates to the agent
      const delegationTool = {
        name: `delegate_to_${agent.role.toLowerCase().replace(/\s+/g, '_')}`,
        description: `Delegate a task to ${agent.role} who has the goal: ${agent.goal}`,
        verbose: false,
        cacheResults: false,
        execute: async ({ task }: { task: string }) => {
          // In a real implementation, this would create a Task object and execute it
          return `Task "${task}" delegated to ${agent.role}`;
        },
        getMetadata: () => ({
          name: `delegate_to_${agent.role.toLowerCase().replace(/\s+/g, '_')}`,
          description: `Delegate a task to ${agent.role} who has the goal: ${agent.goal}`
        })
      } as unknown as BaseTool;
      
      return delegationTool;
    }).filter(Boolean) as BaseTool[];
  }
  
  /**
   * Create a deep copy of the Agent
   * Optimized to avoid unnecessary duplication of resources
   */
  override copy(): AgentBuilder {
    // Create a new config based on current state
    const config: AgentConfig = {
      role: this.originalRole,
      goal: this.originalGoal,
      backstory: this.originalBackstory,
      llm: this._llm,
      functionCallingLlm: this._functionCallingLlm,
      verbose: this._verbose,
      allowDelegation: this._allowDelegation,
      maxIterations: this._maxIterations,
      maxRpm: this._maxRpm,
      memory: this._memory,
      useSystemPrompt: this._useSystemPrompt,
      systemPrompt: this._systemPrompt,
      tools: this._tools
    };
    
    // Create a new instance with the same configuration
    return new AgentBuilder(config);
  }
  
  /**
   * Create an agent executor for the agent
   * This is lazily initialized when needed with optimizations for reuse
   * @param tools Optional tools to use
   * @param task Optional task to execute
   */
  protected async createAgentExecutor(tools?: BaseTool[], task?: Task): Promise<any> {
    // In a real implementation, this would create a proper executor
    // based on the LLM and tools configuration
    // For now, we'll return a placeholder
    
    // Create combined tools list
    const allTools = [...(tools || []), ...this._tools];
    
    // Log tools if verbose mode is enabled
    if (this._verbose) {
      console.log(`Creating executor for ${this.role} with ${allTools.length} tools`);
      for (const tool of allTools) {
        console.log(`- ${tool.name}: ${tool.description}`);
      }
    }
    
    return {
      invoke: async (input: any) => {
        // Track iteration count
        this.executionStats.iterations += 1;
        
        // In a real implementation, this would execute the LLM chain
        // with the proper prompt and tools
        console.log(`Executing agent ${this.role} with input:`, input);
        
        // Simulate token usage
        this.executionStats.tokenCount.prompt += 100;
        this.executionStats.tokenCount.completion += 50;
        this.executionStats.tokenCount.total += 150;
        
        // Return a simulated response
        return { 
          output: `${this.role} has processed the task successfully.`, 
          tokenUsage: {
            prompt_tokens: this.executionStats.tokenCount.prompt,
            completion_tokens: this.executionStats.tokenCount.completion,
            total_tokens: this.executionStats.tokenCount.total
          }
        };
      }
    };
  }
  
  /**
   * Reset execution stats for a new execution
   */
  private resetExecutionStats(): void {
    this.executionStats = {
      tokenCount: { prompt: 0, completion: 0, total: 0 },
      iterations: 0
    };
  }
  
  /**
   * Get the execution time in milliseconds
   */
  private getExecutionTime(): number {
    if (!this.executionStats.startTime || !this.executionStats.endTime) {
      return 0;
    }
    return this.executionStats.endTime - this.executionStats.startTime;
  }
}
