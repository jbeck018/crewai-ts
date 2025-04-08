/**
 * FlowMemoryConnector
 * 
 * Provides optimized integration between the Flow System and Memory components,
 * allowing flows to persist their state and execution history with high performance.
 */

import { Flow, FlowState } from '../index.js';
import { ContextualMemory, ContextualMemoryOptions } from '../../memory/contextual-memory.js';
import { MemoryRetriever } from '../../memory/retrieval.js';
import { VectorStoreMemory } from '../../memory/vector-store.js';
import { MemoryItem } from '../../memory/types.js';

// Flow memory item types for optimized retrieval
export enum FlowMemoryType {
  STATE = 'flow_state',
  EXECUTION = 'flow_execution',
  METHOD_RESULT = 'flow_method_result',
  ERROR = 'flow_error',
  CONFIG = 'flow_config'
}

// Optimized interface for flow memory items
export interface FlowMemoryItem extends MemoryItem {
  flowId: string;
  flowType: string;
  flowVersion?: string;
  memoryType: FlowMemoryType;
  timestamp: number;
  metadata?: Record<string, any>;
}

// Options for flow memory connector with optimization controls
export interface FlowMemoryConnectorOptions {
  // Memory system options
  memoryOptions?: Partial<ContextualMemoryOptions>;
  
  // Persistence optimization settings
  persistStateOnEveryChange?: boolean;
  persistMethodResults?: boolean;
  statePersistenceDebounceMs?: number;
  
  // Performance optimization settings
  useCompression?: boolean;
  maxStateSnapshotsPerFlow?: number;
  inMemoryCache?: boolean;
  inMemoryCacheTTL?: number;
  
  // Additional metadata to add to all flow memory items
  additionalMetadata?: Record<string, any>;
}

/**
 * FlowMemoryConnector provides an optimized bridge between Flow System and Memory
 * components, enabling persistent flow state, execution history, and result retrieval.
 */
export class FlowMemoryConnector<TState extends FlowState = FlowState> {
  private memory: ContextualMemory;
  private retriever: MemoryRetriever;
  private options: FlowMemoryConnectorOptions;
  private flow?: Flow<TState>;
  
  // Performance optimizations
  private pendingStateUpdates: Map<string, NodeJS.Timeout> = new Map();
  private stateCache: Map<string, {state: TState, timestamp: number}> = new Map();
  private methodResultCache: Map<string, any> = new Map();
  
  constructor(options: FlowMemoryConnectorOptions = {}) {
    // Set default options with optimization presets
    this.options = {
      persistStateOnEveryChange: false,
      persistMethodResults: true,
      statePersistenceDebounceMs: 1000, // Debounce updates for performance
      useCompression: true,
      maxStateSnapshotsPerFlow: 10,
      inMemoryCache: true,
      inMemoryCacheTTL: 5 * 60 * 1000, // 5 minutes
      ...options
    };
    
    // Initialize optimized memory system
    this.memory = new ContextualMemory({
      retriever: 'vector', // Use vector store for optimized semantic retrieval
      maxMemoryEntries: 1000,
      memoryExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
      ...(options.memoryOptions || {})
    });
    
    this.retriever = this.memory.retriever;
  }
  
  /**
   * Connect to a flow instance and set up event listeners with optimized debouncing
   */
  connectToFlow(flow: Flow<TState>): void {
    this.flow = flow;
    
    // Store initial flow configuration
    this.persistFlowConfig(flow);
    
    // Set up optimized event listeners
    if (this.options.persistStateOnEveryChange) {
      // Listen for all state changes with debouncing
      flow.events.on('state_changed', () => {
        this.debouncedPersistState(flow);
      });
    }
    
    // Always persist state at the start of flow execution
    flow.events.on('flow_started', () => {
      this.persistFlowState(flow, 'started');
    });
    
    // Always persist state at the end of flow execution
    flow.events.on('flow_finished', () => {
      this.persistFlowState(flow, 'finished');
    });
    
    // Persist method results if enabled
    if (this.options.persistMethodResults) {
      flow.events.on('method_execution_finished', (event) => {
        this.persistMethodResult(flow, event.methodName, event.result, event.duration);
      });
    }
    
    // Always persist errors
    flow.events.on('error', (event) => {
      this.persistFlowError(flow, event.error, event.methodName);
    });
  }
  
  /**
   * Debounced state persistence for performance optimization
   */
  private debouncedPersistState(flow: Flow<TState>): void {
    const flowId = this.getFlowId(flow);
    
    // Clear any existing debounce timer
    if (this.pendingStateUpdates.has(flowId)) {
      clearTimeout(this.pendingStateUpdates.get(flowId)!);
    }
    
    // Set new debounce timer
    const timeout = setTimeout(() => {
      this.persistFlowState(flow, 'updated');
      this.pendingStateUpdates.delete(flowId);
    }, this.options.statePersistenceDebounceMs);
    
    this.pendingStateUpdates.set(flowId, timeout);
  }
  
  /**
   * Persist flow state with optimized storage
   */
  async persistFlowState(flow: Flow<TState>, status: 'started' | 'updated' | 'finished'): Promise<string> {
    const flowId = this.getFlowId(flow);
    const flowType = flow.constructor.name;
    
    // Create optimized state snapshot
    let stateData: any;
    
    if (this.options.useCompression) {
      // Use structured clone to deep clone the state
      // and then strip any circular references or functions
      stateData = this.prepareStateForStorage(flow.state);
    } else {
      stateData = flow.state;
    }
    
    // Store in memory cache for fast retrieval
    if (this.options.inMemoryCache) {
      this.stateCache.set(flowId, {
        state: flow.state as TState,
        timestamp: Date.now()
      });
    }
    
    // Create memory item with optimized metadata
    const memoryItem: FlowMemoryItem = {
      content: JSON.stringify(stateData),
      flowId,
      flowType,
      flowVersion: flow.version || '1.0.0',
      memoryType: FlowMemoryType.STATE,
      timestamp: Date.now(),
      metadata: {
        status,
        ...this.options.additionalMetadata
      }
    };
    
    // Limit the number of snapshots per flow for performance
    if (this.options.maxStateSnapshotsPerFlow) {
      await this.pruneStateSnapshots(flowId);
    }
    
    // Persist to memory system
    const id = await this.memory.add(memoryItem);
    return id;
  }
  
  /**
   * Persist flow configuration
   */
  async persistFlowConfig(flow: Flow<TState>): Promise<string> {
    const flowId = this.getFlowId(flow);
    const flowType = flow.constructor.name;
    
    // Extract config (non-state data)
    const config = {
      flowId,
      flowType,
      flowVersion: flow.version || '1.0.0',
      options: flow.options,
      methods: this.getFlowMethods(flow),
      // Track when this flow config was first persisted
      firstPersisted: Date.now()
    };
    
    // Create memory item
    const memoryItem: FlowMemoryItem = {
      content: JSON.stringify(config),
      flowId,
      flowType,
      flowVersion: flow.version || '1.0.0',
      memoryType: FlowMemoryType.CONFIG,
      timestamp: Date.now(),
      metadata: this.options.additionalMetadata
    };
    
    // Persist to memory system
    const id = await this.memory.add(memoryItem);
    return id;
  }
  
  /**
   * Persist method execution result with performance optimizations
   */
  async persistMethodResult(
    flow: Flow<TState>, 
    methodName: string, 
    result: any, 
    executionTime?: number
  ): Promise<string> {
    const flowId = this.getFlowId(flow);
    const flowType = flow.constructor.name;
    
    // Prepare result data for storage, optimizing for size
    const resultData = this.prepareResultForStorage(result);
    
    // Cache result in memory for fast retrieval
    if (this.options.inMemoryCache) {
      const cacheKey = `${flowId}:${methodName}`;
      this.methodResultCache.set(cacheKey, resultData);
    }
    
    // Create memory item
    const memoryItem: FlowMemoryItem = {
      content: JSON.stringify(resultData),
      flowId,
      flowType,
      flowVersion: flow.version || '1.0.0',
      memoryType: FlowMemoryType.METHOD_RESULT,
      timestamp: Date.now(),
      metadata: {
        methodName,
        executionTime,
        ...this.options.additionalMetadata
      }
    };
    
    // Persist to memory system
    const id = await this.memory.add(memoryItem);
    return id;
  }
  
  /**
   * Persist flow execution error
   */
  async persistFlowError(
    flow: Flow<TState>, 
    error: Error, 
    methodName?: string
  ): Promise<string> {
    const flowId = this.getFlowId(flow);
    const flowType = flow.constructor.name;
    
    // Create memory item
    const memoryItem: FlowMemoryItem = {
      content: JSON.stringify({
        message: error.message,
        stack: error.stack,
        name: error.name,
        methodName
      }),
      flowId,
      flowType,
      flowVersion: flow.version || '1.0.0',
      memoryType: FlowMemoryType.ERROR,
      timestamp: Date.now(),
      metadata: {
        methodName,
        errorType: error.name,
        ...this.options.additionalMetadata
      }
    };
    
    // Persist to memory system
    const id = await this.memory.add(memoryItem);
    return id;
  }
  
  /**
   * Get the latest state for a flow, optimized for performance
   */
  async getLatestFlowState<T extends TState = TState>(flowId: string): Promise<T | null> {
    // Check in-memory cache first for optimal performance
    if (this.options.inMemoryCache) {
      const cached = this.stateCache.get(flowId);
      if (cached && Date.now() - cached.timestamp < this.options.inMemoryCacheTTL!) {
        return cached.state as unknown as T;
      }
    }
    
    // Query memory system with optimized filtering
    const items = await this.memory.get({
      metadata: {
        flowId,
        memoryType: FlowMemoryType.STATE
      },
      limit: 1,
      sortBy: 'timestamp',
      sortDirection: 'desc'
    });
    
    if (items.length === 0) {
      return null;
    }
    
    try {
      const stateData = JSON.parse(items[0].content);
      return stateData as T;
    } catch (error) {
      console.error('Error parsing flow state:', error);
      return null;
    }
  }
  
  /**
   * Get all states for a flow with optimized pagination
   */
  async getFlowStateHistory(
    flowId: string, 
    options: { limit?: number; offset?: number } = {}
  ): Promise<FlowMemoryItem[]> {
    // Query memory system with optimized filtering and pagination
    const items = await this.memory.get({
      metadata: {
        flowId,
        memoryType: FlowMemoryType.STATE
      },
      limit: options.limit || 100,
      offset: options.offset || 0,
      sortBy: 'timestamp',
      sortDirection: 'desc'
    });
    
    return items as FlowMemoryItem[];
  }
  
  /**
   * Get method results for a flow with optimized filtering
   */
  async getMethodResults(
    flowId: string,
    methodName?: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<FlowMemoryItem[]> {
    // Check cache for single method result
    if (methodName && this.options.inMemoryCache) {
      const cacheKey = `${flowId}:${methodName}`;
      if (this.methodResultCache.has(cacheKey)) {
        const result = this.methodResultCache.get(cacheKey);
        // Create a memory item for consistent return format
        return [{
          id: 'cached',
          content: JSON.stringify(result),
          flowId,
          flowType: '',
          memoryType: FlowMemoryType.METHOD_RESULT,
          timestamp: Date.now(),
          metadata: { methodName }
        }];
      }
    }
    
    // Build optimized query
    const query: any = {
      metadata: {
        flowId,
        memoryType: FlowMemoryType.METHOD_RESULT
      },
      limit: options.limit || 100,
      offset: options.offset || 0,
      sortBy: 'timestamp',
      sortDirection: 'desc'
    };
    
    // Add method filtering if specified
    if (methodName) {
      query.metadata.methodName = methodName;
    }
    
    // Query memory system
    const items = await this.memory.get(query);
    return items as FlowMemoryItem[];
  }
  
  /**
   * Get flow errors with optimized filtering
   */
  async getFlowErrors(
    flowId: string,
    methodName?: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<FlowMemoryItem[]> {
    // Build optimized query
    const query: any = {
      metadata: {
        flowId,
        memoryType: FlowMemoryType.ERROR
      },
      limit: options.limit || 100,
      offset: options.offset || 0,
      sortBy: 'timestamp',
      sortDirection: 'desc'
    };
    
    // Add method filtering if specified
    if (methodName) {
      query.metadata.methodName = methodName;
    }
    
    // Query memory system
    const items = await this.memory.get(query);
    return items as FlowMemoryItem[];
  }
  
  /**
   * Search for flow data using semantic search with optimized vector retrieval
   */
  async searchFlowData(
    query: string,
    options: {
      flowId?: string;
      memoryType?: FlowMemoryType;
      limit?: number;
    } = {}
  ): Promise<FlowMemoryItem[]> {
    // Verify we have a vector store retriever for semantic search
    if (!(this.retriever instanceof VectorStoreMemory)) {
      throw new Error('Semantic search requires a vector store retriever');
    }
    
    // Build optimized metadata filter
    const metadataFilter: Record<string, any> = {};
    
    if (options.flowId) {
      metadataFilter.flowId = options.flowId;
    }
    
    if (options.memoryType) {
      metadataFilter.memoryType = options.memoryType;
    }
    
    // Perform semantic search with metadata filtering
    const items = await this.retriever.similaritySearch({
      query,
      k: options.limit || 10,
      metadataFilter
    });
    
    return items as FlowMemoryItem[];
  }
  
  /**
   * Load a flow from memory and create a new instance with restored state
   */
  async loadFlow<T extends Flow<TState>>(
    flowId: string,
    FlowClass: new (...args: any[]) => T
  ): Promise<T | null> {
    // Get latest flow state
    const state = await this.getLatestFlowState(flowId);
    if (!state) {
      return null;
    }
    
    // Create new flow instance with restored state
    const flow = new FlowClass();
    flow.state = state;
    
    // Connect to memory system
    this.connectToFlow(flow);
    
    return flow;
  }
  
  /**
   * Clear flow data from memory with optimized filtering
   */
  async clearFlowData(
    flowId: string,
    options: {
      memoryType?: FlowMemoryType;
      olderThan?: number; // timestamp in ms
    } = {}
  ): Promise<void> {
    // Build optimized query
    const query: any = {
      metadata: {
        flowId
      }
    };
    
    // Add memory type filtering if specified
    if (options.memoryType) {
      query.metadata.memoryType = options.memoryType;
    }
    
    // Add timestamp filtering if specified
    if (options.olderThan) {
      query.timestamp = { $lt: options.olderThan };
    }
    
    // Clear from memory system
    await this.memory.delete(query);
    
    // Clear from cache
    if (this.options.inMemoryCache) {
      this.stateCache.delete(flowId);
      
      // Clear method results for this flow
      const methodKeysToDelete: string[] = [];
      this.methodResultCache.forEach((_, key) => {
        if (key.startsWith(`${flowId}:`)) {
          methodKeysToDelete.push(key);
        }
      });
      
      methodKeysToDelete.forEach(key => {
        this.methodResultCache.delete(key);
      });
    }
  }
  
  /**
   * Get distinct flow IDs with optimized aggregation
   */
  async getDistinctFlowIds(): Promise<string[]> {
    const items = await this.memory.get({
      distinct: 'metadata.flowId'
    });
    
    const flowIds = new Set<string>();
    items.forEach(item => {
      if (item.metadata?.flowId) {
        flowIds.add(item.metadata.flowId);
      }
    });
    
    return Array.from(flowIds);
  }
  
  /**
   * Optimize: Prune old state snapshots to maintain performance
   */
  private async pruneStateSnapshots(flowId: string): Promise<void> {
    const items = await this.memory.get({
      metadata: {
        flowId,
        memoryType: FlowMemoryType.STATE
      },
      sortBy: 'timestamp',
      sortDirection: 'desc'
    });
    
    if (items.length > this.options.maxStateSnapshotsPerFlow!) {
      // Keep the newest snapshots, delete the rest
      const itemsToDelete = items.slice(this.options.maxStateSnapshotsPerFlow!);
      
      for (const item of itemsToDelete) {
        await this.memory.delete({ id: item.id });
      }
    }
  }
  
  /**
   * Helper: Get unique flow ID
   */
  private getFlowId(flow: Flow<TState>): string {
    return flow.id || `${flow.constructor.name}_${Date.now()}`;
  }
  
  /**
   * Helper: Get flow methods for configuration
   */
  private getFlowMethods(flow: Flow<TState>): string[] {
    // Get all methods from the flow prototype
    const prototype = Object.getPrototypeOf(flow);
    return Object.getOwnPropertyNames(prototype).filter(name => {
      // Filter out constructor and private methods
      return (
        name !== 'constructor' &&
        !name.startsWith('_') &&
        typeof prototype[name] === 'function'
      );
    });
  }
  
  /**
   * Helper: Prepare state for storage with optimizations
   */
  private prepareStateForStorage(state: any): any {
    try {
      // Convert to JSON and back to strip functions and handle circular references
      const json = JSON.stringify(state, (key, value) => {
        // Skip functions
        if (typeof value === 'function') {
          return undefined;
        }
        return value;
      });
      
      return JSON.parse(json);
    } catch (error) {
      // Fallback to a more manual approach if JSON serialization fails
      const result: Record<string, any> = {};
      
      // Only copy serializable properties
      for (const [key, value] of Object.entries(state)) {
        if (
          typeof value !== 'function' &&
          typeof value !== 'symbol' &&
          !(value instanceof Promise) &&
          key !== 'events' // Skip event emitters
        ) {
          try {
            // Check if the value can be serialized
            JSON.stringify(value);
            result[key] = value;
          } catch {
            // Skip this property if it can't be serialized
          }
        }
      }
      
      return result;
    }
  }
  
  /**
   * Helper: Prepare method result for storage with optimizations
   */
  private prepareResultForStorage(result: any): any {
    if (result === undefined) return null;
    
    try {
      // Use the same approach as state preparation
      return this.prepareStateForStorage(result);
    } catch (error) {
      // Fallback for simple stringification
      return String(result);
    }
  }
}
