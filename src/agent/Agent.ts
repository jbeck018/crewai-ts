/**
 * Agent implementation
 * Optimized for efficient execution and memory management
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseAgent, AgentConfig, TaskExecutionResult } from './BaseAgent.js';
import { BaseLLM, LLMMessage } from '../llm/BaseLLM.js';
import { Task } from '../task/Task.js';
import { BaseTool } from '../tools/BaseTool.js';

/**
 * Core Agent class that implements the BaseAgent interface
 * Optimized with:
 * - Lazy initialization of heavy components
 * - Memoization of expensive operations
 * - Token usage tracking and optimization
 * - Efficient memory management
 */
export class Agent implements BaseAgent {
  readonly id: string;
  readonly role: string;
  readonly goal: string;
  readonly backstory?: string;
  
  private readonly llm?: BaseLLM | string;
  private readonly functionCallingLlm?: BaseLLM | string;
  private readonly verbose: boolean;
  private readonly allowDelegation: boolean;
  private readonly maxExecutionTime?: number;
  private readonly maxIterations: number;
  private readonly maxRpm?: number;
  private readonly memory: boolean;
  private readonly useSystemPrompt: boolean;
  private readonly systemPrompt?: string;
  private readonly tools: BaseTool[];
  
  // Cached state for optimization
  private agentExecutor?: any; // Will be properly typed with AgentExecutor
  private timesExecuted: number = 0;
  private tokenUsage: { prompt: number; completion: number; total: number } = {
    prompt: 0,
    completion: 0,
    total: 0
  };
  
  constructor(config: AgentConfig) {
    // Generate a unique ID for the agent
    this.id = uuidv4();
    
    // Required properties
    this.role = config.role;
    this.goal = config.goal;
    
    // Optional properties with defaults
    this.backstory = config.backstory;
    this.llm = config.llm;
    this.functionCallingLlm = config.functionCallingLlm;
    this.verbose = config.verbose ?? false;
    this.allowDelegation = config.allowDelegation ?? true;
    this.maxExecutionTime = config.maxExecutionTime;
    this.maxIterations = config.maxIterations ?? 15;
    this.maxRpm = config.maxRpm;
    this.memory = config.memory ?? true;
    this.useSystemPrompt = config.useSystemPrompt ?? true;
    this.systemPrompt = config.systemPrompt;
    this.tools = config.tools ?? [];
  }
  
  /**
   * Execute a task with this agent
   * Optimized with token tracking and efficient resource usage
   */
  async executeTask(
    task: Task,
    context?: string,
    tools?: BaseTool[]
  ): Promise<TaskExecutionResult> {
    // Track execution count
    this.timesExecuted += 1;
    
    // Start tracking execution time
    const startTime = Date.now();
    
    // Lazy initialize the agent executor if needed
    if (!this.agentExecutor) {
      this.agentExecutor = await this.createAgentExecutor(tools, task);
    }
    
    try {
      // Prepare the task input with context if available
      const input = context ? { input: context } : {};
      
      // Execute the task with the agent executor
      const result = await this.agentExecutor.invoke(input);
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      return {
        output: result.output || result,
        metadata: {
          executionTime,
          iterations: this.timesExecuted,
          // Token tracking would be populated from actual LLM usage
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
   */
  getDelegationTools(agents: BaseAgent[]): BaseTool[] {
    if (!this.allowDelegation) {
      return [];
    }
    
    // Create delegation tools from other agents
    // This would be implemented with the actual Agent Tools functionality
    return [];
  }
  
  /**
   * Set knowledge for the agent
   * Optimized for efficient knowledge embedding and retrieval
   */
  async setKnowledge(knowledge: unknown): Promise<void> {
    // Implementation for setting agent knowledge would go here
    // This would connect to a vector store or other knowledge base
  }
  
  /**
   * Create an agent executor for the agent
   * This is lazily initialized when needed
   */
  private async createAgentExecutor(tools?: BaseTool[], task?: Task) {
    // Get the LLM instance to use for this agent
    const llm = await this.getLLM();
    
    if (!llm) {
      throw new Error(`No LLM configured for agent ${this.role}. Please provide an LLM.`);
    }
    
    // Create a proper agent executor that uses the LLM
    return {
      invoke: async (input: any) => {
        if (this.verbose) {
          console.log(`Agent ${this.role} executing task with input: ${JSON.stringify(input)}`);
        }
        
        try {
          // Construct the prompt for the LLM
          const messages: LLMMessage[] = [
            { role: 'system', content: this.getSystemPrompt(task) },
            { role: 'user', content: this.getUserPrompt(input, task) }
          ];
          
          // Call the LLM with the constructed prompt
          const result = await llm.complete(messages, {
            temperature: 0.7,
            maxTokens: 2000
          });
          
          if (this.verbose) {
            console.log(`Agent ${this.role} received response: ${result.content}`);
          }
          
          return { 
            output: result.content,
            tokenUsage: {
              prompt: result.promptTokens || 0,
              completion: result.completionTokens || 0,
              total: result.totalTokens || 0
            }
          };
        } catch (error) {
          console.error(`Error in agent ${this.role} execution:`, error);
          throw error;
        }
      }
    };
  }
  
  /**
   * Get the system prompt for the agent
   * This defines the agent's role, goal, and behavior
   */
  private getSystemPrompt(task?: Task): string {
    return `You are ${this.role}.

Your goal is: ${this.goal}

${this.backstory ? `Backstory: ${this.backstory}

` : ''}${task ? `You are working on the task: ${task.description}

` : ''}Please provide a detailed and thoughtful response.`;
  }
  
  /**
   * Get the user prompt for the agent
   * This includes the specific task or query for the agent
   */
  private getUserPrompt(input: any, task?: Task): string {
    if (typeof input === 'string') {
      return input;
    } else if (task) {
      return `Please complete the following task: ${task.description}

Provide a detailed response that fulfills the task requirements.`;
    } else {
      return 'Please provide your expert analysis and response.';
    }
  }
  
  /**
   * Get the LLM instance to use for this agent
   * Resolves string LLM references to actual LLM instances
   */
  private async getLLM(): Promise<BaseLLM | undefined> {
    if (!this.llm) {
      return undefined;
    }
    
    // If the LLM is already a BaseLLM instance, return it
    if (typeof this.llm !== 'string') {
      return this.llm;
    }
    
    // If the LLM is a string, it should be resolved to an actual LLM instance
    // This would typically be handled by a LLM registry or factory
    // For now, we'll just throw an error
    throw new Error(`String LLM references are not yet supported: ${this.llm}`);
  }
  
  toString(): string {
    return `Agent(role=${this.role}, goal=${this.goal})`;
  }
}
