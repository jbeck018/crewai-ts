/**
 * FlowExecutionTracker
 * 
 * Provides optimized performance tracking for flow execution with minimal overhead.
 * Tracks execution times, resource usage, and execution paths with configurable sampling.
 */
import { Flow, FlowState } from '../index.js';
import { FlowEvent, FlowEventBus, EventPriority } from '../events/FlowEventBus.js';
import { FlowMemoryConnectorInterface } from '../memory/FlowMemoryConnectorInterface.js';

/**
 * Flow execution metrics
 */
export interface FlowExecutionMetrics {
  // Timing metrics
  startTime: number;
  endTime: number;
  executionTimeMs: number;
  methodCallCount: Record<string, number>;
  methodDurations: Record<string, number>;
  stateChanges: number;
  routeEvaluations: number;
  errorCount: number;
  eventCount: number;
  heapUsed?: number;
  heapTotal?: number;
  externalMemory?: number;
  peakMemoryUsageMb?: number;
}

/**
 * Metrics sample point for time series analysis
 */
export interface MetricsSample {
  timestamp: number;
  metrics: Partial<FlowExecutionMetrics>;
  snapshot?: any;
}

/**
 * Execution trace entry with optimized storage
 */
export interface ExecutionTraceEntry {
  timestamp: number;
  type: 'method_call' | 'method_return' | 'state_change' | 'route_evaluation' | 'error';
  target?: string;
  duration?: number;
  snapshot?: any;
  error?: Error;
}

/**
 * Configuration options for FlowExecutionTracker
 */
export interface FlowTrackerOptions {
  // Sampling and filtering options
  sampleInterval?: number;
  minimumDurationToTrack?: number;
  trackMethodCalls?: boolean;
  trackStateChanges?: boolean;
  trackRouteEvaluations?: boolean;
  
  // Memory options
  maxTraceEntries?: number;
  maxSamples?: number;
  compressTraces?: boolean;
  
  // Storage options
  persistMetrics?: boolean;
  eventBus?: FlowEventBus;
  memoryConnector?: FlowMemoryConnectorInterface;

  // Process monitoring
  trackProcessMetrics?: boolean;
  processMetricsInterval?: number;
  
  // Performance thresholds for alerts
  methodDurationWarningMs?: number;
  memoryWarningThresholdMb?: number;
  eventRateWarningThreshold?: number;
}

/**
 * FlowExecutionTracker provides optimized performance tracking for flows
 * with minimal overhead and configurable sampling.
 */
export class FlowExecutionTracker<TState extends FlowState = FlowState> {
  // Metrics storage
  private metrics: FlowExecutionMetrics;
  private metricSamples: MetricsSample[] = [];
  private executionTrace: ExecutionTraceEntry[] = [];
  
  // Flow reference and tracking state
  private flow: Flow<TState>;
  private isTracking: boolean = false;
  private eventHandlers: string[] = [];
  private processMetricsTimer?: NodeJS.Timeout;
  
  // Configuration
  private options: FlowTrackerOptions;
  
  /**
   * Create a tracker for a specific flow
   */
  constructor(flow: Flow<TState>, options: FlowTrackerOptions = {}) {
    this.flow = flow;
    
    // Set default options
    this.options = {
      sampleInterval: 1000, // 1 second
      minimumDurationToTrack: 5, // 5ms
      trackMethodCalls: true,
      trackStateChanges: true,
      trackRouteEvaluations: true,
      maxTraceEntries: 1000,
      maxSamples: 100,
      compressTraces: false,
      persistMetrics: false,
      trackProcessMetrics: false,
      processMetricsInterval: 5000, // 5 seconds
      methodDurationWarningMs: 500, // 500ms
      memoryWarningThresholdMb: 500, // 500MB
      eventRateWarningThreshold: 1000, // 1000 events/sec
      ...options
    };
    
    // Initialize metrics
    this.metrics = {
      startTime: 0,
      endTime: 0,
      executionTimeMs: 0,
      methodCallCount: {},
      methodDurations: {},
      stateChanges: 0,
      routeEvaluations: 0,
      errorCount: 0,
      eventCount: 0
    };
  }
  
  /**
   * Start tracking flow execution with optimized event listeners
   */
  startTracking(): void {
    if (this.isTracking) return;
    this.isTracking = true;
    
    // Record start time
    this.metrics.startTime = performance.now();
    
    // Set up event listeners if event bus is available
    if (this.options.eventBus) {
      this.registerEventListeners(this.options.eventBus);
    }
    
    // Start process metrics tracking if enabled
    if (this.options.trackProcessMetrics) {
      this.startProcessMetricsTracking();
    }
    
    // Record initial sample
    this.takeSample();
  }
  
  /**
   * Stop tracking and finalize metrics
   */
  stopTracking(): FlowExecutionMetrics {
    if (!this.isTracking) return this.metrics;
    
    // Record end time and duration
    this.metrics.endTime = performance.now();
    this.metrics.executionTimeMs = this.metrics.endTime - this.metrics.startTime;
    
    // Remove event listeners
    if (this.options.eventBus) {
      this.unregisterEventListeners(this.options.eventBus);
    }
    
    // Stop process metrics tracking
    if (this.processMetricsTimer) {
      clearInterval(this.processMetricsTimer);
      this.processMetricsTimer = undefined;
    }
    
    // Take final sample
    this.takeSample();
    
    // Persist metrics if configured
    if (this.options.persistMetrics && this.options.memoryConnector) {
      this.persistMetricsToMemory();
    }
    
    this.isTracking = false;
    
    return this.metrics;
  }
  
  /**
   * Record a method call with optimized overhead
   */
  recordMethodCall(methodName: string): () => void {
    if (!this.isTracking || !this.options.trackMethodCalls) {
      return () => {}; // No-op if not tracking
    }
    
    const startTime = performance.now();
    this.metrics.methodCallCount[methodName] = (this.metrics.methodCallCount[methodName] || 0) + 1;
    
    // Add to execution trace if enabled
    this.addTraceEntry({
      timestamp: Date.now(),
      type: 'method_call',
      target: methodName
    });
    
    // Return a function to call when method execution completes
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Only track if duration exceeds minimum threshold
      if (duration >= this.options.minimumDurationToTrack!) {
        // Update method duration stats
        if (!this.metrics.methodDurations[methodName]) {
          this.metrics.methodDurations[methodName] = 0;
        }
        this.metrics.methodDurations[methodName] += duration;
        
        // Add method return to trace
        this.addTraceEntry({
          timestamp: Date.now(),
          type: 'method_return',
          target: methodName,
          duration
        });
        
        // Check for slow method warning
        if (duration > this.options.methodDurationWarningMs!) {
          console.warn(`Flow method ${methodName} took ${duration.toFixed(2)}ms, which exceeds warning threshold of ${this.options.methodDurationWarningMs}ms`);
        }
      }
    };
  }
  
  /**
   * Record a state change with minimal overhead
   */
  recordStateChange(stateChanges: Record<string, any>): void {
    if (!this.isTracking || !this.options.trackStateChanges) return;
    
    this.metrics.stateChanges++;
    
    // Add to execution trace if enabled
    this.addTraceEntry({
      timestamp: Date.now(),
      type: 'state_change',
      snapshot: Object.keys(stateChanges)
    });
  }
  
  /**
   * Record a route evaluation with minimal overhead
   */
  recordRouteEvaluation(routeId: string, result: boolean): void {
    if (!this.isTracking || !this.options.trackRouteEvaluations) return;
    
    this.metrics.routeEvaluations++;
    
    // Add to execution trace if enabled
    this.addTraceEntry({
      timestamp: Date.now(),
      type: 'route_evaluation',
      target: routeId,
      snapshot: { result }
    });
  }
  
  /**
   * Record an error with tracking
   */
  recordError(error: Error, context?: string): void {
    if (!this.isTracking) return;
    
    this.metrics.errorCount++;
    
    // Add to execution trace
    this.addTraceEntry({
      timestamp: Date.now(),
      type: 'error',
      target: context,
      error
    });
  }
  
  /**
   * Get current metrics snapshot
   */
  getMetrics(): FlowExecutionMetrics {
    const metrics: FlowExecutionMetrics = {
      startTime: this.metrics.startTime,
      endTime: Date.now(),
      executionTimeMs: this.metrics.endTime - this.metrics.startTime,
      methodCallCount: this.metrics.methodCallCount,
      methodDurations: this.metrics.methodDurations,
      stateChanges: this.metrics.stateChanges,
      routeEvaluations: this.metrics.routeEvaluations,
      errorCount: this.metrics.errorCount,
      eventCount: this.metrics.eventCount,
      ...(this.metrics.heapUsed !== undefined && {
        heapUsed: this.metrics.heapUsed,
        heapTotal: this.metrics.heapTotal,
        externalMemory: this.metrics.externalMemory,
        peakMemoryUsageMb: this.metrics.peakMemoryUsageMb
      })
    };
    return metrics;
  }
  
  /**
   * Get execution trace
   */
  getExecutionTrace(): ExecutionTraceEntry[] {
    return [...this.executionTrace];
  }
  
  /**
   * Get metric samples for time series analysis
   */
  getMetricSamples(): MetricsSample[] {
    return [...this.metricSamples];
  }
  
  /**
   * Clear all collected data
   */
  clearData(): void {
    this.executionTrace = [];
    this.metricSamples = [];
    
    // Reset metrics except for start time
    const startTime = this.metrics.startTime;
    this.metrics = {
      startTime,
      endTime: 0,
      executionTimeMs: 0,
      methodCallCount: {},
      methodDurations: {},
      stateChanges: 0,
      routeEvaluations: 0,
      errorCount: 0,
      eventCount: 0
    };
  }
  
  /**
   * Take a snapshot of current metrics
   */
  private takeSample(): void {
    if (!this.isTracking) return;

    // Get current metrics
    const currentMetrics = this.getMetrics();
    if (!currentMetrics) {
      return;
    }

    // Take memory snapshot if enabled
    let memorySnapshot: any = undefined;
    if (this.options.trackProcessMetrics && typeof process !== 'undefined') {
      memorySnapshot = {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      };
    }

    // Add sample
    if (this.metricSamples.length < (this.options.maxSamples || 100)) {
      this.metricSamples.push({
        timestamp: Date.now(),
        metrics: currentMetrics,
        snapshot: memorySnapshot
      });
    }

    // If we've exceeded max samples, remove oldest samples to maintain window
    if (this.metricSamples.length > (this.options.maxSamples || 100)) {
      const samplesToRemove = this.metricSamples.length - (this.options.maxSamples || 100);
      this.metricSamples.splice(0, samplesToRemove);
    }
  }

  /**
   * Add an entry to the execution trace with optimized storage
   */
  private addTraceEntry(entry: ExecutionTraceEntry): void {
    if (!this.isTracking) return;

    // Add entry if within limits
    if (this.executionTrace.length < (this.options.maxTraceEntries || 1000)) {
      this.executionTrace.push(entry);
    }

    // If we've exceeded max entries, remove oldest entries to maintain window
    if (this.executionTrace.length > (this.options.maxTraceEntries || 1000)) {
      const entriesToRemove = this.executionTrace.length - (this.options.maxTraceEntries || 1000);
      this.executionTrace.splice(0, entriesToRemove);
    }
  }
  
  /**
   * Register event listeners for flow events
   */
  private registerEventListeners(eventBus: FlowEventBus): void {
    // Handler for method events
    const handleMethodEvent = (event: FlowEvent) => {
      this.metrics.eventCount++;
      
      if (event.type === 'flow:method:error') {
        this.metrics.errorCount++;
      }
    };
    
    // Handler for execution events
    const handleExecutionEvent = (event: FlowEvent) => {
      this.metrics.eventCount++;
      
      if (event.type === 'flow:execution:failed') {
        this.metrics.errorCount++;
      }
    };
    
    // Subscribe to events
    this.eventHandlers.push(
      eventBus.subscribe('flow:method:*', handleMethodEvent, {
        priorityThreshold: EventPriority.LOW
      }),
      eventBus.subscribe('flow:execution:*', handleExecutionEvent, {
        priorityThreshold: EventPriority.LOW
      })
    );
  }
  
  /**
   * Unregister event listeners
   */
  private unregisterEventListeners(eventBus: FlowEventBus): void {
    // Unsubscribe from all events
    this.eventHandlers.forEach(handlerId => {
      eventBus.unsubscribe(handlerId);
    });
    this.eventHandlers = [];
  }
  
  /**
   * Start tracking process metrics at intervals
   */
  private startProcessMetricsTracking(): void {
    if (typeof process === 'undefined') return; // Not in Node.js environment
    
    this.processMetricsTimer = setInterval(() => {
      if (!this.isTracking) {
        clearInterval(this.processMetricsTimer!);
        this.processMetricsTimer = undefined;
        return;
      }
      
      this.takeSample();
    }, this.options.processMetricsInterval);
  }
  
  /**
   * Persist metrics to memory system
   */
  private async persistMetricsToMemory(): Promise<void> {
    if (!this.options.memoryConnector) return;
    if (!this.isTracking) return;

    try {
      // Get flow ID safely
      const flowId = (this.flow as any).id || this.flow.constructor.name;
      if (!flowId) {
        throw new Error('Flow ID is required for metrics persistence');
      }

      // Store execution metrics
      await this.options.memoryConnector.saveFlowData(flowId, {
        type: 'execution_metrics',
        data: this.metrics,
        timestamp: Date.now()
      });

      // Store samples if there are enough of them
      if (this.metricSamples.length > 5) {
        const samplesSubset = this.getRepresentativeSamples(5);
        if (samplesSubset.length > 0) {
          await this.options.memoryConnector.saveFlowData(flowId, {
            type: 'metric_samples',
            data: samplesSubset,
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('Failed to persist execution metrics:', error);
    }
  }
  
  /**
   * Get representative samples from the full set
   * Uses an algorithm to select samples distributed across the time range
   * with efficient memory usage and optimal performance characteristics
   */
  private getRepresentativeSamples(count: number): MetricsSample[] {
    if (count <= 0) return [];
    if (this.metricSamples.length <= count) {
      return [...this.metricSamples];
    }

    const result: MetricsSample[] = [];

    // Always include first and last samples if they exist
    if (this.metricSamples.length > 0) {
      const firstSample = this.metricSamples[0];
      if (firstSample) {
        result.push(firstSample);
      }
    }

    if (this.metricSamples.length > 1) {
      const lastSample = this.metricSamples[this.metricSamples.length - 1];
      if (lastSample) {
        result.push(lastSample);
      }
    }

    // Select samples at regular intervals
    const remaining = count - result.length;
    if (remaining > 0 && this.metricSamples.length > 2) {
      const step = (this.metricSamples.length - 2) / (remaining + 1);
      
      for (let i = 1; i <= remaining; i++) {
        const index = Math.floor(i * step) + 1;
        if (index >= 0 && index < this.metricSamples.length) {
          const sample = this.metricSamples[index];
          if (sample) {
            result.push(sample);
          }
        }
      }
    }

    // Sort by timestamp
    return result.sort((a, b) => a.timestamp - b.timestamp);
  }
}
