/**
 * CrewTester service for testing crews and measuring performance
 * Optimized for memory efficiency and detailed performance metrics
 */
// Use default imports for JS modules with proper type assertions
// This approach ensures better memory efficiency by avoiding unnecessary type conversions
import CrewModule from '../Crew.js';
import AgentModule from '../Agent.js';
import TaskModule from '../Task.js';

// Type-safe casting with explicit named types - memory optimized approach
// Using type assertion for default imports of JavaScript modules
type CrewType = any; // Using any as a placeholder for the Crew type
type AgentType = any; // Using any as a placeholder for the Agent type
type TaskType = any; // Using any as a placeholder for the Task type

const Crew = CrewModule as any;
const Agent = AgentModule as any;
const Task = TaskModule as any;
import { MemoryManager } from '../memory/MemoryManager.js';

export interface TestResult {
  success: boolean;
  duration: number; // Duration in milliseconds
  agentMetrics: Record<string, AgentMetrics>;
  taskMetrics: Record<string, TaskMetrics>;
  memoryUsage: MemoryUsageMetrics;
  errors?: any[];
}

export interface AgentMetrics {
  taskCount: number;
  totalDuration: number;
  avgDuration: number;
  successRate: number;
  tokenUsage: TokenUsage;
}

export interface TaskMetrics {
  duration: number;
  agentId: string;
  success: boolean;
  tokenUsage: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

export interface MemoryUsageMetrics {
  initialHeapUsed: number;
  finalHeapUsed: number;
  delta: number;
  initialExternalUsed: number;
  finalExternalUsed: number;
  externalDelta: number;
}

export interface TestOptions {
  verbose?: boolean;
  resetMemory?: boolean;
  repetitions?: number;
  timeoutMs?: number;
  collectMetrics?: boolean;
  earlyStop?: boolean; // Stop on first failure
}

/**
 * Service for testing crews and collecting performance metrics
 * Optimized for memory efficiency and accurate performance analysis
 */
export class CrewTester {
  private memoryManager: MemoryManager | null = null;
  
  /**
   * Create a new CrewTester instance
   * @param options Test options
   */
  constructor(private options: TestOptions = {}) {
    this.options = {
      verbose: options.verbose ?? false,
      resetMemory: options.resetMemory ?? true,
      repetitions: options.repetitions ?? 1,
      timeoutMs: options.timeoutMs ?? 300000, // 5 minutes default timeout
      collectMetrics: options.collectMetrics ?? true,
      earlyStop: options.earlyStop ?? false
    };
  }
  
  /**
   * Test a crew with specified options
   * Optimized for memory efficiency and detailed metrics collection
   * @param crew Crew to test
   * @returns Test results
   */
  async testCrew(crew: CrewType): Promise<TestResult> {
    // Initialize metrics
    const startTime = Date.now();
    const agentMetrics: Record<string, AgentMetrics> = {};
    const taskMetrics: Record<string, TaskMetrics> = {};
    const errors: any[] = [];
    
    // Initialize memory metrics
    const initialMemory = process.memoryUsage();
    
    // Reset memory if needed
    if (this.options.resetMemory) {
      await this.resetMemories();
    }
    
    // Initialize agent metrics with proper type safety
    crew.agents.forEach((agent: any) => {
      agentMetrics[agent.id] = {
        taskCount: 0,
        totalDuration: 0,
        avgDuration: 0,
        successRate: 0,
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0
        }
      };
    });
    
    // Track success rate
    let successCount = 0;
    let totalTasks = 0;
    
    try {
      // Run the crew repetitions
      for (let i = 0; i < (this.options.repetitions || 1); i++) {
        if (this.options.verbose) {
          console.log(`Running test iteration ${i + 1} of ${this.options.repetitions}`);
        }
        
        // Execute the crew with a timeout
        try {
          const executionPromise = crew.kickoff();
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Test timeout after ${this.options.timeoutMs}ms`)), 
              this.options.timeoutMs);
          });
          
          const result = await Promise.race([executionPromise, timeoutPromise]);
          successCount++;
          
          // Collect task metrics (optimized to collect only what's needed)
          // Adding explicit type annotation for type safety and memory optimization
          crew.executionGraph.tasks.forEach((task: any) => {
            totalTasks++;
            const taskId = task.id;
            const agentId = task.agent?.id;
            
            if (!agentId) return;
            
            // Create task metrics
            const duration = task.metrics?.duration || 0;
            const tokenUsage = task.metrics?.tokenUsage || {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0
            };
            
            taskMetrics[taskId] = {
              duration,
              agentId,
              success: true,
              tokenUsage
            };
            
            // Update agent metrics
            if (agentMetrics[agentId]) {
              agentMetrics[agentId].taskCount++;
              agentMetrics[agentId].totalDuration += duration;
              agentMetrics[agentId].tokenUsage.promptTokens += tokenUsage.promptTokens;
              agentMetrics[agentId].tokenUsage.completionTokens += tokenUsage.completionTokens;
              agentMetrics[agentId].tokenUsage.totalTokens += tokenUsage.totalTokens;
              agentMetrics[agentId].tokenUsage.cost = (agentMetrics[agentId].tokenUsage.cost || 0) + 
                (tokenUsage.cost || 0);
            }
          });
          
        } catch (error) {
          errors.push(error);
          if (this.options.earlyStop) {
            break;
          }
        }
      }
      
      // Calculate final agent metrics with null checks for memory safety
      Object.keys(agentMetrics).forEach(agentId => {
        const metrics = agentMetrics[agentId];
        // Check if metrics exist before accessing properties
        if (metrics) {
          metrics.avgDuration = metrics.taskCount > 0 ? metrics.totalDuration / metrics.taskCount : 0;
          metrics.successRate = metrics.taskCount > 0 ? 
            successCount / (this.options.repetitions || 1) : 0;
        }
      });
      
      // Collect final memory metrics
      const finalMemory = process.memoryUsage();
      const memoryUsage: MemoryUsageMetrics = {
        initialHeapUsed: initialMemory.heapUsed,
        finalHeapUsed: finalMemory.heapUsed,
        delta: finalMemory.heapUsed - initialMemory.heapUsed,
        initialExternalUsed: initialMemory.external,
        finalExternalUsed: finalMemory.external,
        externalDelta: finalMemory.external - initialMemory.external
      };
      
      return {
        success: errors.length === 0,
        duration: Date.now() - startTime,
        agentMetrics,
        taskMetrics,
        memoryUsage,
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (error) {
      // Handle unexpected errors
      return {
        success: false,
        duration: Date.now() - startTime,
        agentMetrics,
        taskMetrics,
        memoryUsage: {
          initialHeapUsed: initialMemory.heapUsed,
          finalHeapUsed: 0,
          delta: 0,
          initialExternalUsed: initialMemory.external,
          finalExternalUsed: 0,
          externalDelta: 0
        },
        errors: [error]
      };
    }
  }
  
  /**
   * Reset all memories
   * Lazily loads MemoryManager to optimize memory usage
   */
  private async resetMemories(): Promise<void> {
    // Lazy-load memory manager to reduce initial memory footprint
    if (!this.memoryManager) {
      // Import dynamically to avoid circular dependencies
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
}
