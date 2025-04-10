/**
 * FlowStateManager
 * 
 * Efficiently manages flow state with optimized memory usage, change tracking,
 * and performance monitoring.
 */
import { FlowState } from '../FlowState.js';
import { FlowPersistence } from '../persistence/FlowPersistence.js';

/**
 * Options for configuring the FlowStateManager
 */
export interface FlowStateManagerOptions {
  // Persistence options
  persistence?: FlowPersistence;
  persistOnChange?: boolean;
  persistenceDebounceMs?: number;
  
  // Memory optimization
  useStructuralSharing?: boolean;
  maxStateHistorySize?: number;
  enableGarbageCollection?: boolean;
  
  // Performance monitoring
  trackPerformance?: boolean;
  warningThresholdMs?: number;
}

/**
 * Performance metrics for state operations
 */
interface StatePerformanceMetrics {
  updateCount: number;
  totalUpdateTimeMs: number;
  averageUpdateTimeMs: number;
  maxUpdateTimeMs: number;
  lastUpdateTimeMs: number;
  totalMemoryChangeMb: number;
}

/**
 * FlowStateManager handles efficient state management for flows
 * with optimized memory usage and performance tracking.
 */
export class FlowStateManager<T extends FlowState = FlowState> {
  // Current state and state history
  private currentState: T;
  private stateHistory: Map<number, T> = new Map();
  private stateHistoryTimestamps: number[] = [];
  
  // Optimization flags
  private readonly options: FlowStateManagerOptions;
  private readonly persistence?: FlowPersistence;
  
  // Performance tracking
  private performanceMetrics: StatePerformanceMetrics = {
    updateCount: 0,
    totalUpdateTimeMs: 0,
    averageUpdateTimeMs: 0,
    maxUpdateTimeMs: 0,
    lastUpdateTimeMs: 0,
    totalMemoryChangeMb: 0
  };
  
  // Change tracking
  private changePending: boolean = false;
  private persistenceTimeout?: NodeJS.Timeout;
  
  constructor(initialState: T, options: FlowStateManagerOptions = {}) {
    // Set default options
    this.options = {
      persistOnChange: true,
      persistenceDebounceMs: 1000,
      useStructuralSharing: true,
      maxStateHistorySize: 10,
      enableGarbageCollection: true,
      trackPerformance: true,
      warningThresholdMs: 50,
      ...options
    };
    
    // Set initial state
    this.currentState = this.cloneState(initialState);
    
    // Add initial state to history
    this.addStateToHistory(this.currentState);
    
    // Set persistence handler
    this.persistence = options.persistence;
  }
  
  /**
   * Get the current state
   */
  getState(): T {
    return this.currentState;
  }
  
  /**
   * Update the state using an updater function
   * Uses optimized structural sharing when enabled
   */
  updateState(updater: (state: T) => void): T {
    // Track performance if enabled
    const startTime = this.options.trackPerformance ? performance.now() : 0;
    
    try {
      // Create a new state for immutability
      let newState: T;
      
      if (this.options.useStructuralSharing) {
        // With structural sharing, we only clone at the top level
        // and let the updater modify it directly
        newState = this.shallowCloneState(this.currentState);
      } else {
        // Without structural sharing, we do a deep clone
        newState = this.cloneState(this.currentState);
      }
      
      // Apply updater function to new state
      updater(newState);
      
      // Update current state
      this.currentState = newState;
      
      // Add to history
      this.addStateToHistory(newState);
      
      // Persist state if configured
      this.handleStateChange();
      
      return newState;
    } finally {
      // Update performance metrics
      if (this.options.trackPerformance) {
        const endTime = performance.now();
        const updateTimeMs = endTime - startTime;
        
        this.updatePerformanceMetrics(updateTimeMs);
        
        // Log warning if update takes too long
        if (updateTimeMs > this.options.warningThresholdMs!) {
          console.warn(`Flow state update took ${updateTimeMs.toFixed(2)}ms, which exceeds the warning threshold of ${this.options.warningThresholdMs}ms`);
        }
      }
    }
  }
  
  /**
   * Get performance metrics for state operations
   */
  getPerformanceMetrics(): StatePerformanceMetrics {
    return { ...this.performanceMetrics };
  }
  
  /**
   * Get the state history
   */
  getStateHistory(): T[] {
    return Array.from(this.stateHistory.values());
  }
  
  /**
   * Restore state to a specific point in history
   */
  restoreState(timestamp: number): boolean {
    const historicalState = this.stateHistory.get(timestamp);
    
    if (historicalState) {
      this.currentState = this.cloneState(historicalState);
      this.handleStateChange();
      return true;
    }
    
    return false;
  }
  
  /**
   * Clear all state history to free memory
   */
  clearHistory(): void {
    const currentTimestamp = Date.now();
    this.stateHistory.clear();
    this.stateHistoryTimestamps = [];
    
    // Keep current state in history
    this.stateHistory.set(currentTimestamp, this.currentState);
    this.stateHistoryTimestamps.push(currentTimestamp);
  }
  
  /**
   * Save the current state to persistence layer immediately
   */
  async persistStateNow(): Promise<void> {
    if (!this.persistence) return;
    
    try {
      await this.persistence.saveState(this.currentState);
      this.changePending = false;
    } catch (error) {
      console.error('Error persisting flow state:', error);
    }
  }
  
  /**
   * Handle state change with debounced persistence
   */
  private handleStateChange(): void {
    if (!this.persistence || !this.options.persistOnChange) return;
    
    // Mark change as pending
    this.changePending = true;
    
    // Debounce persistence to avoid too many writes
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
    }
    
    this.persistenceTimeout = setTimeout(() => {
      if (this.changePending) {
        this.persistStateNow().catch(err => {
          console.error('Failed to persist state:', err);
        });
      }
    }, this.options.persistenceDebounceMs);
  }
  
  /**
   * Add a state to the history with efficient memory management
   */
  private addStateToHistory(state: T): void {
    const timestamp = Date.now();
    
    // Add to history
    this.stateHistory.set(timestamp, state);
    this.stateHistoryTimestamps.push(timestamp);
    
    // Enforce history size limit
    this.pruneStateHistory();
  }
  
  /**
   * Remove oldest states from history to stay within size limit
   */
  private pruneStateHistory(): void {
    // Keep history size within limit
    while (this.stateHistoryTimestamps.length > this.options.maxStateHistorySize!) {
      const oldestTimestamp = this.stateHistoryTimestamps.shift();
      if (oldestTimestamp) {
        this.stateHistory.delete(oldestTimestamp);
      }
    }
    
    // Trigger garbage collection if configured
    if (this.options.enableGarbageCollection && 
        this.stateHistoryTimestamps.length % 5 === 0 && 
        global.gc) {
      // Only works if Node.js is started with --expose-gc flag
      try {
        global.gc();
      } catch (e) {
        // Ignore errors if gc is not available
      }
    }
  }
  
  /**
   * Update performance metrics with new data
   */
  private updatePerformanceMetrics(updateTimeMs: number): void {
    this.performanceMetrics.updateCount++;
    this.performanceMetrics.totalUpdateTimeMs += updateTimeMs;
    this.performanceMetrics.lastUpdateTimeMs = updateTimeMs;
    
    // Update max time if this was the longest update
    if (updateTimeMs > this.performanceMetrics.maxUpdateTimeMs) {
      this.performanceMetrics.maxUpdateTimeMs = updateTimeMs;
    }
    
    // Recalculate average
    this.performanceMetrics.averageUpdateTimeMs = 
      this.performanceMetrics.totalUpdateTimeMs / this.performanceMetrics.updateCount;
  }
  
  /**
   * Create a shallow clone of a state object for structural sharing
   */
  private shallowCloneState(state: T): T {
    // Create a new state instance
    const newState = new FlowState({ id: state.id }) as T;
    
    // Copy all properties
    Object.assign(newState, state);
    
    return newState;
  }
  
  /**
   * Create a deep clone of a state object
   */
  private cloneState(state: T): T {
    // For deep cloning, we use JSON serialization
    // This is not the most efficient but ensures complete isolation
    return JSON.parse(JSON.stringify(state)) as T;
  }
}
