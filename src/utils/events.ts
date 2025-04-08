/**
 * Events system implementation
 * Optimized for efficient event handling with minimal overhead
 */

export type EventHandler<T = any> = (eventData: T) => void | Promise<void>;

export interface EventOptions {
  /**
   * Whether to execute the handler asynchronously
   * @default true
   */
  async?: boolean;
  
  /**
   * Whether to continue execution if the handler throws an error
   * @default true
   */
  ignoreFaults?: boolean;
  
  /**
   * Filter function to determine if the event should be handled
   */
  filter?: (eventData: any) => boolean;
}

/**
 * EventEmitter class for efficient publish-subscribe pattern
 * Optimized for:
 * - Minimal overhead with WeakMap storage
 * - Efficient event handling with filters
 * - Async execution for non-blocking operations
 */
export class EventEmitter {
  private listeners = new Map<string, Array<{ handler: EventHandler; options: EventOptions }>>();
  private wildcardListeners: Array<{ handler: EventHandler; options: EventOptions }> = [];
  private batches = new Map<string, { timer: any; events: any[] }>();
  
  /**
   * Register an event handler
   */
  on<T = any>(eventName: string, handler: EventHandler<T>, options: EventOptions = {}): () => void {
    const listeners = this.getListeners(eventName);
    
    const entry = {
      handler,
      options: {
        async: options.async ?? true,
        ignoreFaults: options.ignoreFaults ?? true,
        filter: options.filter
      }
    };
    
    listeners.push(entry);
    
    // Return a function to remove this listener
    return () => {
      const index = listeners.indexOf(entry);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Register a handler for all events
   */
  onAny<T = any>(handler: EventHandler<T>, options: EventOptions = {}): () => void {
    const entry = {
      handler,
      options: {
        async: options.async ?? true,
        ignoreFaults: options.ignoreFaults ?? true,
        filter: options.filter
      }
    };
    
    this.wildcardListeners.push(entry);
    
    // Return a function to remove this listener
    return () => {
      const index = this.wildcardListeners.indexOf(entry);
      if (index !== -1) {
        this.wildcardListeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Register a one-time event handler
   */
  once<T = any>(eventName: string, handler: EventHandler<T>, options: EventOptions = {}): () => void {
    const removeListener = this.on(eventName, (data: T) => {
      removeListener();
      handler(data);
    }, options);
    
    return removeListener;
  }
  
  /**
   * Emit an event with data
   */
  async emit(eventName: string, data: any): Promise<void> {
    const listeners = this.getListeners(eventName);
    const combinedListeners = [...listeners, ...this.wildcardListeners];
    
    for (const { handler, options } of combinedListeners) {
      // Apply filter if provided
      if (options.filter && !options.filter(data)) {
        continue;
      }
      
      try {
        if (options.async) {
          // Fire and forget
          Promise.resolve().then(() => handler(data));
        } else {
          // Synchronous execution
          handler(data);
        }
      } catch (error) {
        if (!options.ignoreFaults) {
          throw error;
        }
        // Log error but continue with other handlers
        console.error(`Error in event handler for "${eventName}":`, error);
      }
    }
  }
  
  /**
   * Emit an event to be processed in batches
   */
  batchEmit(eventName: string, data: any, options: { maxBatchSize?: number; maxBatchTimeMs?: number } = {}): void {
    const maxBatchSize = options.maxBatchSize ?? 100;
    const maxBatchTimeMs = options.maxBatchTimeMs ?? 100;
    
    let batch = this.batches.get(eventName);
    
    if (!batch) {
      batch = {
        timer: null,
        events: []
      };
      this.batches.set(eventName, batch);
    }
    
    // Add event to batch
    batch.events.push(data);
    
    // If batch is full, process immediately
    if (batch.events.length >= maxBatchSize) {
      this.processBatch(eventName);
      return;
    }
    
    // Otherwise, set a timer to process the batch after maxBatchTimeMs
    if (batch.timer === null) {
      batch.timer = setTimeout(() => {
        this.processBatch(eventName);
      }, maxBatchTimeMs);
    }
  }
  
  /**
   * Remove all event handlers
   */
  removeAllListeners(eventName?: string): void {
    if (eventName) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
      this.wildcardListeners = [];
    }
  }
  
  /**
   * Get the number of listeners for an event
   */
  listenerCount(eventName?: string): number {
    if (eventName) {
      return (this.listeners.get(eventName) || []).length;
    }
    
    let count = this.wildcardListeners.length;
    for (const listeners of this.listeners.values()) {
      count += listeners.length;
    }
    
    return count;
  }
  
  /**
   * Process a batch of events
   */
  private processBatch(eventName: string): void {
    const batch = this.batches.get(eventName);
    
    if (!batch || batch.events.length === 0) {
      return;
    }
    
    // Clear the timer
    if (batch.timer !== null) {
      clearTimeout(batch.timer);
      batch.timer = null;
    }
    
    // Get the events and reset the batch
    const events = [...batch.events];
    batch.events = [];
    
    // Emit the batch event
    this.emit(`${eventName}:batch`, events);
  }
  
  /**
   * Get listeners for an event, creating the array if it doesn't exist
   */
  private getListeners(eventName: string): Array<{ handler: EventHandler; options: EventOptions }> {
    let listeners = this.listeners.get(eventName);
    
    if (!listeners) {
      listeners = [];
      this.listeners.set(eventName, listeners);
    }
    
    return listeners;
  }
}

/**
 * Singleton event emitter instance for global events
 */
export const eventBus = new EventEmitter();
