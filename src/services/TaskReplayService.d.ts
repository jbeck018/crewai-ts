/**
 * Type declarations for TaskReplayService
 * Memory-optimized with proper interface definitions
 */

/**
 * Options for task replay operations
 */
export interface TaskReplayOptions {
  /**
   * Enable verbose logging during replay
   */
  verbose?: boolean;
  
  /**
   * Cache replay results to improve performance
   */
  useCache?: boolean;
  
  /**
   * Maximum memory limit for replay operations in MB
   */
  memoryLimit?: number;
}

/**
 * Replay results structure with optimized memory footprint
 */
export interface TaskReplayResults {
  /**
   * Whether the replay was successful
   */
  success: boolean;
  
  /**
   * ID of the replayed task
   */
  taskId: string;
  
  /**
   * Timestamp when the replay was executed
   */
  replayTime: string;
  
  /**
   * Results of the replay operation
   */
  results: {
    /**
     * Status of the replay operation
     */
    status: 'completed' | 'failed' | 'partial';
    
    /**
     * Output data from the replay
     */
    outputs: Record<string, unknown>;
  };
}

/**
 * Service for replaying task execution with memory-optimized implementation
 */
export class TaskReplayService {
  /**
   * Creates a new task replay service
   * @param options Configuration options
   */
  constructor(options?: {
    useCache?: boolean;
    persistResults?: boolean;
  });
  
  /**
   * Replay a task execution from a specific task ID
   * @param taskId ID of the task to replay from
   * @param options Replay options
   */
  replayFromTask(taskId: string, options?: TaskReplayOptions): Promise<TaskReplayResults>;
  
  /**
   * Get the execution history for a replayed task
   * @param taskId ID of the replayed task
   */
  getReplayHistory(taskId: string): Promise<Array<{
    timestamp: string;
    event: string;
    taskId: string;
  }>>;
}
