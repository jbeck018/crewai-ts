/**
 * FlowScheduler
 * 
 * Provides optimized scheduling of flows with efficient dependency resolution,
 * parallel execution management, and resource allocation strategies.
 */
import { Flow, FlowState } from '../index.js';
import { FlowEventBus, EventPriority, FlowEvent } from '../events/FlowEventBus.js';
import { FlowExecutionTracker, FlowExecutionMetrics } from '../execution/FlowExecutionTracker.js';

/**
 * Flow node in the dependency graph
 */
export interface FlowNode<T extends FlowState = FlowState> {
  id: string;
  flow: Flow<T>;
  dependencies: string[];
  priority: number;
  metadata?: Record<string, any>;
  status?: FlowExecutionStatus;
  result?: any;
  error?: Error;
}

/**
 * Flow execution status
 */
export enum FlowExecutionStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  SUCCESSFUL = 'successful',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Flow execution options
 */
export interface FlowSchedulingOptions {
  // Concurrency options
  maxConcurrent?: number;
  priorityLevels?: number;
  priorityWeights?: number[];
  
  // Time constraints
  maxExecutionTimeMs?: number;
  minExecutionDelayMs?: number;
  executionTimeout?: number;
  
  // Resource management
  memoryLimit?: number; // In MB
  memoryThrottling?: boolean;
  cpuLimit?: number; // Percentage (0-100)
  
  // Execution tracking
  trackPerformance?: boolean;
  eventBus?: FlowEventBus;
  
  // Error handling
  stopOnFirstError?: boolean;
  retryCount?: number;
  retryDelayMs?: number;
  
  // Execution hooks
  beforeExecution?: <T extends FlowState>(node: FlowNode<T>) => Promise<void>;
  afterExecution?: <T extends FlowState>(node: FlowNode<T>, result: any) => Promise<void>;
  onError?: <T extends FlowState>(node: FlowNode<T>, error: Error) => Promise<boolean>; // Return true to retry
}

/**
 * Flow execution result
 */
export interface FlowExecutionResult {
  successful: boolean;
  completedFlows: string[];
  failedFlows: string[];
  skippedFlows: string[];
  results: Map<string, any>;
  errors: Map<string, Error>;
  executionTime: number;
  metrics?: {
    totalFlows: number;
    maxConcurrent: number;
    peakMemoryUsageMb?: number;
    cpuUtilization?: number;
    averageFlowDurationMs: number;
  };
}

/**
 * Flow scheduler event
 */
export interface FlowSchedulerEvent extends FlowEvent {
  type: 'flow_scheduler:start' | 'flow_scheduler:complete' | 'flow_scheduler:error';
  schedulerId: string;
  flowCount?: number;
  concurrentFlows?: number;
}

/**
 * FlowScheduler provides optimized scheduling of flows with efficient dependency resolution
 */
export class FlowScheduler {
  // Dependency graph
  private nodes: Map<string, FlowNode> = new Map();
  private dependents: Map<string, Set<string>> = new Map();
  
  // Execution state
  private scheduled: Set<string> = new Set();
  private running: Map<string, Promise<any>> = new Map();
  private completed: Set<string> = new Set();
  private failed: Set<string> = new Set();
  
  // Results and tracking
  private results: Map<string, any> = new Map();
  private errors: Map<string, Error> = new Map();
  private trackers: Map<string, FlowExecutionTracker> = new Map();
  
  // Performance monitoring
  private startTime: number = 0;
  private endTime: number = 0;
  private peakConcurrent: number = 0;
  private totalDuration: number = 0;
  private retryAttempts: Map<string, number> = new Map();
  
  // Default options
  private readonly defaultOptions: FlowSchedulingOptions = {
    maxConcurrent: 4,
    priorityLevels: 3,
    priorityWeights: [1, 2, 4], // Higher priority flows get more resources
    maxExecutionTimeMs: 300000, // 5 minutes
    minExecutionDelayMs: 0,
    memoryThrottling: true,
    trackPerformance: true,
    stopOnFirstError: false,
    retryCount: 0,
    retryDelayMs: 1000
  };
  
  /**
   * Create a new FlowScheduler with optimized scheduling capabilities
   */
  constructor(
    private options: FlowSchedulingOptions = {},
    private id: string = `scheduler_${Date.now()}`
  ) {
    // Merge with default options
    this.options = {
      ...this.defaultOptions,
      ...options
    };
    
    // Validate and adjust options
    if (this.options.priorityLevels! <= 0) {
      this.options.priorityLevels = 1;
    }
    
    // Ensure priority weights match levels
    if (!this.options.priorityWeights || 
        this.options.priorityWeights.length !== this.options.priorityLevels) {
      this.options.priorityWeights = Array(this.options.priorityLevels).fill(1);
    }
  }
  
  /**
   * Register a flow for execution
   */
  registerFlow<T extends FlowState>(
    flow: Flow<T>,
    options: {
      id?: string;
      dependencies?: string[];
      priority?: number;
      metadata?: Record<string, any>;
    } = {}
  ): string {
    // Generate flow ID if not provided
    const id = options.id || `flow_${flow.constructor.name}_${Date.now()}`;
    
    if (this.nodes.has(id)) {
      throw new Error(`Flow with id ${id} is already registered`);
    }
    
    // Validate priority
    const priority = options.priority !== undefined ? 
      Math.min(Math.max(0, options.priority), this.options.priorityLevels! - 1) : 0;
    
    // Create flow node
    const node: FlowNode<T> = {
      id,
      flow,
      dependencies: options.dependencies || [],
      priority,
      metadata: options.metadata || {},
      status: FlowExecutionStatus.PENDING
    };
    
    // Register node
    this.nodes.set(id, node);
    
    // Register as dependent for each dependency
    for (const depId of node.dependencies) {
      if (!this.dependents.has(depId)) {
        this.dependents.set(depId, new Set());
      }
      this.dependents.get(depId)!.add(id);
    }
    
    return id;
  }
  
  /**
   * Unregister a flow
   */
  unregisterFlow(id: string): boolean {
    if (!this.nodes.has(id)) {
      return false;
    }
    
    const node = this.nodes.get(id)!;
    
    // Remove from dependency lists
    for (const depId of node.dependencies) {
      const dependents = this.dependents.get(depId);
      if (dependents) {
        dependents.delete(id);
      }
    }
    
    // Remove dependents
    this.dependents.delete(id);
    
    // Remove node
    this.nodes.delete(id);
    
    return true;
  }
  
  /**
   * Execute all flows respecting dependencies and concurrency limits
   */
  async execute(options: FlowSchedulingOptions = {}): Promise<FlowExecutionResult> {
    // Merge options
    const execOptions = { ...this.options, ...options };
    
    // Initialize execution
    this.startTime = performance.now();
    this.scheduled.clear();
    this.running.clear();
    this.completed.clear();
    this.failed.clear();
    this.results.clear();
    this.errors.clear();
    this.retryAttempts.clear();
    this.trackers.clear();
    this.peakConcurrent = 0;
    this.totalDuration = 0;
    
    // Emit start event
    if (execOptions.eventBus) {
      const startEvent: FlowSchedulerEvent = {
        type: 'flow_scheduler:start',
        schedulerId: this.id,
        timestamp: Date.now(),
        priority: EventPriority.NORMAL,
        flowCount: this.nodes.size
      };
      execOptions.eventBus.publish(startEvent);
    }
    
    try {
      // Validate dependency graph for cycles
      this.validateDependencyGraph();
      
      // Main execution loop
      while (this.hasMoreFlowsToExecute()) {
        // Check execution time limit
        if (execOptions.maxExecutionTimeMs && 
            performance.now() - this.startTime > execOptions.maxExecutionTimeMs) {
          throw new Error('Flow execution exceeded maximum allowed time');
        }
        
        // Get flows ready to execute
        const readyFlows = this.getReadyFlows();
        
        // If no flows are ready but some are running, wait for them
        if (readyFlows.length === 0 && this.running.size > 0) {
          await this.waitForAnyFlowToComplete();
          continue;
        }
        
        // If no flows are ready and none are running, we might be done or have a deadlock
        if (readyFlows.length === 0 && this.running.size === 0) {
          // Check if there are any flows that aren't completed or failed
          const remainingFlows = Array.from(this.nodes.values())
            .filter(node => !this.completed.has(node.id) && !this.failed.has(node.id));
          
          if (remainingFlows.length > 0) {
            // We have a deadlock
            throw new Error('Deadlock detected in flow execution');
          }
          
          // All flows are completed or failed, we're done
          break;
        }
        
        // Sort ready flows by priority
        readyFlows.sort((a, b) => b.priority - a.priority);
        
        // Execute flows up to concurrency limit
        const concurrencyLimit = this.calculateCurrentConcurrencyLimit(execOptions);
        let startedCount = 0;
        
        for (const node of readyFlows) {
          if (this.running.size >= concurrencyLimit) {
            break;
          }
          
          await this.startFlow(node, execOptions);
          startedCount++;
          
          // Track peak concurrency
          this.peakConcurrent = Math.max(this.peakConcurrent, this.running.size);
          
          // Apply minimum execution delay if configured
          if (execOptions.minExecutionDelayMs && execOptions.minExecutionDelayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, execOptions.minExecutionDelayMs));
          }
        }
        
        // If we didn't start any flows but some are running, wait for one to complete
        if (startedCount === 0 && this.running.size > 0) {
          await this.waitForAnyFlowToComplete();
        }
      }
      
      // All flows completed or failed
      this.endTime = performance.now();
      
      // Prepare execution result
      const result = this.prepareExecutionResult();
      
      // Emit completion event
      if (execOptions.eventBus) {
        const completeEvent: FlowSchedulerEvent = {
          type: 'flow_scheduler:complete',
          schedulerId: this.id,
          timestamp: Date.now(),
          priority: EventPriority.NORMAL,
          flowCount: this.nodes.size,
          metadata: {
            result: {
              successful: result.successful,
              completedCount: result.completedFlows.length,
              failedCount: result.failedFlows.length,
              executionTime: result.executionTime
            }
          }
        };
        execOptions.eventBus.publish(completeEvent);
      }
      
      return result;
    } catch (error) {
      // Emit error event
      if (execOptions.eventBus) {
        const errorEvent: FlowSchedulerEvent = {
          type: 'flow_scheduler:error',
          schedulerId: this.id,
          timestamp: Date.now(),
          priority: EventPriority.HIGH,
          metadata: { error }
        };
        execOptions.eventBus.publish(errorEvent);
      }
      
      // Cancel all running flows
      await this.cancelAllRunningFlows();
      
      // Prepare error result
      this.endTime = performance.now();
      const result = this.prepareExecutionResult();
      result.successful = false;
      
      if (error instanceof Error) {
        result.errors.set('scheduler', error);
      } else {
        result.errors.set('scheduler', new Error(String(error)));
      }
      
      return result;
    }
  }
  
  /**
   * Get all registered flows
   */
  getFlows(): FlowNode[] {
    return Array.from(this.nodes.values());
  }
  
  /**
   * Get a specific flow by ID
   */
  getFlow(id: string): FlowNode | undefined {
    return this.nodes.get(id);
  }
  
  /**
   * Get all ready flows that have all dependencies satisfied
   */
  getReadyFlows(): FlowNode[] {
    return Array.from(this.nodes.values()).filter(node => {
      // Skip already scheduled, running, completed, or failed flows
      if (this.scheduled.has(node.id) || this.running.has(node.id) || 
          this.completed.has(node.id) || this.failed.has(node.id)) {
        return false;
      }
      
      // Check if all dependencies are completed
      return node.dependencies.every(depId => this.completed.has(depId));
    });
  }
  
  /**
   * Get execution results
   */
  getResults(): Map<string, any> {
    return new Map(this.results);
  }
  
  /**
   * Get execution errors
   */
  getErrors(): Map<string, Error> {
    return new Map(this.errors);
  }
  
  /**
   * Get performance metrics for all flows
   */
  getPerformanceMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {
      totalDuration: this.endTime > 0 ? this.endTime - this.startTime : 0,
      peakConcurrent: this.peakConcurrent,
      averageFlowDuration: this.completed.size > 0 ? this.totalDuration / this.completed.size : 0,
      flowCount: this.nodes.size,
      completedCount: this.completed.size,
      failedCount: this.failed.size
    };
    
    // Add individual flow metrics if available
    const flowMetrics: Record<string, any> = {};
    for (const [flowId, tracker] of this.trackers.entries()) {
      flowMetrics[flowId] = tracker.getMetrics();
    }
    
    if (Object.keys(flowMetrics).length > 0) {
      metrics.flows = flowMetrics;
    }
    
    return metrics;
  }
  
  /**
   * Validate the dependency graph for cycles and missing dependencies
   */
  private validateDependencyGraph(): void {
    // Check for missing dependencies
    for (const node of this.nodes.values()) {
      for (const depId of node.dependencies) {
        if (!this.nodes.has(depId)) {
          throw new Error(`Flow ${node.id} depends on missing flow ${depId}`);
        }
      }
    }
    
    // Check for cycles using depth-first search
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const detectCycle = (nodeId: string): boolean => {
      // Already completely explored this node
      if (visited.has(nodeId)) {
        return false;
      }
      
      // Found a cycle
      if (recursionStack.has(nodeId)) {
        return true;
      }
      
      // Mark node as being explored
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      // Explore dependencies
      const node = this.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (detectCycle(depId)) {
            return true;
          }
        }
      }
      
      // Finished exploring this node
      recursionStack.delete(nodeId);
      return false;
    };
    
    // Check all nodes
    for (const node of this.nodes.values()) {
      if (detectCycle(node.id)) {
        throw new Error(`Dependency cycle detected involving flow ${node.id}`);
      }
    }
  }
  
  /**
   * Start executing a flow
   */
  private async startFlow(node: FlowNode, options: FlowSchedulingOptions): Promise<void> {
    // Mark as scheduled
    this.scheduled.add(node.id);
    node.status = FlowExecutionStatus.SCHEDULED;
    
    // Create performance tracker if enabled
    if (options.trackPerformance) {
      const tracker = new FlowExecutionTracker(node.flow, {
        trackMethodCalls: true,
        trackStateChanges: true,
        trackRouteEvaluations: true,
        persistMetrics: false,
        eventBus: options.eventBus
      });
      
      this.trackers.set(node.id, tracker);
      tracker.startTracking();
    }
    
    // Run pre-execution hook if configured
    if (options.beforeExecution) {
      try {
        await options.beforeExecution(node);
      } catch (error) {
        console.error(`Error in before execution hook for flow ${node.id}:`, error);
      }
    }
    
    // Create execution promise with timeout if configured
    let executionPromise = this.executeFlow(node, options);
    
    // Add timeout if configured
    if (options.executionTimeout && options.executionTimeout > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Flow execution timed out after ${options.executionTimeout}ms`));
        }, options.executionTimeout);
      });
      
      executionPromise = Promise.race([executionPromise, timeoutPromise]);
    }
    
    // Store running promise
    this.running.set(node.id, executionPromise);
    node.status = FlowExecutionStatus.RUNNING;
  }
  
  /**
   * Execute a flow and handle results/errors
   */
  private async executeFlow(node: FlowNode, options: FlowSchedulingOptions): Promise<void> {
    try {
      // Execute the flow
      const result = await node.flow.execute();
      
      // Store result
      this.results.set(node.id, result);
      node.result = result;
      
      // Mark as completed
      this.completed.add(node.id);
      node.status = FlowExecutionStatus.SUCCESSFUL;
      
      // Update duration if tracking performance
      const tracker = this.trackers.get(node.id);
      if (tracker) {
        tracker.stopTracking();
        const metrics = tracker.getMetrics();
        if (metrics) {
          this.totalDuration += metrics.executionTimeMs;
        }
      }
      
      // Run post-execution hook if configured
      if (options.afterExecution) {
        try {
          await options.afterExecution(node, result);
        } catch (error) {
          console.error(`Error in after execution hook for flow ${node.id}:`, error);
        }
      }
    } catch (error) {
      // Get error message
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      // Store error
      this.errors.set(node.id, errorObj);
      node.error = errorObj;
      
      // Track error in performance tracker
      const tracker = this.trackers.get(node.id);
      if (tracker) {
        tracker.recordError(errorObj);
        tracker.stopTracking();
      }
      
      // Check if we should retry
      const retryCount = this.retryAttempts.get(node.id) || 0;
      const shouldRetry = options.retryCount! > retryCount;
      
      // Call error handler if configured
      let errorHandlerResult = false;
      if (options.onError) {
        try {
          errorHandlerResult = await options.onError(node, errorObj);
        } catch (handlerError) {
          console.error(`Error in error handler for flow ${node.id}:`, handlerError);
        }
      }
      
      // Retry flow if retry count not exceeded or error handler requests retry
      if ((shouldRetry || errorHandlerResult) && !this.failed.has(node.id)) {
        this.retryAttempts.set(node.id, retryCount + 1);
        
        // Re-schedule flow after retry delay
        setTimeout(() => {
          this.scheduled.delete(node.id);
          node.status = FlowExecutionStatus.PENDING;
        }, options.retryDelayMs);
        
        return;
      }
      
      // Mark as failed
      this.failed.add(node.id);
      node.status = FlowExecutionStatus.FAILED;
      
      // If stopOnFirstError is enabled, cancel all running flows
      if (options.stopOnFirstError) {
        await this.cancelAllRunningFlows();
        throw errorObj;
      }
    } finally {
      // Remove from running
      this.running.delete(node.id);
    }
  }
  
  /**
   * Wait for any running flow to complete
   */
  private async waitForAnyFlowToComplete(): Promise<void> {
    if (this.running.size === 0) return;
    
    // Create a promise that resolves when any flow completes
    const anyCompletion = Promise.race(
      Array.from(this.running.values()).map((promise, index) => {
        const runningIds = Array.from(this.running.keys());
        const flowId = index < runningIds.length ? runningIds[index] : 'unknown';
        
        // Wrap each promise to return its flow ID when it resolves/rejects
        return promise
          .then(() => flowId)
          .catch(() => flowId);
      })
    );
    
    // Wait for any flow to complete
    await anyCompletion;
  }
  
  /**
   * Cancel all running flows
   */
  private async cancelAllRunningFlows(): Promise<void> {
    const runningFlows = Array.from(this.running.keys());
    
    for (const flowId of runningFlows) {
      const node = this.nodes.get(flowId);
      if (node) {
        node.status = FlowExecutionStatus.CANCELLED;
      }
    }
    
    // Wait for all running flows to complete or error
    await Promise.allSettled(Array.from(this.running.values()));
    
    // Clear running flows
    this.running.clear();
  }
  
  /**
   * Prepare the execution result
   */
  private prepareExecutionResult(): FlowExecutionResult {
    const executionTime = this.endTime > 0 ? 
      this.endTime - this.startTime : performance.now() - this.startTime;
    
    // Get skipped flows
    const skippedFlows = Array.from(this.nodes.keys())
      .filter(id => !this.completed.has(id) && !this.failed.has(id));
    
    // Create result object
    const result: FlowExecutionResult = {
      successful: this.failed.size === 0,
      completedFlows: Array.from(this.completed),
      failedFlows: Array.from(this.failed),
      skippedFlows,
      results: new Map(this.results),
      errors: new Map(this.errors),
      executionTime,
      metrics: {
        totalFlows: this.nodes.size,
        maxConcurrent: this.peakConcurrent,
        averageFlowDurationMs: this.completed.size > 0 ? 
          this.totalDuration / this.completed.size : 0
      }
    };
    
    return result;
  }
  
  /**
   * Check if there are more flows to execute
   */
  private hasMoreFlowsToExecute(): boolean {
    // Get total flows that are not completed or failed
    const pendingCount = Array.from(this.nodes.values())
      .filter(node => 
        !this.completed.has(node.id) && 
        !this.failed.has(node.id))
      .length;
    
    return pendingCount > 0 || this.running.size > 0;
  }
  
  /**
   * Calculate the current concurrency limit based on system resources
   */
  private calculateCurrentConcurrencyLimit(options: FlowSchedulingOptions): number {
    let limit = options.maxConcurrent || this.defaultOptions.maxConcurrent!;
    
    // Adjust limit based on memory usage if throttling is enabled
    if (options.memoryThrottling && typeof process !== 'undefined') {
      try {
        const memoryUsage = process.memoryUsage().heapUsed / (1024 * 1024); // MB
        const memoryLimit = options.memoryLimit || 1024; // Default 1GB
        
        // Reduce concurrency as memory usage approaches limit
        const memoryUtilization = memoryUsage / memoryLimit;
        if (memoryUtilization > 0.8) {
          // Linearly reduce concurrency as memory usage increases
          const adjustment = Math.floor(limit * (1 - (memoryUtilization - 0.8) * 5));
          limit = Math.max(1, adjustment); // Always allow at least 1 concurrent flow
        }
      } catch (error) {
        // Ignore errors measuring memory (might be in browser environment)
      }
    }
    
    return limit;
  }
}
