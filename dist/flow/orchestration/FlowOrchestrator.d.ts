/**
 * FlowOrchestrator
 *
 * Coordinates execution of multiple flows with optimized performance,
 * dependency management, and shared memory integration.
 */
import { EventEmitter } from 'events';
import { Flow, FlowState } from '../index.js';
import { FlowMemoryConnector } from '../memory/FlowMemoryConnector.js';
type FlowId = string;
export interface FlowExecutionOptions {
    maxConcurrency?: number;
    timeout?: number;
    retryCount?: number;
    retryDelay?: number;
    failFast?: boolean;
    enableProfiling?: boolean;
    checkpointInterval?: number;
    inputData?: Record<string, any>;
}
export interface FlowOrchestratorOptions {
    enableMemoryIntegration?: boolean;
    memoryConnector?: FlowMemoryConnector;
    execution?: FlowExecutionOptions;
    optimizeFor?: 'memory' | 'speed' | 'balanced';
}
/**
 * Manages and coordinates execution of multiple flows with optimized
 * dependency resolution and parallel execution.
 */
export declare class FlowOrchestrator {
    events: EventEmitter;
    private nodes;
    private edges;
    private pendingFlows;
    private runningFlows;
    private completedFlows;
    private failedFlows;
    private executionStartTime;
    private executionEndTime;
    private flowExecutionTimes;
    private checkpointTimer;
    private memoryConnector?;
    private options;
    private executionOptions;
    constructor(options?: FlowOrchestratorOptions);
    /**
     * Apply optimization preset based on orchestrator options
     */
    private getOptimizedOptions;
    /**
     * Register a flow with the orchestrator
     */
    registerFlow<TState extends FlowState>(flow: Flow<TState>, options?: {
        id?: string;
        priority?: number;
        metadata?: Record<string, any>;
    }): FlowId;
    /**
     * Add a dependency between flows
     */
    addDependency(fromId: FlowId, toId: FlowId, options?: {
        condition?: (fromResult: any) => boolean;
        dataMapping?: (fromResult: any) => any;
    }): void;
    /**
     * Check if adding dependency would create a cycle
     */
    private wouldCreateCycle;
    /**
     * Get flows that are ready to execute (all dependencies satisfied)
     */
    private getReadyFlows;
    /**
     * Execute all registered flows with optimized scheduling
     */
    execute(options?: FlowExecutionOptions): Promise<Map<FlowId, any>>;
    /**
     * Start execution of a flow with optimized data passing
     */
    private startFlow;
    /**
     * Wait for any running flow to complete with optimized promise racing
     */
    private waitForAnyFlowToComplete;
    /**
     * Save execution checkpoint with optimized state serialization
     */
    private saveExecutionCheckpoint;
    /**
     * Restore execution from checkpoint
     */
    restoreFromCheckpoint(checkpointData: any): Promise<void>;
    /**
     * Get execution metrics with performance data
     */
    getExecutionMetrics(): any;
    /**
     * Calculate the critical path through the dependency graph
     */
    private calculateCriticalPath;
    /**
     * Calculate the execution time of the critical path
     */
    private calculateCriticalPathTime;
    /**
     * Get a visualization of the flow dependency graph
     */
    getFlowGraph(): any;
}
export {};
//# sourceMappingURL=FlowOrchestrator.d.ts.map