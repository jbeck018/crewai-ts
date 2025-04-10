/**
 * Crew Agent Executor Mixin
 * Handles agent execution with memory management and human feedback capabilities
 * Optimized for performance and memory efficiency
 */

import { BaseAgent } from '../BaseAgent.js';
import { Task } from '../../task/Task.js';
import { EntityMemoryItem, LongTermMemoryItem, TaskEvaluation } from './types/index.js';

// Placeholder for TaskEvaluator until fully implemented
class TaskEvaluator {
  constructor(private agent: BaseAgent) {}
  
  async evaluate(task: Task, outputText: string): Promise<TaskEvaluation | null> {
    // Simplified implementation for now
    return {
      quality: 0.8,
      suggestions: ['Consider adding more details'],
      entities: []
    };
  }
}

// Task evaluation is now imported from types/index.js

/**
 * Options for the executor mixin
 */
export interface ExecutorOptions {
  /** Whether to enable memory storage */
  memory?: boolean;
  /** Whether to enable human feedback */
  humanInTheLoop?: boolean;
  /** Number of iterations before stopping */
  maxIterations?: number;
  /** Whether to enable training mode */
  trainingMode?: boolean;
  /** Custom printer implementation */
  printer?: any; // Will be properly typed later
}

/**
 * Executor result type
 */
export interface ExecutorResult {
  text: string;
  [key: string]: any;
}

/**
 * Crew Agent Executor Mixin
 * 
 * This mixin provides memory management and human feedback functionality
 * for agent execution with performance optimizations.
 */
export class CrewAgentExecutorMixin {
  private crew: any; // Will be properly typed when Crew is implemented
  private agent: BaseAgent;
  private task: Task;
  private iterations: number = 0;
  private maxIterations: number;
  private memoryEnabled: boolean;
  private humanInTheLoop: boolean;
  private trainingMode: boolean;
  private printer: any; // Will be properly typed later
  
  /**
   * Constructor for the executor mixin
   * @param agent Agent being executed
   * @param task Task being executed
   * @param crew Crew the agent belongs to (optional)
   * @param options Execution options
   */
  constructor(
    agent: BaseAgent,
    task: Task,
    crew?: any,
    options: ExecutorOptions = {}
  ) {
    this.agent = agent;
    this.task = task;
    this.crew = crew;
    this.maxIterations = options.maxIterations ?? 15;
    this.memoryEnabled = options.memory ?? true;
    this.humanInTheLoop = options.humanInTheLoop ?? false;
    this.trainingMode = options.trainingMode ?? false;
    this.printer = options.printer ?? {
      print: (content: string, color?: string) => {
        console.log(content);
      }
    };
  }
  
  /**
   * Process the execution result
   * Updates memory and handles human feedback
   * @param result Execution result
   * @returns The processed result
   */
  async processResult(result: ExecutorResult): Promise<ExecutorResult> {
    // Track iterations
    this.iterations++;
    
    // Only process if we have a crew with memory
    if (this.memoryEnabled && this.crew) {
      // Create short term memory if applicable
      await this.createShortTermMemory(result);
      
      // Create long term memory if applicable
      await this.createLongTermMemory(result);
    }
    
    // Handle human feedback if enabled
    if (this.humanInTheLoop) {
      const feedback = await this.askHumanInput(result.text);
      if (feedback) {
        // If feedback was provided, attach it to the result
        return {
          ...result,
          humanFeedback: feedback
        };
      }
    }
    
    return result;
  }
  
  /**
   * Create and save a short-term memory item if conditions are met
   * Optimized with error handling and validation
   * @param output Execution output
   */
  private async createShortTermMemory(output: ExecutorResult): Promise<void> {
    try {
      if (
        this.crew &&
        this.agent &&
        this.task &&
        !output.text.includes('Action: Delegate work to coworker') &&
        this.crew.hasShortTermMemory() // This method would be implemented in the Crew class
      ) {
        await this.crew.addToShortTermMemory(
          output.text,
          {
            observation: this.task.description,
          },
          this.agent.role
        );
      }
    } catch (error) {
      console.error('Failed to add to short term memory:', error);
    }
  }
  
  /**
   * Create and save long-term and entity memory items based on evaluation
   * Optimized for async operations and error handling
   * @param output Execution output
   */
  private async createLongTermMemory(output: ExecutorResult): Promise<void> {
    try {
      if (
        this.crew &&
        this.crew.hasMemory() && // This method would be implemented in the Crew class
        this.crew.hasLongTermMemory() && // This method would be implemented in the Crew class
        this.crew.hasEntityMemory() && // This method would be implemented in the Crew class
        this.task &&
        this.agent
      ) {
        // Create task evaluator
        const evaluator = new TaskEvaluator(this.agent);
        const evaluation = await evaluator.evaluate(this.task, output.text);
        
        if (!evaluation) {
          return;
        }
        
        // Create and save long term memory
        const longTermMemory: LongTermMemoryItem = {
          task: this.task.description,
          agent: this.agent.role,
          quality: evaluation.quality,
          datetime: Date.now().toString(),
          expectedOutput: this.task.expectedOutput,
          metadata: {
            suggestions: evaluation.suggestions,
            quality: evaluation.quality,
          },
        };
        
        await this.crew.addToLongTermMemory(longTermMemory);
        
        // Create and save entity memories
        for (const entity of evaluation.entities) {
          const entityMemory: EntityMemoryItem = {
            name: entity.name,
            type: entity.type,
            description: entity.description,
            relationships: entity.relationships.map((r: string) => `- ${r}`).join('\n'),
          };
          
          await this.crew.addToEntityMemory(entityMemory);
        }
      }
    } catch (error) {
      console.error('Failed to add to long term memory:', error);
    }
  }
  
  /**
   * Prompt human input with mode-appropriate messaging
   * @param finalAnswer Final answer to present to the human
   * @returns Human feedback or empty string if no feedback
   */
  private async askHumanInput(finalAnswer: string): Promise<string> {
    this.printer.print(
      `## Final Result: ${finalAnswer}`,
      'green'
    );
    
    let prompt: string;
    
    // Different prompts based on mode
    if (this.trainingMode) {
      // Training mode prompt (single iteration)
      prompt = [
        '\n\n=====\n',
        '## TRAINING MODE: Provide feedback to improve the agent\'s performance.',
        'This will be used to train better versions of the agent.',
        'Please provide detailed feedback about the result quality and reasoning process.',
        '=====\n'
      ].join('\n');
    } else {
      // Regular human-in-the-loop prompt (multiple iterations)
      prompt = [
        '\n\n=====\n',
        '## HUMAN FEEDBACK: Provide feedback on the Final Result and Agent\'s actions.',
        'Please follow these guidelines:',
        ' - If you are happy with the result, simply hit Enter without typing anything.',
        ' - Otherwise, provide specific improvement requests.',
        ' - You can provide multiple rounds of feedback until satisfied.',
        '=====\n'
      ].join('\n');
    }
    
    this.printer.print(prompt, 'yellow');
    
    // In a real implementation, this would get input from the user
    // For now, we'll just return an empty string
    return '';
  }
  
  /**
   * Get the current iteration count
   * @returns Number of iterations executed
   */
  getIterations(): number {
    return this.iterations;
  }
  
  /**
   * Check if the execution has reached the maximum number of iterations
   * @returns True if max iterations reached, false otherwise
   */
  hasReachedMaxIterations(): boolean {
    return this.iterations >= this.maxIterations;
  }
}
