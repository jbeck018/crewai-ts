import { EventEmitter } from 'events';

interface ResourceEstimate {
  cpu: number;
  memory: number;
  io: number;
  network: number;
}

interface ResourceUsage {
  cpu: number;
  memory: number;
  io: number;
  network: number;
  availableCpu: number;
  availableMemory: number;
  maxConcurrentIo: number;
  maxConcurrentNetwork: number;
}

interface FlowExecutionMetrics {
  startTime: number;
  endTime: number;
  executionTime: number;
  duration: number;
  resourceUsage?: ResourceUsage;
  error?: Error;
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

interface FlowSchedulerOptions {
  resourceLimits?: {
    availableCpu?: number;
    availableMemory?: number;
    maxConcurrentIo?: number;
    maxConcurrentNetwork?: number;
  };
}

export class FlowSchedulerCore extends EventEmitter {
  private resourceUsage!: ResourceUsage;
  private options: FlowSchedulerOptions;
  private metrics!: {
    averageFlowExecutionTime: number;
    maxFlowExecutionTime: number;
    minFlowExecutionTime: number;
    completedFlows: number;
    failedFlows: number;
  };

  constructor(options: FlowSchedulerOptions) {
    super();
    this.options = options;
    this.initializeResources();
    this.initializeMetrics();
  }

  private initializeResources(): void {
    this.resourceUsage = {
      cpu: 0,
      memory: 0,
      io: 0,
      network: 0,
      availableCpu: this.options.resourceLimits?.availableCpu ?? 4,
      availableMemory: this.options.resourceLimits?.availableMemory ?? 1024,
      maxConcurrentIo: this.options.resourceLimits?.maxConcurrentIo ?? 10,
      maxConcurrentNetwork: this.options.resourceLimits?.maxConcurrentNetwork ?? 10
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

  private updateResourceUsage(flow: SchedulableFlow, isStarting: boolean): void {
    const resourceUsage = flow.resourceUsage || flow.estimatedResourceUsage;
    if (!resourceUsage) return;

    const { cpu, memory, io, network } = resourceUsage;
    if (isStarting) {
      this.resourceUsage.cpu = (this.resourceUsage.cpu || 0) + (cpu || 0);
      this.resourceUsage.memory = (this.resourceUsage.memory || 0) + (memory || 0);
      this.resourceUsage.io = (this.resourceUsage.io || 0) + (io || 0);
      this.resourceUsage.network = (this.resourceUsage.network || 0) + (network || 0);
    } else {
      this.resourceUsage.cpu = Math.max(0, (this.resourceUsage.cpu || 0) - (cpu || 0));
      this.resourceUsage.memory = Math.max(0, (this.resourceUsage.memory || 0) - (memory || 0));
      this.resourceUsage.io = Math.max(0, (this.resourceUsage.io || 0) - (io || 0));
      this.resourceUsage.network = Math.max(0, (this.resourceUsage.network || 0) - (network || 0));
    }
  }

  private getResourceUsage(): ResourceUsage {
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

  private calculateResourceUsage(flow: SchedulableFlow): ResourceEstimate {
    const usage = flow.resourceUsage || flow.estimatedResourceUsage;
    return usage || {
      cpu: 0,
      memory: 0,
      io: 0,
      network: 0
    };
  }

  private canScheduleFlow(flow: SchedulableFlow): boolean {
    const usage = this.calculateResourceUsage(flow);
    return (
      (this.resourceUsage.availableCpu || 0) >= usage.cpu &&
      (this.resourceUsage.availableMemory || 0) >= usage.memory &&
      (this.resourceUsage.maxConcurrentIo || 0) >= usage.io &&
      (this.resourceUsage.maxConcurrentNetwork || 0) >= usage.network
    );
  }

  private handleFlowError(flowId: string, error: Error | number): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Flow execution failed: ${errorMessage}`);
  }
}
