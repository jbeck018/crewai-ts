/**
 * FlowMemoryConnectorInterface
 * 
 * Common interface for flow memory connectors with optimized data structures
 * and memory-efficient operations.
 */
import { FlowState } from '../FlowState.js';

/**
 * Generic flow data structure for storage
 */
export interface FlowData {
  type: string;
  data: any;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Flow memory connector options
 */
export interface FlowMemoryConnectorOptions {
  // Storage options
  inMemoryCache?: boolean;
  cacheSize?: number;
  compression?: boolean; // Renamed from useCompression for consistency
  compressionLevel?: number;
  
  // Optimization options
  enableIncrementalUpdates?: boolean;
  maxStateSnapshotsPerFlow?: number;
  
  // Performance tracking
  trackMemoryUsage?: boolean;
  memoryWarningThresholdMb?: number;
  
  // Query optimization
  indexFields?: string[];
  preloadCommonStates?: boolean;

  // Additional options from existing implementation
  persistStateOnEveryChange?: boolean;
  memoryOptions?: any;
  statePersistenceDebounceMs?: number;
  inMemoryCacheTTL?: number;
  persistMethodResults?: boolean;
  additionalMetadata?: Record<string, any>;
  useCompression?: boolean; // Legacy option, use compression instead
}

/**
 * Memory connector interface for the flow system
 * Provides highly optimized state and execution data persistence
 */
export interface FlowMemoryConnectorInterface<TState extends FlowState = FlowState> {
  /**
   * Save flow state to memory
   */
  saveState(flowId: string, state: TState): Promise<void>;
  
  /**
   * Load flow state from memory
   */
  loadState(flowId: string): Promise<TState | null>;
  
  /**
   * Delete flow state from memory
   */
  deleteState(flowId: string): Promise<boolean>;
  
  /**
   * Save flow result to memory
   */
  saveResult(flowId: string, methodName: string, result: any): Promise<void>;
  
  /**
   * Load flow result from memory
   */
  loadResult(flowId: string, methodName: string): Promise<any | null>;
  
  /**
   * Save flow configuration to memory
   */
  saveConfig(flowId: string, config: Record<string, any>): Promise<void>;
  
  /**
   * Load flow configuration from memory
   */
  loadConfig(flowId: string): Promise<Record<string, any> | null>;
  
  /**
   * Clear all data for a flow
   */
  clearFlowData(flowId: string, options?: { olderThan?: number }): Promise<void>;
  
  /**
   * Get all distinct flow IDs
   */
  getDistinctFlowIds(): Promise<string[]>;
  
  /**
   * Generic method to save any flow-related data
   * This is a flexible method that can be used for various data types
   */
  saveFlowData(flowId: string, data: FlowData): Promise<void>;
  
  /**
   * Generic method to load any flow-related data by type
   * Returns the most recent data of the specified type
   */
  loadFlowData(flowId: string, type: string): Promise<FlowData | null>;
  
  /**
   * Get all flow data of a specific type
   */
  getAllFlowDataByType(flowId: string, type: string): Promise<FlowData[]>;
}
