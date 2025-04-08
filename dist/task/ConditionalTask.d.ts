/**
 * ConditionalTask implementation
 * Extends Task with conditional execution logic
 */
import { Task, TaskConfig, TaskOutput } from './Task.js';
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
export declare class ConditionalTask extends Task {
    private readonly conditions;
    constructor(config: ConditionalTaskConfig);
    /**
     * Execute the conditional task with branching logic
     * Optimized with efficient condition evaluation and result caching
     */
    execute(context?: string): Promise<TaskOutput>;
    toString(): string;
}
//# sourceMappingURL=ConditionalTask.d.ts.map