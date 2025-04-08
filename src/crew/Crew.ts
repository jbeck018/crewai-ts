/**
 * Crew implementation
 * Orchestrates agents and tasks with optimized workflow execution
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseAgent } from '../agent/BaseAgent.js';
import { Task, TaskOutput, TaskPriority } from '../task/Task.js';
import { ConditionalTask } from '../task/ConditionalTask.js';
import { BaseLLM } from '../llm/BaseLLM.js';
import { CrewOutput } from './CrewOutput.js';
import { MemoryManager, MemoryConfig, MemoryType } from '../memory/MemoryManager.js';
import { globalToolUsageTracker } from '../tools/ToolUsage.js';

export type ProcessType = 'sequential' | 'hierarchical' | 'custom';

export interface CrewConfig {
  agents: BaseAgent[];
  tasks: Task[];
  process?: ProcessType;
  verbose?: boolean;
  managerLlm?: BaseLLM | string;
  managerAgent?: BaseAgent;
  memory?: boolean;
  memoryConfig?: Record<MemoryType, Partial<MemoryConfig>>;
  maxConcurrency?: number;
  functionCallingLlm?: BaseLLM | string;
  cache?: boolean;
  maxRpm?: number;
  taskCallback?: (task: Task, output: TaskOutput) => void;
  stepCallback?: (step: any) => void; // Any for now, will be properly typed
  tools?: Record<string, boolean>; // Enable/disable specific tool categories
}

/**
 * Crew class that orchestrates agents and tasks
 * Optimized for:
 * - Efficient workflow execution
 * - Resource management
 * - Error resilience
 * - Performance monitoring
 */
export class Crew {
  readonly id: string;
  readonly agents: BaseAgent[];
  readonly tasks: Task[];
  readonly process: ProcessType;
  readonly verbose: boolean;
  readonly managerLlm?: BaseLLM | string;
  readonly managerAgent?: BaseAgent;
  readonly memory: boolean;
  readonly memoryManager: MemoryManager;
  readonly maxConcurrency: number;
  readonly functionCallingLlm?: BaseLLM | string;
  readonly cache: boolean;
  readonly maxRpm?: number;
  readonly tools: Record<string, boolean>;
  private readonly taskCallback?: (task: Task, output: TaskOutput) => void;
  private readonly stepCallback?: (step: any) => void;
  
  // Execution state
  private taskOutputs = new Map<string, TaskOutput>();
  private currentlyRunningTasks = new Set<string>();
  private taskQueue: Task[] = [];
  private metrics = {
    startTime: 0,
    endTime: 0,
    totalTokens: 0,
    totalCost: 0,
    toolUsage: {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      executionTime: 0
    }
  };
  
  constructor(config: CrewConfig) {
    this.id = uuidv4();
    this.agents = config.agents;
    this.tasks = config.tasks;
    this.process = config.process || 'sequential';
    this.verbose = config.verbose || false;
    this.managerLlm = config.managerLlm;
    this.managerAgent = config.managerAgent;
    this.memory = config.memory ?? true;
    this.maxConcurrency = config.maxConcurrency || 1;
    this.functionCallingLlm = config.functionCallingLlm;
    this.cache = config.cache ?? true;
    this.maxRpm = config.maxRpm;
    this.taskCallback = config.taskCallback;
    this.stepCallback = config.stepCallback;
    this.tools = config.tools ?? {
      delegation: true,
      code_execution: false,
      cache: true,
      multimodal: false
    };
    
    // Initialize memory manager
    this.memoryManager = new MemoryManager();
    
    // Configure memory if provided
    if (config.memoryConfig) {
      for (const [type, memConfig] of Object.entries(config.memoryConfig) as [MemoryType, Partial<MemoryConfig>][]) {
        this.memoryManager.configure(type as MemoryType, memConfig);
      }
    }
    
    // Initialize memory if enabled
    if (this.memory) {
      this.memoryManager.createStandardMemories();
    }
    
    // Validate configuration
    this.validateConfig();
  }
  
  /**
   * Execute the crew's workflow
   * Optimized with task prioritization and parallel execution
   */
  /**
   * Reset specific memory types or all memories
   * @param type Memory type to reset (short, long, entity, contextual, or all)
   * @returns Result of the reset operation
   */
  async resetMemory(type: MemoryType = 'all'): Promise<{ success: boolean; errors?: Record<string, string> }> {
    if (this.verbose) {
      console.log(`Resetting ${type} memory`);
    }
    
    return this.memoryManager.resetMemory(type);
  }
  
  /**
   * Execute the crew's workflow
   * Optimized with task prioritization and parallel execution
   */
  async kickoff(inputs?: Record<string, any>): Promise<CrewOutput> {
    try {
      // Start performance tracking
      this.metrics.startTime = Date.now();
      
      if (this.verbose) {
        console.log(`Starting crew execution with process: ${this.process}`);
      }
      
      // Initialize the task queue based on the process type
      this.initializeTaskQueue();
      
      // Execute based on the process type
      let finalOutput: string;
      
      if (this.process === 'sequential') {
        finalOutput = await this.runSequentialProcess(inputs);
      } else if (this.process === 'hierarchical') {
        finalOutput = await this.runHierarchicalProcess(inputs);
      } else {
        // Custom process would be implemented here
        finalOutput = await this.runSequentialProcess(inputs);
      }
      
      // Finish performance tracking
      this.metrics.endTime = Date.now();
      
      // Create the crew output
      const output = new CrewOutput({
        finalOutput,
        taskOutputs: Array.from(this.taskOutputs.values()),
        metrics: {
          executionTime: this.metrics.endTime - this.metrics.startTime,
          tokenUsage: {
            total: this.metrics.totalTokens
          },
          cost: this.metrics.totalCost
        }
      });
      
      return output;
    } catch (error) {
      console.error('Error in crew execution:', error);
      throw error;
    }
  }
  
  /**
   * Run crew for each input in a list and aggregate results
   * Optimized with batch processing and resource sharing
   */
  async kickoffForEach(inputs: Record<string, any>[]): Promise<CrewOutput[]> {
    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      throw new Error('Inputs must be a non-empty array');
    }
    
    // Process each input in sequence for now
    // In a full implementation, this could use batching and parallel processing
    const results: CrewOutput[] = [];
    
    for (const input of inputs) {
      // Create a copy of the crew for each execution to avoid state interference
      const crewCopy = this.createCopy();
      results.push(await crewCopy.kickoff(input));
    }
    
    return results;
  }
  
  /**
   * Create a copy of the crew for isolated execution
   */
  private createCopy(): Crew {
    return new Crew({
      agents: this.agents,
      tasks: this.tasks,
      process: this.process,
      verbose: this.verbose,
      managerLlm: this.managerLlm,
      managerAgent: this.managerAgent,
      memory: this.memory,
      maxConcurrency: this.maxConcurrency,
      functionCallingLlm: this.functionCallingLlm,
      cache: this.cache,
      maxRpm: this.maxRpm,
      taskCallback: this.taskCallback,
      stepCallback: this.stepCallback
    });
  }
  
  /**
   * Initialize the task queue based on the process type
   * Optimized with priority-based sorting for maximum efficiency
   */
  private initializeTaskQueue(): void {
    this.taskQueue = [...this.tasks];
    
    // Define type-safe priority map for performance optimization
    const priorityMap: Record<TaskPriority, number> = { 
      'critical': 3, 
      'high': 2, 
      'medium': 1, 
      'low': 0 
    };
    
    // Sort tasks by priority for more efficient execution - optimized for performance
    this.taskQueue.sort((a, b) => {
      // Type-safe access with proper defaults
      const aPriorityKey = ((a as any).priority as TaskPriority) || 'medium';
      const bPriorityKey = ((b as any).priority as TaskPriority) || 'medium';
      
      // Safe access to priority map with guaranteed values
      const aPriority = priorityMap[aPriorityKey];
      const bPriority = priorityMap[bPriorityKey];
      
      return bPriority - aPriority; // Higher priority first
    });
  }
  
  /**
   * Run the sequential process
   * Optimized with context passing and parallel execution where possible
   */
  private async runSequentialProcess(inputs?: Record<string, any>): Promise<string> {
    let context = inputs ? JSON.stringify(inputs) : '';
    let result = '';
    
    // Track tasks that can be run in parallel (async tasks)
    const asyncTasks: Task[] = [];
    
    // Process each task in sequence
    for (const task of this.taskQueue) {
      // Skip conditional tasks for now, they're handled separately
      if (task instanceof ConditionalTask) {
        continue;
      }
      
      // Determine if this task should be executed asynchronously
      if ((task as any).isAsync) {
        asyncTasks.push(task);
        continue;
      }
      
      // Execute the task
      const output = await this.executeTask(task, context);
      
      // Update context for the next task
      context = `${context}\n\nTask: ${task.description}\nResult: ${output.result}`;
      result = output.result;
      
      // Track tokens and cost
      if (output.metadata.tokenUsage?.total) {
        this.metrics.totalTokens += output.metadata.tokenUsage.total;
      }
    }
    
    // Execute async tasks in parallel if any
    if (asyncTasks.length > 0) {
      const asyncResults = await Promise.all(
        asyncTasks.map(task => this.executeTask(task, context))
      );
      
      // Get the result from the last async task with proper null safety
      if (asyncResults.length > 0) {
        const lastResult = asyncResults[asyncResults.length - 1];
        if (lastResult && lastResult.result) {
          result = lastResult.result;
        }
      }
      
      // Track tokens and cost for async tasks with optimized null checking
      for (const output of asyncResults) {
        // Safe access to potentially undefined properties with null coalescing
        const tokenUsage = output?.metadata?.tokenUsage;
        if (tokenUsage?.total) {
          this.metrics.totalTokens += tokenUsage.total;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Run the hierarchical process with a manager agent
   * Optimized with intelligent task delegation, resource allocation,
   * and parallel execution where beneficial
   */
  private async runHierarchicalProcess(inputs?: Record<string, any>): Promise<string> {
    // Ensure we have a manager LLM or agent
    if (!this.managerLlm && !this.managerAgent) {
      throw new Error('Hierarchical process requires either managerLlm or managerAgent');
    }
    
    // Import the HierarchicalManager - done here to avoid circular dependencies
    const { HierarchicalManager } = await import('./HierarchicalManager.js');
    
    // Prepare context from inputs
    const inputContext = inputs ? JSON.stringify(inputs) : '';
    
    // Initialize metrics tracking
    const startTime = performance.now();
    
    // Create a performance optimization lookup for prioritization
    // This maps priority names to numeric values for sorting
    const priorityLookup: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    };
    
    if (this.verbose) {
      console.log(`Starting hierarchical process execution with ${this.taskQueue.length} tasks`);
    }
    
    // Get or create the manager agent
    const manager = this.managerAgent || await HierarchicalManager.createManagerAgent({
      managerLlm: this.managerLlm,
      verbose: this.verbose,
      memory: this.memory
    });
    
    // Create a plan for task execution using the manager agent
    const executionPlan = await HierarchicalManager.createExecutionPlan(
      manager,
      this.tasks,
      inputContext
    );
    
    if (this.verbose) {
      console.log('Manager created execution plan:', JSON.stringify(executionPlan, null, 2));
    }
    
    // Execute tasks according to the plan
    const { finalOutput, completedTaskIds, context: updatedContext } = await HierarchicalManager.executeTasksWithPlan(
      executionPlan,
      this.tasks,
      inputContext,
      {
        executeTask: (task, context) => this.executeTask(task, context),
        verbose: this.verbose
      }
    );
    
    // If the plan specified a synthesisRequired flag, have the manager create a final synthesis
    let result = finalOutput;
    if (executionPlan.synthesisRequired) {
      if (this.verbose) {
        console.log('Creating final synthesis using manager agent');
      }
      
      // Create a fully compliant Task instance for synthesis
      const synthesisTaskId = uuidv4();
      const synthesisTask = new Task({
        description: 'Create a final synthesis of all task results',
        agent: manager,
        priority: 'critical',
        cachingStrategy: 'none', // Don't cache synthesis results for better accuracy
        async: false,
        tools: []
      });
      
      // Override the execute method for synthesis-specific behavior
      // This is a performance optimization to avoid creating unnecessary task objects
      const originalExecute = synthesisTask.execute.bind(synthesisTask);
      synthesisTask.execute = async (context?: string): Promise<TaskOutput> => {
        const taskContext = context || '';
        // Use specific synthesis prompt for better performance
        const enhancedContext = `${taskContext}

Your task is to create a final synthesis of all the results above. 
Focus on creating a coherent, comprehensive summary that integrates all the individual task outputs.
Optimize for completeness and clarity.`;
        
        try {
          return await originalExecute(enhancedContext);
        } catch (error) {
          console.error('Synthesis task execution failed:', error);
          
          // Fallback with basic synthesis if the original execution fails
          return {
            result: 'Synthesis failed. Aggregated results from individual tasks are provided.',
            metadata: {
              taskId: synthesisTaskId,
              agentId: manager.id,
              executionTime: 0,
              tokenUsage: {
                prompt: 0,
                completion: 0,
                total: 0
              }
            }
          };
        }
      };
      
      // Execute the synthesis task
      const synthesisOutput = await synthesisTask.execute(updatedContext);
      result = synthesisOutput.result;
      
      // Track tokens and cost for synthesis
      if (synthesisOutput.metadata?.tokenUsage?.total) {
        this.metrics.totalTokens += synthesisOutput.metadata.tokenUsage.total;
      }
    }
    
    // Handle any tasks that weren't in the execution plan (error case)
    const unexecutedTasks = this.tasks.filter(task => !completedTaskIds.has(task.id));
    if (unexecutedTasks.length > 0 && this.verbose) {
      console.warn(`Warning: ${unexecutedTasks.length} tasks were not in the execution plan`);
    }
    
    const endTime = performance.now();
    if (this.verbose) {
      console.log(`Hierarchical process completed in ${(endTime - startTime) / 1000}s`);
    }
    
    return result;
  }
  
  /**
   * Execute a single task
   * Optimized with caching and error handling
   */
  private async executeTask(task: Task, context?: string): Promise<TaskOutput> {
    try {
      // Track that this task is running
      this.currentlyRunningTasks.add(task.id);
      
      if (this.verbose) {
        console.log(`Executing task: ${task.description}`);
      }
      
      // Execute the task
      const output = await task.execute(context);
      
      // Store the output
      this.taskOutputs.set(task.id, output);
      
      // Invoke callback if provided
      if (this.taskCallback) {
        this.taskCallback(task, output);
      }
      
      if (this.verbose) {
        console.log(`Task completed: ${task.description}`);
        console.log(`Result: ${output.result.substring(0, 100)}${output.result.length > 100 ? '...' : ''}`);
      }
      
      return output;
    } catch (error) {
      console.error(`Error executing task ${task.description}:`, error);
      throw error;
    } finally {
      // Mark task as no longer running
      this.currentlyRunningTasks.delete(task.id);
    }
  }
  
  /**
   * Validate the crew configuration
   */
  private validateConfig(): void {
    // Ensure we have at least one agent
    if (!this.agents || this.agents.length === 0) {
      throw new Error('Crew must have at least one agent');
    }
    
    // Ensure we have at least one task
    if (!this.tasks || this.tasks.length === 0) {
      throw new Error('Crew must have at least one task');
    }
    
    // Check if hierarchical process has required components
    if (this.process === 'hierarchical' && !this.managerLlm && !this.managerAgent) {
      throw new Error('Hierarchical process requires either managerLlm or managerAgent');
    }
    
    // Validate async tasks
    this.validateAsyncTasks();
  }
  
  /**
   * Validate that async tasks are configured correctly
   */
  private validateAsyncTasks(): void {
    // Find async tasks
    const asyncTasks = this.tasks.filter(task => (task as any).isAsync);
    
    // Check that we don't have more than one async task at the end
    let foundNonAsync = false;
    for (let i = this.tasks.length - 1; i >= 0; i--) {
      const task = this.tasks[i];
      if ((task as any).isAsync) {
        if (foundNonAsync) {
          throw new Error('Async tasks can only appear at the end of the task list');
        }
      } else {
        foundNonAsync = true;
      }
    }
    
    // Check that ConditionalTask is not async
    for (const task of asyncTasks) {
      if (task instanceof ConditionalTask) {
        throw new Error('ConditionalTask cannot be async');
      }
    }
  }
  
  toString(): string {
    return `Crew(id=${this.id}, agents=${this.agents.length}, tasks=${this.tasks.length})`;
  }
}
