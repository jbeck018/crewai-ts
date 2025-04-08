/**
 * FlowOrchestrator
 * 
 * Coordinates execution of multiple flows with optimized performance,
 * dependency management, and shared memory integration.
 */

import { EventEmitter } from 'events';
import { Flow, FlowState } from '../index.js';
import { FlowMemoryConnector } from '../memory/FlowMemoryConnector.js';

// Flow dependency graph type definitions
type FlowId = string;

// Edge represents a dependency between flows
interface FlowEdge {
  from: FlowId;
  to: FlowId;
  condition?: (fromResult: any) => boolean;
  dataMapping?: (fromResult: any) => any; // Maps output data from one flow to input for another
}

// Node represents a flow in the dependency graph
interface FlowNode<TState extends FlowState = FlowState> {
  id: FlowId;
  flow: Flow<TState>;
  dependencies: Set<FlowId>;
  dependents: Set<FlowId>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: Error;
  startTime?: number;
  endTime?: number;
  priority: number; // Higher number = higher priority
  metadata?: Record<string, any>;
}

// Flow execution options
export interface FlowExecutionOptions {
  maxConcurrency?: number; // Maximum number of flows to run concurrently
  timeout?: number; // Timeout in milliseconds
  retryCount?: number; // Number of retries for failed flows
  retryDelay?: number; // Delay between retries in milliseconds
  failFast?: boolean; // Stop all execution if any flow fails
  enableProfiling?: boolean; // Track detailed performance metrics
  checkpointInterval?: number; // How often to save execution state (ms)
  inputData?: Record<string, any>; // Initial input data for flows
}

// Flow orchestrator options
export interface FlowOrchestratorOptions {
  enableMemoryIntegration?: boolean; // Whether to use memory connector
  memoryConnector?: FlowMemoryConnector; // Custom memory connector
  execution?: FlowExecutionOptions; // Default execution options
  optimizeFor?: 'memory' | 'speed' | 'balanced'; // Performance optimization preset
}

/**
 * Manages and coordinates execution of multiple flows with optimized
 * dependency resolution and parallel execution.
 */
export class FlowOrchestrator {
  // Event emitter for flow orchestration events
  public events: EventEmitter = new EventEmitter();
  
  // Flow dependency graph with optimized storage
  private nodes: Map<FlowId, FlowNode> = new Map();
  private edges: FlowEdge[] = [];
  
  // Execution tracking
  private pendingFlows: Set<FlowId> = new Set();
  private runningFlows: Map<FlowId, Promise<any>> = new Map();
  private completedFlows: Map<FlowId, any> = new Map();
  private failedFlows: Map<FlowId, Error> = new Map();
  
  // Performance tracking
  private executionStartTime: number = 0;
  private executionEndTime: number = 0;
  private flowExecutionTimes: Map<FlowId, number> = new Map();
  private checkpointTimer: NodeJS.Timeout | null = null;
  
  // Memory integration
  private memoryConnector?: FlowMemoryConnector;
  
  // Configuration
  private options: FlowOrchestratorOptions;
  private executionOptions: FlowExecutionOptions;
  
  constructor(options: FlowOrchestratorOptions = {}) {
    // Set default options based on optimization preset
    this.options = this.getOptimizedOptions(options);
    
    // Set default execution options
    this.executionOptions = this.options.execution || {
      maxConcurrency: 4,
      timeout: 30 * 60 * 1000, // 30 minutes
      retryCount: 0,
      retryDelay: 1000,
      failFast: false,
      enableProfiling: false,
      checkpointInterval: 60 * 1000 // 1 minute
    };
    
    // Set up memory integration if enabled
    if (this.options.enableMemoryIntegration) {
      this.memoryConnector = this.options.memoryConnector || new FlowMemoryConnector({
        // Optimized memory connector options
        persistStateOnEveryChange: false, // Only persist at checkpoints for performance
        persistMethodResults: true,
        statePersistenceDebounceMs: 1000,
        useCompression: true,
        inMemoryCache: true
      });
    }
  }
  
  /**
   * Apply optimization preset based on orchestrator options
   */
  private getOptimizedOptions(options: FlowOrchestratorOptions): FlowOrchestratorOptions {
    const optimizeFor = options.optimizeFor || 'balanced';
    
    // Start with provided options
    const optimizedOptions = { ...options };
    
    // Apply optimization preset
    switch (optimizeFor) {
      case 'memory':
        // Optimize for minimal memory usage
        optimizedOptions.execution = {
          maxConcurrency: 2, // Fewer concurrent flows
          checkpointInterval: 30 * 1000, // More frequent checkpoints
          ...options.execution
        };
        break;
        
      case 'speed':
        // Optimize for maximum speed
        optimizedOptions.execution = {
          maxConcurrency: Math.max(navigator.hardwareConcurrency || 4, 4), // Use available cores
          checkpointInterval: 5 * 60 * 1000, // Less frequent checkpoints
          ...options.execution
        };
        break;
        
      case 'balanced':
      default:
        // Balanced optimization (default)
        optimizedOptions.execution = {
          maxConcurrency: Math.max(Math.floor((navigator.hardwareConcurrency || 4) / 2), 2),
          checkpointInterval: 60 * 1000, // 1 minute checkpoints
          ...options.execution
        };
        break;
    }
    
    return optimizedOptions;
  }
  
  /**
   * Register a flow with the orchestrator
   */
  registerFlow<TState extends FlowState>(
    flow: Flow<TState>,
    options: {
      id?: string;
      priority?: number;
      metadata?: Record<string, any>;
    } = {}
  ): FlowId {
    // Generate ID if not provided
    const id = options.id || `${flow.constructor.name}_${Date.now()}`;
    
    // Create node
    const node: FlowNode<TState> = {
      id,
      flow,
      dependencies: new Set(),
      dependents: new Set(),
      status: 'pending',
      priority: options.priority || 0,
      metadata: options.metadata
    };
    
    // Store node in graph
    this.nodes.set(id, node);
    this.pendingFlows.add(id);
    
    // Connect to memory if enabled
    if (this.memoryConnector) {
      this.memoryConnector.connectToFlow(flow);
    }
    
    // Emit event
    this.events.emit('flow_registered', { id, flow });
    
    return id;
  }
  
  /**
   * Add a dependency between flows
   */
  addDependency(
    fromId: FlowId,
    toId: FlowId,
    options: {
      condition?: (fromResult: any) => boolean;
      dataMapping?: (fromResult: any) => any;
    } = {}
  ): void {
    // Validate flows exist
    if (!this.nodes.has(fromId)) {
      throw new Error(`Flow with ID ${fromId} not found`);
    }
    if (!this.nodes.has(toId)) {
      throw new Error(`Flow with ID ${toId} not found`);
    }
    
    // Check for circular dependencies
    if (this.wouldCreateCycle(fromId, toId)) {
      throw new Error(`Adding dependency from ${fromId} to ${toId} would create a cycle`);
    }
    
    // Create edge
    const edge: FlowEdge = {
      from: fromId,
      to: toId,
      condition: options.condition,
      dataMapping: options.dataMapping
    };
    
    // Update nodes
    this.nodes.get(toId)!.dependencies.add(fromId);
    this.nodes.get(fromId)!.dependents.add(toId);
    
    // Add edge
    this.edges.push(edge);
    
    // Emit event
    this.events.emit('dependency_added', { edge });
  }
  
  /**
   * Check if adding dependency would create a cycle
   */
  private wouldCreateCycle(fromId: FlowId, toId: FlowId): boolean {
    // If they're the same, it's a self-cycle
    if (fromId === toId) return true;
    
    // Check if toId is already a dependency of fromId
    const visited = new Set<FlowId>();
    const queue: FlowId[] = [toId];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      visited.add(currentId);
      
      const currentNode = this.nodes.get(currentId);
      if (!currentNode) continue;
      
      for (const depId of currentNode.dependencies) {
        if (depId === fromId) return true;
        if (!visited.has(depId)) {
          queue.push(depId);
        }
      }
    }
    
    return false;
  }
  
  /**
   * Get flows that are ready to execute (all dependencies satisfied)
   */
  private getReadyFlows(): FlowNode[] {
    const readyFlows: FlowNode[] = [];
    
    for (const flowId of this.pendingFlows) {
      const node = this.nodes.get(flowId)!;
      
      // Check if all dependencies are satisfied
      let allDependenciesSatisfied = true;
      let anyDependencyFailed = false;
      
      for (const depId of node.dependencies) {
        if (!this.completedFlows.has(depId)) {
          allDependenciesSatisfied = false;
          break;
        }
        
        // Check conditional dependency
        const edge = this.edges.find(e => e.from === depId && e.to === flowId);
        if (edge?.condition) {
          const depResult = this.completedFlows.get(depId);
          if (!edge.condition(depResult)) {
            allDependenciesSatisfied = false;
            break;
          }
        }
      }
      
      // Check if any dependencies failed
      for (const depId of node.dependencies) {
        if (this.failedFlows.has(depId)) {
          anyDependencyFailed = true;
          break;
        }
      }
      
      // If dependencies failed and failFast is enabled, mark as failed
      if (anyDependencyFailed && this.executionOptions.failFast) {
        node.status = 'failed';
        node.error = new Error(`Dependency failed and failFast is enabled`);
        this.pendingFlows.delete(flowId);
        this.failedFlows.set(flowId, node.error);
        continue;
      }
      
      // If ready, add to ready flows
      if (allDependenciesSatisfied) {
        readyFlows.push(node);
      }
    }
    
    // Sort by priority (higher numbers first)
    return readyFlows.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Execute all registered flows with optimized scheduling
   */
  async execute(options?: FlowExecutionOptions): Promise<Map<FlowId, any>> {
    // Merge options with defaults
    const execOptions = { ...this.executionOptions, ...options };
    
    // Initialize execution state
    this.executionStartTime = performance.now();
    this.pendingFlows = new Set(this.nodes.keys());
    this.runningFlows.clear();
    this.completedFlows.clear();
    this.failedFlows.clear();
    this.flowExecutionTimes.clear();
    
    // Set up checkpoint timer if enabled
    if (execOptions.checkpointInterval && execOptions.checkpointInterval > 0) {
      this.checkpointTimer = setInterval(() => {
        this.saveExecutionCheckpoint();
      }, execOptions.checkpointInterval);
    }
    
    // Emit execution started event
    this.events.emit('execution_started', {
      flowCount: this.nodes.size,
      options: execOptions
    });
    
    try {
      // Main execution loop
      while (this.pendingFlows.size > 0 || this.runningFlows.size > 0) {
        // Get flows that are ready to execute
        const readyFlows = this.getReadyFlows();
        
        // Start flows up to concurrency limit
        const availableSlots = execOptions.maxConcurrency! - this.runningFlows.size;
        const flowsToStart = readyFlows.slice(0, availableSlots);
        
        // Start flows
        for (const node of flowsToStart) {
          this.startFlow(node, execOptions);
        }
        
        // Wait for any flow to complete if at concurrency limit or no ready flows
        if (this.runningFlows.size > 0 && (this.runningFlows.size >= execOptions.maxConcurrency! || readyFlows.length === 0)) {
          await this.waitForAnyFlowToComplete();
        } else if (this.pendingFlows.size > 0 && readyFlows.length === 0 && this.runningFlows.size === 0) {
          // Deadlock detected - some flows have circular dependencies
          throw new Error('Deadlock detected: flows with unsatisfiable dependencies');
        } else if (readyFlows.length === 0 && this.runningFlows.size === 0) {
          // All flows completed
          break;
        } else {
          // Yield to event loop for better responsiveness
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      // Check for overall timeout
      const executionTime = performance.now() - this.executionStartTime;
      if (execOptions.timeout && executionTime > execOptions.timeout) {
        throw new Error(`Execution timed out after ${executionTime}ms`);
      }
      
      // Record end time
      this.executionEndTime = performance.now();
      
      // Emit execution completed event
      this.events.emit('execution_completed', {
        completed: this.completedFlows.size,
        failed: this.failedFlows.size,
        executionTime,
        results: this.completedFlows,
        errors: this.failedFlows
      });
      
      return this.completedFlows;
    } catch (error) {
      // Capture end time for failed execution
      this.executionEndTime = performance.now();
      
      // Emit execution failed event
      this.events.emit('execution_failed', {
        error,
        completed: this.completedFlows.size,
        failed: this.failedFlows.size,
        executionTime: this.executionEndTime - this.executionStartTime
      });
      
      throw error;
    } finally {
      // Clean up checkpoint timer
      if (this.checkpointTimer) {
        clearInterval(this.checkpointTimer);
        this.checkpointTimer = null;
      }
      
      // Save final checkpoint
      this.saveExecutionCheckpoint();
    }
  }
  
  /**
   * Start execution of a flow with optimized data passing
   */
  private async startFlow(node: FlowNode, options: FlowExecutionOptions): Promise<void> {
    const { id, flow } = node;
    
    // Update node status
    node.status = 'running';
    node.startTime = performance.now();
    
    // Remove from pending
    this.pendingFlows.delete(id);
    
    // Prepare input data from dependencies with data mapping
    const inputData: Record<string, any> = { ...options.inputData };
    
    // Get data from dependencies
    for (const depId of node.dependencies) {
      const depResult = this.completedFlows.get(depId);
      const edge = this.edges.find(e => e.from === depId && e.to === id);
      
      if (edge?.dataMapping) {
        // Apply data mapping function
        const mappedData = edge.dataMapping(depResult);
        Object.assign(inputData, mappedData);
      } else {
        // Default mapping: use dependency ID as key
        inputData[depId] = depResult;
      }
    }
    
    // Emit flow started event
    this.events.emit('flow_started', { id, flow, inputData });
    
    // Execute flow with error handling and retries
    const executeWithRetries = async (retriesLeft: number): Promise<any> => {
      try {
        // Execute the flow
        return await flow.execute(inputData);
      } catch (error) {
        // Handle retries
        if (retriesLeft > 0 && options.retryDelay) {
          // Wait for retry delay
          await new Promise(resolve => setTimeout(resolve, options.retryDelay));
          
          // Emit retry event
          this.events.emit('flow_retry', { id, flow, error, retriesLeft });
          
          // Retry
          return executeWithRetries(retriesLeft - 1);
        }
        
        throw error;
      }
    };
    
    // Start flow execution
    const executionPromise = executeWithRetries(options.retryCount || 0)
      .then(result => {
        // Update node status
        node.status = 'completed';
        node.result = result;
        node.endTime = performance.now();
        
        // Record execution time with performance-optimized null check
        const startTime = node.startTime || node.endTime; // Fallback to endTime if startTime is undefined
        const executionTime = node.endTime - startTime;
        this.flowExecutionTimes.set(id, executionTime);
        
        // Add to completed flows
        this.completedFlows.set(id, result);
        
        // Remove from running flows
        this.runningFlows.delete(id);
        
        // Emit flow completed event
        this.events.emit('flow_completed', {
          id,
          flow,
          result,
          executionTime
        });
        
        return result;
      })
      .catch(error => {
        // Update node status
        node.status = 'failed';
        node.error = error;
        node.endTime = performance.now();
        
        // Add to failed flows
        this.failedFlows.set(id, error);
        
        // Remove from running flows
        this.runningFlows.delete(id);
        
        // Emit flow failed event
        this.events.emit('flow_failed', {
          id,
          flow,
          error,
          executionTime: node.endTime - (node.startTime || node.endTime)
        });
        
        // Rethrow to trigger waitForAnyFlowToComplete
        throw error;
      });
    
    // Add to running flows
    this.runningFlows.set(id, executionPromise);
  }
  
  /**
   * Wait for any running flow to complete with optimized promise racing
   */
  private async waitForAnyFlowToComplete(): Promise<void> {
    if (this.runningFlows.size === 0) return;
    
    // Create a promise that resolves when any flow completes
    // Use Promise.race which returns as soon as any promise resolves or rejects
    const promises = Array.from(this.runningFlows.values());
    
    try {
      // Wait for any flow to complete or fail
      await Promise.race(promises.map(p => p.catch(e => e)));
    } catch (error) {
      // Error handled in startFlow
    }
  }
  
  /**
   * Save execution checkpoint with optimized state serialization
   */
  private async saveExecutionCheckpoint(): Promise<void> {
    if (!this.memoryConnector) return;
    
    try {
      // Create checkpoint data with minimal information
      const checkpoint = {
        timestamp: Date.now(),
        executionStartTime: this.executionStartTime,
        executionState: {
          pending: Array.from(this.pendingFlows),
          running: Array.from(this.runningFlows.keys()),
          completed: Array.from(this.completedFlows.entries()).map(([id, result]) => ({
            id,
            result
          })),
          failed: Array.from(this.failedFlows.entries()).map(([id, error]) => ({
            id,
            error: error.message,
            stack: error.stack
          }))
        },
        flowMetrics: Array.from(this.flowExecutionTimes.entries()).map(([id, time]) => ({
          id,
          executionTime: time
        })),
        nodeStatuses: Array.from(this.nodes.entries()).map(([id, node]) => ({
          id,
          status: node.status,
          startTime: node.startTime,
          endTime: node.endTime
        }))
      };
      
      // Save checkpoint to memory
      this.events.emit('checkpoint_created', { checkpoint });
      
      // TODO: Store checkpoint using the memory connector
      // This would be implemented based on the memory connector's API
    } catch (error) {
      console.error('Error saving checkpoint:', error);
      this.events.emit('checkpoint_failed', { error });
    }
  }
  
  /**
   * Restore execution from checkpoint
   */
  async restoreFromCheckpoint(checkpointData: any): Promise<void> {
    // TODO: Implement checkpoint restoration
    // This would restore the execution state from a saved checkpoint
    this.events.emit('restore_from_checkpoint', { checkpointData });
  }
  
  /**
   * Get execution metrics with performance data
   */
  getExecutionMetrics(): any {
    const totalExecutionTime = this.executionEndTime - this.executionStartTime;
    
    return {
      totalExecutionTime,
      flowCount: this.nodes.size,
      completedFlows: this.completedFlows.size,
      failedFlows: this.failedFlows.size,
      flowExecutionTimes: Object.fromEntries(this.flowExecutionTimes),
      averageFlowExecutionTime: Array.from(this.flowExecutionTimes.values()).reduce((sum, time) => sum + time, 0) / this.flowExecutionTimes.size,
      // Calculate critical path (longest path through dependency graph)
      criticalPath: this.calculateCriticalPath(),
      criticalPathExecutionTime: this.calculateCriticalPathTime()
    };
  }
  
  /**
   * Calculate the critical path through the dependency graph
   */
  private calculateCriticalPath(): FlowId[] {
    // TODO: Implement critical path calculation
    // This would calculate the longest path through the dependency graph
    return [];
  }
  
  /**
   * Calculate the execution time of the critical path
   */
  private calculateCriticalPathTime(): number {
    // TODO: Implement critical path time calculation
    return 0;
  }
  
  /**
   * Get a visualization of the flow dependency graph
   */
  getFlowGraph(): any {
    // Create graph representation
    const nodes = Array.from(this.nodes.entries()).map(([id, node]) => ({
      id,
      status: node.status,
      executionTime: node.endTime && node.startTime ? node.endTime - node.startTime : undefined,
      priority: node.priority,
      metadata: node.metadata
    }));
    
    const edges = this.edges.map(edge => ({
      from: edge.from,
      to: edge.to,
      hasCondition: !!edge.condition,
      hasDataMapping: !!edge.dataMapping
    }));
    
    return { nodes, edges };
  }
}
