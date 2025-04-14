/**
 * FlowExecutionTracker
 * 
 * Provides optimized tracking and metrics for flow execution in the Flow Orchestration system.
 * Designed for high-performance in multi-flow environments with minimal memory footprint.
 */

import { EventEmitter } from 'events';

// Optimized data structures for tracking flow execution metrics
interface FlowExecutionData {
  id: string;
  status: FlowStatus;
  startTime?: number;
  endTime?: number;
  duration?: number;
  attempts: number;
  nodeExecutions: Map<string, NodeExecutionData>;
  errors: Error[];
  metadata?: Record<string, any>;
  priority?: number;
  dependencies: Set<string>;
  dependents: Set<string>;
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

export type FlowStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'canceled';

export interface FlowMetrics {
  startTime: number | undefined;
  endTime?: number | undefined;
  duration?: number | undefined;
  status: FlowStatus;
  attempts: number;
  error?: Error | undefined;
  result?: any;
  nodeExecutions?: Map<string, NodeExecutionData> | undefined;
  metadata?: Record<string, any> | undefined;
  dependencies?: Set<string> | undefined;
  dependents?: Set<string> | undefined;
  resourceUsage?: {
    cpu: number | undefined;
    memory: number | undefined;
    io: number | undefined;
    network: number | undefined;
  };
  memory?: {
    bytesAllocated?: number | undefined;
    peakMemoryUsage?: number | undefined;
  };
  priority?: number | undefined;
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
export class FlowExecutionTracker extends EventEmitter {
  private flowData: Map<string, FlowMetrics>;
  private durations: number[] = [];
  private totalDuration = 0;
  private statusCounts: {
    pending: number;
    ready: number;
    running: number;
    completed: number;
    failed: number;
    canceled: number;
  } = {
    pending: 0,
    ready: 0,
    running: 0,
    completed: 0,
    failed: 0,
    canceled: 0
  };
  private bottlenecks: string[] = [];
  private timeSeriesData: Array<{
    timestamp: number;
    metrics: Record<string, number>;
  }> = [];
  private startTime: number;
  private endTime?: number;

  constructor(options: TrackerOptions = {}) {
    super();
    this.flowData = new Map();
    this.startTime = Date.now();
    this.statusCounts = {
      pending: 0,
      ready: 0,
      running: 0,
      completed: 0,
      failed: 0,
      canceled: 0
    };
  }

  registerFlow(flowId: string): void {
    if (!this.flowData.has(flowId)) {
      const startTime = Date.now();
      this.flowData.set(flowId, {
        startTime,
        endTime: undefined,
        duration: undefined,
        status: 'pending' as const,
        attempts: 0,
        error: undefined,
        result: undefined,
        nodeExecutions: new Map(),
        metadata: {},
        dependencies: new Set(),
        dependents: new Set()
      } as FlowMetrics);
      this.statusCounts.pending++;
      this.emit('flowStart', flowId);
    }
  }

  addDependency(flowId: string, dependencyId: string): void {
    const flow = this.flowData.get(flowId);
    const dependency = this.flowData.get(dependencyId);
    
    if (!flow || !dependency) {
      throw new Error('Flow not registered');
    }

    if (flow.dependencies) {
      flow.dependencies.add(dependencyId);
    }
    if (dependency.dependents) {
      dependency.dependents.add(flowId);
    }
  }

  startFlow(flowId: string): void {
    const metrics = this.getFlowMetrics(flowId);
    if (!metrics) {
      throw new Error('Flow not found');
    }

    if (metrics.startTime) {
      throw new Error('Flow already started');
    }

    metrics.startTime = Date.now();
    metrics.status = 'running' as const;
    metrics.attempts = (metrics.attempts || 0) + 1;

    this.statusCounts.pending--;
    this.statusCounts.running++;
    this.emit('flowStarted', flowId);
  }

  completeFlow(flowId: string, result: any): void {
    const metrics = this.getFlowMetrics(flowId);
    if (!metrics) {
      throw new Error('Flow not found');
    }

    if (!metrics.startTime) {
      throw new Error('Flow not started');
    }

    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.result = result;
    metrics.status = 'completed' as const;

    this.durations.push(metrics.duration);
    this.totalDuration += metrics.duration;
    this.statusCounts.running--;
    this.statusCounts.completed++;

    this.emit('flowCompleted', flowId);
  }

  failFlow(flowId: string, error: Error): void {
    const metrics = this.getFlowMetrics(flowId);
    if (!metrics) {
      throw new Error('Flow not found');
    }

    if (!metrics.startTime) {
      throw new Error('Flow not started');
    }

    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.error = error;
    metrics.status = 'failed' as const;

    this.durations.push(metrics.duration);
    this.totalDuration += metrics.duration;
    this.statusCounts.running--;
    this.statusCounts.failed++;

    this.emit('flowFailed', flowId);
  }

  cancelFlow(flowId: string): void {
    const metrics = this.getFlowMetrics(flowId);
    if (!metrics) {
      throw new Error('Flow not found');
    }

    if (!metrics.startTime) {
      throw new Error('Flow not started');
    }

    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.status = 'canceled' as const;

    if (typeof metrics.duration === 'number') {
      this.durations.push(metrics.duration);
      this.totalDuration += metrics.duration;
    }
    this.statusCounts.running--;
    this.statusCounts.canceled++;

    this.emit('flowCanceled', flowId);
  }

  resetFlow(flowId: string): void {
    const metrics = this.getFlowMetrics(flowId);
    if (!metrics) {
      throw new Error('Flow not found');
    }

    // Reset timestamps
    metrics.startTime = undefined;
    metrics.endTime = undefined;
    metrics.duration = undefined;

    // Reset error and result
    metrics.error = undefined;
    metrics.result = undefined;
    metrics.status = 'pending' as const;

    // Reset counts safely
    if (this.statusCounts.running > 0) this.statusCounts.running--;
    if (this.statusCounts.completed > 0) this.statusCounts.completed--;
    if (this.statusCounts.failed > 0) this.statusCounts.failed--;
    if (this.statusCounts.canceled > 0) this.statusCounts.canceled--;
    this.statusCounts.pending++;

    // Reset flow metrics
    metrics.duration = undefined;
    if (metrics.nodeExecutions) {
      metrics.nodeExecutions.clear();
    }
    metrics.attempts = 0;
    metrics.metadata = undefined;
    metrics.priority = undefined;
    if (metrics.dependencies) {
      metrics.dependencies.clear();
    }
    if (metrics.dependents) {
      metrics.dependents.clear();
    }
    metrics.memory = undefined;
    metrics.resourceUsage = undefined;

    this.emit('flowReset', flowId);
  }

  private getFlowMetrics(flowId: string): FlowMetrics | undefined {
    return this.flowData.get(flowId);
  }

  getFlowExecutionTime(flowId: string): number {
    const metrics = this.getFlowMetrics(flowId);
    if (!metrics || !metrics.startTime) return 0;
    return (metrics.endTime ?? Date.now()) - metrics.startTime;
  }

  getFlowStatus(flowId: string): FlowStatus {
    const metrics = this.getFlowMetrics(flowId);
    if (!metrics) {
      return 'pending';
    }
    return metrics.status;
  }

  getFlowError(flowId: string): Error | undefined {
    const metrics = this.getFlowMetrics(flowId);
    return metrics?.error;
  }

  getFlowResult(flowId: string): any {
    const metrics = this.getFlowMetrics(flowId);
    return metrics?.result;
  }

  getFlowCount(): number {
    return this.flowData.size;
  }

  getCompletedFlows(): number {
    return this.statusCounts.completed;
  }

  getFailedFlows(): number {
    return this.statusCounts.failed;
  }

  getRunningFlows(): number {
    return this.statusCounts.running;
  }

  getPendingFlows(): number {
    return this.statusCounts.pending;
  }

  getCanceledFlows(): number {
    return this.statusCounts.canceled;
  }

  getReadyFlows(): number {
    return this.statusCounts.ready;
  }

  getBottlenecks(): string[] {
    return [...this.bottlenecks];
  }

  getTimeSeriesData(): Array<{
    timestamp: number;
    metrics: Record<string, number>;
  }> {
    return [...this.timeSeriesData];
  }

  async saveExecutionCheckpoint(): Promise<void> {
    const checkpointData = {
      flowData: Array.from(this.flowData.entries()),
      durations: this.durations,
      totalDuration: this.totalDuration,
      statusCounts: this.statusCounts,
      bottlenecks: this.bottlenecks,
      timeSeriesData: this.timeSeriesData,
    };
    
    // Save to memory or file system
    // Implementation depends on the persistence strategy
    // For now, we'll just store in memory
    localStorage.setItem('flowExecutionCheckpoint', JSON.stringify(checkpointData));
  }

  async loadExecutionCheckpoint(): Promise<void> {
    const checkpointData = JSON.parse(localStorage.getItem('flowExecutionCheckpoint') || '{}');
    
    this.flowData = new Map(checkpointData.flowData);
    this.durations = checkpointData.durations;
    this.totalDuration = checkpointData.totalDuration;
    this.statusCounts = checkpointData.statusCounts;
    this.bottlenecks = checkpointData.bottlenecks;
    this.timeSeriesData = checkpointData.timeSeriesData;
  }

  async waitForAnyFlowToComplete(): Promise<string | undefined> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        for (const [flowId, metrics] of this.flowData.entries()) {
          if (metrics.status === 'completed' || metrics.status === 'failed' || metrics.status === 'canceled') {
            resolve(flowId);
            return;
          }
        }
        setTimeout(checkCompletion, 100);
      };
      checkCompletion();
    });
  }

  reset(): void {
    this.flowData.clear();
    this.durations = [];
    this.totalDuration = 0;
    this.statusCounts = {
      pending: 0,
      ready: 0,
      running: 0,
      completed: 0,
      failed: 0,
      canceled: 0
    };
    this.bottlenecks = [];
    this.timeSeriesData = [];
    this.startTime = Date.now();
    this.endTime = undefined;
  }

  private collectTimeSeriesDataPoint(): void {
    const timestamp = Date.now();
    const avgTime = this.durations.length > 0 ? this.totalDuration / this.durations.length : 0;
    this.timeSeriesData.push({
      timestamp,
      metrics: {
        runningFlows: this.statusCounts.running,
        completedFlows: this.statusCounts.completed,
        averageExecutionTime: avgTime,
      },
    });

    if (this.timeSeriesData.length > 1000) {
      this.timeSeriesData.shift();
    }
  }

  startTracking(): void {
    this.startTime = Date.now();
    this.collectTimeSeriesDataPoint();
    setInterval(() => this.collectTimeSeriesDataPoint(), 1000);
  }

  stopTracking(): void {
    this.endTime = Date.now();
    this.collectTimeSeriesDataPoint();
  }

  private updateBottlenecks(): void {
    const flowTimes = Array.from(this.flowData.entries())
      .filter(([_, metrics]) => metrics?.endTime !== undefined)
      .map(([id, metrics]) => [id, metrics?.duration ?? 0] as [string, number]);

    const sortedTimes = flowTimes.sort(([, a], [, b]) => b - a);
    const top10 = sortedTimes.slice(0, 10);
    this.bottlenecks = top10.map(([id]) => id);
  }

  private calculateMedian(): number {
    const sorted = [...this.durations].sort((a, b) => (a ?? 0) - (b ?? 0));
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length === 0) return 0;
    const lower = sorted[mid - 1] ?? 0;
    const upper = sorted[mid] ?? 0;
    return sorted.length % 2 !== 0 ? upper : (lower + upper) / 2;
  }

  private calculateP95(): number {
    const sorted = [...this.durations].sort((a, b) => (a ?? 0) - (b ?? 0));
    const index = Math.floor(sorted.length * 0.95);
    if (sorted.length === 0) return 0;
    return sorted[index] ?? 0;
  }

  getMetrics(): FlowExecutionMetrics {
    const flowExecutionTimes = new Map(
      Array.from(this.flowData.entries()).map(([flowId, metrics]) => [
        flowId,
        metrics.duration ?? 0
      ])
    );

    const durations = Array.from(this.flowData.values())
      .map(metrics => metrics.duration ?? 0)
      .filter(d => d > 0);

    const maxTime = Math.max(...durations, 0);
    const minTime = Math.min(...durations, maxTime);
    const medianTime = durations.length > 0 ? durations.sort()[Math.floor(durations.length / 2)] : 0;

    return {
      flowExecutionTimes,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime,
      averageFlowExecutionTime: this.durations.length > 0 ? this.totalDuration / this.durations.length : 0,
      medianFlowExecutionTime: medianTime,
      maxFlowExecutionTime: maxTime === 0 ? 0 : maxTime,
      minFlowExecutionTime: minTime,
      completedFlows: this.statusCounts.completed,
      failedFlows: this.statusCounts.failed,
      pendingFlows: this.statusCounts.pending,
      runningFlows: this.statusCounts.running,
      readyFlows: this.statusCounts.ready,
      canceledFlows: this.statusCounts.canceled,
      bottlenecks: [...this.bottlenecks],
      timeSeriesData: this.timeSeriesData
    };
  }

  updateDependencies(flowId: string, dependencies: string[]): void {
    const flow = this.flowData.get(flowId);
    if (!flow) return;

    dependencies.forEach(dependencyId => {
      const dependency = this.flowData.get(dependencyId);
      if (!dependency) return;

      if (flow.dependencies) {
        flow.dependencies.delete(dependencyId);
      }
      if (dependency.dependents) {
        dependency.dependents.delete(flowId);
      }

      this.emit('dependenciesUpdated', flowId, dependencyId);
    });
  }

  updateFlowMetrics(flowId: string): void {
    const flow = this.flowData.get(flowId);
    if (!flow) return;
    
    const now = Date.now();
    flow.duration = (flow.endTime ?? now) - (flow.startTime ?? now);
    flow.resourceUsage = {
      cpu: flow.resourceUsage?.cpu ?? 0,
      memory: flow.resourceUsage?.memory ?? 0,
      io: flow.resourceUsage?.io ?? 0,
      network: flow.resourceUsage?.network ?? 0
    };
  }

  getFlowResourceUsage(flowId: string): FlowResourceUsage | undefined {
    const metrics = this.getFlowMetrics(flowId);
    if (!metrics?.resourceUsage) return undefined;
    return {
      cpu: metrics.resourceUsage.cpu ?? 0,
      memory: metrics.resourceUsage.memory ?? 0,
      io: metrics.resourceUsage.io ?? 0,
      network: metrics.resourceUsage.network ?? 0
    };
  }
}

export interface FlowExecutionMetrics {
  flowExecutionTimes: Map<string, number | undefined>;
  startTime: number;
  endTime: number | undefined;
  duration: number;
  averageFlowExecutionTime: number | undefined;
  medianFlowExecutionTime: number | undefined;
  maxFlowExecutionTime: number | undefined;
  minFlowExecutionTime: number | undefined;
  completedFlows: number;
  failedFlows: number;
  pendingFlows: number;
  runningFlows: number;
  readyFlows: number;
  canceledFlows: number;
  bottlenecks: string[];
  timeSeriesData: Array<{
    timestamp: number;
    metrics: Record<string, number>;
  }>;
}

export interface FlowResourceUsage {
  cpu: number;
  memory: number;
  io: number;
  network: number;
}
