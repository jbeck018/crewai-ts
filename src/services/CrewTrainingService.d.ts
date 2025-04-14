/**
 * Type declarations for CrewTrainingService
 * Memory-optimized with proper interface definitions
 */

/**
 * Training result metrics with memory-efficient representation
 */
export interface TrainingMetrics {
  /**
   * Accuracy as a percentage (0-100)
   */
  accuracy: number;

  /**
   * Number of agents trained
   */
  agentCount: number;

  /**
   * Total time spent training in milliseconds
   * Allows for performance monitoring and optimization
   */
  trainingTime: number;
  
  /**
   * Number of training iterations completed
   */
  iterations: number;
  
  /**
   * Generated agent data with memory-optimized structure
   */
  agentsData: Record<string, any>[];
}

/**
 * Options for crew training
 */
export interface TrainingOptions {
  /**
   * Number of training iterations
   */
  iterations: number;

  /**
   * Path to output file
   */
  outputFile: string;

  /**
   * Enable verbose output
   */
  verbose?: boolean;
}

/**
 * Service for training crew agents with memory-optimized implementation
 */
export class CrewTrainingService {
  /**
   * Create a new training service
   */
  constructor();

  /**
   * Register callback for iteration completion
   * @param callback Function to call when an iteration completes
   */
  onIterationComplete(callback: (iteration: number) => void): void;

  /**
   * Train the crew with specified options
   * @param options Training configuration
   * @returns Promise containing training metrics and output path
   */
  train(options: TrainingOptions): Promise<{
    metrics: TrainingMetrics;
    outputPath: string;
  }>;
}
