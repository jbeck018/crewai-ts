/**
 * ReplayService for replaying crew task execution
 * Optimized for memory efficiency and task restoration
 */
import { Crew, Task, Agent } from '../types/index.js';
import { MemoryManager } from '../memory/MemoryManager.js';
import { KickoffTaskOutputsStorage } from '../memory/storage/KickoffTaskOutputsStorage.js';
import { Telemetry } from '../telemetry/Telemetry.js';
import { TelemetryEventType } from '../telemetry/types.js';

export interface ReplayResult {
  success: boolean;
  taskId: string;
  agentId?: string;
  originalOutput?: string;
  replayOutput?: string;
  timeTaken: number; // In milliseconds
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: Error;
}

export interface ReplayOptions {
  verbose?: boolean;
  maxTimeMs?: number;
  saveResult?: boolean;
  useCache?: boolean;
  preserveMemory?: boolean;
}

/**
 * Service for replaying crew task execution
 * Optimized for memory efficiency and execution restoration
 */
export class ReplayService {
  private taskOutputsStorage: KickoffTaskOutputsStorage | null = null;
  private memoryManager: MemoryManager | null = null;
  private telemetry: Telemetry | null = null;
  
  /**
   * Create a new ReplayService instance
   * @param options Replay options
   */
  constructor(private options: ReplayOptions = {}) {
    this.options = {
      verbose: options.verbose ?? false,
      maxTimeMs: options.maxTimeMs ?? 300000, // 5 minutes default timeout
      saveResult: options.saveResult ?? true,
      useCache: options.useCache ?? true,
      preserveMemory: options.preserveMemory ?? true
    };
  }
  
  /**
   * Replay a specific crew task by ID
   * @param taskId Task ID to replay
   * @param crew Optional crew instance to use for replay
   * @returns Replay result
   */
  async replayTask(taskId: string, crew?: Crew): Promise<ReplayResult> {
    const startTime = Date.now();
    
    // Initialize telemetry
    await this.initializeTelemetry();
    
    try {
      // Get the task output from storage
      const taskOutput = await this.getTaskOutput(taskId);
      if (!taskOutput) {
        throw new Error(`Task with ID ${taskId} not found in storage`);
      }
      
      this.logVerbose(`Found task ${taskId} for replay`);
      
      // Need to recreate the task and agent for execution
      const { task, agent } = await this.recreateTaskAndAgent(taskOutput, crew);
      if (!task || !agent) {
        throw new Error(`Failed to recreate task and agent for task ID ${taskId}`);
      }
      
      this.logVerbose(`Recreated task and agent for replay`);
      
      // Set up timeout for execution
      const executionPromise = agent.executeTask(task);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Task replay timeout after ${this.options.maxTimeMs}ms`)),
          this.options.maxTimeMs
        );
      });
      
      // Execute the task with timeout protection
      this.trackEvent('task_replay_started', {
        taskId,
        agentId: agent.id,
        originalOutput: taskOutput.actualOutput || taskOutput.expectedOutput
      });
      
      const replayOutput = await Promise.race([executionPromise, timeoutPromise]);
      
      this.logVerbose(`Task replay completed`);
      
      // Get token usage from task metrics if available with proper fallbacks for undefined values
      const tokenUsage = {
        promptTokens: task.metrics?.tokenUsage?.promptTokens ?? 0,
        completionTokens: task.metrics?.tokenUsage?.completionTokens ?? 0,
        totalTokens: task.metrics?.tokenUsage?.totalTokens ?? 0
      };
      
      // Save the result if configured
      if (this.options.saveResult) {
        await this.saveTaskOutput({
          taskId,
          expectedOutput: taskOutput.expectedOutput,
          actualOutput: replayOutput,
          agentId: agent.id,
          metadata: {
            replayTime: Date.now(),
            originalTime: taskOutput.timestamp,
            tokenUsage
          }
        });
      }
      
      const result: ReplayResult = {
        success: true,
        taskId,
        agentId: agent.id,
        originalOutput: taskOutput.actualOutput || taskOutput.expectedOutput,
        replayOutput,
        timeTaken: Date.now() - startTime,
        tokenUsage
      };
      
      this.trackEvent('task_replay_completed', {
        taskId,
        agentId: agent.id,
        success: true,
        timeTaken: result.timeTaken,
        tokenUsage
      });
      
      return result;
      
    } catch (error) {
      const result: ReplayResult = {
        success: false,
        taskId,
        timeTaken: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error))
      };
      
      this.trackEvent('task_replay_failed', {
        taskId,
        error: String(error),
        timeTaken: result.timeTaken
      });
      
      return result;
    } finally {
      // Reset memory if not preserving
      if (!this.options.preserveMemory) {
        await this.resetMemories();
      }
    }
  }
  
  /**
   * Get task output from storage
   * Lazily initializes storage for memory efficiency
   * @param taskId Task ID to retrieve
   * @returns Task output or null if not found
   */
  private async getTaskOutput(taskId: string) {
    if (!this.taskOutputsStorage) {
      this.taskOutputsStorage = new KickoffTaskOutputsStorage();
    }
    
    return this.taskOutputsStorage.getTaskById(taskId);
  }
  
  /**
   * Save task output to storage
   * @param taskOutput Task output to save
   */
  private async saveTaskOutput(taskOutput: any) {
    if (!this.taskOutputsStorage) {
      this.taskOutputsStorage = new KickoffTaskOutputsStorage();
    }
    
    await this.taskOutputsStorage.save(taskOutput);
  }
  
  /**
   * Recreate task and agent from stored task output
   * @param taskOutput Stored task output
   * @param crew Optional crew to use for context
   * @returns Recreated task and agent
   */
  private async recreateTaskAndAgent(taskOutput: any, crew?: Crew): Promise<{ task?: Task, agent?: Agent }> {
    // Use existing crew if provided
    if (crew) {
      // Find the task and agent in the crew
      const task = crew.executionGraph.tasks.find((t: Task) => t.id === taskOutput.taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskOutput.taskId} not found in provided crew`);
      }
      
      const agent = task.agent;
      if (!agent) {
        throw new Error(`Agent not found for task with ID ${taskOutput.taskId}`);
      }
      
      return { task, agent };
    }
    
    // Need to recreate from minimal data
    // This is a simplified implementation - in a real system, you would
    // likely need to restore more context and dependencies
    const metadata = taskOutput.metadata || {};
    
    // Instead of creating a new Agent, we'll create a mock agent object that conforms to the Agent interface
    const agent: Agent = {
      id: `agent_${Date.now()}`,
      name: metadata.agentName || 'Replay Agent',
      role: metadata.agentRole || 'Assistant',
      goal: metadata.agentGoal || 'Complete the task',
      verbose: this.options.verbose,
      allowDelegation: false,
      // Implement required methods
      executeTask: async (task: Task): Promise<string> => {
        // Simplified implementation
        return taskOutput.expectedOutput || 'Task completed';
      },
      getResponse: async (message: string, options?: any): Promise<string> => {
        // Simplified implementation
        return 'Response to: ' + message;
      },
      getResponseAsStream: async (message: string, context?: string, tokenCallback?: (token: string) => void): Promise<string> => {
        // Simplified implementation
        const response = 'Response to: ' + message;
        if (tokenCallback) {
          // Simulate streaming by sending one word at a time
          const words = response.split(' ');
          words.forEach(word => tokenCallback(word + ' '));
        }
        return response;
      }
    };
    
    // Create a task object that conforms to the Task interface
    const task: Task = {
      id: taskOutput.taskId,
      description: metadata.taskDescription || taskOutput.expectedOutput,
      expectedOutput: taskOutput.expectedOutput,
      agent,
      completed: false
    };
    
    // ID is already set in the task object creation
    
    return { task, agent };
  }
  
  /**
   * Reset all memories
   * Lazily loads MemoryManager to optimize memory usage
   */
  private async resetMemories(): Promise<void> {
    if (!this.memoryManager) {
      try {
        this.memoryManager = new MemoryManager();
        this.memoryManager.createStandardMemories();
      } catch (error) {
        console.error('Error initializing memory manager:', error);
        return;
      }
    }
    
    try {
      await this.memoryManager.resetMemory('all');
    } catch (error) {
      console.error('Error resetting memories:', error);
    }
  }
  
  /**
   * Initialize telemetry
   * Lazily loads Telemetry to optimize memory usage
   */
  private async initializeTelemetry(): Promise<void> {
    if (!this.telemetry) {
      try {
        this.telemetry = Telemetry.getInstance({
          enabled: true,
          samplingRate: 0.5 // Memory-efficient sampling rate
        });
      } catch (error) {
        console.error('Error initializing telemetry:', error);
      }
    }
  }
  
  /**
   * Track telemetry event
   * @param type Event type
   * @param data Event data
   */
  private trackEvent(type: string, data: Record<string, any>): void {
    if (this.telemetry) {
      try {
        this.telemetry.track(type as TelemetryEventType, data);
      } catch (error) {
        // Silently handle telemetry errors
      }
    }
  }
  
  /**
   * Log verbose messages if verbose mode is enabled
   * @param message Message to log
   * @param data Optional data to log
   */
  private logVerbose(message: string, data?: any): void {
    if (this.options.verbose) {
      if (data) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }
}
