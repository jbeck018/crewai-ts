/**
 * ToolUsage implementation
 * Tracks tool usage statistics and provides analytics
 * Optimized for low memory footprint and efficient access patterns
 */
/**
 * ToolUsageTracker class for monitoring and analyzing tool usage
 * Optimized for:
 * - Low memory footprint with retention policy
 * - Efficient aggregation calculations
 * - Fast access to usage statistics
 */
export class ToolUsageTracker {
    executions = new Map();
    stats = new Map();
    maxEntries;
    constructor(options) {
        // Default to storing last 1000 entries per tool
        this.maxEntries = options?.maxEntriesPerTool ?? 1000;
    }
    /**
     * Record a tool execution
     * Updates both detailed history and aggregated stats with one pass
     */
    recordExecution(execution, metadata) {
        const { toolName, tags } = metadata;
        const timestamp = Date.now();
        // Create execution data entry
        const executionData = {
            toolName,
            timestamp,
            executionTime: execution.executionTime ?? 0,
            success: execution.success,
            cached: execution.cached ?? false,
            error: execution.error,
            tags
        };
        // Update execution history with retention policy
        if (!this.executions.has(toolName)) {
            this.executions.set(toolName, []);
        }
        const toolExecutions = this.executions.get(toolName);
        toolExecutions.push(executionData);
        // Apply retention policy if needed
        if (toolExecutions.length > this.maxEntries) {
            // Remove oldest entries (faster than splice for large arrays)
            this.executions.set(toolName, toolExecutions.slice(-this.maxEntries));
        }
        // Update aggregated stats
        this.updateStats(toolName, executionData);
    }
    /**
     * Get usage statistics for a specific tool
     */
    getToolStats(toolName) {
        return this.stats.get(toolName);
    }
    /**
     * Get usage statistics for all tools
     */
    getAllToolStats() {
        return new Map(this.stats);
    }
    /**
     * Get recent executions for a specific tool
     */
    getToolExecutions(toolName, limit) {
        const executions = this.executions.get(toolName) || [];
        if (limit && limit < executions.length) {
            // Return most recent executions
            return executions.slice(-limit);
        }
        return [...executions]; // Return a copy to prevent modification
    }
    /**
     * Clear all usage data
     */
    clear() {
        this.executions.clear();
        this.stats.clear();
    }
    /**
     * Update aggregated statistics for a tool
     * Efficiently updates stats in a single pass
     */
    updateStats(toolName, execution) {
        // Get or initialize stats
        const existingStats = this.stats.get(toolName);
        const stats = existingStats ?? {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            cachedExecutions: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
        };
        // Update counts
        stats.totalExecutions++;
        if (execution.success)
            stats.successfulExecutions++;
        else
            stats.failedExecutions++;
        if (execution.cached)
            stats.cachedExecutions++;
        // Update timing information
        stats.totalExecutionTime += execution.executionTime;
        stats.averageExecutionTime = stats.totalExecutionTime /
            (stats.totalExecutions - stats.cachedExecutions || 1); // Avoid division by zero
        // Update timestamps
        stats.firstExecution = stats.firstExecution ?? execution.timestamp;
        stats.lastExecution = execution.timestamp;
        // Track most common error
        if (!execution.success && execution.error) {
            // Create error counting map if needed
            const errorCounts = stats.errorCounts ?? new Map();
            const currentCount = (errorCounts.get(execution.error) ?? 0) + 1;
            errorCounts.set(execution.error, currentCount);
            // Update most common error if needed
            if (!stats.mostCommonError ||
                (stats.mostCommonErrorCount ?? 0) < currentCount) {
                stats.mostCommonError = execution.error;
                stats.mostCommonErrorCount = currentCount;
            }
            // Store back the error counts
            stats.errorCounts = errorCounts;
        }
        // Save updated stats
        this.stats.set(toolName, stats);
    }
}
// Create a singleton instance for global usage tracking
export const globalToolUsageTracker = new ToolUsageTracker();
//# sourceMappingURL=ToolUsage.js.map