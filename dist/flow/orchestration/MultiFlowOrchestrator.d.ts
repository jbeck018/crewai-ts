/**
 * MultiFlowOrchestrator
 *
 * High-performance orchestration system that integrates all flow orchestration components
 * with advanced optimizations for memory efficiency, execution speed, and resource management.
 */
import { EventEmitter } from 'events';
import type { Flow, FlowId, FlowState } from '../types.js';
import { type SchedulerOptions } from './FlowScheduler.js';
import { type FlowVisualizationOptions } from './FlowDependencyVisualizer.js';
import { FlowMemoryConnector } from '../memory/FlowMemoryConnector.js';
export interface FlowDefinition<TState extends FlowState = FlowState> {
    flow: Flow<TState>;
    id?: FlowId;
    name?: string;
    description?: string;
    priority?: number;
    tags?: string[];
    dependencies?: FlowId[];
    resourceEstimate?: {
        cpu?: number;
        memory?: number;
        io?: number;
        network?: number;
    };
    condition?: (context: any) => boolean | Promise<boolean>;
    dataMapping?: (upstreamResults: any) => any;
    metadata?: Record<string, any>;
    retryConfig?: {
        maxAttempts: number;
        backoffFactor: number;
        initialDelayMs: number;
    };
}
export interface MultiFlowOrchestratorOptions {
    /** Performance optimization target */
    optimizeFor?: 'speed' | 'memory' | 'balanced';
    /** Enable memory integration */
    enableMemoryIntegration?: boolean;
    /** Memory connector */
    memoryConnector?: FlowMemoryConnector;
    /** Scheduler options */
    scheduler?: SchedulerOptions;
    /** Flow execution settings */
    execution?: {
        /** Maximum concurrent flows */
        maxConcurrency?: number;
        /** Global flow timeout in milliseconds */
        timeout?: number;
        /** Default retry count for failed flows */
        retryCount?: number;
        /** Interval to checkpoint execution state */
        checkpointInterval?: number;
        /** Use optimistic execution mode */
        optimisticExecution?: boolean;
        /** Execution strategy: breadth-first or depth-first */
        strategy?: 'breadth-first' | 'depth-first';
    };
    /** Memory optimization settings */
    memory?: {
        /** Aggressively clean up completed flow states */
        aggressiveCleanup?: boolean;
        /** Share immutable state between flows when possible */
        enableStateSharing?: boolean;
        /** Memory budgets in MB before throttling */
        budgetMB?: number;
        /** Compression level for persisted states */
        compressionLevel?: 'none' | 'fast' | 'high';
    };
    /** Metrics and monitoring */
    metrics?: {
        /** Enable detailed performance tracking */
        enableDetailedTracking?: boolean;
        /** Sample rate for performance metrics */
        samplingRate?: number;
        /** Export metrics to console */
        exportToConsole?: boolean;
        /** Maximum metrics history size */
        maxHistorySize?: number;
    };
    /** Debug settings */
    debug?: {
        /** Enable verbose logging */
        verbose?: boolean;
        /** Log level */
        logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    };
    /** Visualization settings */
    visualization?: FlowVisualizationOptions;
}
export interface MultiFlowExecutionResult {
    results: Map<FlowId, any>;
    metrics: {
        totalExecutionTime: number;
        flowsExecuted: number;
        flowsSucceeded: number;
        flowsFailed: number;
        averageFlowExecutionTime: number;
        peakMemoryUsageMB: number;
        criticalPathTime: number;
    };
    errors?: Map<FlowId, Error>;
    visualizationPath?: string;
}
/**
 * MultiFlowOrchestrator integrates the execution tracker, scheduler, visualizer,
 * and memory connector to provide a comprehensive system for orchestrating
 * multiple flows with optimized performance and resource utilization.
 */
export declare class MultiFlowOrchestrator extends EventEmitter {
    private flows;
    private orchestrator;
    private tracker;
    private scheduler;
    private visualizer?;
    private memoryConnector?;
    private resultCache;
    private initialMemoryUsage;
    private peakMemoryUsage;
    private executionStartTime;
    private executionEndTime?;
    private criticalPathTime;
    private criticalPathFlows;
    private options;
    constructor(options?: MultiFlowOrchestratorOptions);
    /**
     * Set up internal event handlers with optimized event flow
     */
    private setupEventHandlers;
    /**
     * Track memory usage for performance monitoring
     */
    private updateMemoryUsage;
    /**
     * Register a flow with the orchestration system
     */
    registerFlow<TState extends FlowState>(definition: FlowDefinition<TState>): FlowId;
    /**
     * Add a dependency between flows
     */
    addDependency(dependencyId: FlowId, dependentId: FlowId, options?: {
        condition?: (result: any) => boolean | Promise<boolean>;
        dataMapping?: (result: any) => any;
    }): void;
    /**
     * Execute all registered flows with optimized multi-flow orchestration
     */
    execute(options?: {
        inputData?: Record<string, any>;
        generateVisualization?: boolean;
    }): Promise<MultiFlowExecutionResult>;
    /**
     * Calculate the critical execution path
     */
    private calculateCriticalPath;
    /**
     * Generate visualization of flow dependencies and execution
     */
    visualizeFlows(): Promise<string>;
    /**
     * Clean up memory for completed flows
     */
    private cleanupMemory;
    /**
     * Get detailed execution metrics
     */
    getMetrics(): {
        message: string;
        execution?: undefined;
        memory?: undefined;
        bottlenecks?: undefined;
        flowExecutionTimes?: undefined;
        timeSeriesData?: undefined;
    } | {
        execution: {
            totalTime: number;
            flowsExecuted: number;
            flowsSucceeded: number;
            flowsFailed: number;
            flowsPending: number;
            averageFlowTime: number;
            medianFlowTime: number;
            maxFlowTime: number;
            criticalPathTime: number;
            criticalPathFlows: string[];
        };
        memory: {
            initialUsageMB: number;
            peakUsageMB: number;
            deltaMB: number;
        };
        bottlenecks: string[];
        flowExecutionTimes: Record<string, number>;
        timeSeriesData: {
            timestamp: number;
            runningFlows: number;
            completedFlows: number;
            averageExecutionTime: number;
        }[] | undefined;
        message?: undefined;
    };
    /**
     * Reset the orchestrator to initial state
     */
    reset(): void;
    /**
     * Get a registered flow definition
     */
    getFlowDefinition(flowId: FlowId): FlowDefinition | undefined;
    /**
     * Get a flow by ID
     */
    getFlow(flowId: FlowId): Flow<any> | undefined;
    /**
     * Get all registered flows
     */
    getFlows(): Map<FlowId, FlowDefinition>;
    /**
     * Get the flow dependency graph
     */
    getFlowGraph(): any;
    /**
     * Get scheduler statistics
     */
    getSchedulerStats(): {
        pendingCount: number;
        readyCount: number;
        runningCount: number;
        completedCount: number;
        totalFlows: number;
        resourceUsage: {
            availableCpu: number;
            availableMemory: number;
            maxConcurrentIo: number;
            maxConcurrentNetwork: number;
        };
    };
}
//# sourceMappingURL=MultiFlowOrchestrator.d.ts.map