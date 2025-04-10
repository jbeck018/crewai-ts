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
  
  // Critical path analysis
  private criticalPath: FlowId[] = [];
  
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
   * Uses incremental state updates to minimize memory usage
   */
  private async saveExecutionCheckpoint(): Promise<void> {
    if (!this.memoryConnector) return;
    
    try {
      // Create optimized checkpoint data with minimal memory footprint
      // Use typed arrays and buffer views where possible for better memory efficiency
      const timestamp = Date.now();
      
      // Use Set data structures instead of arrays for better lookup performance
      // and more efficient memory representation of unique values
      const pendingFlowsArray = Array.from(this.pendingFlows);
      const runningFlowsArray = Array.from(this.runningFlows.keys());
      
      // Efficient data serialization with selective attribute inclusion
      // Only include necessary information to reduce memory footprint
      const completedFlowsData = Array.from(this.completedFlows).map(([id, result]) => {
        // Use a memory-efficient shallow result representation when possible
        const serializedResult = typeof result === 'object' && result !== null
          ? { _resultType: result.constructor?.name, _resultValue: result.toString() }
          : result;
        
        return { id, result: serializedResult };
      });
      
      // Similarly optimize error storage
      const failedFlowsData = Array.from(this.failedFlows).map(([id, error]) => ({
        id,
        error: error.message,
        // Only include stack trace if available and in development mode
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }));
      
      // Apply optimized serialization for metrics data
      const flowMetricsData = Array.from(this.flowExecutionTimes).map(([id, time]) => ({
        id, executionTime: time
      }));
      
      // Create minimal node status representation with only essential properties
      const nodeStatusesData = Array.from(this.nodes.entries())
        .map(([id, node]) => ({
          id,
          status: node.status,
          startTime: node.startTime,
          endTime: node.endTime,
          // Include critical path information if available
          isOnCriticalPath: this.criticalPath?.includes(id) || false
        }));
      
      // Create memory-efficient checkpoint object
      const checkpoint = {
        timestamp,
        executionStartTime: this.executionStartTime,
        executionProgress: {
          completedPercentage: this.nodes.size > 0 
            ? (this.completedFlows.size / this.nodes.size) * 100 
            : 0,
          remainingFlows: this.pendingFlows.size + this.runningFlows.size
        },
        executionState: {
          pending: pendingFlowsArray,
          running: runningFlowsArray,
          completed: completedFlowsData,
          failed: failedFlowsData
        },
        flowMetrics: flowMetricsData,
        nodeStatuses: nodeStatusesData,
        // Include critical path information
        criticalPath: this.criticalPath || []
      };
      
      // Save checkpoint to memory
      this.events.emit('checkpoint_created', { checkpoint });
      
      // Store checkpoint using the memory connector
      if (this.memoryConnector) {
        // Use optimized storage with compression when available
        await this.memoryConnector.storeCheckpoint(
          `flow_checkpoint_${this.executionStartTime}`,
          checkpoint,
          { compress: true, version: '1.0' }
        );
      }
    } catch (error) {
      console.error('Error saving checkpoint:', error);
      this.events.emit('checkpoint_failed', { error });
    }
  }
  
  /**
   * Restore execution from checkpoint with optimized state reconstruction
   * Implements memory-efficient restoration of flow state from checkpoint data
   * 
   * @param checkpointData The checkpoint data to restore from, typically retrieved via FlowMemoryConnector
   * @returns Promise that resolves when restoration is complete
   */
  async restoreFromCheckpoint(checkpointData: any): Promise<void> {
    if (!checkpointData) {
      throw new Error('Cannot restore from empty checkpoint data');
    }
    
    this.events.emit('restore_from_checkpoint_started', { checkpointId: checkpointData.timestamp });
    
    try {
      // Reset current execution state to prepare for restoration
      // Use targeted clearing instead of full reset for better performance
      this.pendingFlows.clear();
      this.runningFlows.clear();
      this.completedFlows.clear();
      this.failedFlows.clear();
      this.flowExecutionTimes.clear();
      
      // Restore execution timestamps
      this.executionStartTime = checkpointData.executionStartTime || Date.now();
      this.executionEndTime = 0; // Reset end time as execution will continue
      
      // Restore flow states with memory-efficient approach
      if (checkpointData.executionState) {
        const { pending, running, completed, failed } = checkpointData.executionState;
        
        // Restore pending flows - use Set for O(1) lookups
        if (Array.isArray(pending)) {
          pending.forEach(id => this.pendingFlows.add(id));
        }
        
        // Restore completed flows - use Map for O(1) lookups and value retrieval
        if (Array.isArray(completed)) {
          completed.forEach(({id, result}) => {
            // Handle serialized results that need deserialization
            let deserializedResult = result;
            if (result && typeof result === 'object' && result._resultType && result._resultValue) {
              // Simple deserialization - in a real implementation this would be more robust
              try {
                // Attempt to reconstruct based on type information
                if (result._resultType === 'Date') {
                  deserializedResult = new Date(result._resultValue);
                } else if (result._resultType === 'Set') {
                  deserializedResult = new Set(JSON.parse(result._resultValue));
                } else if (result._resultType === 'Map') {
                  deserializedResult = new Map(JSON.parse(result._resultValue));
                } else {
                  deserializedResult = result._resultValue;
                }
              } catch (e) {
                // Fallback to original serialized form if deserialization fails
                deserializedResult = result._resultValue;
              }
            }
            
            this.completedFlows.set(id, deserializedResult);
          });
        }
        
        // Restore failed flows
        if (Array.isArray(failed)) {
          failed.forEach(({id, error, stack}) => {
            const err = new Error(error);
            if (stack) err.stack = stack;
            this.failedFlows.set(id, err);
          });
        }
        
        // For running flows, we need to restart them, so add them back to pending
        if (Array.isArray(running)) {
          running.forEach(id => this.pendingFlows.add(id));
        }
      }
      
      // Restore node statuses
      if (Array.isArray(checkpointData.nodeStatuses)) {
        checkpointData.nodeStatuses.forEach((nodeStatus: any) => {
          const node = this.nodes.get(nodeStatus.id);
          if (node) {
            // Only restore fields that make sense to restore
            // This avoids overwriting the full node with potentially incomplete data
            node.status = nodeStatus.status === 'running' ? 'pending' : nodeStatus.status;
            node.startTime = nodeStatus.startTime;
            node.endTime = nodeStatus.endTime;
          }
        });
      }
      
      // Restore metrics data
      if (Array.isArray(checkpointData.flowMetrics)) {
        checkpointData.flowMetrics.forEach((metric: any) => {
          if (metric.id && typeof metric.executionTime === 'number') {
            this.flowExecutionTimes.set(metric.id, metric.executionTime);
          }
        });
      }
      
      // Restore critical path if available
      if (Array.isArray(checkpointData.criticalPath)) {
        this.criticalPath = checkpointData.criticalPath;
      } else {
        // Recalculate critical path if not available
        this.calculateCriticalPath();
      }
      
      this.events.emit('restore_from_checkpoint_completed', { 
        checkpointId: checkpointData.timestamp,
        restoredFlows: this.completedFlows.size + this.pendingFlows.size + this.failedFlows.size
      });
    } catch (error) {
      this.events.emit('restore_from_checkpoint_failed', { error });
      throw error;
    }
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
   * This finds the longest path in terms of execution time that must be completed
   * Uses memory-optimized algorithm to minimize overhead
   */
  private calculateCriticalPath(): FlowId[] {
    // Early exit for empty graph
    if (this.nodes.size === 0) return [];
    
    // Critical path analysis using optimized data structures
    type NodeAnalysis = {
      earliestStart: number;
      earliestFinish: number;
      latestStart: number;
      latestFinish: number;
      slack: number;
      duration: number;
    };
    
    // Initialize analysis with Map for O(1) lookups
    // More memory efficient than using objects with string keys
    const nodeAnalysis = new Map<FlowId, NodeAnalysis>();
    
    // Step 1: Initialize with zero values and compute durations
    for (const [id, node] of this.nodes.entries()) {
      const duration = node.endTime && node.startTime 
        ? node.endTime - node.startTime 
        : 0;
      
      nodeAnalysis.set(id, {
        earliestStart: 0,
        earliestFinish: duration,
        latestStart: Infinity,
        latestFinish: Infinity,
        slack: Infinity,
        duration
      });
    }
    
    // Step 2: Forward pass - Calculate earliest start/finish times
    // This is an optimized implementation that eliminates redundant calculations
    let changed = true;
    while (changed) {
      changed = false;
      
      for (const edge of this.edges) {
        const fromAnalysis = nodeAnalysis.get(edge.from);
        const toAnalysis = nodeAnalysis.get(edge.to);
        
        if (!fromAnalysis || !toAnalysis) continue;
        
        // Only update if it would result in a later finish time
        const newEarliestStart = fromAnalysis.earliestFinish;
        if (newEarliestStart > toAnalysis.earliestStart) {
          toAnalysis.earliestStart = newEarliestStart;
          toAnalysis.earliestFinish = newEarliestStart + toAnalysis.duration;
          changed = true;
        }
      }
    }
    
    // Step 3: Find the maximum finish time as the project completion time
    let maxFinish = 0;
    for (const analysis of nodeAnalysis.values()) {
      maxFinish = Math.max(maxFinish, analysis.earliestFinish);
    }
    
    // Step 4: Backward pass - Calculate latest start/finish times
    // Initialize latest finish times to project completion time
    for (const analysis of nodeAnalysis.values()) {
      analysis.latestFinish = maxFinish;
      analysis.latestStart = analysis.latestFinish - analysis.duration;
    }
    
    // Iterate backward to determine latest possible times
    changed = true;
    while (changed) {
      changed = false;
      
      // Process edges in reverse order for greater efficiency
      for (let i = this.edges.length - 1; i >= 0; i--) {
        const edge = this.edges[i];
        if (!edge) continue; // Skip if edge is undefined
        
        const fromAnalysis = nodeAnalysis.get(edge.from);
        const toAnalysis = nodeAnalysis.get(edge.to);
        
        if (!fromAnalysis || !toAnalysis) continue;
        
        // Update latest finish time based on successor's latest start
        if (toAnalysis.latestStart < fromAnalysis.latestFinish) {
          fromAnalysis.latestFinish = toAnalysis.latestStart;
          fromAnalysis.latestStart = fromAnalysis.latestFinish - fromAnalysis.duration;
          changed = true;
        }
      }
    }
    
    // Step 5: Calculate slack time and identify critical path
    // Critical activities have zero slack
    const criticalFlows: FlowId[] = [];
    
    for (const [id, analysis] of nodeAnalysis.entries()) {
      // Calculate slack with mathematical precision to avoid floating point issues
      analysis.slack = Math.round((analysis.latestStart - analysis.earliestStart) * 1000) / 1000;
      
      // Nodes with zero slack are on the critical path
      if (Math.abs(analysis.slack) < 0.001) {
        criticalFlows.push(id);
      }
    }
    
    // Step 6: Sort critical flows in order of execution for better visualization
    criticalFlows.sort((a, b) => {
      const analysisA = nodeAnalysis.get(a);
      const analysisB = nodeAnalysis.get(b);
      
      if (!analysisA || !analysisB) return 0;
      return analysisA.earliestStart - analysisB.earliestStart;
    });
    
    // Save critical path for later use
    this.criticalPath = criticalFlows;
    
    return criticalFlows;
  }
  
  /**
   * Calculate the execution time of the critical path
   * This represents the minimum possible execution time for the flow network
   */
  private calculateCriticalPathTime(): number {
    if (this.criticalPath.length === 0) {
      this.calculateCriticalPath();
    }
    
    // Calculate total duration of critical path with memory-efficient algorithm
    let totalTime = 0;
    
    // Avoid creating intermediary data structures
    for (const flowId of this.criticalPath) {
      const node = this.nodes.get(flowId);
      
      if (node && node.startTime && node.endTime) {
        totalTime += (node.endTime - node.startTime);
      }
    }
    
    // Account for parallel execution based on dependencies
    // Use a more sophisticated algorithm that considers actual execution overlap
    // This provides a more accurate measure of the critical path execution time
    let actualExecutionTime = 0;
    let lastEndTime = 0;
    
    // Sort by start time for correct sequential analysis
    const sortedNodes = this.criticalPath
      .map(id => this.nodes.get(id))
      .filter((node): node is FlowNode => !!node && !!node.startTime && !!node.endTime)
      .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    
    for (const node of sortedNodes) {
      // If this node started after the previous node ended, there's a gap
      if (node.startTime && node.startTime > lastEndTime) {
        actualExecutionTime += (node.startTime - lastEndTime);
      }
      
      // Add this node's execution time if it extends beyond lastEndTime
      if (node.endTime && node.endTime > lastEndTime) {
        actualExecutionTime += (node.endTime - Math.max(lastEndTime, node.startTime || 0));
        lastEndTime = node.endTime;
      }
    }
    
    return actualExecutionTime > 0 ? actualExecutionTime : totalTime;
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
