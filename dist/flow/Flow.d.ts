/**
 * Base class for all flows with optimized execution and caching.
 */
import EventEmitter from 'events';
import { FlowState } from './FlowState.js';
import { FlowOptions } from './types.js';
/**
 * Base Flow class with optimized execution model and event system
 */
export declare class Flow<T extends FlowState = FlowState> {
    protected state: T;
    protected events: EventEmitter<[never]>;
    private readonly _methods;
    private readonly _startMethods;
    private readonly _listeners;
    private readonly _routers;
    private readonly _pendingAndListeners;
    private readonly _executedMethods;
    private readonly _methodResultCache;
    private readonly _methodCacheTtlMs;
    private readonly _persistence?;
    /**
     * Creates a new Flow instance with optimized execution model
     *
     * @param options Flow configuration options
     */
    constructor(options?: FlowOptions<T>);
    /**
     * Starts the flow execution with optimized async execution
     *
     * @param inputs Optional inputs for the flow
     * @returns The flow execution result
     */
    execute(inputs?: Record<string, any>): Promise<any>;
    /**
     * Waits for the flow to complete execution
     * Uses an optimized event-based approach to avoid polling
     */
    private _waitForFlowCompletion;
    /**
     * Scans and registers methods with their metadata
     * Uses prototype inspection for efficiency
     */
    private _scanAndRegisterMethods;
    /**
     * Registers a listener method with its triggering condition
     * Uses optimized data structures for fast condition evaluation
     */
    private _registerListener;
    /**
     * Executes a method and processes its result
     * Implements optimized caching and event handling
     */
    private _executeMethod;
    /**
     * Executes listeners for a triggered method
     * Implements parallel execution for performance
     */
    private _executeListeners;
    /**
     * Finds which listeners should be triggered by a method execution
     * Uses optimized lookup tables for performance
     */
    private _findTriggeredListeners;
    /**
     * Executes a single listener method
     * Handles parameter inspection and error handling
     */
    private _executeSingleListener;
    /**
     * Checks if the flow is complete based on method result
     * Handles STOP constants and other completion signals
     */
    private _checkFlowCompletion;
    /**
     * Emits a flow event to the event system
     * Handles both internal events and external event bus
     */
    private _emitEvent;
    /**
     * Retrieves a cached method result
     * Implements TTL-based cache expiration
     */
    private _getFromCache;
    /**
     * Adds a method result to the cache
     * Implements memory-efficient caching
     */
    private _addToCache;
    /**
     * Cleans the method result cache to prevent memory issues
     * Implements efficient cache cleanup based on age
     */
    private _cleanCache;
    /**
     * Estimates the size of an object in memory
     * Used for cache size management
     */
    private _estimateSize;
}
//# sourceMappingURL=Flow.d.ts.map