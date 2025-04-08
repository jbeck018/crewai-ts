/**
 * FlowScheduler
 *
 * Resource-aware scheduling system for optimizing multi-flow execution,
 * implementing advanced performance optimization strategies to maximize
 * throughput while respecting system constraints.
 */
import { EventEmitter } from 'events';
import type { Flow, FlowId } from '../types.js';
import { FlowExecutionTracker } from './FlowExecutionTracker.js';
export interface SchedulableFlow {
    id: FlowId;
    flow: Flow<any>;
    priority: number;
    state: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'cancelled';
    dependencies: Set<FlowId>;
    dependents: Set<FlowId>;
    estimatedResourceUsage: ResourceEstimate;
    startTime?: number;
    endTime?: number;
    attempt: number;
    executionTime?: number;
    readyTime?: number;
    timeInQueue?: number;
}
interface ResourceEstimate {
    cpu: number;
    memory: number;
    io: number;
    network: number;
}
interface SystemResources {
    availableCpu: number;
    availableMemory: number;
    maxConcurrentIo: number;
    maxConcurrentNetwork: number;
}
export interface SchedulerOptions {
    /** Maximum concurrent flows to execute */
    maxConcurrency?: number;
    /** Whether to optimize for speed or memory */
    optimizeFor?: 'speed' | 'memory' | 'balanced';
    /** Resource limits for scheduling */
    resourceLimits?: Partial<SystemResources>;
    /** Enable predictive scheduling based on flow history */
    enablePredictiveScheduling?: boolean;
    /** Window size for adaptive scheduling algorithms */
    adaptiveWindowSize?: number;
    /** Default priority for flows (higher is more important) */
    defaultPriority?: number;
    /** Use work-stealing algorithm for load balancing */
    enableWorkStealing?: boolean;
    /** Maximum time a flow can be in queue before priority boost */
    maxQueueTime?: number;
    /** Amount to boost priority after max queue time */
    priorityBoostAmount?: number;
    /** Re-evaluate schedule after this many milliseconds */
    scheduleInterval?: number;
    /** Apply backpressure when system is overloaded */
    enableBackpressure?: boolean;
}
/**
 * FlowScheduler is responsible for determining the optimal execution order
 * of flows based on dependencies, priorities, and resource constraints.
 * It implements various performance optimizations to ensure efficient
 * flow execution in a multi-flow environment.
 */
export declare class FlowScheduler extends EventEmitter {
    private readyQueue;
    private pendingFlows;
    private runningFlows;
    private completedFlows;
    private flowMap;
    private resourceUsage;
    private timer?;
    private tracker?;
    private flowsBlockedBy;
    private flowsBlocking;
    private flowExecutionHistory;
    private lastScheduleTime;
    private priorityChanged;
    private options;
    constructor(options?: SchedulerOptions, tracker?: FlowExecutionTracker);
    /**
     * Register a flow with the scheduler
     */
    registerFlow(id: FlowId, flow: Flow<any>, options?: {
        priority?: number;
        dependencies?: FlowId[];
        resourceEstimate?: Partial<ResourceEstimate>;
    }): void;
    /**
     * Add a dependency between flows
     */
    addDependency(dependentId: FlowId, dependencyId: FlowId): void;
    /**
     * Check if adding a dependency would create a cycle
     * Using optimized DFS with visited sets
     */
    private wouldCreateCycle;
    /**
     * Start scheduling flows
     */
    start(): void;
    /**
     * Stop scheduling flows
     */
    stop(): void;
    /**
     * Reset the scheduler to initial state
     */
    reset(): void;
    /**
     * Update the set of flows that are ready to run
     * Uses optimized dependency checking
     */
    private updateReadyFlows;
    /**
     * Sort the ready queue based on priority and other factors
     * Uses optimized sorting algorithm
     */
    private sortReadyQueue;
    /**
     * Calculate resource efficiency score for a flow
     * Higher is better
     */
    private calculateResourceEfficiency;
    /**
     * Predict execution time for a flow based on historical data
     * Returns estimate in milliseconds
     */
    private predictExecutionTime;
    /**
     * Schedule flows for execution based on resources and priorities
     */
    private scheduleFlows;
    /**
     * Check if the system is overloaded and should apply backpressure
     */
    private isSystemOverloaded;
    /**
     * Execute a flow
     */
    private executeFlow;
    /**
     * Mark a flow as completed
     */
    markFlowCompleted(flowId: FlowId, success: boolean, result?: any): void;
    /**
     * Update dependent flows when a flow completes
     */
    private updateDependentFlows;
    /**
     * Check if resources can be allocated for a flow
     */
    private canAllocateResources;
    /**
     * Allocate resources for a flow
     */
    private allocateResources;
    /**
     * Release resources allocated to a flow
     */
    private releaseResources;
    /**
     * Get all scheduled flows
     */
    getFlows(): Map<FlowId, SchedulableFlow>;
    /**
     * Get a flow by ID
     */
    getFlow(flowId: FlowId): SchedulableFlow | undefined;
    /**
     * Get current scheduler stats
     */
    getStats(): {
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
export {};
//# sourceMappingURL=FlowScheduler.d.ts.map