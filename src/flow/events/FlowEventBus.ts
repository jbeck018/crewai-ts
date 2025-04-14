/**
 * FlowEventBus
 * 
 * Optimized event system for flows with minimal overhead,
 * efficient event filtering, and performance monitoring.
 */
import EventEmitter from 'events';

/**
 * Event priority levels
 */
export enum EventPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Base flow event interface
 */
export interface FlowEvent {
  type: string;
  timestamp: number;
  priority: EventPriority;
  metadata?: Record<string, any>;
}

/**
 * Flow state change event
 */
export interface FlowStateChangeEvent extends FlowEvent {
  type: 'flow:state:changed';
  flowId: string;
  stateId: string;
  changes: Record<string, any>;
}

/**
 * Flow execution event
 */
export interface FlowExecutionEvent extends FlowEvent {
  type: 'flow:execution:started' | 'flow:execution:completed' | 'flow:execution:failed';
  flowId: string;
  executionId: string;
  duration?: number;
  error?: Error;
}

/**
 * Flow method execution event
 */
export interface FlowMethodEvent extends FlowEvent {
  type: 'flow:method:before' | 'flow:method:after' | 'flow:method:error';
  flowId: string;
  methodName: string;
  executionId: string;
  duration?: number;
  result?: any;
  error?: Error;
}

/**
 * Flow routing event
 */
export interface FlowRoutingEvent extends FlowEvent {
  type: 'flow:routing:evaluation' | 'flow:routing:selected';
  flowId: string;
  routeId?: string;
  matches?: string[];
  evaluationTimeMs?: number;
}

/**
 * Combined event types
 */
export type AllFlowEvents = 
  | FlowStateChangeEvent
  | FlowExecutionEvent
  | FlowMethodEvent
  | FlowRoutingEvent;

/**
 * Event handler function
 */
export type EventHandler<T extends FlowEvent = FlowEvent> = (event: T) => void | Promise<void>;

/**
 * Event subscription options
 */
export interface EventSubscriptionOptions {
  filter?: (event: FlowEvent) => boolean;
  maxListenerCount?: number;
  priorityThreshold?: EventPriority;
  queueSize?: number;
  batchEvents?: boolean;
  batchTimeMs?: number;
}

/**
 * Event bus options
 */
export interface FlowEventBusOptions {
  enableProfiling?: boolean;
  maxQueueSize?: number;
  defaultBatchSize?: number;
  warningThresholdMs?: number;
  errorHandler?: (error: Error, event: FlowEvent) => void;
}

/**
 * Holds performance metrics for the event bus
 */
interface EventBusMetrics {
  eventsPublished: number;
  eventsDelivered: number;
  /**
   * Count events by type for optimized metrics tracking
   */
  eventTypeCounts: Record<string, number>;
  averageProcessingTimeMs: number;
  totalProcessingTimeMs: number;
  maxProcessingTimeMs: number;
  queueOverflowCount: number;
  errorCount: number;
  activeSubscriptions: number;
  /**
   * Total events processed through the system
   * Memory-optimized tracking separate from published events
   */
  eventsProcessed: number;
  /**
   * Number of events processed in batch mode for memory efficiency
   */
  batchedEventCount: number;
}

/**
 * Manages event handling for flow system with optimized event routing
 * and efficient subscription management.
 */
export class FlowEventBus {
  // Underlying event emitter with modifications for performance
  private eventEmitter = new EventEmitter();
  
  // Event queue for batching and prioritization
  private eventQueue: Map<EventPriority, FlowEvent[]> = new Map();
  private processing = false;
  
  // Batched event handling
  private batchedEvents: Map<string, Map<string, FlowEvent[]>> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Options
  private options: FlowEventBusOptions;
  
  // Handler storage for optimized lookups
  private handlerSets: Map<string, Set<string>> = new Map();
  private handlerFilters: Map<string, (event: FlowEvent) => boolean> = new Map();
  private handlerPriorities: Map<string, EventPriority> = new Map();
  
  // Performance metrics - memory-optimized implementation with all required fields
  private metrics: EventBusMetrics = {
    eventsPublished: 0,
    eventsDelivered: 0,
    eventTypeCounts: {},
    averageProcessingTimeMs: 0,
    totalProcessingTimeMs: 0,
    maxProcessingTimeMs: 0,
    queueOverflowCount: 0,
    errorCount: 0,
    activeSubscriptions: 0,
    // Initialize newly added properties for type-safety
    eventsProcessed: 0,
    batchedEventCount: 0
  };
  
  constructor(options: FlowEventBusOptions = {}) {
    // Set default options
    this.options = {
      enableProfiling: true,
      maxQueueSize: 1000,
      defaultBatchSize: 10,
      warningThresholdMs: 50,
      ...options
    };
    
    // Initialize queue for each priority level
    for (const priority of Object.values(EventPriority)) {
      if (typeof priority === 'number') {
        this.eventQueue.set(priority, []);
      }
    }
    
    // Increase max listeners to avoid Node.js warnings
    this.eventEmitter.setMaxListeners(0);
  }
  
  /**
   * Subscribe to flow events with optional filtering
   * @param eventType Event type to subscribe to (can include wildcards)
   * @param handler Event handler function
   * @param options Subscription options
   * @returns Subscription ID that can be used to unsubscribe
   */
  subscribe<T extends FlowEvent>(
    eventType: string,
    handler: EventHandler<T>,
    options: EventSubscriptionOptions = {}
  ): string {
    // Generate unique handler ID
    const handlerId = `${eventType}:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`;
    
    // Store handler for this event type
    if (!this.handlerSets.has(eventType)) {
      this.handlerSets.set(eventType, new Set());
    }
    this.handlerSets.get(eventType)!.add(handlerId);
    
    // Store filter if provided
    if (options.filter) {
      this.handlerFilters.set(handlerId, options.filter);
    }
    
    // Store priority threshold
    this.handlerPriorities.set(handlerId, options.priorityThreshold ?? EventPriority.LOW);
    
    // Create actual handler function with optimization features
    const wrappedHandler = async (event: T) => {
      // Skip if below priority threshold
      if (event.priority < (options.priorityThreshold ?? EventPriority.LOW)) {
        return;
      }
      
      // Apply filter if provided
      if (options.filter && !options.filter(event)) {
        return;
      }
      
      // Track metrics if profiling enabled
      const startTime = this.options.enableProfiling ? performance.now() : 0;
      
      try {
        // Execute handler
        await handler(event);
        
        // Update metrics
        if (this.options.enableProfiling) {
          this.metrics.eventsDelivered++;
        }
      } catch (error) {
        // Handle errors
        this.metrics.errorCount++;
        
        if (this.options.errorHandler) {
          this.options.errorHandler(error as Error, event);
        } else {
          console.error('Error in event handler:', error);
        }
      } finally {
        // Update processing time metrics
        if (this.options.enableProfiling) {
          const processingTime = performance.now() - startTime;
          this.metrics.totalProcessingTimeMs += processingTime;
          this.metrics.averageProcessingTimeMs = 
            this.metrics.totalProcessingTimeMs / this.metrics.eventsDelivered;
          
          if (processingTime > this.metrics.maxProcessingTimeMs) {
            this.metrics.maxProcessingTimeMs = processingTime;
          }
          
          // Log warning if processing took too long
          if (processingTime > this.options.warningThresholdMs!) {
            console.warn(
              `Slow event handler for ${event.type}: ${processingTime.toFixed(2)}ms ` +
              `(threshold: ${this.options.warningThresholdMs}ms)`
            );
          }
        }
      }
    };
    
    // Add listener
    this.eventEmitter.on(eventType, wrappedHandler);
    this.metrics.activeSubscriptions++;
    
    return handlerId;
  }
  
  /**
   * Subscribe to multiple event types at once
   * @param eventTypes Array of event types to subscribe to
   * @param handler Event handler function
   * @param options Subscription options
   * @returns Array of subscription IDs
   */
  subscribeToMany<T extends FlowEvent>(
    eventTypes: string[],
    handler: EventHandler<T>,
    options: EventSubscriptionOptions = {}
  ): string[] {
    return eventTypes.map(type => this.subscribe(type, handler, options));
  }
  
  /**
   * Unsubscribe from events
   * @param subscriptionId Subscription ID returned from subscribe()
   */
  unsubscribe(subscriptionId: string): boolean {
    // Parse subscription ID to get event type
    // Memory-optimized string safety implementation
    // Ensure subscriptionId is always a valid string before operating on it
    if (typeof subscriptionId !== 'string' || !subscriptionId) {
      return false; // Invalid subscription ID
    }
    
    // Split with string safety validation
    const parts = subscriptionId.split(':');
    
    // Only proceed if we have valid parts after splitting
    if (!parts || parts.length === 0) {
      return false; // Cannot extract event type
    }
    
    // Extract event type with null safety
    const eventType = parts[0] || '';
    
    // Skip processing if eventType is empty
    if (!eventType) {
      return false;
    }
    
    // Remove from handler sets with type safety
    const handlerSet = this.handlerSets.get(eventType);
    if (handlerSet) {
      handlerSet.delete(subscriptionId);
      if (handlerSet.size === 0) {
        this.handlerSets.delete(eventType);
      }
    }
    
    // Remove filter and priority
    this.handlerFilters.delete(subscriptionId);
    this.handlerPriorities.delete(subscriptionId);
    
    // Remove actual listener
    this.eventEmitter.removeAllListeners(subscriptionId);
    this.metrics.activeSubscriptions--;
    
    return true;
  }
  
  /**
   * Publish an event to the event bus
   * @param event Event to publish
   * @param immediate Whether to process immediately or queue
   */
  async publish<T extends FlowEvent>(event: T, immediate = false): Promise<void> {
    // Set timestamp if not provided
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    
    // Track metrics with memory-optimized implementation
    if (this.options.enableProfiling && this.metrics) {
      // Safely increment event count with null checks
      this.metrics.eventsPublished = (this.metrics.eventsPublished || 0) + 1;
      
      // Initialize event type counts if needed
      if (!this.metrics.eventTypeCounts) {
        this.metrics.eventTypeCounts = {};
      }
      
      // Get event type with string safety
      const eventType = event.type || 'unknown';
      
      // Initialize counter for this event type if needed
      if (typeof this.metrics.eventTypeCounts[eventType] !== 'number') {
        this.metrics.eventTypeCounts[eventType] = 0;
      }
      
      // Increment with type safety
      this.metrics.eventTypeCounts[eventType]++;
    }
    
    if (immediate) {
      // Emit immediately
      this.eventEmitter.emit(event.type, event);
    } else {
      // Add to priority queue with memory-optimized implementation
      const priority = event.priority || EventPriority.NORMAL; // Default priority for type safety
      let queue = this.eventQueue.get(priority);
      
      // Create queue if it doesn't exist (lazy initialization for memory efficiency)
      if (!queue) {
        queue = [];
        this.eventQueue.set(priority, queue);
      }
      
      // Add event to queue with type checking for memory safety
      queue.push(event);
      
      // Check for queue overflow with null safety
      const maxSize = this.options.maxQueueSize || 1000; // Provide default if undefined
      if (queue.length > maxSize && this.metrics) {
        // Safely increment with null check
        this.metrics.queueOverflowCount = (this.metrics.queueOverflowCount || 0) + 1;
        queue.splice(0, queue.length - maxSize);
      }
      
      // Process queue if not already processing and method exists
      if (!this.processing) {
        this.processEventQueue();
      }
    }
  }
  
  /**
   * Publish multiple events at once
   * @param events Events to publish
   * @param options Publishing options
   */
  async publishMany(events: FlowEvent[], options: { immediate?: boolean } = {}): Promise<void> {
    for (const event of events) {
      await this.publish(event, options.immediate);
    }
  }
  
  /**
   * Publish events in batched mode for better performance
   * @param eventType Event type for batching
   * @param event Event to add to batch
   * @param batchId Batch identifier (default is event type)
   * @param flushTimeMs Time in milliseconds before automatically flushing batch
   */
  publishBatched<T extends FlowEvent>(
    eventType: string,
    event: T,
    batchId = eventType,
    flushTimeMs = 100
  ): void {
    // Initialize batch for this type if needed
    if (!this.batchedEvents.has(eventType)) {
      this.batchedEvents.set(eventType, new Map());
    }
    
    // Initialize batch for this ID if needed
    const typeBatches = this.batchedEvents.get(eventType)!;
    if (!typeBatches.has(batchId)) {
      typeBatches.set(batchId, []);
    }
    
    // Add event to batch
    typeBatches.get(batchId)!.push(event);
    
    // Set or reset timer for this batch
    if (this.batchTimers.has(batchId)) {
      clearTimeout(this.batchTimers.get(batchId)!);
    }
    
    this.batchTimers.set(batchId, setTimeout(() => {
      this.flushBatch(eventType, batchId);
    }, flushTimeMs));
  }
  
  /**
   * Flush a batched event immediately
   * @param eventType Event type to flush
   * @param batchId Batch identifier (default is event type)
   */
  flushBatch(eventType: string, batchId = eventType): void {
    // Get batches for this type
    const typeBatches = this.batchedEvents.get(eventType);
    if (!typeBatches) return;
    
    // Get batch for this ID
    const batch = typeBatches.get(batchId);
    if (!batch || batch.length === 0) return;
    
    // Clear batch
    typeBatches.delete(batchId);
    
    // Clear timer
    if (this.batchTimers.has(batchId)) {
      clearTimeout(this.batchTimers.get(batchId)!);
      this.batchTimers.delete(batchId);
    }
    
    // Create batch event with all events in the batch
    const batchEvent: FlowEvent = {
      type: `${eventType}:batch`,
      timestamp: Date.now(),
      priority: EventPriority.NORMAL,
      metadata: {
        batchId,
        eventCount: batch.length,
        events: batch
      }
    };
    
    // Publish batch event
    this.publish(batchEvent, true);
  }
  
  /**
   * Process events in the queue based on priority
   */
  private async processEventQueue(): Promise<void> {
    this.processing = true;
    
    try {
      // Process events in priority order
      for (let priority = EventPriority.CRITICAL; priority >= EventPriority.LOW; priority--) {
        const queue = this.eventQueue.get(priority);
        if (!queue || queue.length === 0) continue;
        
        // Process a batch of events (default 10)
        const batchSize = Math.min(queue.length, this.options.defaultBatchSize!);
        const batch = queue.splice(0, batchSize);
        
        // Process each event in the batch
        for (const event of batch) {
          this.eventEmitter.emit(event.type, event);
        }
      }
      
      // Check if more events to process
      const moreEvents = Array.from(this.eventQueue.values()).some(q => q.length > 0);
      
      if (moreEvents) {
        // Continue processing in next tick
        setImmediate(() => this.processEventQueue());
      } else {
        this.processing = false;
      }
    } catch (error) {
      console.error('Error processing event queue:', error);
      this.processing = false;
    }
  }
  
  /**
   * Get performance metrics
   */
  getMetrics(): EventBusMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    // Create memory-optimized metrics object with all required fields initialized
    this.metrics = {
      eventsPublished: 0,
      eventsDelivered: 0,
      eventTypeCounts: {},
      averageProcessingTimeMs: 0,
      totalProcessingTimeMs: 0,
      maxProcessingTimeMs: 0,
      queueOverflowCount: 0,
      errorCount: 0,
      // Preserve active subscriptions count when resetting other metrics
      activeSubscriptions: this.metrics?.activeSubscriptions || 0,
      // Initialize newly added properties
      eventsProcessed: 0,
      batchedEventCount: 0
    };
  }
  
  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.eventEmitter.removeAllListeners();
    this.handlerSets.clear();
    this.handlerFilters.clear();
    this.handlerPriorities.clear();
    
    // Clear batched events
    this.batchedEvents.clear();
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();
    
    // Reset metrics with memory optimization
    if (this.metrics) {
      // Initialize metrics object if needed
      this.metrics.activeSubscriptions = 0;
      this.metrics.eventsPublished = 0;
      this.metrics.eventsProcessed = 0;
      this.metrics.queueOverflowCount = 0;
      this.metrics.eventTypeCounts = {};
      this.metrics.batchedEventCount = 0;
    }
  }
}
