/**
 * CrewOutput implementation
 * Handles the structure and formatting of crew execution results
 */
/**
 * CrewOutput class that represents the result of a crew execution
 * Optimized for:
 * - Efficient data access patterns
 * - Serialization performance
 * - Memory efficiency for large outputs
 */
export class CrewOutput {
    finalOutput;
    taskOutputs;
    metrics;
    timestamp;
    constructor(config) {
        this.finalOutput = config.finalOutput;
        this.taskOutputs = config.taskOutputs;
        this.metrics = config.metrics;
        this.timestamp = Date.now();
    }
    /**
     * Get the output as a string
     */
    toString() {
        return this.finalOutput;
    }
    /**
     * Get all task results as a map of task ID to result
     * Optimized for efficient lookup
     */
    getTaskResultsMap() {
        const map = new Map();
        for (const output of this.taskOutputs) {
            map.set(output.metadata.taskId, output.result);
        }
        return map;
    }
    /**
     * Get the result of a specific task by ID
     */
    getTaskResult(taskId) {
        const output = this.taskOutputs.find(o => o.metadata.taskId === taskId);
        return output?.result;
    }
    /**
     * Get a formatted summary of the crew execution
     */
    getSummary() {
        const executionTimeSeconds = this.metrics.executionTime / 1000;
        return [
            `Execution completed in ${executionTimeSeconds.toFixed(2)}s`,
            `Total tokens used: ${this.metrics.tokenUsage.total}`,
            `Tasks executed: ${this.taskOutputs.length}`,
            `Final output length: ${this.finalOutput.length} characters`,
        ].join('\n');
    }
    /**
     * Convert to JSON for serialization
     * Optimized to include only necessary data
     */
    toJSON() {
        return {
            finalOutput: this.finalOutput,
            taskOutputs: this.taskOutputs,
            metrics: this.metrics,
            timestamp: this.timestamp,
        };
    }
}
//# sourceMappingURL=CrewOutput.js.map