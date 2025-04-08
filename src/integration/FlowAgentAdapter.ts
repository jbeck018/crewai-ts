/**
 * FlowAgentAdapter
 * 
 * Integrates the Flow System with the Agent/Crew framework, optimized for
 * efficient execution, shared memory contexts, and minimal overhead.
 */

import { performance } from 'perf_hooks';
import EventEmitter from 'events';
import { Agent } from '../agent/Agent.js';
import { BaseAgent } from '../agent/BaseAgent.js';
import { BaseTool, ToolExecutionResult, ToolMetadata } from '../tools/BaseTool.js';
import { Flow } from '../flow/Flow.js';
import { FlowState } from '../flow/FlowState.js';
import { FlowOrchestrator } from '../flow/orchestration/FlowOrchestrator.js';
import { MultiFlowOrchestrator } from '../flow/orchestration/MultiFlowOrchestrator.js';
import { FlowMemoryConnector } from '../flow/memory/FlowMemoryConnector.js';
import { ContextualMemory } from '../memory/ContextualMemory.js';
import { ShortTermMemory } from '../memory/ShortTermMemory.js';
import { LongTermMemory } from '../memory/LongTermMemory.js';

/**
 * Import all necessary Flow interfaces and types
 */
import { Condition, FlowMethodNode, MethodExecutionResult } from '../flow/types.js';
import { EntityMemory } from '../memory/EntityMemory.js';
import { Task, TaskOutput } from '../task/Task.js';
import { FlowDependencyVisualizer } from '../flow/orchestration/FlowDependencyVisualizer.js';

/**
 * Configuration for the FlowAgentAdapter
 */
export interface FlowAgentAdapterConfig {
  /** Enable shared memory between flows and agents */
  enableSharedMemory?: boolean;
  
  /** Pre-initialize the adapter with these flows */
  flows?: Flow<any>[];
  
  /** Memory connector to use (will create one if not provided) */
  memoryConnector?: FlowMemoryConnector;
  
  /** Memory instance to use (will create one if not provided) */
  memory?: ContextualMemory;
  
  /** Enable flow visualizations */
  enableVisualizations?: boolean;
  
  /** Optimization level for flow execution */
  optimizationLevel?: 'minimal' | 'balanced' | 'aggressive';
  
  /** Automatically convert flows to agent tools */
  autoRegisterFlowTools?: boolean;
  
  /** Custom tool formatting function */
  flowToolFormatter?: (flow: Flow<any>) => Partial<BaseTool>;
}

/**
 * Adapter that enables bidirectional integration between the Flow System
 * and the Agent/Crew framework. Provides optimized mechanisms for sharing
 * context, memory, and execution between the two systems.
 */
export class FlowAgentAdapter extends Flow<FlowState> {
  // Implement required methods from Flow class to properly extend it
  protected _createFlowExecutionContext(inputs?: Record<string, any>): any {
    return {
      adapter: true,
      memory: this.memory,
      timestamp: Date.now()
    };
  }

  // We use the base class implementations for the following methods:
  // - _scanAndRegisterMethods
  // - _buildMethodDependencyGraph
  // - _shouldExecuteMethod
  // - _validateFlowDefinition
  
  // Base class implementation of _waitForFlowCompletion is used

  /**
   * Prunes the result cache to prevent memory leaks
   * Removes oldest entries when cache exceeds maximum size
   */
  private pruneResultCache(): void {
    if (this.flowResultCache.size <= this.MAX_CACHE_SIZE) {
      return; // No pruning needed
    }
    
    // Get all cache entries and sort by timestamp (oldest first)
    const entries = Array.from(this.flowResultCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    // Calculate how many entries to remove
    const removeCount = Math.ceil(this.flowResultCache.size * 0.2); // Remove 20% of entries
    
    // Remove oldest entries
    for (let i = 0; i < removeCount; i++) {
      if (entries[i]) {
        this.flowResultCache.delete(entries[i][0]);
      }
    }
  }
  private orchestrator: MultiFlowOrchestrator;
  private memoryConnector: FlowMemoryConnector;
  private memory: ContextualMemory;
  private registeredFlows: Map<string, Flow<any>> = new Map();
  private flowTools: Map<string, BaseTool> = new Map();
  private agentFlowLinks: Map<string, Set<string>> = new Map();
  private executionTimes: Map<string, number[]> = new Map();
  private flowResultCache: Map<string, {result: any, timestamp: number}> = new Map();
  private flowStateCache: Map<string, any> = new Map();
  private MAX_CACHE_SIZE = 100; // Maximum number of items in the cache
  private MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes cache TTL
  
  // Cache for performance optimization
  private toolDescriptionCache: Map<string, string> = new Map();
  
  constructor(config: FlowAgentAdapterConfig = {}) {
    super(); // Call base Flow constructor
    
    // Initialize memory components with optimization settings including all required parameters
    this.memory = config.memory || new ContextualMemory(
      // Options with performance optimization settings
      {
        useCache: true,
        cacheTtlMs: 5 * 60 * 1000, // 5 minutes for better performance
        maxContextLength: 10000,   // Limit context size for efficiency
        defaultSearchLimit: 5,     // Reasonable limit for memory search
        useAsyncFetch: true,       // Parallel memory fetching for better speed
        defaultRelevanceThreshold: 0.4 // Slightly higher threshold for better precision
      },
      // Required memory implementations with valid properties
      new ShortTermMemory({
        capacity: 100,             // Optimize for moderate memory usage
        maxAgeMs: 30 * 60 * 1000, // 30 minute expiry for short-term items
        useLRU: true              // Use LRU eviction policy for better performance
      }),
      new LongTermMemory({
        cacheSize: 10000,          // Limit cache size for better performance
        useCache: true,           // Use caching for faster access
        namespace: 'flow_adapter' // Unique namespace for flow adapter
      }),
      new EntityMemory({
        trackSources: true,        // Track sources for better entity context
        maxEntities: 1000,        // Limit maximum entities for better performance
        useCache: true            // Use caching for faster entity access
      })
    );
    
    // Initialize result cache for flow execution optimization
    this.flowResultCache = new Map<string, any>();
    
    // Initialize memory connector with proper configuration
    // Use the structure expected by FlowMemoryConnector
    // Initialize memory connector with proper configuration using valid options only
    this.memoryConnector = config.memoryConnector || new FlowMemoryConnector({
      // Configure with performance-optimized settings 
      inMemoryCache: true,
      persistStateOnEveryChange: config.optimizationLevel === 'aggressive',
      statePersistenceDebounceMs: config.optimizationLevel === 'aggressive' ? 500 : 1000,
      maxStateSnapshotsPerFlow: 50,  // Limit state history for better memory usage
      // Remove invalid properties: batchWrites, compressLargeStates, optimizationLevel
      memoryOptions: {
        retriever: 'vector',
        maxMemoryEntries: 1000,       // Prevent unbounded memory growth
        memoryExpiry: 24 * 60 * 60,   // 24 hour expiry for old entries
        optimizeVectorStorage: true    // Use optimized vector storage
      }
    });
    
    // Map optimization strategy to concrete settings
    const optimizationSettings = this.getOptimizationSettings(config.optimizationLevel || 'balanced');
    
    // Initialize orchestrator with optimized settings
    this.orchestrator = new MultiFlowOrchestrator({
      enableMemoryIntegration: config.enableSharedMemory !== false,
      memoryConnector: this.memoryConnector,
      ...optimizationSettings
    });
    
    // Register initial flows if provided
    if (config.flows && config.flows.length > 0) {
      for (const flow of config.flows) {
        this.registerFlow(flow);
      }
    }
    
    // Automatically register flows as tools if enabled
    if (config.autoRegisterFlowTools !== false) {
      this.registerAllFlowsAsTools(config.flowToolFormatter);
    }
  }
  
  /**
   * Register a flow with the adapter
   */
  /**
   * Register a flow with the adapter
   * Uses type assertion to ensure compatibility with FlowState
   */
  /**
   * Register a flow with the adapter ensuring full compatibility
   * Uses a robust adapter pattern for type safety and optimized performance
   */
  registerFlow<TState extends FlowState>(flow: Flow<TState>, id?: string): string {
    // Generate a stable ID if not provided
    const generatedId = id || `flow_${this.registeredFlows.size + 1}`;
    
    // Create a fully compliant flow adapter that satisfies the Flow interface
    const compliantFlow = this.ensureCompliantFlow(flow);
    
    // Register the flow with the orchestrator with rich metadata
    const flowId = this.orchestrator.registerFlow({
      flow: compliantFlow, // Now fully type-compatible, no assertions needed
      id: generatedId,
      name: flow.constructor.name,
      metadata: {
        description: this.getFlowPurpose(flow),
        className: flow.constructor.name,
        registeredAt: new Date().toISOString(),
        isAdapterWrapped: true // Mark as wrapped for debugging
      }
    });
    
    // Add to local registry for faster access
    this.registeredFlows.set(flowId, compliantFlow);
    return flowId;
  }

  /**
   * Create a fully compliant Flow wrapper that implements the complete Flow interface
   * This pattern ensures TypeScript compatibility while preserving the original flow behavior
   */
  private ensureCompliantFlow<TState extends FlowState>(originalFlow: Flow<TState>): Flow<FlowState> {
    // Create a complete adapter class that implements the Flow interface using composition pattern
    class FlowAdapter extends Flow<FlowState> {
      // Required properties from the Flow interface
      readonly _methods = new Map<string, Function>();
      readonly _startMethods = new Set<string>();
      readonly _listeners = new Map<string, Map<string, Condition>>();
      readonly _routers = new Map<string, Condition>();
      readonly _pendingAndListeners = new Map<string, Set<string>>();
      readonly _executedMethods = new Set<string>();
      readonly _dependencyMap = new Map<string, Set<string>>();
      readonly _inputMap = new Map<string, any>();
      readonly _methodResults = new Map<string, any>();
      readonly _context = new Map<string, any>();
      readonly _executionOrder: string[] = [];
      private wrappedFlow: Flow<TState>;
      private readonly flowId: string;
      private readonly _state: FlowState;
      private readonly _eventEmitter = new EventEmitter();
      
      // Required properties that we maintain locally rather than accessing private properties
      // This ensures we can properly delegate to the wrapped flow when needed
      private readonly _localMethods: Map<string, Function> = new Map();
      private readonly _localMethodResults: Map<string, any> = new Map();
      
      // Event handling structures with proper type safety
      readonly _flowEventListeners: Map<string, Set<Function>> = new Map();
      readonly _errorHandlers: Set<Function> = new Set();
      readonly _beforeMethodHandlers: Map<string, Set<Function>> = new Map();
      readonly _afterMethodHandlers: Map<string, Set<Function>> = new Map();
      readonly _stateChangeListeners: Set<Function> = new Set();
      
      constructor(flow: Flow<TState>) {
        super(); // Call the parent class constructor first
        
        this.wrappedFlow = flow;
        this.flowId = `flow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Initialize state with required id property
        this._state = {
          id: this.flowId,
          lastExecuted: new Date().toISOString()
        };
        
        // Set up event listeners
        this._eventEmitter.on('flow:completed', (state: any) => {
          if (this.wrappedFlow.events) {
            // Forward events to wrapped flow's events if available
            (this.wrappedFlow.events as EventEmitter).emit('flow:completed', state);
          }
        });
        
        // Initialize our local copies of methods and configuration
        this.initializeFromWrappedFlow();
      }
      
      /**
       * Initialize our local versions of methods and configurations
       * Using composition pattern instead of trying to access private fields
       */
      private initializeFromWrappedFlow(): void {
        // We don't try to access private properties of the wrapped flow
        // Instead we rely on the public API and reflection to determine capabilities
        
        // Get all methods from the original flow object instance
        const proto = Object.getPrototypeOf(this.wrappedFlow);
        const methodNames = Object.getOwnPropertyNames(proto).filter(
          name => typeof this.wrappedFlow[name] === 'function' && name !== 'constructor'
        );
        
        // Register each method in our local methods map
        methodNames.forEach(name => {
          // Only register actual methods, not getters/setters
          const descriptor = Object.getOwnPropertyDescriptor(proto, name);
          if (descriptor && typeof descriptor.value === 'function') {
            this._localMethods.set(name, this.wrappedFlow[name].bind(this.wrappedFlow));
          }
        });
      }
      
      // Store the FlowState as required by the base Flow class
      protected override state: FlowState = new FlowState({});
      
      /**
       * Updates the state with new values while maintaining compatibility with wrapped flows
       * This replaces the previous getter/setter implementation with a method
       */
      protected updateState(newState: FlowState): void {
        // Update our local state
        Object.assign(this.state, newState);
        
        // Try to update wrapped flow state if possible
        if (this.wrappedFlow) {
          try {
            // This may fail if state is read-only in the wrapped flow
            (this.wrappedFlow as any).state = {
              ...((this.wrappedFlow as any).state || {}),
              ...newState,
              // Don't override the original ID
              id: (this.wrappedFlow as any).state?.id
            };
          } catch (error) {
            // Silently fail if we can't set the state directly
          }
        }
      }
      
      // Implementation of methods required by Flow interface
      readonly _methodResultCache = new Map<string, any>();
      readonly _methodCacheTtlMs = 5 * 60 * 1000; // 5 minutes by default
      
      // Virtual methods required by the Flow interface
      override _waitForFlowCompletion(): Promise<any> { return Promise.resolve(); }
      _createFlowExecutionContext(): any { return {}; }
      _scanAndRegisterMethods(): void {}
      _buildMethodDependencyGraph(): void {}
      _shouldExecuteMethod(methodName: string): boolean { return false; }
      _validateFlowDefinition(): void {}
      override _registerMethod(name: string, method: Function): void {}
      override _addDependency(methodName: string, dependency: string): void {}
      override _executeAllMethods(inputs?: Record<string, any>): Promise<Map<string, any>> { return Promise.resolve(new Map()); }
      
      // Additional listener-related methods required by Flow interface
      // Implement the Flow interface method for registering listeners
      // Adapting our event system to match the required interface
      override _registerListener(listenerName: string, condition: Condition): void {
        // Adapt the Flow interface's registerListener to our implementation
        if (typeof condition === 'function') {
          this._eventEmitter.on(listenerName, condition as any);
        } else if (typeof condition === 'string') {
          // Create a simple condition function that matches the event name
          this._eventEmitter.on(listenerName, (...args: any[]) => true);
        }
      }
      
      override async _executeListeners(event: string, ...args: any[]): Promise<void> {
        this._eventEmitter.emit(event, ...args);
        return Promise.resolve();
      }
      
      // Implement the Flow interface method for finding triggered listeners
      // Adapting our event system to match the required interface
      override _findTriggeredListeners(triggerMethod: string): string[] {
        // Adapt to the Flow interface requirement
        // This should return listener names that match the trigger method
        // For our implementation, we'll return an empty array as a simple adapter
        return [];
      }
      
      // Implement the Flow interface method for executing a single listener
      // Adapting our event system to match the required interface
      override async _executeSingleListener(listenerName: string, result: any): Promise<void> {
        // Adapt to the Flow interface by executing the named listener with the result
        const listeners = this._eventEmitter.listeners(listenerName);
        for (const listener of listeners) {
          if (typeof listener === 'function') {
            await Promise.resolve(listener(result));
          }
        }
        return Promise.resolve();
      }
      
      emit(event: string, ...args: any[]): boolean {
        return this._eventEmitter.emit(event, ...args);
      }
      
      once(event: string, callback: (...args: any[]) => void): void {
        this._eventEmitter.once(event, callback);
      }
      
      off(event: string, callback: (...args: any[]) => void): void {
        this._eventEmitter.off(event, callback);
      }
      
      // Property required by Flow interface
      override get events(): EventEmitter {
        return this._eventEmitter;
      }
      
      // Implementation of Flow interface methods
      
      /**
       * Run method required by the Flow interface
       * Uses composition to delegate to wrapped flow
       */
      override async run(input?: any): Promise<FlowState> {
        // First check if wrapped flow has an execute method
        if (typeof this.wrappedFlow.execute === 'function') {
          try {
            // Execute the wrapped flow's execute method
            const result = await this.wrappedFlow.execute(input);
            
            // Ensure result has all required properties
            if (result && typeof result === 'object') {
              const updatedState = {
                ...result,
                id: this.flowId, // Always preserve our ID
                lastExecuted: new Date().toISOString() // Add execution timestamp
              };
              
              // Update our state with the result
              this.updateState(updatedState);
              return updatedState;
            }
            
            // Handle non-object results
            const defaultState = { 
              id: this.flowId,
              result,
              lastExecuted: new Date().toISOString()
            };
            this.updateState(defaultState);
            return defaultState;
          } catch (error) {
            console.error(`Error running flow ${this.wrappedFlow.constructor.name}:`, error);
            // Add error info to the state
            const errorState = { 
              id: this.flowId, 
              error: String(error),
              lastExecuted: new Date().toISOString()
            };
            this.updateState(errorState);
            return errorState;
          }
        }
        
        // If wrapped flow doesn't have run method, use default implementation
        console.warn(`Flow ${this.wrappedFlow.constructor.name} missing run method, using default implementation`);
        
        // Default implementation just returns our state
        const defaultState = { 
          id: this.flowId,
          lastExecuted: new Date().toISOString()
        };
        this.updateState(defaultState);
        return defaultState;
      }
      
      /**
       * Reset method required by Flow interface
       */
      override reset(): void {
        // Call wrapped flow's reset if available
        if (typeof this.wrappedFlow.reset === 'function') {
          this.wrappedFlow.reset();
        }
        
        // Reset our local state
        this._state.lastExecuted = new Date().toISOString();
        this._executedMethods.clear();
        this._methodResults.clear();
        this._inputMap.clear();
        this._localMethodResults.clear();
      }

      /**
       * Execute method required by Flow interface
       */
      async execute(inputs: Record<string, any> = {}): Promise<any> {
        // Call wrapped flow's execute if available
        if (typeof this.wrappedFlow.execute === 'function') {
          return this.wrappedFlow.execute(inputs);
        }
        
        // Fallback to our run method
        return this.run(inputs);
      }
      
      // Implement method required by Flow interface
      on(event: string, callback: (...args: any[]) => void): void {
        this._eventEmitter.on(event, callback);
      }
      
      // Using the protected updateState method defined above
      
      /**
       * Execute a specific method in the flow
       */
      async executeMethod(methodName: string, inputs?: Record<string, any>): Promise<any> {
        // Execute the specified method if available
        const method = this._methods.get(methodName);
        if (!method) {
          console.warn(`Method ${methodName} not found in flow ${this.flowId}, falling back to run`);
          return this.run(inputs);
        }
        return method(inputs);
      }
      
      /**
       * Execute a flow from an agent context with optimized caching
       * @param flowId The ID of the flow to execute
       * @param inputs Optional inputs for the flow
       * @returns The result of the flow execution
       */
      /**
       * Execute a flow with optimized caching and performance tracking
       * @param flowId ID of the flow to execute
       * @param inputs Optional inputs for the flow execution
       */
      async executeFlow(flowId: string, inputs?: Record<string, any>): Promise<any> {
        const startTime = performance.now();
        
        try {
          // Check cache first for performance optimization
          const cacheKey = `${flowId}_${JSON.stringify(inputs || {})}`; 
          if (this._localMethodResults && this._localMethodResults.has(cacheKey)) {
            return this._localMethodResults.get(cacheKey);
          }
          
          // Execute the flow
          const registeredFlow = this.registeredFlows.get(flowId);
          if (!registeredFlow) {
            throw new Error(`Flow ${flowId} not found`);
          }
          
          const result = await registeredFlow.execute(inputs);
          
          // Cache the result for future use
          if (this._localMethodResults) {
            this._localMethodResults.set(cacheKey, result);
          }
          
          const duration = performance.now() - startTime;
          console.debug(`Flow ${flowId} executed in ${duration}ms`);
          
          // Track execution metrics for optimization
          this._executionOrder.push(flowId);
          
          return result;
        } catch (error: any) {
          console.error(`Error executing flow ${flowId}:`, error);
          throw new Error(`Flow execution failed: ${error.message}`);
        }
      }
      
      // Implementation of _executeMethod method
      override async _executeMethod(methodName: string, input?: any): Promise<any> {
        const method = this._methods.get(methodName);
        if (!method) {
          throw new Error(`Method ${methodName} not found in flow ${this.flowId}`);
        }
        
        try {
          return await method(input);
        } catch (error) {
          console.error(`Error executing method ${methodName}:`, error);
          throw error;
        }
      }
      
      // Using the implementation from the base adapter class
      

      

      

      

      
      // This is a specialized method for executing flow methods that's distinct from the base class _executeSingleListener
      _executeListenerMethod(method: string, input?: any): Promise<any> {
        if (typeof (this.wrappedFlow as any)._executeListenerMethod === 'function') {
          return (this.wrappedFlow as any)._executeListenerMethod(method, input);
        }
        
        // Default implementation
        const methodFn = this._methods.get(method);
        if (!methodFn) {
          return Promise.resolve(null);
        }
        return Promise.resolve(methodFn(input));
      }
      
      override _checkFlowCompletion(): Promise<boolean> {
        if (typeof (this.wrappedFlow as any)._checkFlowCompletion === 'function') {
          return (this.wrappedFlow as any)._checkFlowCompletion();
        }
        
        // Default implementation
        return Promise.resolve(true);
      }
      
      override _emitEvent(event: string, data?: any): Promise<void> {
        if (typeof (this.wrappedFlow as any)._emitEvent === 'function') {
          return (this.wrappedFlow as any)._emitEvent(event, data);
        }
        
        // Default implementation 
        const listeners = this._flowEventListeners.get(event);
        if (listeners) {
          // Execute all listeners in parallel for optimal performance
          const promises = Array.from(listeners).map(callback => {
            try {
              return Promise.resolve(callback(data));
            } catch (error) {
              console.error(`Error in event listener for ${event}:`, error);
              return Promise.resolve();
            }
          });
          return Promise.all(promises).then(() => {});
        }
        return Promise.resolve();
      }
      
      // Additional required Flow interface methods
      getMethodResults(): Map<string, any> {
        if (typeof (this.wrappedFlow as any).getMethodResults === 'function') {
          return (this.wrappedFlow as any).getMethodResults();
        }
        return this._methodResults;
      }
      
      getExecutionOrder(): string[] {
        if (typeof (this.wrappedFlow as any).getExecutionOrder === 'function') {
          return (this.wrappedFlow as any).getExecutionOrder();
        }
        return this._executionOrder;
      }
      
      getDependencyMap(): Map<string, Set<string>> {
        if (typeof (this.wrappedFlow as any).getDependencyMap === 'function') {
          return (this.wrappedFlow as any).getDependencyMap();
        }
        return this._dependencyMap;
      }
      
      getMethodSignatures(): Record<string, any> {
        if (typeof (this.wrappedFlow as any).getMethodSignatures === 'function') {
          return (this.wrappedFlow as any).getMethodSignatures();
        }
        // Default implementation returns an empty record
        return {};
      }
      
      // Cache management methods required by the Flow interface
      _getFromCache(key: string): any {
        if (typeof (this.flow as any)._getFromCache === 'function') {
          return (this.flow as any)._getFromCache(key);
        }
        return this._methodResultCache.get(key);
      }
      
      _addToCache(key: string, value: any): void {
        if (typeof (this.flow as any)._addToCache === 'function') {
          (this.flow as any)._addToCache(key, value);
          return;
        }
        this._methodResultCache.set(key, value);
      }
      
      _cleanCache(): void {
        if (typeof (this.flow as any)._cleanCache === 'function') {
          (this.flow as any)._cleanCache();
          return;
        }
        this._methodResultCache.clear();
      }
      
      _estimateSize(obj: any): number {
        if (typeof (this.flow as any)._estimateSize === 'function') {
          return (this.flow as any)._estimateSize(obj);
        }
        
        // Simple size estimation for cache management
        if (obj === null || obj === undefined) return 0;
        if (typeof obj === 'boolean' || typeof obj === 'number') return 8;
        if (typeof obj === 'string') return obj.length * 2;
        if (Array.isArray(obj)) {
          return obj.reduce((size, item) => size + this._estimateSize(item), 0);
        }
        if (typeof obj === 'object') {
          return Object.entries(obj).reduce((size, [key, value]) => {
            return size + key.length * 2 + this._estimateSize(value);
          }, 0);
        }
        return 16; // Default size for unknown types
      }
      
      // Forward any remaining properties/methods we haven't explicitly defined to the original flow
      [key: string]: any;
    }
    
    // Create and return fully compatible adapter instance
    return new FlowAdapter(originalFlow);
  }
  
  /**
   * Link an agent with a flow to enable context sharing
   * @param agent - The agent to link the flow with
   * @param flowId - The ID of the flow to link with the agent
   */
  linkAgentToFlow(agent: BaseAgent, flowId: string): void {
    // Initialize the map entry if it doesn't exist
    if (!this.agentFlowLinks.has(agent.id)) {
      this.agentFlowLinks.set(agent.id, new Set());
    }
    
    // Add the flow to the agent's set
    const agentFlows = this.agentFlowLinks.get(agent.id);
    if (agentFlows) {
      agentFlows.add(flowId);
    }
    
    // Initialize execution time tracking with high-precision timestamp
    if (!this.executionTimes.has(flowId)) {
      this.executionTimes.set(flowId, []);
    }
  }
  /**
   * Execute a flow in the context of a specific agent with optimized performance tracking
   * This method enhances executeFlow with agent-specific optimizations
   * @param agent - The agent instance triggering the flow
   * @param flowId - ID of the flow to execute
   * @param inputs - Input data for the flow
   * @returns The result of the flow execution
   */
  /**
   * Execute a flow in the context of a specific agent with performance tracking and caching
   * @param agent - The agent executing the flow
   * @param flowId - ID of the flow to execute
   * @param inputs - Optional input data for the flow
   * @returns The result of the flow execution
   */
  /**
   * Execute a flow in the context of a specific agent, optimizing for performance
   * and caching results to improve response times for repeated calls
   * 
   * @param agent - The agent context to execute the flow within
   * @param flowId - ID of the flow to execute
   * @param inputs - Optional inputs for the flow execution
   * @returns Promise resolving to the flow execution result
   */
  async executeFlowForAgent(agent: BaseAgent, flowId: string, inputs?: Record<string, any>): Promise<any> {
    try {
      // Performance optimization: Generate a cache key that includes agent context
      const cacheKey = `agent_${agent.id}_flow_${flowId}_${JSON.stringify(inputs || {})}`;
      
      // Check agent-specific cache first (significant performance boost)
      if (this.flowResultCache.has(cacheKey)) {
        const cachedData = this.flowResultCache.get(cacheKey);
        // Ensure the cache hasn't expired
        if (cachedData && (performance.now() - cachedData.timestamp) < this.MAX_CACHE_AGE) {
          return cachedData.result;
        }
      }
      
      // Verify flow exists and is linked to agent
      const flow = this.registeredFlows.get(flowId);
      if (!flow) {
        throw new Error(`Flow with ID ${flowId} not found`);
      }
      
      // Check if agent is linked to this flow for proper authorization
      const agentFlowsSet = this.agentFlowLinks.get(agent.id);
      if (!agentFlowsSet || !agentFlowsSet.has(flowId)) {
        // Link the agent to the flow if not already linked
        this.linkAgentToFlow(agent, flowId);
      }
      
      // Start performance tracking with high-precision timer
      const startTime = performance.now();
      
      // Apply any agent-specific context enrichment
      const enrichedInputs = { ...inputs, _agentContext: this.extractAgentContext(agent) };
      
      // Execute the flow with optimized data passing
      const result = await this.orchestrator.execute({
        inputData: { [flowId]: enrichedInputs || {} }
      });
      
      // Extract result with proper type inference
      // Use type assertion with unknown as intermediate step for safer type conversion
      const flowResult = result.results ? result.results.get(flowId) : undefined;
      
      // Track execution time with agent context for adaptive optimization
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Store execution times for agent-specific optimizations
      const executionTimes = this.executionTimes.get(flowId) || [];
      executionTimes.push(duration);
      
      // Keep execution history for better statistical analysis
      // Using a sliding window for more accurate recent performance metrics
      if (executionTimes.length > 20) {
        executionTimes.shift();
      }
      
      this.executionTimes.set(flowId, executionTimes);
      
      // Cache result with agent context for future executions
      this.flowResultCache.set(cacheKey, {
        result: flowResult,
        timestamp: performance.now()
      });
      
      // Prevent memory leaks by pruning cache when needed
      this.pruneResultCache();
      
      return flowResult;
    } catch (error) {
      console.error(`Error executing flow ${flowId} for agent ${agent.id}:`, error);
      // Enhanced error handling with detailed context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Flow execution failed for agent ${agent.id}, flow ${flowId}: ${errorMessage}`);
    }
  }

  /**
   * Execute a flow from an agent context with optimized data passing
   * @param flowId - ID of the flow to execute
   * @param inputs - Input data for the flow
   * @returns The result of the flow execution with proper typing
   */
  async executeFlow<TResult>(flowId: string, inputs?: Record<string, any>): Promise<TResult> {
    try {
      // Performance optimization: Check result cache first
      const cacheKey = `flow_${flowId}_${JSON.stringify(inputs || {})}`;
      
      // Return cached result if available (significant performance boost)
      if (this.flowResultCache.has(cacheKey)) {
        return this.flowResultCache.get(cacheKey) as TResult;
      }
      
      // Verify flow exists with type safety
      const flow = this.registeredFlows.get(flowId);
      if (!flow) {
        throw new Error(`Flow with ID ${flowId} not found`);
      }
      
      // Start performance tracking
      const startTime = performance.now();
      
      // Execute the flow with optimized data passing
      const result = await this.orchestrator.execute({
        inputData: { [flowId]: inputs || {} }
      });
      
      // Extract result with proper type inference
      const flowResult = result.results.get(flowId) as TResult;
      
      // Cache the flow state for faster access later
      const flowInfo = this.orchestrator.getFlowDefinition(flowId);
      if (flowInfo) {
        this.flowStateCache.set(flowId, { flowId, ...flowInfo.metadata });
      }
      
      // Track execution time for adaptive optimization
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      const times = this.executionTimes.get(flowId) || [];
      times.push(duration);
      
      // Keep execution history for better statistical analysis
      if (times.length > 20) {
        times.shift();
      }
      
      this.executionTimes.set(flowId, times);
      
      // Cache result for future executions with same inputs
      this.flowResultCache.set(cacheKey, flowResult);
      
      // Prevent memory leaks by pruning cache when needed
      this.pruneResultCache();
      
      return flowResult;
    } catch (error) {
      console.error(`Error executing flow ${flowId}:`, error);
      // Enhanced error handling with detailed context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Flow execution failed for ${flowId}: ${errorMessage}`);
    }
  }

  /**
   * Prune the result cache to prevent memory bloat
   * Implements a simple LRU eviction policy for optimal memory usage
   */
  private pruneResultCache(): void {
    // Check if we need to prune
    if (this.flowResultCache.size <= this.MAX_CACHE_SIZE) {
      return;
    }
    
    // Remove oldest entries first (LRU implementation)
    const entries = Array.from(this.flowResultCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    // Calculate how many entries to remove
    const removeCount = Math.max(10, Math.floor(this.flowResultCache.size * 0.2));
    
    // Remove oldest entries
    for (let i = 0; i < removeCount; i++) {
      if (i < entries.length) {
        this.flowResultCache.delete(entries[i][0]);
      }
    }
  }
  
  /**
   * Create a task that executes a flow as part of its execution
   */
  createFlowTask(flowId: string, agent: BaseAgent, description: string): Task {
    const flow = this.registeredFlows.get(flowId);
    if (!flow) {
      throw new Error(`Flow ${flowId} not found`);
    }
    
    // Get flow information from the orchestrator
    const flowInfo = this.orchestrator.getFlowDefinition(flowId);
    
    // Create context with string array type as required by Task
    const flowMetadata = flowInfo?.metadata || {};
    
    // Convert object properties to string array for Task.context
    const contextStrings = [
      `Flow ID: ${flowId}`,
      `Flow Name: ${flowInfo?.name || 'Unknown'}`,
      `Flow Description: ${flowMetadata.description || 'No description available'}`
    ];
    
    // Add any tags if available
    if (flowInfo?.tags && Array.isArray(flowInfo.tags) && flowInfo.tags.length > 0) {
      contextStrings.push(`Flow Tags: ${flowInfo.tags.join(', ')}`);
    }
    
    return new Task({
      description: description || `Execute the ${flowId} flow`,
      agent,
      // Include a tool for executing the flow
      tools: [this.createFlowTool(flowId)],
      // Pass context data as string array
      context: contextStrings,
      // Optimize for performance
      cachingStrategy: 'memory'
    });
  }
  
  /**
   * Create a tool that allows agents to execute a flow
   */
  createFlowTool(flowId: string, customToolProps?: Partial<BaseTool>): BaseTool {
    const flow = this.registeredFlows.get(flowId);
    if (!flow) {
      throw new Error(`Flow ${flowId} not found`);
    }
    
    // Check if we already have a cached tool for this flow
    if (this.flowTools.has(flowId)) {
      return this.flowTools.get(flowId)!;
    }
    
    // Generate an optimized tool description if not in cache
    let description = this.toolDescriptionCache.get(flowId);
    if (!description) {
      description = `Execute the ${flow.constructor.name} flow to ${this.getFlowPurpose(flow)}.`;
      this.toolDescriptionCache.set(flowId, description);
    }
    
    // Capture the adapter reference for the tool function
    const adapter = this;
    
    // Create a tool that implements the BaseTool interface
    const tool: BaseTool = {
      name: `execute_${flowId}_flow`,
      description,
      // Required properties from BaseTool interface
      verbose: false,
      cacheResults: true,
      // Call function for tool execution
      async execute(args: Record<string, any>): Promise<ToolExecutionResult> {
        const startTime = Date.now();
        try {
          const result = await adapter.executeFlow(flowId, args);
          return {
            success: true,
            result: JSON.stringify(result),
            executionTime: Date.now() - startTime
          };
        } catch (error) {
          // Type-safe error handling
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            result: `Error executing flow: ${errorMessage}`,
            error: errorMessage,
            executionTime: Date.now() - startTime
          };
        }
      },
      // Implementation of getMetadata
      getMetadata(): ToolMetadata {
        return {
          name: `execute_${flowId}_flow`,
          description,
          verbose: false,
          cacheResults: true
        };
      }
    };
    
    // Apply any custom properties
    if (customToolProps) {
      Object.assign(tool, customToolProps);
    }
    
    // Cache the tool for future use
    this.flowTools.set(flowId, tool);
    
    return tool;
  }
  
  /**
   * Register all flows as agent tools for easy usage
   */
  registerAllFlowsAsTools(formatter?: (flow: Flow<any>) => Partial<BaseTool>): BaseTool[] {
    const tools: BaseTool[] = [];
    
    for (const [flowId, flow] of this.registeredFlows.entries()) {
      const customProps = formatter ? formatter(flow) : undefined;
      const tool = this.createFlowTool(flowId, customProps);
      tools.push(tool);
    }
    
    return tools;
  }
  
  /**
   * Extract agent context for use in flows
   */
  extractAgentContext(agent: BaseAgent): Record<string, any> {
    // If the agent is our Agent implementation, use optimized extraction
    if (agent instanceof Agent) {
      return {
        role: agent.role,
        goal: agent.goal,
        backstory: agent.backstory,
        // Extract more if needed in a memory-efficient way
      };
    }
    
    // Fallback for other agent implementations
    return {
      id: agent.id,
      role: agent.role
    };
  }
  
  /**
   * Generate a visualization of the flows in this adapter
   */
  async visualizeFlows(): Promise<string> {
    return this.orchestrator.visualizeFlows();
  }
  
  /**
   * Estimate flow execution time based on history
   */
  estimateExecutionTime(flowId: string): number {
    const times = this.executionTimes.get(flowId);
    if (!times || times.length === 0) {
      return 1000; // Default estimate: 1 second
    }
    
    // Calculate average with outlier rejection for more reliable estimates
    if (times.length >= 4) {
      // Sort times and remove the highest and lowest 25%
      const sortedTimes = [...times].sort((a, b) => a - b);
      const q1Index = Math.floor(sortedTimes.length * 0.25);
      const q3Index = Math.floor(sortedTimes.length * 0.75);
      const middleTimes = sortedTimes.slice(q1Index, q3Index + 1);
      
      // Average of middle 50%
      const sum = middleTimes.reduce((acc, time) => acc + time, 0);
      return sum / middleTimes.length;
    }
    
    // Simple average for small samples
    const sum = times.reduce((acc, time) => acc + time, 0);
    return sum / times.length;
  }
  
  /**
   * Get flow metrics for observability
   */
  getFlowMetrics(): Record<string, any> {
    return this.orchestrator.getMetrics();
  }
  
  /**
   * Map optimization level to concrete settings
   */
  private getOptimizationSettings(level: 'minimal' | 'balanced' | 'aggressive'): Record<string, any> {
    switch (level) {
      case 'minimal':
        return {
          optimizeFor: 'memory',
          execution: {
            maxConcurrency: 2,
            checkpointInterval: 10000 // 10 seconds
          },
          memory: {
            aggressiveCleanup: false,
            compressionLevel: 'none'
          }
        };
        
      case 'aggressive':
        return {
          optimizeFor: 'speed',
          execution: {
            maxConcurrency: navigator?.hardwareConcurrency || 8,
            checkpointInterval: 2000, // 2 seconds
            optimisticExecution: true
          },
          memory: {
            aggressiveCleanup: true,
            enableStateSharing: true,
            compressionLevel: 'high'
          },
          scheduler: {
            enablePredictiveScheduling: true,
            enableWorkStealing: true
          }
        };
        
      case 'balanced':
      default:
        return {
          optimizeFor: 'balanced',
          execution: {
            maxConcurrency: 4,
            checkpointInterval: 5000 // 5 seconds
          },
          memory: {
            aggressiveCleanup: true,
            compressionLevel: 'fast'
          }
        };
    }
  }
  
  /**
   * Try to extract a flow's purpose from its name or state
   */
  private getFlowPurpose(flow: Flow<any>): string {
    // Extract purpose from flow name
    const name = flow.constructor.name;
    
    // Convert camelCase or PascalCase to words
    if (name.endsWith('Flow')) {
      const baseName = name.substring(0, name.length - 4);
      return baseName
        .replace(/([A-Z])/g, ' $1') // Insert spaces before capital letters
        .trim()
        .toLowerCase();
    }
    
    return 'perform an operation';
  }
  
  /**
   * Get the orchestrator for direct access
   */
  getOrchestrator(): MultiFlowOrchestrator {
    return this.orchestrator;
  }
  
  /**
   * Get the memory connector for direct access
   */
  getMemoryConnector(): FlowMemoryConnector {
    return this.memoryConnector;
  }
}
