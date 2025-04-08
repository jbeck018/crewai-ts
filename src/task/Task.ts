/**
 * Task implementation
 * Optimized for efficient execution, context management, and error handling
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseAgent } from '../agent/BaseAgent.js';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskConfig {
  description: string;
  agent: BaseAgent;
  expectedOutput?: string;
  context?: string[];
  priority?: TaskPriority;
  async?: boolean;
  tools?: any[];
  kpi?: string;
  cachingStrategy?: 'none' | 'memory' | 'disk' | 'hybrid';
  maxRetries?: number;
  timeoutMs?: number;
}

export interface TaskOutput {
  result: string;
  metadata: {
    taskId: string;
    agentId: string;
    executionTime: number;
    tokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };
    iterations?: number;
    cacheHit?: boolean;
    retries?: number;
  };
}

/**
 * Task class that represents work to be done by an agent
 * Optimized for:
 * - Efficient execution tracking
 * - Result caching
 * - Context management
 * - Error handling with retries
 */
export class Task {
  readonly id: string;
  readonly description: string;
  readonly agent: BaseAgent;
  readonly expectedOutput?: string;
  readonly context: string[];
  readonly priority: TaskPriority;
  readonly isAsync: boolean;
  readonly tools: any[];
  readonly kpi?: string;
  readonly cachingStrategy: 'none' | 'memory' | 'disk' | 'hybrid';
  readonly maxRetries: number;
  readonly timeoutMs?: number;

  // Execution state
  private output?: TaskOutput;
  private executionCount = 0;
  private lastExecutionTime = 0;
  private cacheKey?: string;

  constructor(config: TaskConfig) {
    this.id = uuidv4();
    this.description = config.description;
    this.agent = config.agent;
    this.expectedOutput = config.expectedOutput;
    this.context = config.context || [];
    this.priority = config.priority || 'medium';
    this.isAsync = config.async || false;
    this.tools = config.tools || [];
    this.kpi = config.kpi;
    this.cachingStrategy = config.cachingStrategy || 'none';
    this.maxRetries = config.maxRetries || 3;
    this.timeoutMs = config.timeoutMs;

    // Optimize by pre-computing cache key if caching is enabled
    if (this.cachingStrategy !== 'none') {
      this.cacheKey = this.computeCacheKey();
    }
  }

  /**
   * Execute the task with the assigned agent
   * Optimized with caching, retries, and timeout management
   */
  async execute(context?: string): Promise<TaskOutput> {
    // Check cache first if caching is enabled
    if (this.cachingStrategy !== 'none' && this.checkCache()) {
      return this.output!;
    }

    // Track execution metrics
    const startTime = Date.now();
    this.executionCount++;
    let retries = 0;
    let error: Error | null = null;

    // Setup timeout controller if needed
    const abortController = this.timeoutMs ? new AbortController() : undefined;
    const timeoutId = this.timeoutMs
      ? setTimeout(() => abortController?.abort(new Error('Task execution timeout')), this.timeoutMs)
      : undefined;

    try {
      // Prepare context by joining existing context with new context
      const fullContext = this.prepareContext(context);

      // Execute task with retry logic
      for (let i = 0; i <= this.maxRetries; i++) {
        try {
          // Execute the task with the agent
          const result = await this.agent.executeTask(
            this,
            fullContext,
            this.tools
          );

          // Process and store the result
          this.output = {
            result: result.output,
            metadata: {
              taskId: this.id,
              agentId: this.agent.id,
              executionTime: Date.now() - startTime,
              tokenUsage: result.metadata?.totalTokens ? {
                prompt: result.metadata.promptTokens || 0,
                completion: result.metadata.completionTokens || 0,
                total: result.metadata.totalTokens
              } : undefined,
              iterations: result.metadata?.iterations,
              retries
            }
          };

          // Store in cache if enabled
          if (this.cachingStrategy !== 'none') {
            this.updateCache();
          }

          return this.output;
        } catch (err) {
          error = err as Error;
          retries++;

          // Only retry if we haven't exceeded max retries
          if (i < this.maxRetries) {
            // Exponential backoff with jitter
            const delay = Math.min(100 * Math.pow(2, i) + Math.random() * 100, 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // If we've exhausted retries, throw the last error
      throw error || new Error('Task execution failed after retries');
    } finally {
      // Clear timeout if it was set
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      this.lastExecutionTime = Date.now() - startTime;
    }
  }

  /**
   * Get execution status
   */
  getStatus(): 'pending' | 'completed' | 'failed' {
    if (this.executionCount === 0) return 'pending';
    return this.output ? 'completed' : 'failed';
  }

  /**
   * Prepare context by combining existing context with new context
   * Optimized to avoid redundant string operations
   */
  private prepareContext(additionalContext?: string): string {
    if (!additionalContext && this.context.length === 0) {
      return '';
    }

    // Efficiently join context strings
    const contextParts = [...this.context];
    if (additionalContext) {
      contextParts.push(additionalContext);
    }

    return contextParts.join('\n\n');
  }

  /**
   * Compute a cache key for this task
   * Optimized to use minimal string operations
   */
  private computeCacheKey(): string {
    // Create a stable representation of the task for caching
    const keyParts = [
      this.description,
      this.agent.id,
      ...this.context,
      this.tools.map(t => t.name).join(',')
    ];

    // Use a fast hashing function (in a real implementation)
    return keyParts.join('||');
  }

  /**
   * Check if a cached result exists
   */
  private checkCache(): boolean {
    // This would interface with a caching system
    // For now, just check if we have a previous output
    return !!this.output;
  }

  /**
   * Update the cache with the latest result
   */
  private updateCache(): void {
    // This would interface with a caching system to store the result
    // using this.cacheKey and this.output
  }

  toString(): string {
    return `Task(id=${this.id}, description=${this.description}, agent=${this.agent.role})`;
  }
}
