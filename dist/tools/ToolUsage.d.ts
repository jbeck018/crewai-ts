/**
 * ToolUsage implementation
 * Tracks tool usage statistics and provides analytics
 * Optimized for low memory footprint and efficient access patterns
 */
import { ToolExecutionResult } from './BaseTool.js';
/**
 * Detailed information about a single tool execution
 */
export interface ToolExecutionData {
    /** Tool name */
    toolName: string;
    /** Execution timestamp */
    timestamp: number;
    /** Execution duration in milliseconds */
    executionTime: number;
    /** Whether the execution was successful */
    success: boolean;
    /** Whether the result was from cache */
    cached: boolean;
    /** Error message if execution failed */
    error?: string;
    /** Tags associated with the tool */
    tags?: string[];
}
/**
 * Aggregated usage statistics for a tool
 */
export interface ToolStats {
    /** Total number of executions */
    totalExecutions: number;
    /** Number of successful executions */
    successfulExecutions: number;
    /** Number of failed executions */
    failedExecutions: number;
    /** Number of cached executions */
    cachedExecutions: number;
    /** Total execution time in milliseconds */
    totalExecutionTime: number;
    /** Average execution time in milliseconds */
    averageExecutionTime: number;
    /** Most common error message */
    mostCommonError?: string;
    /** Frequency of most common error */
    mostCommonErrorCount?: number;
    /** First execution timestamp */
    firstExecution?: number;
    /** Last execution timestamp */
    lastExecution?: number;
}
/**
 * ToolUsageTracker class for monitoring and analyzing tool usage
 * Optimized for:
 * - Low memory footprint with retention policy
 * - Efficient aggregation calculations
 * - Fast access to usage statistics
 */
export declare class ToolUsageTracker {
    private executions;
    private stats;
    private maxEntries;
    constructor(options?: {
        maxEntriesPerTool?: number;
    });
    /**
     * Record a tool execution
     * Updates both detailed history and aggregated stats with one pass
     */
    recordExecution(execution: ToolExecutionResult, metadata: {
        toolName: string;
        tags?: string[];
    }): void;
    /**
     * Get usage statistics for a specific tool
     */
    getToolStats(toolName: string): ToolStats | undefined;
    /**
     * Get usage statistics for all tools
     */
    getAllToolStats(): Map<string, ToolStats>;
    /**
     * Get recent executions for a specific tool
     */
    getToolExecutions(toolName: string, limit?: number): ToolExecutionData[];
    /**
     * Clear all usage data
     */
    clear(): void;
    /**
     * Update aggregated statistics for a tool
     * Efficiently updates stats in a single pass
     */
    private updateStats;
}
export declare const globalToolUsageTracker: ToolUsageTracker;
//# sourceMappingURL=ToolUsage.d.ts.map