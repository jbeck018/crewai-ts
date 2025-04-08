/**
 * FlowExecutionTracker
 *
 * Provides optimized tracking and metrics for flow execution in the Flow Orchestration system.
 * Designed for high-performance in multi-flow environments with minimal memory footprint.
 */
import { EventEmitter } from 'events';
import type { FlowId, FlowStatus } from '../types.js';
interface FlowExecutionData {
    id: FlowId;
    status: FlowStatus;
    startTime?: number;
    endTime?: number;
    duration?: number;
    attempts: number;
    nodeExecutions: Map<string, NodeExecutionData>;
    errors: Error[];
    metadata?: Record<string, any>;
    priority?: number;
    dependencies: Set<FlowId>;
    dependents: Set<FlowId>;
    memory?: {
        bytesAllocated?: number;
        peakMemoryUsage?: number;
    };
}
interface NodeExecutionData {
    nodeId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: number;
    endTime?: number;
    duration?: number;
    attempts: number;
    result?: any;
    error?: Error;
}
export interface FlowExecutionMetrics {
    totalExecutionTime: number;
    flowCount: number;
    completedFlows: number;
    failedFlows: number;
    pendingFlows: number;
    runningFlows: number;
    averageFlowExecutionTime: number;
    medianFlowExecutionTime: number;
    maxFlowExecutionTime: number;
    minFlowExecutionTime: number;
    p95FlowExecutionTime: number;
    flowExecutionTimes: Record<FlowId, number>;
    statusCounts: Record<FlowStatus, number>;
    flowPriorities: Record<number, number>;
    bottlenecks: FlowId[];
    criticalPath?: {
        flows: FlowId[];
        totalTime: number;
    };
    timeSeriesData?: {
        timestamp: number;
        runningFlows: number;
        completedFlows: number;
        averageExecutionTime: number;
    }[];
}
export interface TrackerOptions {
    /** Enable in-depth memory tracking (adds overhead) */
    enableMemoryTracking?: boolean;
    /** Maximum number of flows to keep in history */
    maxHistorySize?: number;
    /** Interval (ms) to collect time series data, 0 to disable */
    timeSeriesInterval?: number;
    /** Maximum number of time series data points to keep */
    maxTimeSeriesPoints?: number;
    /** Automatically calculate bottlenecks */
    trackBottlenecks?: boolean;
    /** Track performance variance */
    trackVariance?: boolean;
    /** Sample rate for detailed tracking (1 = track everything, 0.5 = track 50%) */
    samplingRate?: number;
    /** Maximum errors to store per flow */
    maxErrorsPerFlow?: number;
}
/**
 * Tracks flow execution with optimized data structures and algorithms
 * for minimal overhead and maximum performance insight.
 */
export declare class FlowExecutionTracker extends EventEmitter {
    private flowData;
    private executionHistory;
    private timeSeriesData;
    private timeSeriesInterval?;
    private startTime;
    private endTime?;
    private totalDuration;
    private durations;
    private statusCounts;
    private sumDuration;
    private sumDurationSquared;
    private options;
    constructor(options?: TrackerOptions);
    /**
     * Initialize the tracker at the start of orchestration
     */
    initialize(): void;
    /**
     * Register a flow with the tracker
     */
    registerFlow(flowId: FlowId, metadata?: Record<string, any>, priority?: number): void;
    /**
     * Add dependency information for flow
     */
    addDependency(dependentId: FlowId, dependencyId: FlowId): void;
    /**
     * Record flow execution start
     */
    startFlowExecution(flowId: FlowId): void;
    /**
     * Record flow execution completion
     */
    completeFlowExecution(flowId: FlowId, success: boolean, result?: any): void;
    /**
     * Record flow execution cancellation
     */
    cancelFlowExecution(flowId: FlowId, reason?: string): void;
    /**
     * Record flow execution error
     */
    recordFlowError(flowId: FlowId, error: Error): void;
    /**
     * Record node execution start
     */
    startNodeExecution(flowId: FlowId, nodeId: string): void;
    /**
     * Record node execution completion
     */
    completeNodeExecution(flowId: FlowId, nodeId: string, success: boolean, result?: any, error?: Error): void;
    /**
     * Finalize tracking at the end of orchestration
     */
    finalize(): void;
    /**
     * Get comprehensive execution metrics (optimized for performance)
     */
    getMetrics(): FlowExecutionMetrics;
    /**
     * Get detailed data for a specific flow
     */
    getFlowData(flowId: FlowId): FlowExecutionData | undefined;
    /**
     * Start collecting time series data at regular intervals
     */
    private startTimeSeriesCollection;
    /**
     * Collect a single time series data point
     */
    private collectTimeSeriesDataPoint;
    /**
     * Reset the tracker to initial state
     */
    reset(): void;
}
export {};
//# sourceMappingURL=FlowExecutionTracker.d.ts.map