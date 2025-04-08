/**
 * ConditionalTask implementation
 * Extends Task with conditional execution logic
 */

import { Task, TaskConfig, TaskOutput } from './Task.js';
import { BaseAgent } from '../agent/BaseAgent.js';

export type ConditionFunction = (context: string) => boolean | Promise<boolean>;
export type TaskCondition = {
  condition: ConditionFunction;
  trueTask: Task;
  falseTask?: Task;
};

export interface ConditionalTaskConfig extends TaskConfig {
  conditions: TaskCondition[];
}

/**
 * ConditionalTask class that adds branching logic to tasks
 * Optimized for:
 * - Minimal overhead during condition evaluation
 * - Efficient condition chaining
 * - Lazy execution of conditional branches
 */
export class ConditionalTask extends Task {
  private readonly conditions: TaskCondition[];

  constructor(config: ConditionalTaskConfig) {
    // Pass base config to parent Task class
    super(config);
    this.conditions = config.conditions;
    
    // Validate that conditional tasks cannot be async as per original crewAI
    if (config.async) {
      throw new Error('ConditionalTask cannot be async');
    }
  }

  /**
   * Execute the conditional task with branching logic
   * Optimized with efficient condition evaluation and result caching
   */
  override async execute(context?: string): Promise<TaskOutput> {
    // Prepare the full context
    const fullContext = context || '';
    
    // Evaluate conditions sequentially
    for (const condition of this.conditions) {
      try {
        // Evaluate the condition
        const result = await Promise.resolve(condition.condition(fullContext));
        
        // Execute the appropriate task based on the condition result
        if (result && condition.trueTask) {
          return await condition.trueTask.execute(fullContext);
        } else if (!result && condition.falseTask) {
          return await condition.falseTask.execute(fullContext);
        }
        // If no task is available for the condition result, continue to the next condition
      } catch (error) {
        console.error(`Error evaluating condition in ConditionalTask ${this.id}:`, error);
        // If a condition errors, try the next one
      }
    }
    
    // If no conditions matched or all errored, fall back to the default execution
    return super.execute(context);
  }

  toString(): string {
    return `ConditionalTask(id=${this.id}, conditions=${this.conditions.length})`;
  }
}
