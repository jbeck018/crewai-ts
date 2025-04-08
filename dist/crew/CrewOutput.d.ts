/**
 * CrewOutput implementation
 * Handles the structure and formatting of crew execution results
 */
import { TaskOutput } from '../task/Task.js';
export interface CrewOutputMetrics {
    executionTime: number;
    tokenUsage: {
        total: number;
        prompt?: number;
        completion?: number;
    };
    cost?: number;
}
export interface CrewOutputConfig {
    finalOutput: string;
    taskOutputs: TaskOutput[];
    metrics: CrewOutputMetrics;
}
/**
 * CrewOutput class that represents the result of a crew execution
 * Optimized for:
 * - Efficient data access patterns
 * - Serialization performance
 * - Memory efficiency for large outputs
 */
export declare class CrewOutput {
    readonly finalOutput: string;
    readonly taskOutputs: TaskOutput[];
    readonly metrics: CrewOutputMetrics;
    readonly timestamp: number;
    constructor(config: CrewOutputConfig);
    /**
     * Get the output as a string
     */
    toString(): string;
    /**
     * Get all task results as a map of task ID to result
     * Optimized for efficient lookup
     */
    getTaskResultsMap(): Map<string, string>;
    /**
     * Get the result of a specific task by ID
     */
    getTaskResult(taskId: string): string | undefined;
    /**
     * Get a formatted summary of the crew execution
     */
    getSummary(): string;
    /**
     * Convert to JSON for serialization
     * Optimized to include only necessary data
     */
    toJSON(): Record<string, any>;
}
//# sourceMappingURL=CrewOutput.d.ts.map