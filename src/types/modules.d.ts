/**
 * Enhanced module declarations for JavaScript imports
 * Provides comprehensive type safety for dynamically imported modules
 * Optimized for memory efficiency and improved TypeScript compatibility
 */

// Declare specific module declarations for better type safety
declare module '../../services/CrewTrainingService.js' {
  export interface TrainingOptions {
    iterations: number;
    outputFile: string;
    verbose: boolean;
  }
  
  export interface TrainingMetrics {
    accuracy: number;
    agentCount: number;
    trainingTime: number;
    iterations: number;
    agentsData: Record<string, any>[];
  }
  
  export class CrewTrainingService {
    onIterationComplete(callback: (iteration: number) => void): void;
    train(options: TrainingOptions): Promise<{
      metrics: TrainingMetrics;
      outputPath: string;
    }>;
  }
}

// TaskReplay service with memory-optimized type declarations
declare module '../../services/TaskReplayService.js' {
  export interface ReplayOptions {
    verbose?: boolean;
    timeout?: number;
  }
  
  export interface ReplayResult {
    success: boolean;
    metrics?: {
      executionTime: number;
      tokensUsed: number;
    };
    output?: string;
    error?: string;
  }
  
  export class TaskReplayService {
    replayFromTask(taskId: string, options?: ReplayOptions): Promise<ReplayResult>;
  }
}

// Add declarations for common Node.js modules that might be missing typings
declare global {
  namespace NodeJS {
    // Add any missing Node.js typings for process, etc.
    interface Process {
      stdin: any;
      stdout: any;
      stderr: any;
    }
  }
}

// Generic fallback for other .js imports
declare module '*.js' {
  const value: any;
  export default value;
}

// Specific declarations for core modules
declare module '../Crew.js' {
  export class Crew {
    // Add proper type definitions here
  }
}

declare module '../Agent.js' {
  export class Agent {
    // Add proper type definitions here
  }
}

declare module '../Task.js' {
  export class Task {
    // Add proper type definitions here
  }
}

// Knowledge modules
declare module '../../knowledge/KnowledgeChunk.js' {
  export class KnowledgeChunk {
    // Add proper type definitions here
  }
}

declare module '../../knowledge/KnowledgeBase.js' {
  export class KnowledgeBase {
    // Add proper type definitions here
  }
}
