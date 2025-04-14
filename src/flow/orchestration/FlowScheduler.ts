/**
 * FlowScheduler
 * 
 * Resource-aware scheduling system for optimizing multi-flow execution,
 * implementing advanced performance optimization strategies to maximize
 * throughput while respecting system constraints.
 */

import { EventEmitter } from 'events';
import type { FlowId } from '../types.js';
import { FlowExecutionTracker } from './FlowExecutionTracker.js';

declare global {
  namespace NodeJS {
    interface Process {
      cpuUsage(): { user: number; system: number; };
    }
  }
}

// Optimized data structures for scheduling
interface ResourceEstimate {
  cpu: number;
  memory: number;
  io: number;
  network: number;
}

interface ResourceUsage extends ResourceEstimate {
  availableCpu: number;
  availableMemory: number;
  maxConcurrentIo: number;
  maxConcurrentNetwork: number;
}

interface ResourceLimits {
  availableCpu: number;
  availableMemory: number;
  maxConcurrentIo: number;
  maxConcurrentNetwork: number;
}

interface SystemResources {
  availableCpu: number;
  availableMemory: number;
  maxConcurrentIo: number;
  maxConcurrentNetwork: number;
}

interface FlowSchedulerMetrics {
  averageFlowExecutionTime: number;
  maxFlowExecutionTime: number;
  minFlowExecutionTime: number;
  completedFlows: number;
  failedFlows: number;
}

interface FlowExecutionMetrics {
  startTime: number;
  endTime: number;
  executionTime: number;
  duration: number;
  resourceUsage?: ResourceUsage;
  error?: Error;
}

interface Flow<T> {
  execute(): Promise<T>;
  id: string;
}

interface SchedulableFlow {
  id: string;
  flow: any;
  resourceUsage?: ResourceUsage;
  estimatedResourceUsage?: ResourceEstimate;
  metrics?: FlowExecutionMetrics;
  state: string;
  readyTime?: number;
  timeInQueue?: number;
  priority: number;
  dependencies: Set<string>;
  dependents: Set<string>;
  attempt: number;
  errors: Error[];
  startTime?: number;
  endTime?: number;
  executionTime?: number;
}

export interface SchedulerOptions {
  /** Maximum concurrent flows to execute */
  maxConcurrency?: number;
  /** Whether to optimize for speed or memory */
  optimizeFor?: 'speed' | 'memory' | 'balanced';
  /** Resource limits for scheduling */
  resourceLimits?: Partial<ResourceLimits>;
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

export interface FlowSchedulerOptions extends SchedulerOptions {
  tracker?: FlowExecutionTracker;
}

export class FlowScheduler extends EventEmitter {
  private readyQueue: SchedulableFlow[] = [];
  private pendingFlows: Map<string, SchedulableFlow> = new Map();
  private runningFlows: Map<string, SchedulableFlow> = new Map();
  private completedFlows: Map<string, SchedulableFlow> = new Map();
  private failedFlows: Map<string, SchedulableFlow> = new Map();
  private flowMap: Map<string, SchedulableFlow> = new Map();
  private resourceUsage!: ResourceUsage;
  private timer?: NodeJS.Timeout;
  private tracker: FlowExecutionTracker;
  private metrics!: {
    averageFlowExecutionTime: number;
    maxFlowExecutionTime: number;
    minFlowExecutionTime: number;
    completedFlows: number;
    failedFlows: number;
  };
  private logger: Console = console;

  // Performance optimization: pre-computed dependency resolution maps
  private flowsBlockedBy: Map<string, Set<string>> = new Map();
  private flowsBlocking: Map<string, Set<string>> = new Map();

  // Performance history for predictive scheduling
  private flowExecutionHistory: Map<string, number[]> = new Map(); // flowType -> execution times
  private lastScheduleTime: number = 0;

  // Priority queue indexing for O(log n) operations
  private priorityChanged: boolean = false;

  private options: Required<FlowSchedulerOptions>;

  constructor(options: FlowSchedulerOptions = {}, tracker?: FlowExecutionTracker) {
    super();

    // Default options optimized for performance
    const defaultOptions: Required<FlowSchedulerOptions> = {
      maxConcurrency: 10,
      optimizeFor: 'balanced',
      resourceLimits: {
        availableCpu: navigator?.hardwareConcurrency ?? 4,
        availableMemory: 1024,
        maxConcurrentIo: 10,
        maxConcurrentNetwork: 10
      },
      enablePredictiveScheduling: true,
      adaptiveWindowSize: 5,
      defaultPriority: 0,
      enableWorkStealing: true,
      maxQueueTime: 60000,
      priorityBoostAmount: 10,
      scheduleInterval: 1000,
      enableBackpressure: true,
      tracker: tracker || new FlowExecutionTracker()
    };

    this.options = { ...defaultOptions, ...options };
    this.tracker = this.options.tracker;

    // Initialize resources and metrics
    this.initializeResources();
    this.initializeMetrics();

    // Initialize collections
    this.readyQueue = [];
    this.pendingFlows = new Map<string, SchedulableFlow>();
    this.runningFlows = new Map<string, SchedulableFlow>();
  }

  private initializeResources(): void {
    this.resourceUsage = {
      cpu: 0,
      memory: 0,
      io: 0,
      network: 0,
      availableCpu: this.options.resourceLimits.availableCpu ?? 4,
      availableMemory: this.options.resourceLimits.availableMemory ?? 1024,
      maxConcurrentIo: this.options.resourceLimits.maxConcurrentIo ?? 10,
      maxConcurrentNetwork: this.options.resourceLimits.maxConcurrentNetwork ?? 10
    };
  }

  private initializeMetrics(): void {
    this.metrics = {
      averageFlowExecutionTime: 0,
      maxFlowExecutionTime: 0,
      minFlowExecutionTime: Infinity,
      completedFlows: 0,
      failedFlows: 0
    };
  }

  /**
   * Register a flow with the scheduler
   */
  registerFlow(
    id: string, 
    flow: Flow<any>, 
    options: {
      priority?: number;
      dependencies?: string[];
      resourceEstimate?: Partial<ResourceEstimate>;
    } = {}
  ): void {
    const flowData: SchedulableFlow = {
      id,
      flow,
      priority: options.priority || this.options.defaultPriority,
      state: 'pending',
      dependencies: new Set(options.dependencies || []),
      dependents: new Set(),
      estimatedResourceUsage: {
        cpu: options.resourceEstimate?.cpu ?? 0.1,
        memory: options.resourceEstimate?.memory ?? 10,
        io: options.resourceEstimate?.io ?? 0.1,
        network: options.resourceEstimate?.network ?? 0.1
      },
      attempt: 0,
      executionTime: undefined,
      errors: []
    };

    this.flowMap.set(id, flowData);
    this.pendingFlows.set(id, flowData);

    // Update dependency maps
    for (const dep of flowData.dependencies) {
      const blockers = this.flowsBlocking.get(dep) || new Set();
      blockers.add(id);
      this.flowsBlocking.set(dep, blockers);

      const blockedBy = this.flowsBlockedBy.get(id) || new Set();
      blockedBy.add(dep);
      this.flowsBlockedBy.set(id, blockedBy);
    }

    // Update tracker if available
    if (this.tracker) {
      this.tracker.registerFlow(id);
    }

    this.emit('flow_registered', { id, priority: flowData.priority });
  }

  /**
   * Add a dependency between flows
   */
  addDependency(dependentId: string, dependencyId: string): void {
    const dependent = this.flowMap.get(dependentId);
    const dependency = this.flowMap.get(dependencyId);

    if (!dependent || !dependency) {
      throw new Error('Flow not registered');
    }

    if (this.wouldCreateCycle(dependentId, dependencyId)) {
      throw new Error('Dependency would create cycle');
    }

    dependent.dependencies.add(dependencyId);
    dependency.dependents.add(dependentId);

    // Update dependency maps
    const blockers = this.flowsBlocking.get(dependencyId) || new Set();
    blockers.add(dependentId);
    this.flowsBlocking.set(dependencyId, blockers);

    const blockedBy = this.flowsBlockedBy.get(dependentId) || new Set();
    blockedBy.add(dependencyId);
    this.flowsBlockedBy.set(dependentId, blockedBy);

    // Update tracker if available
    if (this.tracker) {
      this.tracker.addDependency(dependentId, dependencyId);
    }

    this.emit('dependency_added', { dependentId, dependencyId });
  }

  /**
   * Start scheduling flows
   */
  start(): void {
    this.lastScheduleTime = performance.now();

    // Initial update of ready flows
    this.updateReadyFlows();

    // Set up periodic scheduling
    if (this.options.scheduleInterval > 0) {
      this.timer = setInterval(() => {
        this.scheduleFlows();
      }, this.options.scheduleInterval);
    }

    // Immediate first scheduling
    this.scheduleFlows();
  }

  /**
   * Stop scheduling flows
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Reset the scheduler to initial state
   */
  reset(): void {
    this.stop();
    this.readyQueue = [];
    this.pendingFlows.clear();
    this.runningFlows.clear();
    this.completedFlows.clear();
    this.failedFlows.clear();
    this.flowMap.clear();
    this.flowsBlockedBy.clear();
    this.flowsBlocking.clear();

    // Reset resource usage
    this.resetResources();

    this.emit('scheduler_reset');
  }

  private resetResources(): void {
    const limits = this.options.resourceLimits;
    this.resourceUsage = {
      cpu: 0,
      memory: 0,
      io: 0,
      network: 0,
      availableCpu: limits?.availableCpu ?? 4,
      availableMemory: limits?.availableMemory ?? 1024,
      maxConcurrentIo: limits?.maxConcurrentIo ?? 10,
      maxConcurrentNetwork: limits?.maxConcurrentNetwork ?? 10
    };
    this.emit('scheduler_reset');
  }

  /**
   * Update the set of flows that are ready to run
   * Uses optimized dependency checking
   */
  private updateReadyFlows(): void {
    // Check all pending flows
    for (const [id, flow] of this.pendingFlows.entries()) {
      // Get flows blocking this one with O(1) lookup
      const blockers = this.flowsBlockedBy.get(id);

      // Flow is ready if it has no blockers or all blockers are completed
      if (!blockers || blockers.size === 0 || 
          Array.from(blockers).every(blockerId => {
            const blocker = this.flowMap.get(blockerId);
            return blocker && blocker.state === 'completed';
          })) {
        // Move from pending to ready
        flow.state = 'ready';
        flow.readyTime = performance.now();
        this.addFlowToReadyQueue(flow);
      }
    }

    // Sort ready queue if needed
    if (this.readyQueue.length > 1) {
      this.sortReadyQueue();
    }
  }

  /**
   * Sort the ready queue based on priority and other factors
   * Uses optimized sorting algorithm
   */
  private sortReadyQueue(): void {
    const now = performance.now();

    // Apply priority boosts based on queue time
    if (this.options.maxQueueTime > 0) {
      for (const flow of this.readyQueue) {
        if (flow.readyTime && now - flow.readyTime > this.options.maxQueueTime) {
          // Calculate time in queue
          flow.timeInQueue = now - flow.readyTime;

          // Apply priority boost to prevent starvation
          const boostFactor = Math.floor(flow.timeInQueue / this.options.maxQueueTime);
          const boost = boostFactor * this.options.priorityBoostAmount;

          // Apply boost (up to a maximum reasonable value)
          flow.priority = Math.min(flow.priority + boost, 100);
        }
      }
    }

    // Sort by multiple factors for optimal scheduling
    this.readyQueue.sort((a, b) => {
      // Priority is the primary factor (higher values first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // If priorities are equal, use predicted execution time (shorter first)
      if (this.options.enablePredictiveScheduling) {
        const aTime = this.predictExecutionTime(a);
        const bTime = this.predictExecutionTime(b);
        if (aTime !== bTime) {
          return aTime - bTime; // Shorter first
        }
      }

      // If still tied, use resource efficiency (higher efficiency first)
      const aEfficiency = this.calculateResourceEfficiency(a);
      const bEfficiency = this.calculateResourceEfficiency(b);
      if (aEfficiency !== bEfficiency) {
        return bEfficiency - aEfficiency;
      }

      // Finally, use readiness time (earlier first)
      return (a.readyTime || 0) - (b.readyTime || 0);
    });
  }

  /**
   * Add flow to ready queue
   */
  private addFlowToReadyQueue(flow: SchedulableFlow): void {
    flow.state = 'pending';
    flow.readyTime = performance.now();
    this.readyQueue.push(flow);
    this.readyQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Mark flow as ready
   */
  private markFlowAsReady(flow: SchedulableFlow): void {
    flow.state = 'pending';
    flow.readyTime = performance.now();
    this.addFlowToReadyQueue(flow);
  }

  /**
   * Calculate resource efficiency score for a flow
   * Higher is better
   */
  private calculateResourceEfficiency(flow: SchedulableFlow): number {
    const usage = flow.estimatedResourceUsage || {
      cpu: 0,
      memory: 0,
      io: 0,
      network: 0
    };
    const { availableCpu, availableMemory, maxConcurrentIo, maxConcurrentNetwork } = this.resourceUsage;

    // Calculate resource utilization percentage
    const cpuUtil = usage.cpu / availableCpu;
    const memUtil = usage.memory / availableMemory;
    const ioUtil = usage.io / maxConcurrentIo;
    const netUtil = usage.network / maxConcurrentNetwork;

    // Calculate efficiency as 1 - max utilization
    return 1 - Math.max(cpuUtil, memUtil, ioUtil, netUtil);
  }

  /**
   * Predict execution time for a flow based on historical data
   * Returns estimate in milliseconds
   */
  private predictExecutionTime(flow: SchedulableFlow): number {
    // Use default values if resource estimates are not provided
    const resourceEstimate = flow.estimatedResourceUsage || {
      cpu: 1,
      memory: 10,
      io: 1,
      network: 1
    };

    // Simple linear model based on resource estimates
    // CPU time + Memory time + IO time + Network time
    return (
      resourceEstimate.cpu * 1000 + // CPU time in ms (assuming 1 core = 1000ms)
      resourceEstimate.memory * 0.1 + // Memory time (1MB = 0.1ms)
      resourceEstimate.io * 10 + // IO time (1 operation = 10ms)
      resourceEstimate.network * 50 // Network time (1 operation = 50ms)
    );
  }

  /**
   * Schedule flows for execution based on resources and priorities
   */
  private scheduleFlows(): void {
    const now = performance.now();
    this.lastScheduleTime = now;

    // Check for completed running flows
    for (const [id, flow] of this.runningFlows.entries()) {
      // If flow is actually done (external signal), mark as completed
      if (flow.state === 'completed' || flow.state === 'failed') {
        this.runningFlows.delete(id);
        this.completedFlows.set(id, flow);

        // Release resources
        this.updateResourceUsage(flow, false);

        // Record execution time for predictive scheduling
        if (flow.startTime && flow.endTime && this.options.enablePredictiveScheduling) {
          const executionTime = flow.endTime - flow.startTime;
          const flowType = flow.flow.constructor.name;
          const history = this.flowExecutionHistory.get(flowType);
          if (history) {
            history.push(executionTime);
            // Keep history bounded
            if (history.length > 100) {
              history.shift();
            }
          }
        }

        // Update dependents
        this.updateDependentFlows(id);
      }
    }

    // Update ready flows before scheduling
    this.updateReadyFlows();

    // Schedule flows until we hit resource limits or no more ready flows
    while (this.readyQueue.length > 0) {
      // Check if we've hit concurrency limit
      if (this.runningFlows.size >= this.options.maxConcurrency) {
        break;
      }

      // Check if we should apply backpressure
      if (this.options.enableBackpressure && this.isSystemOverloaded()) {
        break;
      }

      // Get highest priority flow
      const flow = this.readyQueue.shift();
      if (!flow) break;

      // Check if resources are available
      if (!this.canScheduleFlow(flow)) {
        // Put back at head of queue for next scheduling cycle
        this.readyQueue.unshift(flow);
        break;
      }

      // Allocate resources and execute
      this.updateResourceUsage(flow, true);
      this.executeFlow(flow);
    }

    // Emit stats event
    this.emit('scheduler_stats', {
      pendingCount: this.pendingFlows.size,
      readyCount: this.readyQueue.length,
      runningCount: this.runningFlows.size,
      completedCount: this.completedFlows.size,
      totalFlows: this.flowMap.size,
      resourceUsage: { ...this.resourceUsage }
    });
  }

  /**
   * Check if the system is overloaded and should apply backpressure
   */
  private isSystemOverloaded(): boolean {
    // Simple overload detection
    const cpuPercentage = 1 - (this.resourceUsage.availableCpu / 
      (this.options.resourceLimits.availableCpu || 4));

    const memoryPercentage = 1 - (this.resourceUsage.availableMemory / 
      (this.options.resourceLimits.availableMemory || 1024));

    // System is overloaded if either CPU or memory usage is above 90%
    return cpuPercentage > 0.9 || memoryPercentage > 0.9;
  }

  /**
   * Execute a flow
   */
  private async executeFlow(flow: SchedulableFlow): Promise<void> {
    const startTime = Date.now();
    try {
      await flow.flow.execute();
      const duration = Date.now() - startTime;
      this.metrics = {
        ...this.metrics,
        averageFlowExecutionTime: (this.metrics.averageFlowExecutionTime * this.metrics.completedFlows + duration) / (this.metrics.completedFlows + 1),
        maxFlowExecutionTime: Math.max(this.metrics.maxFlowExecutionTime, duration),
        minFlowExecutionTime: Math.min(this.metrics.minFlowExecutionTime, duration),
        completedFlows: this.metrics.completedFlows + 1
      };
      this.markFlowCompleted(flow.id, true);
      this.updateDependentFlows(flow.id);
    } catch (error) {
      this.metrics = {
        ...this.metrics,
        failedFlows: this.metrics.failedFlows + 1
      };
      this.markFlowCompleted(flow.id, false);
      throw error;
    }
  }

  private markFlowCompleted(flowId: string, success: boolean): void {
    const flow = this.runningFlows.get(flowId);
    if (!flow) return;

    if (this.tracker) {
      const metrics = flow.metrics || {
        startTime: flow.startTime || 0,
        endTime: Date.now(),
        executionTime: 0,
        duration: 0,
        resourceUsage: flow.resourceUsage
      };
      
      if (success) {
        this.tracker.completeFlow(flowId, metrics);
      } else {
        // Pass the error object if it exists
        const error = metrics.error;
        if (error) {
          this.tracker.failFlow(flowId, error);
        } else {
          this.tracker.failFlow(flowId, new Error('Flow execution failed'));
        }
      }
    }

    if (success) {
      this.completedFlows.set(flowId, flow);
    } else {
      this.failedFlows.set(flowId, flow);
    }
    this.runningFlows.delete(flowId);
    this.emit(success ? 'flow_completed' : 'flow_failed', { flowId });
  }

  /**
   * Update the set of flows that are dependent on a given flow
   */
  private updateDependentFlows(flowId: string): void {
    const dependents = this.flowsBlocking.get(flowId);
    if (!dependents) return;

    for (const dependentId of dependents) {
      const blockers = this.flowsBlockedBy.get(dependentId);
      if (blockers) {
        blockers.delete(flowId);
        const dependent = this.flowMap.get(dependentId);
        if (dependent && blockers.size === 0) {
          dependent.state = 'ready';
          dependent.readyTime = performance.now();
          this.addFlowToReadyQueue(dependent);
          this.sortReadyQueue();
        }
      }
    }
  }

  /**
   * Check if adding a dependency would create a cycle
   * Using optimized DFS with visited sets
   */
  private wouldCreateCycle(from: string, to: string): boolean {
    const visited = new Set<string>();
    const stack = [to]; // Start from the dependency

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (current === from) {
        return true; // Would create a cycle
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      // Add all dependents to the stack
      const dependents = this.flowsBlocking.get(current);
      if (dependents) {
        for (const dependent of dependents) {
          stack.push(dependent);
        }
      }
    }

    return false;
  }

  /**
   * Start flow execution
   */
  startFlowExecution(flowId: string): void {
    const flow = this.flowMap.get(flowId);
    if (!flow) {
      throw new Error('Flow not found');
    }

    if (flow.state !== 'ready') {
      throw new Error('Flow not ready to start');
    }

    this.executeFlow(flow);
  }

  /**
   * Get all scheduled flows
   */
  getFlows(): Map<string, SchedulableFlow> {
    return new Map(this.flowMap);
  }

  /**
   * Get a flow by ID
   */
  getFlow(flowId: string): SchedulableFlow | undefined {
    return this.flowMap.get(flowId);
  }

  /**
   * Get current scheduler stats
   */
  getStats() {
    return {
      pendingCount: this.pendingFlows.size,
      readyCount: this.readyQueue.length,
      runningCount: this.runningFlows.size,
      completedCount: this.completedFlows.size,
      totalFlows: this.flowMap.size,
      resourceUsage: { ...this.resourceUsage }
    };
  }

  private updateResourceUsage(flow: SchedulableFlow, isStarting: boolean): void {
    const resourceUsage = flow.resourceUsage || flow.estimatedResourceUsage;
    if (!resourceUsage) return;

    // Create a safe copy of the resource usage with default values
    const safeUsage: ResourceEstimate = {
      cpu: resourceUsage.cpu ?? 0,
      memory: resourceUsage.memory ?? 0,
      io: resourceUsage.io ?? 0,
      network: resourceUsage.network ?? 0
    };

    if (!this.resourceUsage) {
      this.resourceUsage = {
        cpu: 0,
        memory: 0,
        io: 0,
        network: 0,
        availableCpu: 4,
        availableMemory: 1024,
        maxConcurrentIo: 10,
        maxConcurrentNetwork: 10
      };
    }

    if (isStarting) {
      this.resourceUsage.cpu = (this.resourceUsage.cpu ?? 0) + safeUsage.cpu;
      this.resourceUsage.memory = (this.resourceUsage.memory ?? 0) + safeUsage.memory;
      this.resourceUsage.io = (this.resourceUsage.io ?? 0) + safeUsage.io;
      this.resourceUsage.network = (this.resourceUsage.network ?? 0) + safeUsage.network;
    } else {
      this.resourceUsage.cpu = Math.max(0, (this.resourceUsage.cpu ?? 0) - safeUsage.cpu);
      this.resourceUsage.memory = Math.max(0, (this.resourceUsage.memory ?? 0) - safeUsage.memory);
      this.resourceUsage.io = Math.max(0, (this.resourceUsage.io ?? 0) - safeUsage.io);
      this.resourceUsage.network = Math.max(0, (this.resourceUsage.network ?? 0) - safeUsage.network);
    }
  }

  private handleFlowError(flowId: string, error: Error | number): void {
    const flow = this.runningFlows.get(flowId);
    if (!flow) return;

    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(`Flow execution failed: ${errorMessage}`);
    
    // Update flow metrics with error information
    if (flow.metrics) {
      flow.metrics.error = error instanceof Error ? error : new Error(errorMessage);
    }
    
    this.markFlowCompleted(flowId, false);
  }

  private canScheduleFlow(flow: SchedulableFlow): boolean {
    if (!this.resourceUsage) {
      return false;
    }

    const usage = this.calculateResourceUsage(flow);
    return (
      (this.resourceUsage.availableCpu || 0) >= usage.cpu &&
      (this.resourceUsage.availableMemory || 0) >= usage.memory &&
      (this.resourceUsage.maxConcurrentIo || 0) >= usage.io &&
      (this.resourceUsage.maxConcurrentNetwork || 0) >= usage.network
    );
  }

  private calculateResourceUsage(flow: SchedulableFlow): ResourceEstimate {
    const usage = flow.resourceUsage || flow.estimatedResourceUsage;
    return usage || {
      cpu: 0,
      memory: 0,
      io: 0,
      network: 0
    };
  }

  private getResourceUsage(): ResourceUsage {
    if (!this.resourceUsage) {
      this.resourceUsage = {
        cpu: 0,
        memory: 0,
        io: 0,
        network: 0,
        availableCpu: 4,
        availableMemory: 1024,
        maxConcurrentIo: 10,
        maxConcurrentNetwork: 10
      };
    }

    const memoryUsage = process.memoryUsage();
    return {
      cpu: 0,
      memory: memoryUsage ? memoryUsage.heapUsed / 1024 / 1024 : 0,
      io: 0,
      network: 0,
      availableCpu: this.resourceUsage.availableCpu || 4,
      availableMemory: this.resourceUsage.availableMemory || 1024,
      maxConcurrentIo: this.resourceUsage.maxConcurrentIo || 10,
      maxConcurrentNetwork: this.resourceUsage.maxConcurrentNetwork || 10
    };
  }

  private scheduleFlow(flowId: string): void {
    const flow = this.getFlow(flowId);
    if (!flow) return;

    if (!this.resourceUsage) {
      this.initializeResources();
    }

    if (this.canScheduleFlow(flow)) {
      this.updateResourceUsage(flow, true);
      this.runningFlows.set(flowId, flow);
      this.executeFlow(flow);
    } else {
      this.pendingFlows.set(flowId, flow);
    }
  }

  private updateFlowMetrics(flowId: string): void {
    const flow = this.getFlow(flowId);
    if (!flow?.metrics) return;

    const now = performance.now();
    flow.metrics.executionTime = now - (flow.metrics.startTime || now);
    flow.metrics.duration = flow.metrics.executionTime;
  }

  private getFlowMetrics(flowId: string): FlowExecutionMetrics | null {
    const flow = this.getFlow(flowId);
    return flow?.metrics || null;
  }

  private getFlowExecutionTime(flowId: string): number {
    const metrics = this.getFlowMetrics(flowId);
    if (!metrics || !metrics.startTime || !metrics.endTime) {
      return 0;
    }
    return metrics.endTime - metrics.startTime;
  }

  private getFlowResourceUsage(flowId: string): ResourceUsage | null {
    const metrics = this.getFlowMetrics(flowId);
    return metrics?.resourceUsage || null;
  }
}
