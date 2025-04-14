/**
 * Type declarations for CrewEvaluationService
 * Memory-optimized with proper interface definitions
 */

/**
 * Agent performance metrics during evaluation
 */
export interface AgentPerformanceMetrics {
  /**
   * Name of the agent
   */
  name: string;

  /**
   * Success rate as a decimal (0-1)
   */
  successRate: number;

  /**
   * Number of tasks successfully completed
   */
  completedTasks: number;

  /**
   * Average completion time in milliseconds
   */
  averageTimeMs?: number;
}

/**
 * Task result metrics from evaluation
 */
export interface TaskResultMetrics {
  /**
   * Task identifier
   */
  id: string;

  /**
   * Task name or description
   */
  name: string;

  /**
   * Whether the task was successful
   */
  success: boolean;

  /**
   * Execution time in milliseconds
   */
  executionTimeMs: number;

  /**
   * Task output data
   */
  output?: string;
}

/**
 * Evaluation results with comprehensive metrics
 */
export interface EvaluationResults {
  /**
   * Overall success rate as a decimal (0-1)
   */
  successRate: number;

  /**
   * Average task completion time in milliseconds
   */
  averageTaskTimeMs: number;

  /**
   * Total number of tasks executed
   */
  totalTasks: number;

  /**
   * Performance metrics for each agent
   */
  agentPerformance?: AgentPerformanceMetrics[];

  /**
   * Detailed results for each task
   */
  taskResults?: TaskResultMetrics[];
}

/**
 * Options for crew evaluation
 */
export interface EvaluationOptions {
  /**
   * Number of test iterations
   */
  iterations: number;

  /**
   * Model to use for agents
   */
  model: string;

  /**
   * Enable verbose output
   */
  verbose?: boolean;

  /**
   * Maximum memory usage in MB (for optimization)
   */
  memoryLimit?: number;
}

/**
 * Service for evaluating crew performance with memory-optimized implementation
 */
export class CrewEvaluationService {
  /**
   * Create a new evaluation service
   */
  constructor();
  
  /**
   * Register callback for iteration completion
   * @param callback Function to call when an iteration completes
   */
  onIterationComplete(callback: (iteration: number) => void): void;
  
  /**
   * Evaluate crew performance with specified options
   * @param options Evaluation configuration
   */
  evaluate(options: EvaluationOptions): Promise<EvaluationResults>;
}
