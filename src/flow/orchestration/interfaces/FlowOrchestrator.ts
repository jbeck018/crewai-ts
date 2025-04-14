import { EventEmitter } from 'node:events';
import type { FlowMemoryConnectorInterface } from '../../memory/FlowMemoryConnectorInterface.js';

export interface FlowMetrics {
  duration: number;
  startTime: number;
  endTime: number | undefined;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: Error;
  result?: any;
  nodeExecutions: Map<string, any>;
  attempts: number;
  errors: Error[];
  metadata: Record<string, any>;
  dependencies: Set<string>;
  dependents: Set<string>;
}

export interface FlowState {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  error?: Error;
  result?: any;
  metrics?: FlowMetrics;
}

export interface ExtendedFlow<T, TState extends FlowState> {
  id: string;
  definition: T;
  state: TState;
  metrics: FlowMetrics;
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
  flowExecutionTimes: Map<string, number>;
  statusCounts: Record<'pending' | 'running' | 'completed' | 'failed', number>;
  bottlenecks: string[];
  timeSeriesData: Array<{
    timestamp: number;
    metrics: Record<string, number>;
  }>;
  errors: Map<string, Error>;
}

export interface FlowVisualizationOptions {
  enabled: boolean;
  format: 'png' | 'svg' | 'dot';
  outputDirectory: string;
  includeDependencies: boolean;
  includeMetrics: boolean;
}

export interface FlowOrchestratorOptions {
  optimizeFor: 'speed' | 'memory' | 'balanced';
  enableMemoryIntegration: boolean;
  memoryConnector?: FlowMemoryConnectorInterface<FlowState>;
  scheduler: {
    maxParallelFlows?: number;
    priorityStrategy?: 'fifo' | 'lifo' | 'priority';
    backoffStrategy?: 'exponential' | 'linear' | 'constant';
  };
  visualization: FlowVisualizationOptions;
}

export interface FlowExecutionTracker {
  registerFlow(flowId: string): void;
  addDependency(flowId: string, dependencyId: string): void;
  startFlowExecution(flowId: string): void;
  completeFlowExecution(flowId: string, result?: any): void;
  failFlowExecution(flowId: string, error: Error): void;
  getMetrics(): FlowExecutionMetrics;
  getMetricsForFlow(flowId: string): FlowMetrics | undefined;
  getFlowExecutionTime(flowId: string): number;
  getFlowStatus(flowId: string): 'pending' | 'running' | 'completed' | 'failed' | undefined;
  getFlowError(flowId: string): Error | undefined;
  getFlowResult(flowId: string): any;
  getFlowCount(): number;
  getCompletedFlows(): number;
  getFailedFlows(): number;
  getRunningFlows(): number;
  getPendingFlows(): number;
  getBottlenecks(): string[];
  getTimeSeriesData(): Array<{
    timestamp: number;
    metrics: Record<string, number>;
  }>;
  saveExecutionCheckpoint(): Promise<void>;
  loadExecutionCheckpoint(): Promise<void>;
  reset(): void;
  collectTimeSeriesDataPoint(): void;
  startTracking(): void;
  stopTracking(): void;
}

export interface FlowOrchestrator extends EventEmitter {
  // Flow management
  registerFlow(definition: any): string;
  getFlow(flowId: string): ExtendedFlow<any, FlowState> | undefined;
  removeFlow(flowId: string): void;
  reset(): void;
  
  // Execution
  execute(options?: { inputData?: Record<string, any> }): Promise<any>;
  startFlow(flowId: string, options?: any): Promise<void>;
  waitForAnyFlowToComplete(): Promise<{ flowId: string; result: any } | null>;
  saveExecutionCheckpoint(): Promise<void>;
  loadExecutionCheckpoint(): Promise<void>;
  
  // Metrics and state
  getMetrics(): FlowExecutionMetrics;
  getMetricsForFlow(flowId: string): FlowExecutionMetrics;
  getOptimizedOptions(): Record<string, any>;
  
  // Flow state
  pendingFlows: Map<string, ExtendedFlow<any, FlowState>>;
  completedFlows: Map<string, ExtendedFlow<any, FlowState>>;
  failedFlows: Map<string, ExtendedFlow<any, FlowState>>;
  
  // Execution tracking
  currentExecution: {
    startTime: number;
    endTime?: number;
    status: 'running' | 'completed' | 'failed';
    error?: Error;
  };
  
  // Graph properties
  nodes: Array<{ id: string; }>
  edges: Array<{ from: string; to: string; }>
  
  // Critical path tracking
  criticalPath: {
    flows: string[];
    time: number;
  };
  
  // Flow execution tracking
  runningFlows: Set<string>;
  flowExecutionTimes: Map<string, number>;
  timeSeriesData: Array<{
    timestamp: number;
    metrics: Record<string, number>;
  }>;
  
  // Error tracking
  errors: Map<string, Error>;
  
  // Internal state
  executionStartTime: number;
  executionEndTime?: number;
  checkpointTimer?: ReturnType<typeof setTimeout>;
  options: Required<FlowOrchestratorOptions>;
  
  // Memory tracking
  memoryUsage: {
    initial: number;
    peak: number;
    current: number;
  };
  
  // Performance metrics
  performanceMetrics: {
    totalExecutionTime: number;
    averageFlowTime: number;
    maxFlowTime: number;
    minFlowTime: number;
    flowCount: number;
    completedFlows: number;
    failedFlows: number;
  };
  
  // Visualization
  visualizationPath?: string;
  visualizationOptions?: FlowVisualizationOptions;
  
  // Flow graph methods
  getFlowGraph(): {
    nodes: Array<{ id: string; }>
    edges: Array<{ from: string; to: string; }>
  };
  
  // Flow dependency methods
  getFlowDependencies(flowId: string): string[];
  getDependentFlows(flowId: string): string[];
  getFlowDependencyOrder(): string[];
  getFlowDependencyMatrix(): Record<string, Record<string, boolean>>;
  getFlowDependencyTree(): Record<string, Array<string>>;
  getFlowDependencyList(): Array<{ id: string; dependencies: string[] }>;
  getFlowDependencyDepth(): Record<string, number>;
  getFlowDependencyWidth(): Record<string, number>;
  getFlowDependencyFanIn(): Record<string, number>;
  getFlowDependencyFanOut(): Record<string, number>;
  getFlowDependencyCycles(): Array<Array<string>>;
  getFlowDependencyCriticalPath(): string[];
  getFlowDependencyCriticalPathFlows(): string[];
}
