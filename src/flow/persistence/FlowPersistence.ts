/**
 * Flow Persistence Layer
 * 
 * Provides efficient state persistence with optimized storage,
 * incremental updates, and memory usage tracking.
 */
import { FlowState } from '../FlowState.js';
import { createHash } from 'crypto';
import { gzip, unzip } from 'node:zlib';
import { promisify } from 'node:util';

// Promisify zlib functions for async compression
const gzipAsync = promisify(gzip);
const unzipAsync = promisify(unzip);

/**
 * Options for configuring the FlowPersistence layer
 */
export interface FlowPersistenceOptions {
  // Storage configuration
  useCompression?: boolean;                  // Whether to compress state data
  storageType?: 'memory' | 'file' | 'redis'; // Storage backend type
  storageConfig?: Record<string, any>;       // Configuration for storage backend
  
  // Performance optimization
  maxCacheSize?: number;                     // Maximum number of states to keep in memory
  enableIncrementalUpdates?: boolean;        // Store diffs instead of full states
  compressionLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; // Compression level (0-9)
  
  // Memory usage monitoring
  trackMemoryUsage?: boolean;                // Whether to track memory usage
  memorySizeWarningThresholdMb?: number;     // Threshold for warning about memory usage
  
  // Conflict resolution
  conflictResolution?: 'last-write-wins' | 'merge' | 'error'; // How to handle conflicts
}

/**
 * State delta for incremental updates
 */
interface StateDelta {
  stateId: string;
  timestamp: number;
  delta: Record<string, any>;
  hash: string; // Hash of the previous state this delta applies to
}

/**
 * Storage backend interface for persistence implementations
 */
export interface PersistenceStorage {
  saveState(stateId: string, data: Uint8Array): Promise<void>;
  loadState(stateId: string): Promise<Uint8Array | null>;
  deleteState(stateId: string): Promise<boolean>;
  listStates(): Promise<string[]>;
}

/**
 * In-memory storage implementation with LRU cache
 */
class InMemoryStorage implements PersistenceStorage {
  private storage = new Map<string, Uint8Array>();
  private lruOrder: string[] = [];
  private maxSize: number;
  
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }
  
  async saveState(stateId: string, data: Uint8Array): Promise<void> {
    // Update LRU order
    this.updateLruOrder(stateId);
    
    // Store data
    this.storage.set(stateId, data);
    
    // Enforce size limit
    this.enforceSizeLimit();
  }
  
  async loadState(stateId: string): Promise<Uint8Array | null> {
    const data = this.storage.get(stateId);
    
    if (data) {
      // Update LRU order on access
      this.updateLruOrder(stateId);
      return data;
    }
    
    return null;
  }
  
  async deleteState(stateId: string): Promise<boolean> {
    const deleted = this.storage.delete(stateId);
    
    if (deleted) {
      // Remove from LRU order
      const index = this.lruOrder.indexOf(stateId);
      if (index !== -1) {
        this.lruOrder.splice(index, 1);
      }
    }
    
    return deleted;
  }
  
  async listStates(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
  
  private updateLruOrder(stateId: string): void {
    // Remove if exists
    const index = this.lruOrder.indexOf(stateId);
    if (index !== -1) {
      this.lruOrder.splice(index, 1);
    }
    
    // Add to front (most recently used)
    this.lruOrder.unshift(stateId);
  }
  
  private enforceSizeLimit(): void {
    // Remove least recently used items if over capacity
    while (this.lruOrder.length > this.maxSize) {
      const stateId = this.lruOrder.pop();
      if (stateId) {
        this.storage.delete(stateId);
      }
    }
  }
}

/**
 * Flow Persistence manager for efficient state storage and retrieval
 */
export class FlowPersistence {
  // Options and storage
  private options: FlowPersistenceOptions;
  private storage: PersistenceStorage;
  
  // Delta storage for incremental updates
  private deltas: Map<string, StateDelta[]> = new Map();
  
  // Memory tracking
  private memoryUsageBytes: number = 0;
  
  // In-memory cache for faster access
  private stateCache: Map<string, { state: FlowState, timestamp: number }> = new Map();
  
  constructor(options: FlowPersistenceOptions = {}) {
    // Set default options
    this.options = {
      useCompression: true,
      storageType: 'memory',
      maxCacheSize: 50,
      enableIncrementalUpdates: true,
      compressionLevel: 6,
      trackMemoryUsage: true,
      memorySizeWarningThresholdMb: 100,
      conflictResolution: 'last-write-wins',
      ...options
    };
    
    // Initialize storage based on type
    switch (this.options.storageType) {
      case 'memory':
      default:
        this.storage = new InMemoryStorage(this.options.maxCacheSize);
        break;
      // Additional storage backends would be implemented here
    }
  }
  
  /**
   * Save state to the persistence layer with optimized storage
   * @param state Flow state to save
   */
  async saveState(state: FlowState): Promise<void> {
    try {
      const stateId = state.id;
      const timestamp = Date.now();
      
      // Convert state to serializable form
      const serializedState = this.serializeState(state);
      
      // Track memory usage if enabled
      if (this.options.trackMemoryUsage) {
        const stateSize = this.estimateSize(serializedState);
        this.memoryUsageBytes += stateSize;
        
        // Check if warning threshold exceeded
        if (this.options.memorySizeWarningThresholdMb && 
            this.memoryUsageBytes > this.options.memorySizeWarningThresholdMb * 1024 * 1024) {
          console.warn(`Flow persistence memory usage exceeds ${this.options.memorySizeWarningThresholdMb}MB threshold`);
        }
      }
      
      // Update in-memory cache
      this.stateCache.set(stateId, { state, timestamp });
      
      // If incremental updates enabled, calculate and store delta
      if (this.options.enableIncrementalUpdates) {
        await this.saveStateDelta(state, serializedState);
      } else {
        // Otherwise store full state
        await this.saveFullState(stateId, serializedState);
      }
    } catch (error) {
      console.error('Error saving flow state:', error);
      throw error;
    }
  }
  
  /**
   * Load state from the persistence layer
   * @param stateId ID of the state to load
   */
  async loadState(stateId: string): Promise<FlowState | null> {
    try {
      // Check cache first for performance
      const cached = this.stateCache.get(stateId);
      if (cached) {
        return cached.state;
      }
      
      // Load from storage
      const data = await this.storage.loadState(stateId);
      if (!data) {
        return null;
      }
      
      // Decompress if needed
      const decompressedData = this.options.useCompression ? 
        await unzipAsync(data) : data;
      
      // Deserialize state
      const serializedState = JSON.parse(new TextDecoder().decode(decompressedData));
      const state = this.deserializeState(serializedState);
      
      // Update cache
      this.stateCache.set(stateId, { 
        state, 
        timestamp: Date.now() 
      });
      
      return state;
    } catch (error) {
      console.error(`Error loading flow state ${stateId}:`, error);
      return null;
    }
  }
  
  /**
   * Delete state from the persistence layer
   * @param stateId ID of the state to delete
   */
  async deleteState(stateId: string): Promise<boolean> {
    try {
      // Remove from cache
      this.stateCache.delete(stateId);
      
      // Remove deltas if exists
      this.deltas.delete(stateId);
      
      // Delete from storage
      return await this.storage.deleteState(stateId);
    } catch (error) {
      console.error(`Error deleting flow state ${stateId}:`, error);
      return false;
    }
  }
  
  /**
   * List all available state IDs
   */
  async listStates(): Promise<string[]> {
    try {
      return await this.storage.listStates();
    } catch (error) {
      console.error('Error listing flow states:', error);
      return [];
    }
  }
  
  /**
   * Clear all cached states to free memory
   */
  clearCache(): void {
    this.stateCache.clear();
    this.memoryUsageBytes = 0;
  }
  
  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): { bytes: number, megabytes: number } {
    return {
      bytes: this.memoryUsageBytes,
      megabytes: this.memoryUsageBytes / (1024 * 1024)
    };
  }
  
  /**
   * Save a full state to storage
   */
  private async saveFullState(stateId: string, serializedState: any): Promise<void> {
    // Convert to JSON string
    const jsonString = JSON.stringify(serializedState);
    const textEncoder = new TextEncoder();
    const stateData = textEncoder.encode(jsonString);
    
    // Compress if enabled
    const dataToStore = this.options.useCompression ? 
      await gzipAsync(stateData, { level: this.options.compressionLevel }) : 
      stateData;
    
    // Save to storage
    await this.storage.saveState(stateId, dataToStore);
  }
  
  /**
   * Calculate and save state delta for incremental updates
   */
  private async saveStateDelta(state: FlowState, newSerializedState: any): Promise<void> {
    const stateId = state.id;
    
    // Load existing state to calculate delta
    const existingData = await this.storage.loadState(stateId);
    
    if (!existingData) {
      // No existing state, save full state
      await this.saveFullState(stateId, newSerializedState);
      return;
    }
    
    try {
      // Get existing state
      const decompressedData = this.options.useCompression ? 
        await unzipAsync(existingData) : existingData;
      
      const existingSerializedState = JSON.parse(new TextDecoder().decode(decompressedData));
      
      // Calculate delta
      const delta = this.calculateDelta(existingSerializedState, newSerializedState);
      
      // If delta is larger than 50% of full state, just save full state
      const deltaSize = this.estimateSize(delta);
      const fullSize = this.estimateSize(newSerializedState);
      
      if (deltaSize > fullSize * 0.5) {
        await this.saveFullState(stateId, newSerializedState);
        return;
      }
      
      // Create delta object
      const stateDelta: StateDelta = {
        stateId,
        timestamp: Date.now(),
        delta,
        hash: this.calculateStateHash(existingSerializedState)
      };
      
      // Add to deltas collection
      const stateDeltaList = this.deltas.get(stateId) || [];
      stateDeltaList.push(stateDelta);
      this.deltas.set(stateId, stateDeltaList);
      
      // Save full state periodically (every 10 deltas)
      if (stateDeltaList.length >= 10) {
        await this.saveFullState(stateId, newSerializedState);
        this.deltas.delete(stateId);
      }
    } catch (error) {
      // Fallback to saving full state on error
      console.warn(`Error calculating delta for state ${stateId}, saving full state:`, error);
      await this.saveFullState(stateId, newSerializedState);
    }
  }
  
  /**
   * Calculate delta between two state objects
   */
  private calculateDelta(oldState: any, newState: any): Record<string, any> {
    const delta: Record<string, any> = {};
    
    // Get all keys from both objects
    const allKeys = new Set<string>([...Object.keys(oldState), ...Object.keys(newState)]);
    
    // Compare each key
    for (const key of allKeys) {
      // Skip id field as it should be the same
      if (key === 'id') continue;
      
      // Handle nested objects
      if (typeof oldState[key] === 'object' && oldState[key] !== null &&
          typeof newState[key] === 'object' && newState[key] !== null) {
        // Recursively calculate delta for nested objects
        const nestedDelta = this.calculateDelta(oldState[key], newState[key]);
        if (Object.keys(nestedDelta).length > 0) {
          delta[key] = nestedDelta;
        }
      } 
      // For non-objects, add to delta if changed
      else if (JSON.stringify(oldState[key]) !== JSON.stringify(newState[key])) {
        delta[key] = newState[key];
      }
    }
    
    return delta;
  }
  
  /**
   * Serialize a FlowState for storage
   */
  private serializeState(state: FlowState): any {
    // Create a clean copy without duplicate ID field
    const stateCopy = { ...state };
    return stateCopy;
  }
  
  /**
   * Deserialize stored data back to a FlowState
   */
  private deserializeState(data: any): FlowState {
    // Recreate FlowState instance
    const state = new FlowState({ id: data.id });
    
    // Copy all properties except id which is already set
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id') {
        (state as any)[key] = value;
      }
    });
    
    return state;
  }
  
  /**
   * Calculate a hash for a state object
   */
  private calculateStateHash(state: any): string {
    const stateString = JSON.stringify(state);
    return createHash('sha256').update(stateString).digest('hex');
  }
  
  /**
   * Estimate the size of an object in bytes
   */
  private estimateSize(obj: any): number {
    const jsonString = JSON.stringify(obj);
    return new TextEncoder().encode(jsonString).length;
  }
}
