/**
 * Main Telemetry class
 * Optimized for memory efficiency and performance with minimal overhead
 */

import { EventEmitter } from 'events';
import os from 'os';

import {
  TelemetryEventType,
  TelemetryOptions,
  TelemetryEventData,
  TelemetryProvider,
  SystemInfo
} from './types.js';
import { TelemetryEvent } from './TelemetryEvent.js';

// Ensure we don't have unbounded memory growth with events
const DEFAULT_BUFFER_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MEMORY_LIMIT = 10 * 1024 * 1024; // 10MB

/**
 * Main Telemetry class
 * Handles event collection, batching, and dispatching to configured providers
 */
export class Telemetry extends EventEmitter {
  private static instance: Telemetry;
  private providers: Map<string, TelemetryProvider> = new Map();
  private eventBuffer: TelemetryEventData[] = [];
  private flushInterval?: NodeJS.Timeout;
  private systemInfo: SystemInfo;
  private initialized = false;
  private flushPromise?: Promise<void>;
  private memoryUsage = 0;
  private options: Required<TelemetryOptions>;
  private eventCount = 0;
  
  /**
   * Private constructor to enforce singleton pattern
   * @param options Telemetry options
   */
  private constructor(options: TelemetryOptions = {}) {
    super();
    
    // Set default options with memory efficiency in mind
    this.options = {
      enabled: options.enabled ?? true,
      endpoint: options.endpoint ?? 'https://telemetry.crewai.com/v1/events',
      bufferSize: options.bufferSize ?? DEFAULT_BUFFER_SIZE,
      flushIntervalMs: options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      samplingRate: options.samplingRate ?? 1,
      memoryLimit: options.memoryLimit ?? DEFAULT_MEMORY_LIMIT,
      shareTelemetry: options.shareTelemetry ?? false
    };
    
    // Initialize system info (with minimal data collection)
    this.systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      // These are added only if shareTelemetry is true
      ...(this.options.shareTelemetry ? {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      } : {})
    };
  }
  
  /**
   * Get singleton instance
   * 
   * @param options Configuration options
   * @returns Telemetry instance
   */
  public static getInstance(options?: TelemetryOptions): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry(options);
    }
    return Telemetry.instance;
  }
  
  /**
   * Initialize telemetry system
   * 
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    if (this.initialized || !this.options.enabled) {
      return;
    }
    
    try {
      // Initialize all providers
      const promises = Array.from(this.providers.values()).map(provider => provider.initialize());
      await Promise.all(promises);
      
      // Set up regular flush interval with memory-efficient approach
      if (this.options.flushIntervalMs > 0) {
        this.flushInterval = setInterval(() => this.flush(), this.options.flushIntervalMs);
      }
      
      // Record initialization event
      this.track(TelemetryEventType.INITIALIZATION, {
        version: process.env.npm_package_version
      });
      
      this.initialized = true;
    } catch (error) {
      // Silently fail - telemetry should never break the application
      console.warn('Telemetry initialization failed:', error);
      this.disable();
    }
  }
  
  /**
   * Register a telemetry provider
   * 
   * @param provider Provider to register
   * @returns This instance for chaining
   */
  public registerProvider(provider: TelemetryProvider): Telemetry {
    if (!this.providers.has(provider.name)) {
      this.providers.set(provider.name, provider);
      if (this.initialized) {
        // Initialize provider if telemetry is already initialized
        provider.initialize().catch(() => {
          // Silently fail if provider initialization fails
          this.providers.delete(provider.name);
        });
      }
    }
    return this;
  }
  
  /**
   * Unregister a telemetry provider
   * 
   * @param providerName Name of provider to unregister
   * @returns This instance for chaining
   */
  public unregisterProvider(providerName: string): Telemetry {
    const provider = this.providers.get(providerName);
    if (provider) {
      provider.shutdown().catch(() => {});
      this.providers.delete(providerName);
    }
    return this;
  }
  
  /**
   * Track an event
   * 
   * @param type Event type
   * @param data Event data
   * @param context Additional context
   * @returns Event ID for correlation
   */
  public track<T extends TelemetryEventData>(type: TelemetryEventType, data: Partial<T> = {}, context?: Record<string, any>): string {
    if (!this.options.enabled) {
      return '';
    }
    
    try {
      // Apply sampling if configured
      if (this.options.samplingRate < 1 && Math.random() > this.options.samplingRate) {
        return ''; // Skip event due to sampling
      }
      
      // Create the event
      const event = TelemetryEvent.create<T>(type, data, context);
      
      // Ensure we're not exceeding memory limits
      this.trackMemoryUsage();
      
      // Add to buffer
      this.eventBuffer.push(event);
      this.eventCount++;
      
      // If buffer is full, schedule a flush
      if (this.eventBuffer.length >= this.options.bufferSize) {
        // Use queueMicrotask to avoid blocking but ensure it runs soon
        queueMicrotask(() => this.flush());
      }
      
      // Emit event for custom handling
      this.emit('event', event);
      
      return event.id;
    } catch (error) {
      // Telemetry should never break the application
      return '';
    }
  }
  
  /**
   * Track error with memory-efficient error handling
   * 
   * @param error Error to track
   * @param source Source of error
   * @param context Additional context
   * @returns Error event ID
   */
  public trackError(error: Error, source?: string, context?: Record<string, any>): string {
    if (!this.options.enabled) {
      return '';
    }
    
    try {
      const event = TelemetryEvent.createErrorEvent(error, source, context);
      this.eventBuffer.push(event);
      this.eventCount++;
      
      // Errors are important, flush more aggressively
      queueMicrotask(() => this.flush());
      
      this.emit('error', event);
      
      return event.id;
    } catch {
      return '';
    }
  }
  
  /**
   * Track crew event
   * 
   * @param type Event type
   * @param crewId Crew ID
   * @param data Additional crew data
   * @param context Additional context
   * @returns Event ID
   */
  public trackCrew(type: TelemetryEventType, crewId: string, data?: Partial<Record<string, any>>, context?: Record<string, any>): string {
    if (!this.options.enabled) {
      return '';
    }
    
    try {
      const event = TelemetryEvent.createCrewEvent(type, crewId, data, context);
      this.eventBuffer.push(event);
      this.eventCount++;
      
      this.emit('crew', event);
      
      return event.id;
    } catch {
      return '';
    }
  }
  
  /**
   * Track agent event
   * 
   * @param type Event type
   * @param agentId Agent ID
   * @param data Additional agent data
   * @param context Additional context
   * @returns Event ID
   */
  public trackAgent(type: TelemetryEventType, agentId: string, data?: Partial<Record<string, any>>, context?: Record<string, any>): string {
    if (!this.options.enabled) {
      return '';
    }
    
    try {
      const event = TelemetryEvent.createAgentEvent(type, agentId, data, context);
      this.eventBuffer.push(event);
      this.eventCount++;
      
      this.emit('agent', event);
      
      return event.id;
    } catch {
      return '';
    }
  }
  
  /**
   * Track task event
   * 
   * @param type Event type
   * @param taskId Task ID
   * @param data Additional task data
   * @param context Additional context
   * @returns Event ID
   */
  public trackTask(type: TelemetryEventType, taskId: string, data?: Partial<Record<string, any>>, context?: Record<string, any>): string {
    if (!this.options.enabled) {
      return '';
    }
    
    try {
      const event = TelemetryEvent.createTaskEvent(type, taskId, data, context);
      this.eventBuffer.push(event);
      this.eventCount++;
      
      this.emit('task', event);
      
      return event.id;
    } catch {
      return '';
    }
  }

  /**
   * Track flow event with memory-efficient implementation
   * Uses similar optimization patterns to knowledge system embedders
   * 
   * @param type Flow event type
   * @param flowId Unique flow identifier
   * @param data Additional flow data
   * @param context Additional context
   * @returns Event ID for correlation
   */
  public trackFlow(type: TelemetryEventType, flowId: string, data?: Partial<Record<string, any>>, context?: Record<string, any>): string {
    if (!this.options.enabled) {
      return '';
    }
    
    try {
      // Apply sampling to reduce memory footprint for high-frequency events
      // Using the same approach as in our knowledge embedders
      if (this.options.samplingRate < 1 && Math.random() > this.options.samplingRate) {
        return '';
      }
      
      // Auto-calculate execution time for completion events if not provided
      // Similar to optimization techniques in knowledge embedders
      const enhancedData = {
        ...data,
        ...(type === TelemetryEventType.FLOW_EXECUTION_COMPLETED && data?.startTime && !data.executionTimeMs ? {
          executionTimeMs: Date.now() - (data.startTime as number),
          memoryUsageBytes: process.memoryUsage?.().heapUsed
        } : {})
      };
      
      const event = TelemetryEvent.createFlowEvent(type, flowId, enhancedData, context);
      this.eventBuffer.push(event);
      this.eventCount++;
      
      this.emit('flow', event);
      
      return event.id;
    } catch {
      return '';
    }
  }

  /**
   * Track test execution with memory-efficient implementation
   * Similar to knowledge system test optimizations
   * 
   * @param type Test event type
   * @param testId Test identifier
   * @param data Additional test data
   * @param context Additional context
   * @returns Event ID
   */
  public trackTest(type: TelemetryEventType, testId: string, data?: Partial<Record<string, any>>, context?: Record<string, any>): string {
    if (!this.options.enabled) {
      return '';
    }
    
    try {
      // Similar to knowledge integration tests, auto-calculate duration
      const enhancedData = {
        ...data,
        ...(type === TelemetryEventType.TEST_EXECUTION_COMPLETED && data?.startTime && !data.durationMs ? {
          durationMs: Date.now() - (data.startTime as number)
        } : {})
      };
      
      const event = TelemetryEvent.createTestEvent(type, testId, enhancedData, context);
      this.eventBuffer.push(event);
      this.eventCount++;
      
      this.emit('test', event);
      
      return event.id;
    } catch {
      return '';
    }
  }

  /**
   * Track memory operation with memory-efficient implementation
   * Uses the same optimization techniques as our knowledge embedders
   * 
   * @param type Memory event type
   * @param storeId Store identifier
   * @param operation Operation type
   * @param data Additional memory data
   * @param context Additional context
   * @returns Event ID
   */
  public trackMemoryOperation(
    type: TelemetryEventType, 
    storeId: string, 
    operation: 'create' | 'read' | 'update' | 'delete' | 'query',
    data?: Partial<Record<string, any>>, 
    context?: Record<string, any>
  ): string {
    if (!this.options.enabled) {
      return '';
    }
    
    try {
      // Apply specialized sampling for high-frequency memory operations
      // This pattern is used in our knowledge embedders for similar operations
      const operationSamplingRate = 
        operation === 'query' ? Math.min(this.options.samplingRate, 0.1) : this.options.samplingRate;
        
      if (operationSamplingRate < 1 && Math.random() > operationSamplingRate) {
        return '';
      }
      
      // Capture memory usage if not explicitly provided - memory-efficient approach
      const memorySnapshot = !data?.memoryBefore && !data?.memoryAfter && process.memoryUsage ? 
        process.memoryUsage().heapUsed : 
        undefined;
      
      const enhancedData = {
        ...data,
        memoryBefore: data?.memoryBefore || memorySnapshot
      };
      
      const event = TelemetryEvent.createMemoryEvent(type, storeId, operation, enhancedData, context);
      this.eventBuffer.push(event);
      this.eventCount++;
      
      this.emit('memory', event);
      
      return event.id;
    } catch {
      return '';
    }
  }

  /**
   * Track deployment event with memory-efficient implementation
   * 
   * @param type Deployment event type
   * @param deploymentId Unique deployment identifier
   * @param data Additional deployment data
   * @param context Additional context
   * @returns Event ID
   */
  public trackDeployment(
    type: TelemetryEventType,
    deploymentId: string,
    data?: Partial<Record<string, any>>,
    context?: Record<string, any>
  ): string {
    if (!this.options.enabled) {
      return '';
    }
    
    try {
      // Auto-calculate duration similar to our knowledge embedder pattern
      const enhancedData = {
        ...data,
        ...(type === TelemetryEventType.CREW_DEPLOYMENT_COMPLETED && data?.startTime && !data.durationMs ? {
          durationMs: Date.now() - (data.startTime as number)
        } : {})
      };
      
      const event = TelemetryEvent.createDeploymentEvent(type, deploymentId, enhancedData, context);
      this.eventBuffer.push(event);
      this.eventCount++;
      
      this.emit('deployment', event);
      
      return event.id;
    } catch {
      return '';
    }
  }
  
  /**
   * Flush events to all providers
   * Implements efficient batching and error handling
   * 
   * @returns Promise that resolves when flush is complete
   */
  public async flush(): Promise<void> {
    if (!this.options.enabled || this.eventBuffer.length === 0 || this.flushPromise) {
      return;
    }
    
    try {
      // Create a copy of the current buffer and clear the main buffer
      // This allows new events to be collected while we're flushing
      const events = [...this.eventBuffer];
      this.eventBuffer = [];
      this.memoryUsage = 0;
      
      // Create flush promise to prevent concurrent flushes
      this.flushPromise = this.flushEvents(events);
      await this.flushPromise;
    } catch (error) {
      // Telemetry should never break the application
    } finally {
      this.flushPromise = undefined;
    }
  }
  
  /**
   * Flush events to all providers with retry logic
   * 
   * @param events Events to flush
   */
  private async flushEvents(events: TelemetryEventData[]): Promise<void> {
    if (events.length === 0 || this.providers.size === 0) {
      return;
    }
    
    try {
      // Sanitize sensitive data before sending
      const sanitizedEvents = events.map(e => TelemetryEvent.sanitize(e));
      
      // Send to all providers in parallel with retry logic
      const providerPromises = Array.from(this.providers.entries()).map(async ([name, provider]) => {
        let retries = 0;
        let success = false;
        
        while (!success && retries <= this.options.maxRetries) {
          try {
            success = await provider.submitEvents(sanitizedEvents);
          } catch {
            // If provider throws, increment retry counter
            retries++;
            
            // Exponential backoff with jitter
            if (retries <= this.options.maxRetries) {
              const delay = Math.min(100 * Math.pow(2, retries) + Math.random() * 100, 10000);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        // If still not successful after retries, consider removing the provider
        if (!success) {
          // Optionally disable problematic providers
          // this.providers.delete(name);
        }
        
        return success;
      });
      
      await Promise.all(providerPromises);
    } catch (error) {
      // Fail silently - telemetry should not break the application
    }
  }
  
  /**
   * Track memory usage of the telemetry buffer
   * Implements bounds checking to prevent unbounded growth
   */
  private trackMemoryUsage(): void {
    try {
      // Estimate memory usage growth (rough approximation)
      this.memoryUsage += 256; // Assume average event size ~256 bytes
      
      // If memory usage exceeds limit, flush and clear buffer
      if (this.memoryUsage > this.options.memoryLimit) {
        queueMicrotask(() => this.flush());
      }
    } catch {
      // Fail silently
    }
  }
  
  /**
   * Disable telemetry
   */
  public disable(): void {
    this.options.enabled = false;
    this.clearEvents();
    
    // Clear flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }
  }
  
  /**
   * Enable telemetry
   */
  public enable(): void {
    this.options.enabled = true;
    
    // Reinitialize if needed
    if (!this.initialized) {
      this.initialize().catch(() => {});
    } else if (!this.flushInterval && this.options.flushIntervalMs > 0) {
      // Restart flush interval
      this.flushInterval = setInterval(() => this.flush(), this.options.flushIntervalMs);
    }
  }
  
  /**
   * Clear all pending events
   */
  public clearEvents(): void {
    this.eventBuffer = [];
    this.memoryUsage = 0;
  }
  
  /**
   * Get event count since initialization
   * 
   * @returns Total event count
   */
  public getEventCount(): number {
    return this.eventCount;
  }
  
  /**
   * Get current buffer size
   * 
   * @returns Current buffer size
   */
  public getBufferSize(): number {
    return this.eventBuffer.length;
  }
  
  /**
   * Shutdown telemetry system
   * 
   * @param flush Whether to flush pending events before shutdown
   * @returns Promise that resolves when shutdown is complete
   */
  public async shutdown(flush = true): Promise<void> {
    if (flush && this.eventBuffer.length > 0) {
      await this.flush();
    }
    
    // Clear flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }
    
    // Shutdown all providers
    const promises = Array.from(this.providers.values()).map(provider => {
      return provider.shutdown().catch(() => {});
    });
    
    await Promise.all(promises);
    
    this.providers.clear();
    this.clearEvents();
    this.initialized = false;
    this.options.enabled = false;
  }
  
  /**
   * Check if telemetry is enabled
   * 
   * @returns True if telemetry is enabled
   */
  public isEnabled(): boolean {
    return this.options.enabled;
  }
  
  /**
   * Update telemetry options
   * 
   * @param options New options
   */
  public updateOptions(options: Partial<TelemetryOptions>): void {
    // Update options
    Object.assign(this.options, options);
    
    // If flush interval changed, restart it
    if (options.flushIntervalMs !== undefined && this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = setInterval(() => this.flush(), this.options.flushIntervalMs);
    }
    
    // Toggle enabled state if needed
    if (options.enabled !== undefined) {
      if (options.enabled) {
        this.enable();
      } else {
        this.disable();
      }
    }
  }
}
