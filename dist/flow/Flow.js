/**
 * Base class for all flows with optimized execution and caching.
 */
import EventEmitter from 'events';
import { FlowState } from './FlowState.js';
import { STOP } from './types.js';
/**
 * Base Flow class with optimized execution model and event system
 */
export class Flow {
    // Flow state tracking and event handling
    state;
    events = new EventEmitter();
    // Fast method lookup tables for optimized execution
    _methods = new Map();
    _startMethods = new Set();
    _listeners = new Map();
    _routers = new Map();
    // Execution tracking for "AND" conditions optimization
    _pendingAndListeners = new Map();
    _executedMethods = new Set();
    // Method execution memoization cache with TTL
    _methodResultCache = new Map();
    _methodCacheTtlMs = 5 * 60 * 1000; // 5 minutes default
    // Persistence layer for flow state
    _persistence;
    /**
     * Creates a new Flow instance with optimized execution model
     *
     * @param options Flow configuration options
     */
    constructor(options = {}) {
        // Initialize state (type assertion needed due to generic constraint)
        this.state = new FlowState(options.initialState || {});
        this._persistence = options.persistence;
        // Scan and register methods with optimized indexing
        this._scanAndRegisterMethods();
        // Emit flow creation event
        this._emitEvent({
            type: 'flow_created',
            flowName: this.constructor.name
        });
    }
    /**
     * Starts the flow execution with optimized async execution
     *
     * @param inputs Optional inputs for the flow
     * @returns The flow execution result
     */
    async execute(inputs = {}) {
        // Apply inputs to initial state
        Object.assign(this.state, inputs);
        // If there's a state ID in inputs, try to restore state
        if (inputs.stateId && this._persistence) {
            try {
                const savedState = await this._persistence.loadState(inputs.stateId);
                if (savedState) {
                    this.state = savedState;
                }
            }
            catch (error) {
                console.error('Failed to restore flow state:', error);
            }
        }
        // Emit flow started event
        this._emitEvent({
            type: 'flow_started',
            flowName: this.constructor.name,
            stateId: this.state.id
        });
        // Save initial state if persistence is enabled
        if (this._persistence) {
            try {
                await this._persistence.saveState(this.state);
            }
            catch (error) {
                console.error('Failed to save initial flow state:', error);
            }
        }
        // Execute all start methods in parallel for maximum performance
        const startMethodPromises = Array.from(this._startMethods).map(methodName => {
            return this._executeMethod(methodName, this._methods.get(methodName));
        });
        // Wait for all start methods to complete
        const results = await Promise.all(startMethodPromises);
        // Wait for the flow to finish (all methods executed) and return the result
        const finalResult = await this._waitForFlowCompletion();
        // Emit flow finished event
        this._emitEvent({
            type: 'flow_finished',
            flowName: this.constructor.name,
            stateId: this.state.id,
            result: finalResult
        });
        return finalResult;
    }
    /**
     * Waits for the flow to complete execution
     * Uses an optimized event-based approach to avoid polling
     */
    _waitForFlowCompletion() {
        return new Promise((resolve) => {
            this.events.once('flow:completed', (result) => {
                resolve(result);
            });
        });
    }
    /**
     * Scans and registers methods with their metadata
     * Uses prototype inspection for efficiency
     */
    _scanAndRegisterMethods() {
        // Get all property names from the prototype chain
        const prototype = Object.getPrototypeOf(this);
        const propertyNames = Object.getOwnPropertyNames(prototype);
        // Filter out constructor and private/protected methods
        const methodNames = propertyNames.filter(name => {
            return name !== 'constructor' &&
                typeof prototype[name] === 'function' &&
                !name.startsWith('_');
        });
        // Register each method with its metadata
        for (const methodName of methodNames) {
            const method = prototype[methodName];
            this._methods.set(methodName, method.bind(this));
            // Check if method has flow metadata
            const metadata = method.__metadata;
            if (!metadata)
                continue;
            // Register start methods
            if (metadata.isStartMethod) {
                this._startMethods.add(methodName);
            }
            // Register listeners with their conditions
            if (metadata.isListener && metadata.condition) {
                this._registerListener(methodName, metadata.condition);
            }
            // Register routers with their conditions
            if (metadata.isRouter && metadata.condition) {
                this._routers.set(methodName, metadata.condition);
            }
        }
    }
    /**
     * Registers a listener method with its triggering condition
     * Uses optimized data structures for fast condition evaluation
     */
    _registerListener(listenerName, condition) {
        if (typeof condition === 'string') {
            // Simple condition (single method name)
            if (!this._listeners.has(condition)) {
                this._listeners.set(condition, new Map());
            }
            this._listeners.get(condition).set(listenerName, condition);
        }
        else if (typeof condition === 'object') {
            // Complex condition (AND/OR of methods)
            const complexCondition = condition;
            for (const methodName of complexCondition.methods) {
                if (!this._listeners.has(methodName)) {
                    this._listeners.set(methodName, new Map());
                }
                this._listeners.get(methodName).set(listenerName, condition);
                // For AND conditions, track pending methods to optimize execution
                if (complexCondition.type === 'AND') {
                    if (!this._pendingAndListeners.has(listenerName)) {
                        this._pendingAndListeners.set(listenerName, new Set(complexCondition.methods));
                    }
                }
            }
        }
        else if (typeof condition === 'function') {
            // Function condition - more complex to track, store in a special listener category
            // Create a virtual trigger for function-based conditions
            const virtualTrigger = `__function_condition_${Math.random().toString(36).substr(2, 9)}`;
            if (!this._listeners.has(virtualTrigger)) {
                this._listeners.set(virtualTrigger, new Map());
            }
            this._listeners.get(virtualTrigger).set(listenerName, condition);
        }
    }
    /**
     * Executes a method and processes its result
     * Implements optimized caching and event handling
     */
    async _executeMethod(methodName, method, previousResult) {
        // Check cache first for performance optimization
        const cacheKey = `${methodName}:${JSON.stringify(previousResult)}`;
        const cachedResult = this._getFromCache(cacheKey);
        if (cachedResult) {
            return {
                success: true,
                result: cachedResult
            };
        }
        try {
            // Mark method as executed for tracking AND conditions
            this._executedMethods.add(methodName);
            // Emit method execution started event
            this._emitEvent({
                type: 'method_execution_started',
                flowName: this.constructor.name,
                methodName,
                stateId: this.state.id
            });
            // Execute the method with or without previous result
            let result;
            if (previousResult !== undefined) {
                result = await method(previousResult);
            }
            else {
                result = await method();
            }
            // Cache result for future reuse
            this._addToCache(cacheKey, result);
            // Emit method execution finished event
            this._emitEvent({
                type: 'method_execution_finished',
                flowName: this.constructor.name,
                methodName,
                stateId: this.state.id,
                result
            });
            // Check if this method triggers any listeners
            await this._executeListeners(methodName, result);
            // Check for flow completion
            this._checkFlowCompletion(result);
            return {
                success: true,
                result
            };
        }
        catch (error) {
            // Handle and emit error events
            console.error(`Error executing method ${methodName}:`, error);
            // Emit method execution failed event
            this._emitEvent({
                type: 'method_execution_failed',
                flowName: this.constructor.name,
                methodName,
                stateId: this.state.id,
                error
            });
            return {
                success: false,
                error: error
            };
        }
        finally {
            // Save state if persistence is enabled
            if (this._persistence) {
                try {
                    await this._persistence.saveState(this.state);
                }
                catch (error) {
                    console.error('Failed to save flow state:', error);
                }
            }
        }
    }
    /**
     * Executes listeners for a triggered method
     * Implements parallel execution for performance
     */
    async _executeListeners(triggerMethod, result) {
        // Find all listeners for this method
        const triggered = this._findTriggeredListeners(triggerMethod);
        if (triggered.length === 0)
            return;
        // Execute all triggered listeners in parallel for maximum performance
        const listenerPromises = triggered.map(listenerName => {
            return this._executeSingleListener(listenerName, result);
        });
        // Wait for all listeners to complete
        await Promise.all(listenerPromises);
    }
    /**
     * Finds which listeners should be triggered by a method execution
     * Uses optimized lookup tables for performance
     */
    _findTriggeredListeners(triggerMethod) {
        const triggered = [];
        // Skip if no listeners for this method
        if (!this._listeners.has(triggerMethod))
            return triggered;
        // Get all listeners for this method
        const listeners = this._listeners.get(triggerMethod);
        // Check each listener's condition
        for (const [listenerName, condition] of listeners.entries()) {
            if (typeof condition === 'string') {
                // Simple condition - always trigger
                triggered.push(listenerName);
            }
            else if (typeof condition === 'object') {
                // Complex condition - check AND/OR logic
                const complexCondition = condition;
                if (complexCondition.type === 'OR') {
                    // OR condition - trigger immediately
                    triggered.push(listenerName);
                }
                else if (complexCondition.type === 'AND') {
                    // AND condition - check if all required methods have executed
                    // Use the pending methods tracking for efficiency
                    if (this._pendingAndListeners.has(listenerName)) {
                        const pendingMethods = this._pendingAndListeners.get(listenerName);
                        // Remove this trigger method from pending
                        pendingMethods.delete(triggerMethod);
                        // If no more pending methods, trigger the listener
                        if (pendingMethods.size === 0) {
                            triggered.push(listenerName);
                            this._pendingAndListeners.delete(listenerName);
                        }
                    }
                }
            }
            else if (typeof condition === 'function') {
                // Function condition - evaluate function
                const conditionFn = condition;
                if (conditionFn.call(this)) {
                    triggered.push(listenerName);
                }
            }
        }
        return triggered;
    }
    /**
     * Executes a single listener method
     * Handles parameter inspection and error handling
     */
    async _executeSingleListener(listenerName, result) {
        try {
            const method = this._methods.get(listenerName);
            if (!method)
                return;
            // Execute the listener with the result from the triggering method
            const listenerResult = await this._executeMethod(listenerName, method, result);
            // If this is also a router method, check its result for flow control
            if (this._routers.has(listenerName)) {
                if (listenerResult.success && listenerResult.result === STOP) {
                    // Signal flow completion when a router returns STOP
                    this.events.emit('flow:completed', this.state);
                }
            }
        }
        catch (error) {
            console.error(`Error in listener ${listenerName}:`, error);
        }
    }
    /**
     * Checks if the flow is complete based on method result
     * Handles STOP constants and other completion signals
     */
    _checkFlowCompletion(result) {
        if (result === STOP) {
            // Signal flow completion with current state
            this.events.emit('flow:completed', this.state);
        }
    }
    /**
     * Emits a flow event to the event system
     * Handles both internal events and external event bus
     */
    _emitEvent(event) {
        // Emit to internal event emitter
        this.events.emit(event.type, event);
        // Log event for debugging (can be disabled in production)
        if (process.env.DEBUG_FLOW === 'true') {
            console.log(`[Flow] ${event.type}:`, event);
        }
    }
    /**
     * Retrieves a cached method result
     * Implements TTL-based cache expiration
     */
    _getFromCache(key) {
        const cached = this._methodResultCache.get(key);
        if (!cached)
            return null;
        // Check if cache entry has expired
        const now = Date.now();
        if (now - cached.timestamp > this._methodCacheTtlMs) {
            this._methodResultCache.delete(key);
            return null;
        }
        return cached.result;
    }
    /**
     * Adds a method result to the cache
     * Implements memory-efficient caching
     */
    _addToCache(key, result) {
        // Skip caching for large results to avoid memory issues
        const resultSize = this._estimateSize(result);
        if (resultSize > 1000000) {
            // Skip caching large results (> 1MB approx)
            return;
        }
        this._methodResultCache.set(key, {
            result,
            timestamp: Date.now()
        });
        // Clean up cache if it gets too large
        if (this._methodResultCache.size > 100) {
            this._cleanCache();
        }
    }
    /**
     * Cleans the method result cache to prevent memory issues
     * Implements efficient cache cleanup based on age
     */
    _cleanCache() {
        const now = Date.now();
        const expiredKeys = [];
        // Find expired entries
        for (const [key, entry] of this._methodResultCache.entries()) {
            if (now - entry.timestamp > this._methodCacheTtlMs) {
                expiredKeys.push(key);
            }
        }
        // Remove expired entries
        for (const key of expiredKeys) {
            this._methodResultCache.delete(key);
        }
        // If still too many entries, remove oldest ones
        if (this._methodResultCache.size > 50) {
            // Sort entries by age
            const entries = Array.from(this._methodResultCache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);
            // Remove oldest entries until cache size is acceptable
            const toRemove = entries.slice(0, entries.length - 50);
            for (const [key] of toRemove) {
                this._methodResultCache.delete(key);
            }
        }
    }
    /**
     * Estimates the size of an object in memory
     * Used for cache size management
     */
    _estimateSize(obj) {
        if (obj === null || obj === undefined)
            return 0;
        if (typeof obj === 'string')
            return obj.length * 2; // UTF-16 uses 2 bytes per char
        if (typeof obj === 'number')
            return 8; // 64-bit float
        if (typeof obj === 'boolean')
            return 4; // boolean
        if (Array.isArray(obj)) {
            return obj.reduce((acc, item) => acc + this._estimateSize(item), 0);
        }
        if (typeof obj === 'object') {
            return Object.entries(obj).reduce((acc, [key, value]) => acc + key.length * 2 + this._estimateSize(value), 0);
        }
        return 8; // default size estimate
    }
}
//# sourceMappingURL=Flow.js.map