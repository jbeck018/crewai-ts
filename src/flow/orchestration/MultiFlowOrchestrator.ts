import { EventEmitter } from 'events';
import type { FlowMemoryConnectorInterface } from '../memory/FlowMemoryConnectorInterface.js';
import { FlowOrchestrator, FlowOrchestratorOptions, FlowMetrics, FlowState, ExtendedFlow, FlowExecutionMetrics, FlowVisualizationOptions } from './interfaces/FlowOrchestrator.js';
import { FlowExecutionTracker } from './FlowExecutionTracker.js';
import { Flow, FlowId, FlowNode, FlowStatus } from '../types.js';
import { FlowData } from '../memory/FlowMemoryConnectorInterface.js';

export class MultiFlowOrchestrator extends EventEmitter implements FlowOrchestrator {
  #orchestrators: Map<string, FlowOrchestrator> = new Map();
  #tracker: FlowExecutionTracker;
  #options: Required<FlowOrchestratorOptions>;
  #pendingFlows: Map<string, ExtendedFlow<any, FlowState>> = new Map();
  #completedFlows: Map<string, ExtendedFlow<any, FlowState>> = new Map();
  #failedFlows: Map<string, ExtendedFlow<any, FlowState>> = new Map();
  #currentExecution: {
    startTime: number;
    endTime?: number;
    status: 'running' | 'completed' | 'failed';
    error?: Error;
  } = {
    startTime: 0,
    endTime: undefined,
    status: 'running'
  };
  #criticalPath: {
    flows: string[];
    time: number;
  } = { flows: [], time: 0 };
  #runningFlows: Set<string> = new Set();
  #flowExecutionTimes: Map<string, number> = new Map();
  #timeSeriesData: Array<{
    timestamp: number;
    metrics: Record<string, number>;
  }> = [];
  #errors: Map<string, Error> = new Map();
  #executionStartTime: number = 0;
  #executionEndTime?: number;
  #checkpointTimer?: NodeJS.Timeout;
  #memoryUsage: {
    initial: number;
    peak: number;
    current: number;
  } = {
    initial: 0,
    peak: 0,
    current: 0
  };
  #performanceMetrics: {
    totalExecutionTime: number;
    averageFlowTime: number;
    maxFlowTime: number;
    minFlowTime: number;
    flowCount: number;
    completedFlows: number;
    failedFlows: number;
  } = {
    totalExecutionTime: 0,
    averageFlowTime: 0,
    maxFlowTime: 0,
    minFlowTime: Infinity,
    flowCount: 0,
    completedFlows: 0,
    failedFlows: 0
  };
  #visualizationPath?: string;
  #visualizationOptions?: FlowVisualizationOptions;

  constructor(options: Partial<FlowOrchestratorOptions> = {}) {
    super();
    this.#orchestrators = new Map();
    this.#tracker = new FlowExecutionTracker();
    this.#options = {
      optimizeFor: options.optimizeFor ?? 'balanced',
      enableMemoryIntegration: options.enableMemoryIntegration ?? false,
      memoryConnector: options.memoryConnector ?? new (class implements FlowMemoryConnectorInterface<FlowState> {
        async saveState(flowId: string, state: FlowState): Promise<void> {
          // implement save state logic
        }
        async loadState(flowId: string): Promise<FlowState | null> {
          // implement load state logic
          return null;
        }
        async deleteState(flowId: string): Promise<boolean> {
          // implement delete state logic
          return true;
        }
        async saveResult(flowId: string, methodName: string, result: any): Promise<void> {
          // implement save result logic
        }
        async loadResult(flowId: string, methodName: string): Promise<any | null> {
          // implement load result logic
          return null;
        }
        async deleteResult(flowId: string): Promise<boolean> {
          // implement delete result logic
          return true;
        }
        async saveMetrics(flowId: string, metrics: Record<string, any>): Promise<void> {
          // implement save metrics logic
        }
        async loadMetrics(flowId: string): Promise<Record<string, any> | null> {
          // implement load metrics logic
          return null;
        }
        async deleteMetrics(flowId: string): Promise<boolean> {
          // implement delete metrics logic
          return true;
        }
        async saveFlowState(): Promise<void> {
          // implement save flow state logic
        }
        async loadFlowState(): Promise<FlowState | null> {
          // implement load flow state logic
          return null;
        }
        async saveConfig(flowId: string, config: Record<string, any>): Promise<void> {
          // implement save config logic
        }
        async loadConfig(flowId: string): Promise<Record<string, any> | null> {
          // implement load config logic
          return null;
        }
        async clearFlowData(flowId: string, options?: { olderThan?: number }): Promise<void> {
          // implement clear flow data logic
        }
        async getDistinctFlowIds(): Promise<string[]> {
          // implement get distinct flow ids logic
          return [];
        }
        async getFlowCount(): Promise<number> {
          // implement get flow count logic
          return 0;
        }
        async getFlowIds(): Promise<string[]> {
          // implement get flow ids logic
          return [];
        }
        async getFlowData(flowId: string): Promise<Record<string, any> | null> {
          // implement get flow data logic
          return null;
        }
        async getFlowStates(): Promise<Record<string, FlowState>> {
          // implement get flow states logic
          return {};
        }
        async getFlowResults(): Promise<Record<string, any>> {
          // implement get flow results logic
          return {};
        }
        async getFlowMetrics(): Promise<Record<string, Record<string, any>>> {
          // implement get flow metrics logic
          return {};
        }
        async saveFlowData(flowId: string, data: FlowData): Promise<void> {
          // implement save flow data logic
        }
        async loadFlowData(flowId: string, type: string): Promise<FlowData | null> {
          // implement load flow data logic
          return null;
        }
        async getAllFlowDataByType(flowId: string, type: string): Promise<FlowData[]> {
          // implement get all flow data by type logic
          return [];
        }
      })(),
      scheduler: {
        maxParallelFlows: options.scheduler?.maxParallelFlows ?? 1,
        priorityStrategy: options.scheduler?.priorityStrategy ?? 'fifo',
        backoffStrategy: options.scheduler?.backoffStrategy ?? 'exponential'
      },
      visualization: {
        enabled: options.visualization?.enabled ?? false,
        format: options.visualization?.format ?? 'png',
        outputDirectory: options.visualization?.outputDirectory ?? '.',
        includeDependencies: options.visualization?.includeDependencies ?? true,
        includeMetrics: options.visualization?.includeMetrics ?? true
      }
    };
    this.#visualizationOptions = this.#options.visualization;
    this.#executionStartTime = Date.now();
    this.#memoryUsage.initial = process.memoryUsage().heapUsed;
  }

  getOrchestrator(): FlowOrchestrator | undefined {
    return Array.from(this.#orchestrators.values())[0];
  }

  getFlowOrchestrator(flowId: string): FlowOrchestrator | undefined {
    for (const orchestrator of this.#orchestrators.values()) {
      if (orchestrator.getFlow(flowId)) {
        return orchestrator;
      }
    }
    return undefined;
  }

  registerFlow(definition: any): string {
    const orchestrator = this.getOrchestrator();
    if (!orchestrator) {
      throw new Error('No orchestrator available');
    }
    const flowId = orchestrator.registerFlow(definition);
    const flow = orchestrator.getFlow(flowId);
    if (flow) {
      this.#pendingFlows.set(flowId, flow);
    }
    return flowId;
  }

  getFlow(flowId: string): ExtendedFlow<any, FlowState> | undefined {
    return this.#pendingFlows.get(flowId) || 
           this.#completedFlows.get(flowId) || 
           this.#failedFlows.get(flowId);
  }

  removeFlow(flowId: string): void {
    const orchestrator = this.getFlowOrchestrator(flowId);
    if (orchestrator) {
      orchestrator.removeFlow(flowId);
      this.#pendingFlows.delete(flowId);
      this.#completedFlows.delete(flowId);
      this.#failedFlows.delete(flowId);
      this.#runningFlows.delete(flowId);
      this.#flowExecutionTimes.delete(flowId);
      this.#errors.delete(flowId);
    }
  }

  reset(): void {
    this.#pendingFlows.clear();
    this.#completedFlows.clear();
    this.#failedFlows.clear();
    this.#runningFlows.clear();
    this.#flowExecutionTimes.clear();
    this.#errors.clear();
    this.#executionStartTime = 0;
    this.#executionEndTime = undefined;
    this.#checkpointTimer = undefined;
    this.#performanceMetrics = {
      totalExecutionTime: 0,
      averageFlowTime: 0,
      maxFlowTime: 0,
      minFlowTime: Infinity,
      flowCount: 0,
      completedFlows: 0,
      failedFlows: 0
    };
    for (const orchestrator of this.#orchestrators.values()) {
      orchestrator.reset();
    }
  }

  execute(options?: { inputData?: Record<string, any> }): Promise<any> {
    return Promise.all(
      Array.from(this.#orchestrators.values()).map(orchestrator =>
        orchestrator.execute(options)
      )
    ).then(results => results[0]);
  }

  startFlow(flowId: string, options?: any): Promise<void> {
    const orchestrator = this.getFlowOrchestrator(flowId);
    if (!orchestrator) {
      throw new Error(`Flow ${flowId} not found`);
    }
    return orchestrator.startFlow(flowId, options);
  }

  waitForAnyFlowToComplete(): Promise<{ flowId: string; result: any } | null> {
    return Promise.race(
      Array.from(this.#orchestrators.values()).map(orchestrator =>
        orchestrator.waitForAnyFlowToComplete()
      )
    );
  }

  saveExecutionCheckpoint(): Promise<void> {
    return Promise.all(
      Array.from(this.#orchestrators.values()).map(orchestrator =>
        orchestrator.saveExecutionCheckpoint()
      )
    ).then(() => {});
  }

  loadExecutionCheckpoint(): Promise<void> {
    return Promise.all(
      Array.from(this.#orchestrators.values()).map(orchestrator =>
        orchestrator.loadExecutionCheckpoint()
      )
    ).then(() => {});
  }

  getMetrics(): FlowExecutionMetrics {
    const metrics: FlowExecutionMetrics = {
      totalExecutionTime: 0,
      flowCount: 0,
      completedFlows: 0,
      failedFlows: 0,
      pendingFlows: 0,
      runningFlows: 0,
      averageFlowExecutionTime: 0,
      medianFlowExecutionTime: 0,
      maxFlowExecutionTime: 0,
      minFlowExecutionTime: Infinity,
      p95FlowExecutionTime: 0,
      flowExecutionTimes: new Map<string, number>(),
      statusCounts: {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0
      },
      bottlenecks: [],
      timeSeriesData: [] as Array<{
        timestamp: number;
        metrics: Record<string, number>;
      }>,
      errors: new Map<string, Error>()
    };

    for (const orchestrator of this.#orchestrators.values()) {
      const orchestratorMetrics = orchestrator.getMetrics();
      if (!orchestratorMetrics) continue;

      metrics.totalExecutionTime += orchestratorMetrics.totalExecutionTime || 0;
      metrics.flowCount += orchestratorMetrics.flowCount || 0;
      metrics.completedFlows += orchestratorMetrics.completedFlows || 0;
      metrics.failedFlows += orchestratorMetrics.failedFlows || 0;
      metrics.pendingFlows += orchestratorMetrics.pendingFlows || 0;
      metrics.runningFlows += orchestratorMetrics.runningFlows || 0;

      if (orchestratorMetrics.flowExecutionTimes) {
        for (const [flowId, time] of orchestratorMetrics.flowExecutionTimes.entries()) {
          metrics.flowExecutionTimes.set(flowId, time);
        }
      }

      if (orchestratorMetrics.errors) {
        for (const [flowId, error] of orchestratorMetrics.errors.entries()) {
          metrics.errors.set(flowId, error);
        }
      }

      metrics.timeSeriesData.push(...(orchestratorMetrics.timeSeriesData || []));

      // Update status counts
      metrics.statusCounts.pending += orchestratorMetrics.statusCounts?.pending || 0;
      metrics.statusCounts.running += orchestratorMetrics.statusCounts?.running || 0;
      metrics.statusCounts.completed += orchestratorMetrics.statusCounts?.completed || 0;
      metrics.statusCounts.failed += orchestratorMetrics.statusCounts?.failed || 0;
    }

    // Calculate derived metrics
    const times = Array.from(metrics.flowExecutionTimes.values());
    if (times.length > 0) {
      metrics.averageFlowExecutionTime = times.reduce((a, b) => (a || 0) + (b || 0), 0) / times.length;
      const sortedTimes = [...times].sort((a, b) => (a || 0) - (b || 0));
      metrics.medianFlowExecutionTime = sortedTimes[Math.floor(sortedTimes.length / 2)] || 0;
      metrics.p95FlowExecutionTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
      metrics.maxFlowExecutionTime = Math.max(...times) || 0;
      metrics.minFlowExecutionTime = Math.min(...times) || Infinity;
    }

    return metrics;
  }

  getMetricsForFlow(flowId: string): FlowExecutionMetrics {
    const orchestrator = this.getFlowOrchestrator(flowId);
    const flowMetrics = orchestrator?.getMetricsForFlow(flowId);
    if (!flowMetrics) {
      throw new Error(`Metrics not available for flow ${flowId}`);
    }
    return flowMetrics;
  }

  getFlowDependencyOrder(): string[] {
    return Array.from(this.#pendingFlows.keys())
      .sort((a, b) => {
        const aMetrics = this.#pendingFlows.get(a)?.state.metrics;
        const bMetrics = this.#pendingFlows.get(b)?.state.metrics;
        
        if (!aMetrics?.dependencies?.size) return -1;
        if (!bMetrics?.dependencies?.size) return 1;
        
        return aMetrics.dependencies.size - bMetrics.dependencies.size;
      });
  }

  getFlowDependencyMatrix(): Record<string, Record<string, boolean>> {
    const matrix: Record<string, Record<string, boolean>> = {};
    for (const [flowId, flow] of this.#pendingFlows) {
      matrix[flowId] = {};
      if (flow.state.metrics?.dependencies) {
        for (const dep of flow.state.metrics.dependencies) {
          matrix[flowId][dep] = true;
        }
      }
    }
    return matrix;
  }

  getFlowDependencyTree(): Record<string, string[]> {
    const tree: Record<string, string[]> = {};
    for (const [flowId, flow] of this.#pendingFlows) {
      tree[flowId] = Array.from(flow.state.metrics?.dependencies || new Set());
    }
    return tree;
  }

  getFlowDependencyList(): Array<{ id: string; dependencies: string[] }> {
    return Array.from(this.#pendingFlows.entries()).map(([id, flow]) => ({
      id,
      dependencies: Array.from(flow.state.metrics?.dependencies || new Set())
    }));
  }

  getFlowDependencyDepth(): Record<string, number> {
    const depths: Record<string, number> = {};
    const visited = new Set<string>();

    const calculateDepth = (flowId: string, currentDepth = 0): number => {
      if (visited.has(flowId)) return depths[flowId] || currentDepth;
      visited.add(flowId);

      const flow = this.#pendingFlows.get(flowId);
      if (!flow?.state.metrics?.dependencies) {
        depths[flowId] = currentDepth;
        return currentDepth;
      }

      if (flow.state.metrics.dependencies.size === 0) {
        depths[flowId] = currentDepth;
        return currentDepth;
      }

      const maxDependencyDepth = Math.max(...Array.from(flow.state.metrics.dependencies).map(dep => 
        calculateDepth(dep, currentDepth + 1)
      ));

      depths[flowId] = maxDependencyDepth;
      return maxDependencyDepth;
    };

    for (const flowId of this.#pendingFlows.keys()) {
      calculateDepth(flowId, 0);
    }

    return depths;
  }

  getFlowDependencyWidth(): Record<string, number> {
    const widths: Record<string, number> = {};
    for (const [flowId, flow] of this.#pendingFlows) {
      widths[flowId] = flow.state.metrics?.dependencies?.size || 0;
    }
    return widths;
  }

  getFlowDependencyFanIn(): Record<string, number> {
    const fanIn: Record<string, number> = {};
    for (const [flowId, flow] of this.#pendingFlows) {
      fanIn[flowId] = flow.state.metrics?.dependencies?.size || 0;
    }
    return fanIn;
  }

  getFlowDependencyFanOut(): Record<string, number> {
    const fanOut: Record<string, number> = {};
    for (const flowId of this.#pendingFlows.keys()) {
      const flow = this.#pendingFlows.get(flowId);
      if (!flow?.state.metrics?.dependencies) continue;
      fanOut[flowId] = this.getDependentFlows(flowId).length;
    }
    return fanOut;
  }

  getFlowDependencyCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const findCycles = (flowId: string, path: string[] = []): void => {
      if (visited.has(flowId)) return;
      if (visiting.has(flowId)) {
        const cycle = path.slice(path.indexOf(flowId));
        cycle.push(flowId);
        cycles.push(cycle);
        return;
      }

      visiting.add(flowId);
      path.push(flowId);

      const flow = this.#pendingFlows.get(flowId);
      if (!flow?.state.metrics?.dependencies) return;

      for (const dep of flow.state.metrics.dependencies) {
        findCycles(dep, [...path]);
      }

      visiting.delete(flowId);
      visited.add(flowId);
    };

    for (const flowId of this.#pendingFlows.keys()) {
      findCycles(flowId, []);
    }

    return cycles;
  }

  getFlowDependencyCriticalPath(): string[] {
    const criticalPath: string[] = [];
    let maxTime = 0;

    for (const flowId of this.getFlowDependencyOrder()) {
      const flow = this.getFlow(flowId);
      if (!flow?.state.metrics?.endTime) continue;

      const flowTime = flow.state.metrics.endTime - flow.state.metrics.startTime;
      if (flowTime > maxTime) {
        maxTime = flowTime;
        criticalPath.length = 0;
        criticalPath.push(flowId);
      } else if (flowTime === maxTime) {
        criticalPath.push(flowId);
      }
    }

    return criticalPath;
  }

  getFlowDependencyCriticalPathFlows(): string[] {
    return this.getFlowDependencyCriticalPath();
  }

  getDependentFlows(flowId: string): string[] {
    const dependents = new Set<string>();
    for (const [id, flow] of this.#pendingFlows) {
      if (flow.state.metrics?.dependencies?.has(flowId)) {
        dependents.add(id);
      }
    }
    return Array.from(dependents);
  }

  getFlowGraph(): {
    nodes: Array<{ id: string }>
    edges: Array<{ from: string; to: string }>
  } {
    const nodes = Array.from(this.pendingFlows.keys()).map(id => ({ id }));
    const edges: Array<{ from: string; to: string }> = [];
    
    for (const [flowId, flow] of this.pendingFlows) {
      if (flow.state.metrics?.dependencies) {
        for (const dep of flow.state.metrics.dependencies) {
          edges.push({ from: dep, to: flowId });
        }
      }
    }

    return { nodes, edges };
  }

  getFlowDependencies(flowId: string): string[] {
    const flow = this.getFlow(flowId);
    return flow?.state.metrics?.dependencies ? Array.from(flow.state.metrics.dependencies) : [];
  }

  get nodes(): Array<{ id: string }> {
    const nodes: Array<{ id: string }> = [];
    for (const orchestrator of this.#orchestrators.values()) {
      nodes.push(...orchestrator.nodes);
    }
    return nodes;
  }

  get edges(): Array<{ from: string; to: string }> {
    const edges: Array<{ from: string; to: string }> = [];
    for (const orchestrator of this.#orchestrators.values()) {
      edges.push(...orchestrator.edges);
    }
    return edges;
  }

  get options(): Required<FlowOrchestratorOptions> {
    return this.#options;
  }

  get pendingFlows(): Map<string, ExtendedFlow<any, FlowState>> {
    return this.#pendingFlows;
  }

  get completedFlows(): Map<string, ExtendedFlow<any, FlowState>> {
    return this.#completedFlows;
  }

  get failedFlows(): Map<string, ExtendedFlow<any, FlowState>> {
    return this.#failedFlows;
  }

  get currentExecution(): {
    startTime: number;
    endTime?: number;
    status: 'running' | 'completed' | 'failed';
    error?: Error;
  } {
    return this.#currentExecution;
  }

  get criticalPath(): {
    flows: string[];
    time: number;
  } {
    return this.#criticalPath;
  }

  get runningFlows(): Set<string> {
    return this.#runningFlows;
  }

  get flowExecutionTimes(): Map<string, number> {
    return this.#flowExecutionTimes;
  }

  get timeSeriesData(): Array<{
    timestamp: number;
    metrics: Record<string, number>;
  }> {
    return this.#timeSeriesData;
  }

  get errors(): Map<string, Error> {
    return this.#errors;
  }

  get executionStartTime(): number {
    return this.#executionStartTime;
  }

  get executionEndTime(): number | undefined {
    return this.#executionEndTime;
  }

  get checkpointTimer(): NodeJS.Timeout | undefined {
    return this.#checkpointTimer;
  }

  get memoryUsage(): {
    initial: number;
    peak: number;
    current: number;
  } {
    return this.#memoryUsage;
  }

  get performanceMetrics(): {
    totalExecutionTime: number;
    averageFlowTime: number;
    maxFlowTime: number;
    minFlowTime: number;
    flowCount: number;
    completedFlows: number;
    failedFlows: number;
  } {
    return this.#performanceMetrics;
  }

  get visualizationPath(): string | undefined {
    return this.#visualizationPath;
  }

  get visualizationOptions(): FlowVisualizationOptions | undefined {
    return this.#visualizationOptions;
  }

  getOptimizedOptions(): Record<string, any> {
    const options: Record<string, any> = {
      optimizeFor: this.#options.optimizeFor,
      enableMemoryIntegration: this.#options.enableMemoryIntegration,
      scheduler: {
        maxParallelFlows: this.#options.scheduler.maxParallelFlows,
        priorityStrategy: this.#options.scheduler.priorityStrategy,
        backoffStrategy: this.#options.scheduler.backoffStrategy
      },
      visualization: this.#options.visualization
    };
    return options;
  }

  getFlowMetrics(flowId: string): FlowMetrics | undefined {
    const flow = this.getFlow(flowId);
    if (!flow?.state?.metrics) return undefined;
    return flow.state.metrics;
  }

  getFlowExecutionTime(flowId: string): number {
    const metrics = this.getFlowMetrics(flowId);
    if (!metrics?.startTime) return 0;
    const endTime = metrics.endTime ?? Date.now();
    return endTime - metrics.startTime;
  }

  getFlowResourceUsage(flowId: string): FlowMetrics['nodeExecutions'] | undefined {
    const metrics = this.getFlowMetrics(flowId);
    if (!metrics?.nodeExecutions) return undefined;
    return metrics.nodeExecutions;
  }

  getFlowStatus(flowId: string): FlowStatus {
    const flow = this.getFlow(flowId);
    return flow?.state?.status ?? 'pending';
  }

  getFlowState(flowId: string): FlowState | undefined {
    const flow = this.getFlow(flowId);
    if (!flow?.state) return undefined;
    return flow.state;
  }
}
