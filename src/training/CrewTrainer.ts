/**
 * CrewTrainer service for improving crew performance through training
 * Optimized for memory efficiency and performance improvement tracking
 */
import { Crew, Agent, Task } from '../types/index.js';
import { MemoryManager } from '../memory/MemoryManager.js';
import { Telemetry } from '../telemetry/Telemetry.js';
import { TelemetryEventType } from '../telemetry/types.js';

export interface TrainingResult {
  success: boolean;
  trainingRounds: number;
  initialPerformance: PerformanceMetrics;
  finalPerformance: PerformanceMetrics;
  improvement: PerformanceMetrics;
  byAgent: Record<string, AgentTrainingResult>;
  errors?: any[];
  duration: number; // In milliseconds
}

export interface PerformanceMetrics {
  taskSuccessRate: number;
  avgResponseTime: number;
  tokenEfficiency: number;
  coherenceScore?: number;
  relevanceScore?: number;
}

export interface AgentTrainingResult {
  agentId: string;
  initialPerformance: PerformanceMetrics;
  finalPerformance: PerformanceMetrics;
  improvement: PerformanceMetrics;
  taskCount: number;
}

export interface TrainingOptions {
  rounds?: number;
  evaluatePerRound?: boolean;
  saveCheckpoints?: boolean;
  verbose?: boolean;
  maxTimePerRoundMs?: number;
  useHistoricalTasks?: boolean;
  resetMemoryBetweenRounds?: boolean;
  adaptiveDifficulty?: boolean; // Adjust task difficulty based on agent performance
  customEvaluator?: (crew: Crew) => Promise<number>; // Custom evaluation function
}

/**
 * Service for training crews and improving their performance
 * Optimized for memory efficiency and incremental performance enhancement
 */
export class CrewTrainer {
  private memoryManager: MemoryManager | null = null;
  private telemetry: Telemetry | null = null;
  private trainingTasks: Task[] = [];
  
  /**
   * Create a new CrewTrainer instance
   * @param options Training options
   */
  constructor(private options: TrainingOptions = {}) {
    this.options = {
      rounds: options.rounds ?? 3,
      evaluatePerRound: options.evaluatePerRound ?? true,
      saveCheckpoints: options.saveCheckpoints ?? false,
      verbose: options.verbose ?? false,
      maxTimePerRoundMs: options.maxTimePerRoundMs ?? 600000, // 10 minutes default
      useHistoricalTasks: options.useHistoricalTasks ?? true,
      resetMemoryBetweenRounds: options.resetMemoryBetweenRounds ?? false,
      adaptiveDifficulty: options.adaptiveDifficulty ?? false,
      customEvaluator: options.customEvaluator
    };
  }
  
  /**
   * Train a crew over multiple rounds to improve performance
   * @param crew Crew to train
   * @returns Training results with performance metrics
   */
  async trainCrew(crew: Crew): Promise<TrainingResult> {
    const startTime = Date.now();
    const errors: any[] = [];
    
    // Setup telemetry
    await this.initializeTelemetry();
    
    // Initialize per-agent metrics tracking
    const agentResults: Record<string, AgentTrainingResult> = {};
    crew.agents.forEach(agent => {
      agentResults[agent.id] = {
        agentId: agent.id,
        initialPerformance: this.createEmptyPerformanceMetrics(),
        finalPerformance: this.createEmptyPerformanceMetrics(),
        improvement: this.createEmptyPerformanceMetrics(),
        taskCount: 0
      };
    });
    
    // Collect historical tasks if enabled
    if (this.options.useHistoricalTasks) {
      await this.collectHistoricalTasks(crew);
    }
    
    // Evaluate initial performance
    let initialPerformance = this.createEmptyPerformanceMetrics();
    try {
      initialPerformance = await this.evaluateCrew(crew);
      
      // Track initial performance for each agent
      crew.agents.forEach((agent: Agent) => {
        const agentId = agent?.id;
        if (agentId && agentResults[agentId]) {
          agentResults[agentId].initialPerformance = {
            ...initialPerformance,
            // Agent-specific metrics could be added here
          };
        }
      });
      
      this.trackEvent('training_started', {
        crewId: crew.id,
        agentCount: crew.agents.length,
        taskCount: crew.executionGraph.tasks.length,
        initialPerformance
      });
      
    } catch (error) {
      errors.push(error);
      this.logVerbose('Error evaluating initial performance:', error);
    }
    
    // Run training rounds
    for (let round = 0; round < (this.options.rounds || 3); round++) {
      this.logVerbose(`Starting training round ${round + 1} of ${this.options.rounds}`);
      
      try {
        // Reset memories between rounds if configured
        if (this.options.resetMemoryBetweenRounds && round > 0) {
          await this.resetMemories();
        }
        
        // Execute the crew with a timeout
        const roundStartTime = Date.now();
        const executionPromise = crew.kickoff();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Training round timeout after ${this.options.maxTimePerRoundMs}ms`)),
            this.options.maxTimePerRoundMs
          );
        });
        
        await Promise.race([executionPromise, timeoutPromise]);
        
        this.logVerbose(`Completed training round ${round + 1} in ${Date.now() - roundStartTime}ms`);
        
        // Add completed tasks to historical tasks
        if (this.options.useHistoricalTasks) {
          this.updateHistoricalTasks(crew);
        }
        
        // Collect per-agent metrics for this round
        crew.agents.forEach((agent: Agent) => {
          const agentId = agent?.id;
          if (agentId && agentResults[agentId]) {
            // Count tasks completed by this agent
            const agentTasks = crew.executionGraph.tasks.filter((task: Task) => task.agent?.id === agentId);
            agentResults[agentId].taskCount += agentTasks.length;
          }
        });
        
        // Evaluate after each round if configured
        if (this.options.evaluatePerRound) {
          const roundPerformance = await this.evaluateCrew(crew);
          this.trackEvent('training_round_completed', {
            crewId: crew.id,
            round: round + 1,
            performance: roundPerformance
          });
        }
        
        // Adjust difficulty if adaptive training is enabled
        if (this.options.adaptiveDifficulty) {
          await this.adjustTaskDifficulty(crew, agentResults);
        }
        
      } catch (error) {
        errors.push(error);
        this.logVerbose(`Error in training round ${round + 1}:`, error);
      }
    }
    
    // Evaluate final performance
    let finalPerformance = this.createEmptyPerformanceMetrics();
    try {
      finalPerformance = await this.evaluateCrew(crew);
      
      // Track final performance for each agent
      crew.agents.forEach((agent: Agent) => {
        const agentId = agent?.id;
        if (agentId && agentResults[agentId]) {
          agentResults[agentId].finalPerformance = {
            ...finalPerformance,
            // Agent-specific metrics could be added here
          };
          
          // Calculate improvement for this agent
          agentResults[agentId].improvement = this.calculateImprovement(
            agentResults[agentId].initialPerformance,
            agentResults[agentId].finalPerformance
          );
        }
      });
      
      this.trackEvent('training_completed', {
        crewId: crew.id,
        duration: Date.now() - startTime,
        rounds: this.options.rounds,
        initialPerformance,
        finalPerformance,
        errors: errors.length
      });
      
    } catch (error) {
      errors.push(error);
      this.logVerbose('Error evaluating final performance:', error);
    }
    
    // Calculate overall improvement
    const improvement = this.calculateImprovement(initialPerformance, finalPerformance);
    
    return {
      success: errors.length === 0,
      trainingRounds: this.options.rounds || 3,
      initialPerformance,
      finalPerformance,
      improvement,
      byAgent: agentResults,
      errors: errors.length > 0 ? errors : undefined,
      duration: Date.now() - startTime
    };
  }
  
  /**
   * Create empty performance metrics
   * @returns Empty performance metrics
   */
  private createEmptyPerformanceMetrics(): PerformanceMetrics {
    return {
      taskSuccessRate: 0,
      avgResponseTime: 0,
      tokenEfficiency: 0,
      coherenceScore: 0,
      relevanceScore: 0
    };
  }
  
  /**
   * Calculate improvement between initial and final performance
   * @param initial Initial performance metrics
   * @param final Final performance metrics
   * @returns Improvement metrics
   */
  private calculateImprovement(initial: PerformanceMetrics, final: PerformanceMetrics): PerformanceMetrics {
    return {
      taskSuccessRate: final.taskSuccessRate - initial.taskSuccessRate,
      avgResponseTime: initial.avgResponseTime - final.avgResponseTime, // Lower is better
      tokenEfficiency: final.tokenEfficiency - initial.tokenEfficiency,
      coherenceScore: (final.coherenceScore || 0) - (initial.coherenceScore || 0),
      relevanceScore: (final.relevanceScore || 0) - (initial.relevanceScore || 0)
    };
  }
  
  /**
   * Evaluate current crew performance
   * @param crew Crew to evaluate
   * @returns Performance metrics
   */
  private async evaluateCrew(crew: Crew): Promise<PerformanceMetrics> {
    // Use custom evaluator if provided
    if (this.options.customEvaluator) {
      try {
        const score = await this.options.customEvaluator(crew);
        return {
          taskSuccessRate: score,
          avgResponseTime: 0, // Cannot be determined from custom evaluator
          tokenEfficiency: 0, // Cannot be determined from custom evaluator
          coherenceScore: score,
          relevanceScore: score
        };
      } catch (error) {
        this.logVerbose('Error in custom evaluator:', error);
      }
    }
    
    // Default evaluation based on task execution metrics
    let successfulTasks = 0;
    let totalResponseTime = 0;
    let totalTokens = 0;
    let usefulTokens = 0;
    
    const tasks = crew.executionGraph.tasks;
    if (tasks.length === 0) {
      return this.createEmptyPerformanceMetrics();
    }
    
    for (const task of tasks as Task[]) {
      if (task.completed) {
        successfulTasks++;
      }
      
      totalResponseTime += task.metrics?.duration || 0;
      
      if (task.metrics?.tokenUsage) {
        const tokenUsage = task.metrics.tokenUsage;
        totalTokens += tokenUsage.totalTokens || 0;
        
        // Estimate useful tokens based on output quality (simplified metric)
        const outputLength = (task.output?.length || 0);
        const promptLength = (task.description?.length || 0) + (task.expectedOutput?.length || 0);
        usefulTokens += Math.min(tokenUsage.completionTokens || 0, outputLength / 4); // Rough approximation
      }
    }
    
    // Calculate metrics
    const taskSuccessRate = tasks.length > 0 ? successfulTasks / tasks.length : 0;
    const avgResponseTime = successfulTasks > 0 ? totalResponseTime / successfulTasks : 0;
    const tokenEfficiency = totalTokens > 0 ? usefulTokens / totalTokens : 0;
    
    return {
      taskSuccessRate,
      avgResponseTime,
      tokenEfficiency,
      coherenceScore: this.estimateCoherenceScore(crew),
      relevanceScore: this.estimateRelevanceScore(crew)
    };
  }
  
  /**
   * Estimate coherence score based on agent outputs
   * @param crew Crew to evaluate
   * @returns Estimated coherence score (0-1)
   */
  private estimateCoherenceScore(crew: Crew): number {
    // Simplified coherence estimation based on task output consistency
    let coherenceScore = 0.5; // Default mid-point
    
    const tasks = crew.executionGraph.tasks;
    if (tasks.length <= 1) {
      return coherenceScore; // Not enough tasks to evaluate coherence
    }
    
    // Count tasks with non-empty outputs
    const tasksWithOutput = tasks.filter(task => task.output && task.output.length > 0);
    if (tasksWithOutput.length <= 1) {
      return coherenceScore;
    }
    
    // Simple heuristic: If most tasks have output, coherence is higher
    coherenceScore = Math.min(0.9, tasksWithOutput.length / tasks.length);
    
    return coherenceScore;
  }
  
  /**
   * Estimate relevance score based on task outputs
   * @param crew Crew to evaluate
   * @returns Estimated relevance score (0-1)
   */
  private estimateRelevanceScore(crew: Crew): number {
    // Simplified relevance estimation based on expected vs actual outputs
    let relevanceScore = 0.5; // Default mid-point
    
    const tasks = crew.executionGraph.tasks;
    if (tasks.length === 0) {
      return relevanceScore;
    }
    
    // Count tasks with expected outputs
    const tasksWithExpected = tasks.filter(task => 
      task.expectedOutput && task.expectedOutput.length > 0 && 
      task.output && task.output.length > 0
    );
    
    if (tasksWithExpected.length === 0) {
      return relevanceScore;
    }
    
    // Calculate average string similarity between expected and actual outputs
    // Simplified approximation
    let totalSimilarity = 0;
    for (const task of tasksWithExpected as Task[]) {
      const expected = task.expectedOutput?.toLowerCase() || '';
      const actual = task.output?.toLowerCase() || '';
      
      // Very basic similarity measurement
      const maxLength = Math.max(expected.length, actual.length);
      if (maxLength === 0) continue;
      
      // Approximate similarity based on length ratio as a simple metric
      const lengthRatio = Math.min(expected.length, actual.length) / maxLength;
      totalSimilarity += lengthRatio;
    }
    
    relevanceScore = tasksWithExpected.length > 0 ? 
      totalSimilarity / tasksWithExpected.length : 0.5;
    
    return relevanceScore;
  }
  
  /**
   * Collect historical tasks for learning
   * @param crew Crew to collect tasks from
   */
  private async collectHistoricalTasks(crew: Crew): Promise<void> {
    // Simplified implementation - store current tasks as training data
    this.trainingTasks = [...crew.executionGraph.tasks];
  }
  
  /**
   * Update historical tasks with new completed tasks
   * @param crew Crew with completed tasks
   */
  private updateHistoricalTasks(crew: Crew): void {
    // Add successfully completed tasks to training data
    const successfulTasks = crew.executionGraph.tasks.filter(task => 
      task.completed && task.output && task.output.length > 0
    );
    
    this.trainingTasks = [...this.trainingTasks, ...successfulTasks];
    
    // Limit history size for memory efficiency
    const maxHistorySize = 100;
    if (this.trainingTasks.length > maxHistorySize) {
      // Keep most recent tasks
      this.trainingTasks = this.trainingTasks.slice(-maxHistorySize);
    }
  }
  
  /**
   * Adjust task difficulty based on agent performance
   * @param crew Crew to adjust tasks for
   * @param agentResults Current agent training results
   */
  private async adjustTaskDifficulty(crew: Crew, agentResults: Record<string, AgentTrainingResult>): Promise<void> {
    // Simplified implementation of adaptive difficulty
    for (const agent of crew.agents as Agent[]) {
      const agentResult = agentResults[agent.id];
      if (!agentResult) continue;
      
      // Get tasks associated with this agent
      const agentTasks = crew.executionGraph.tasks.filter(task => task.agent?.id === agent.id);
      if (agentTasks.length === 0) continue;
      
      // Calculate agent performance level (0-1)
      const performanceLevel = agentResult.taskCount > 0 ? 
        (agentTasks.filter(task => task.completed).length / agentTasks.length) : 0.5;
      
      // Adapt task complexity based on performance
      for (const task of agentTasks as Task[]) {
        // Simple adaptation: adjust task description length/complexity
        if (performanceLevel > 0.8) {
          // Agent performing well, increase difficulty slightly
          task.description = `[Advanced] ${task.description}`;
        } else if (performanceLevel < 0.3) {
          // Agent struggling, decrease difficulty slightly
          task.description = `[Simplified] ${task.description?.replace(/\[Advanced\]\s*/, '')}`;
        }
      }
    }
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
        // Use getInstance() for the Telemetry singleton
        this.telemetry = Telemetry.getInstance({
          enabled: true,
          samplingRate: 0.5 // More memory efficient
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
        // Silently handle telemetry errors to avoid disrupting training
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
