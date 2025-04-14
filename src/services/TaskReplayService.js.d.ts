/**
 * Module declaration for TaskReplayService.js
 * This file ensures TypeScript properly recognizes the JavaScript module
 * Memory-optimized with correct type exports and proper JavaScript import handling
 */

// Declare module with proper naming convention for TypeScript type safety
declare module 'TaskReplayService' {
  // Explicit interface declarations for better type safety
  export interface TaskReplayOptions {
    iterations?: number;
    parallelism?: number;
    outputFile?: string;
    verbose?: boolean;
  }

  export interface TaskReplayResults {
    metrics: {
      successRate: number;
      averageDuration: number;
      completedRuns: number;
    };
    outputPath: string;
  }

  // Declare the class with proper method signatures
  export class TaskReplayService {
    constructor(options?: TaskReplayOptions);
    replay(taskId: string): Promise<TaskReplayResults>;
  }

  // Default export for the module
  const service: typeof TaskReplayService;
  export default service;
}
