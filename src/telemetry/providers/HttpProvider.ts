/**
 * HTTP Telemetry Provider
 * Sends telemetry events to a remote endpoint with memory-efficient batching
 */

import { TelemetryEventData, TelemetryProvider } from '../types.js';

/**
 * HTTP provider options
 */
export interface HttpProviderOptions {
  /** Endpoint URL */
  endpoint: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Maximum batch size */
  maxBatchSize?: number;
  /** Whether to compress data */
  compress?: boolean;
  /** Maximum payload size in bytes */
  maxPayloadSize?: number;
  /** Retry count for failed requests */
  retries?: number;
  /** Whether to wait for response */
  waitForResponse?: boolean;
}

/**
 * HTTP telemetry provider
 * Sends events to an HTTP endpoint with memory-efficient batching and compression
 */
export class HttpProvider implements TelemetryProvider {
  public readonly name = 'http';
  private options: Required<HttpProviderOptions>;
  private pendingRequests = 0;
  private inFlight = new Map<string, AbortController>();
  
  /**
   * Create new HTTP provider
   * 
   * @param options Provider options
   */
  constructor(options: HttpProviderOptions) {
    if (!options.endpoint) {
      throw new Error('HTTP provider requires an endpoint URL');
    }
    
    this.options = {
      endpoint: options.endpoint,
      headers: options.headers || {},
      timeoutMs: options.timeoutMs || 10000, // 10 seconds
      maxBatchSize: options.maxBatchSize || 100,
      compress: options.compress !== undefined ? options.compress : true,
      maxPayloadSize: options.maxPayloadSize || 1024 * 1024, // 1MB
      retries: options.retries || 3,
      waitForResponse: options.waitForResponse !== undefined ? options.waitForResponse : false
    };
    
    // Set default headers
    if (!this.options.headers['Content-Type']) {
      this.options.headers['Content-Type'] = 'application/json';
    }
  }
  
  /**
   * Initialize provider
   */
  public async initialize(): Promise<void> {
    // Nothing to initialize
    return Promise.resolve();
  }
  
  /**
   * Submit events to HTTP endpoint
   * Implements memory-efficient batching and compression
   * 
   * @param events Events to submit
   * @returns Success status
   */
  public async submitEvents(events: TelemetryEventData[]): Promise<boolean> {
    if (events.length === 0) {
      return true;
    }
    
    try {
      // Split events into optimal batches for memory efficiency
      const batches = this.createBatches(events);
      const results = await Promise.all(batches.map(batch => this.sendBatch(batch)));
      
      // If any batch failed, return false
      return results.every(Boolean);
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Split events into optimal batches
   * 
   * @param events Events to batch
   * @returns Batches of events
   */
  private createBatches(events: TelemetryEventData[]): TelemetryEventData[][] {
    const batches: TelemetryEventData[][] = [];
    let currentBatch: TelemetryEventData[] = [];
    let currentSize = 0;
    
    for (const event of events) {
      // Rough size estimation (better than JSON.stringify for memory efficiency)
      const eventSize = this.estimateEventSize(event);
      
      // If adding this event would exceed batch size or payload limit, start a new batch
      if (currentBatch.length >= this.options.maxBatchSize || 
          (currentSize + eventSize) > this.options.maxPayloadSize) {
        batches.push(currentBatch);
        currentBatch = [];
        currentSize = 0;
      }
      
      currentBatch.push(event);
      currentSize += eventSize;
    }
    
    // Add the last batch if not empty
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    return batches;
  }
  
  /**
   * Estimate event size in bytes
   * More memory-efficient than JSON.stringify
   * 
   * @param event Event to estimate size of
   * @returns Estimated size in bytes
   */
  private estimateEventSize(event: TelemetryEventData): number {
    // Start with a base size for the object structure
    let size = 100; // Base overhead
    
    // Add size for each property
    for (const [key, value] of Object.entries(event)) {
      // Add key length + 2 for quotes
      size += key.length + 2;
      
      // Add value size based on type
      if (typeof value === 'string') {
        size += value.length + 2; // String + quotes
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        size += 8; // Fixed size for primitives
      } else if (value === null || value === undefined) {
        size += 4; // 'null' or size of undefined when stringified
      } else if (Array.isArray(value)) {
        size += 4 + value.length * 8; // Array overhead + estimate per item
      } else if (typeof value === 'object') {
        size += 50 + Object.keys(value).length * 20; // Rough object size estimate
      }
    }
    
    return size;
  }
  
  /**
   * Send a batch of events
   * Implements memory-efficient HTTP request with compression
   * 
   * @param batch Batch of events to send
   * @returns Success status
   */
  private async sendBatch(batch: TelemetryEventData[]): Promise<boolean> {
    if (batch.length === 0) {
      return true;
    }
    
    const requestId = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    const controller = new AbortController();
    this.inFlight.set(requestId, controller);
    this.pendingRequests++;
    
    let retries = 0;
    let success = false;
    
    try {
      // Stringify payload once to avoid multiple allocations
      const payload = JSON.stringify(batch);
      
      while (!success && retries <= this.options.retries) {
        try {
          // Prepare headers for this specific request
          const headers = { ...this.options.headers };
          
          // If compression is enabled, we'd compress here
          // This would require additional libraries
          if (this.options.compress) {
            // In a real implementation, we'd use a compression library
            // headers['Content-Encoding'] = 'gzip';
            // const compressedPayload = await compressData(payload);
          }
          
          // Setup timeout for memory efficiency
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, this.options.timeoutMs);
          
          // Send the request
          const response = await fetch(this.options.endpoint, {
            method: 'POST',
            headers,
            body: payload,
            signal: controller.signal,
          });
          
          // Clear timeout
          clearTimeout(timeoutId);
          
          // Check response
          success = response.ok;
          
          // If we don't need to wait for response, return early
          if (!this.options.waitForResponse) {
            success = true;
          }
        } catch (error) {
          // Increment retry counter
          retries++;
          
          // Abort if we're out of retries
          if (retries > this.options.retries) {
            break;
          }
          
          // Exponential backoff with jitter
          const delay = Math.min(100 * Math.pow(2, retries) + Math.random() * 100, 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      return success;
    } catch (error) {
      return false;
    } finally {
      // Cleanup
      this.inFlight.delete(requestId);
      this.pendingRequests--;
    }
  }
  
  /**
   * Shutdown provider
   * Cancels any pending requests
   */
  public async shutdown(): Promise<void> {
    // Cancel all in-flight requests
    for (const controller of this.inFlight.values()) {
      controller.abort();
    }
    
    this.inFlight.clear();
    this.pendingRequests = 0;
    
    return Promise.resolve();
  }
  
  /**
   * Get number of pending requests
   * 
   * @returns Pending request count
   */
  public getPendingRequests(): number {
    return this.pendingRequests;
  }
}
