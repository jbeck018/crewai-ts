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
export declare class EventEmitter {
    private listeners;
    private wildcardListeners;
    private batches;
    /**
     * Register an event handler
     */
    on<T = any>(eventName: string, handler: EventHandler<T>, options?: EventOptions): () => void;
    /**
     * Register a handler for all events
     */
    onAny<T = any>(handler: EventHandler<T>, options?: EventOptions): () => void;
    /**
     * Register a one-time event handler
     */
    once<T = any>(eventName: string, handler: EventHandler<T>, options?: EventOptions): () => void;
    /**
     * Emit an event with data
     */
    emit(eventName: string, data: any): Promise<void>;
    /**
     * Emit an event to be processed in batches
     */
    batchEmit(eventName: string, data: any, options?: {
        maxBatchSize?: number;
        maxBatchTimeMs?: number;
    }): void;
    /**
     * Remove all event handlers
     */
    removeAllListeners(eventName?: string): void;
    /**
     * Get the number of listeners for an event
     */
    listenerCount(eventName?: string): number;
    /**
     * Process a batch of events
     */
    private processBatch;
    /**
     * Get listeners for an event, creating the array if it doesn't exist
     */
    private getListeners;
}
/**
 * Singleton event emitter instance for global events
 */
export declare const eventBus: EventEmitter;
//# sourceMappingURL=events.d.ts.map