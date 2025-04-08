/**
 * FlowScheduler
 *
 * Resource-aware scheduling system for optimizing multi-flow execution,
 * implementing advanced performance optimization strategies to maximize
 * throughput while respecting system constraints.
 */
import { EventEmitter } from 'events';
/**
 * FlowScheduler is responsible for determining the optimal execution order
 * of flows based on dependencies, priorities, and resource constraints.
 * It implements various performance optimizations to ensure efficient
 * flow execution in a multi-flow environment.
 */
export class FlowScheduler extends EventEmitter {
    readyQueue = [];
    pendingFlows = new Map();
    runningFlows = new Map();
    completedFlows = new Map();
    flowMap = new Map();
    resourceUsage;
    timer;
    tracker;
    // Performance optimization: pre-computed dependency resolution maps
    flowsBlockedBy = new Map();
    flowsBlocking = new Map();
    // Performance history for predictive scheduling
    flowExecutionHistory = new Map(); // flowType -> execution times
    lastScheduleTime = 0;
    // Priority queue indexing for O(log n) operations
    priorityChanged = false;
    options;
    constructor(options = {}, tracker) {
        super();
        // Default options optimized for performance
        this.options = {
            maxConcurrency: 4,
            optimizeFor: 'balanced',
            resourceLimits: {
                availableCpu: navigator?.hardwareConcurrency || 4,
                availableMemory: 1024, // 1GB default
                maxConcurrentIo: 10,
                maxConcurrentNetwork: 10
            },
            enablePredictiveScheduling: true,
            adaptiveWindowSize: 10,
            defaultPriority: 5,
            enableWorkStealing: true,
            maxQueueTime: 30000, // 30 seconds
            priorityBoostAmount: 2,
            scheduleInterval: 100, // 100ms
            enableBackpressure: true,
            ...options
        };
        // Initialize resource tracking
        this.resourceUsage = {
            availableCpu: this.options.resourceLimits.availableCpu || 4,
            availableMemory: this.options.resourceLimits.availableMemory || 1024,
            maxConcurrentIo: this.options.resourceLimits.maxConcurrentIo || 10,
            maxConcurrentNetwork: this.options.resourceLimits.maxConcurrentNetwork || 10
        };
        // Link tracker if provided
        this.tracker = tracker;
    }
    /**
     * Register a flow with the scheduler
     */
    registerFlow(id, flow, options = {}) {
        const { priority = this.options.defaultPriority, dependencies = [], resourceEstimate = {} } = options;
        // Create optimized schedulable flow object
        const schedulableFlow = {
            id,
            flow,
            priority,
            state: 'pending',
            dependencies: new Set(dependencies),
            dependents: new Set(),
            estimatedResourceUsage: {
                cpu: resourceEstimate.cpu || 0.1, // Default to 10% of a core
                memory: resourceEstimate.memory || 50, // Default to 50MB
                io: resourceEstimate.io || 0.1,
                network: resourceEstimate.network || 0.1
            },
            attempt: 0
        };
        // Store in maps for O(1) lookups
        this.pendingFlows.set(id, schedulableFlow);
        this.flowMap.set(id, schedulableFlow);
        // Initialize dependency tracking for efficient topological scheduling
        this.flowsBlockedBy.set(id, new Set(dependencies));
        this.flowsBlocking.set(id, new Set());
        // Register flow type for predictive scheduling
        if (this.options.enablePredictiveScheduling) {
            const flowType = flow.constructor.name;
            if (!this.flowExecutionHistory.has(flowType)) {
                this.flowExecutionHistory.set(flowType, []);
            }
        }
        // Log registration with tracker
        if (this.tracker) {
            this.tracker.registerFlow(id, { flowType: flow.constructor.name }, priority);
        }
        // Check if this flow is a dependency for any existing flows
        for (const [existingId, existingFlow] of this.flowMap.entries()) {
            if (existingFlow.dependencies.has(id)) {
                // This new flow blocks the existing flow
                const blockedBy = this.flowsBlockedBy.get(existingId);
                if (blockedBy) {
                    blockedBy.add(id);
                }
                // Update the blocking relationship
                const blocking = this.flowsBlocking.get(id);
                if (blocking) {
                    blocking.add(existingId);
                    schedulableFlow.dependents.add(existingId);
                }
            }
        }
        // Update dependency graph in tracker
        if (this.tracker) {
            for (const depId of dependencies) {
                this.tracker.addDependency(id, depId);
            }
        }
        // Emit event
        this.emit('flow_registered', { id, priority });
        // Re-evaluate ready flows
        this.updateReadyFlows();
    }
    /**
     * Add a dependency between flows
     */
    addDependency(dependentId, dependencyId) {
        const dependent = this.flowMap.get(dependentId);
        const dependency = this.flowMap.get(dependencyId);
        if (!dependent || !dependency) {
            throw new Error(`Cannot add dependency: one or both flows not found`);
        }
        // Check for cycles
        if (this.wouldCreateCycle(dependentId, dependencyId)) {
            throw new Error(`Adding dependency from ${dependencyId} to ${dependentId} would create a cycle`);
        }
        // Update dependency sets with optimized data structures
        dependent.dependencies.add(dependencyId);
        dependency.dependents.add(dependentId);
        // Update blocked-by and blocking maps
        const blockedBy = this.flowsBlockedBy.get(dependentId) || new Set();
        blockedBy.add(dependencyId);
        this.flowsBlockedBy.set(dependentId, blockedBy);
        const blocking = this.flowsBlocking.get(dependencyId) || new Set();
        blocking.add(dependentId);
        this.flowsBlocking.set(dependencyId, blocking);
        // Update tracker
        if (this.tracker) {
            this.tracker.addDependency(dependentId, dependencyId);
        }
        // Re-evaluate ready queue
        if (dependent.state === 'ready') {
            // Flow was ready but now has a new dependency
            dependent.state = 'pending';
            this.readyQueue = this.readyQueue.filter(f => f.id !== dependentId);
            this.pendingFlows.set(dependentId, dependent);
        }
        this.updateReadyFlows();
    }
    /**
     * Check if adding a dependency would create a cycle
     * Using optimized DFS with visited sets
     */
    wouldCreateCycle(from, to) {
        const visited = new Set();
        const stack = [to]; // Start from the dependency
        while (stack.length > 0) {
            const current = stack.pop();
            if (current === from) {
                return true; // Would create a cycle
            }
            if (visited.has(current)) {
                continue;
            }
            visited.add(current);
            // Add all dependents to the stack
            const dependents = this.flowsBlocking.get(current);
            if (dependents) {
                for (const dependent of dependents) {
                    stack.push(dependent);
                }
            }
        }
        return false;
    }
    /**
     * Start scheduling flows
     */
    start() {
        this.lastScheduleTime = performance.now();
        // Initial update of ready flows
        this.updateReadyFlows();
        // Set up periodic scheduling
        if (this.options.scheduleInterval > 0) {
            this.timer = setInterval(() => {
                this.scheduleFlows();
            }, this.options.scheduleInterval);
        }
        // Immediate first scheduling
        this.scheduleFlows();
    }
    /**
     * Stop scheduling flows
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
    /**
     * Reset the scheduler to initial state
     */
    reset() {
        this.stop();
        this.readyQueue = [];
        this.pendingFlows.clear();
        this.runningFlows.clear();
        this.completedFlows.clear();
        this.flowMap.clear();
        this.flowsBlockedBy.clear();
        this.flowsBlocking.clear();
        // Reset resource usage
        this.resourceUsage = {
            availableCpu: this.options.resourceLimits.availableCpu || 4,
            availableMemory: this.options.resourceLimits.availableMemory || 1024,
            maxConcurrentIo: this.options.resourceLimits.maxConcurrentIo || 10,
            maxConcurrentNetwork: this.options.resourceLimits.maxConcurrentNetwork || 10
        };
        this.emit('scheduler_reset');
    }
    /**
     * Update the set of flows that are ready to run
     * Uses optimized dependency checking
     */
    updateReadyFlows() {
        // Check all pending flows
        for (const [id, flow] of this.pendingFlows.entries()) {
            // Get flows blocking this one with O(1) lookup
            const blockers = this.flowsBlockedBy.get(id);
            // Flow is ready if it has no blockers or all blockers are completed
            if (!blockers || blockers.size === 0 ||
                Array.from(blockers).every(blockerId => {
                    const blocker = this.flowMap.get(blockerId);
                    return blocker && blocker.state === 'completed';
                })) {
                // Move from pending to ready
                flow.state = 'ready';
                flow.readyTime = performance.now();
                this.readyQueue.push(flow);
                this.pendingFlows.delete(id);
            }
        }
        // Sort ready queue if needed
        if (this.readyQueue.length > 1) {
            this.sortReadyQueue();
        }
    }
    /**
     * Sort the ready queue based on priority and other factors
     * Uses optimized sorting algorithm
     */
    sortReadyQueue() {
        const now = performance.now();
        // Apply priority boosts based on queue time
        if (this.options.maxQueueTime > 0) {
            for (const flow of this.readyQueue) {
                if (flow.readyTime && now - flow.readyTime > this.options.maxQueueTime) {
                    // Calculate time in queue
                    flow.timeInQueue = now - flow.readyTime;
                    // Apply priority boost to prevent starvation
                    const boostFactor = Math.floor(flow.timeInQueue / this.options.maxQueueTime);
                    const boost = boostFactor * this.options.priorityBoostAmount;
                    // Apply boost (up to a maximum reasonable value)
                    flow.priority = Math.min(flow.priority + boost, 100);
                }
            }
        }
        // Sort by multiple factors for optimal scheduling
        this.readyQueue.sort((a, b) => {
            // Priority is the primary factor (higher values first)
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            // If priorities are equal, use predicted execution time (shorter first)
            if (this.options.enablePredictiveScheduling) {
                const aTime = this.predictExecutionTime(a);
                const bTime = this.predictExecutionTime(b);
                if (aTime !== bTime) {
                    return aTime - bTime; // Shorter first
                }
            }
            // If still tied, use resource efficiency (higher efficiency first)
            const aEfficiency = this.calculateResourceEfficiency(a);
            const bEfficiency = this.calculateResourceEfficiency(b);
            if (aEfficiency !== bEfficiency) {
                return bEfficiency - aEfficiency;
            }
            // Finally, use readiness time (earlier first)
            return (a.readyTime || 0) - (b.readyTime || 0);
        });
    }
    /**
     * Calculate resource efficiency score for a flow
     * Higher is better
     */
    calculateResourceEfficiency(flow) {
        const { cpu, memory, io, network } = flow.estimatedResourceUsage;
        // Define resource weights based on current bottlenecks
        const cpuWeight = this.resourceUsage.availableCpu < 1 ? 3 : 1;
        const memoryWeight = this.resourceUsage.availableMemory < 100 ? 3 : 1;
        const ioWeight = this.resourceUsage.maxConcurrentIo < 2 ? 3 : 1;
        const networkWeight = this.resourceUsage.maxConcurrentNetwork < 2 ? 3 : 1;
        // Calculate inverse resource usage (lower usage = higher efficiency)
        const cpuEfficiency = (1 - cpu) * cpuWeight;
        const memoryEfficiency = (1 - (memory / 1000)) * memoryWeight;
        const ioEfficiency = (1 - io) * ioWeight;
        const networkEfficiency = (1 - network) * networkWeight;
        // Total efficiency score
        return cpuEfficiency + memoryEfficiency + ioEfficiency + networkEfficiency;
    }
    /**
     * Predict execution time for a flow based on historical data
     * Returns estimate in milliseconds
     */
    predictExecutionTime(flow) {
        if (!this.options.enablePredictiveScheduling) {
            return 0; // Prediction disabled
        }
        const flowType = flow.flow.constructor.name;
        const history = this.flowExecutionHistory.get(flowType);
        if (!history || history.length === 0) {
            // No history, use heuristic estimate based on dependency count
            return 100 + (flow.dependencies.size * 50);
        }
        // Use recent window for adaptive prediction
        const recentHistory = history.slice(-this.options.adaptiveWindowSize);
        if (recentHistory.length === 0) {
            return 100; // Fallback default
        }
        // Calculate average with outlier rejection
        if (recentHistory.length >= 4) {
            // Remove outliers for more stable predictions
            const sorted = [...recentHistory].sort((a, b) => a - b);
            const q1Index = Math.floor(sorted.length / 4);
            const q3Index = Math.floor(sorted.length * 3 / 4);
            const validTimes = sorted.slice(q1Index, q3Index + 1);
            // Calculate average of non-outlier values
            const sum = validTimes.reduce((acc, time) => acc + time, 0);
            return sum / validTimes.length;
        }
        // Simple average for small sample sizes
        const sum = recentHistory.reduce((acc, time) => acc + time, 0);
        return sum / recentHistory.length;
    }
    /**
     * Schedule flows for execution based on resources and priorities
     */
    scheduleFlows() {
        const now = performance.now();
        this.lastScheduleTime = now;
        // Check for completed running flows
        for (const [id, flow] of this.runningFlows.entries()) {
            // If flow is actually done (external signal), mark as completed
            if (flow.state === 'completed' || flow.state === 'failed') {
                this.runningFlows.delete(id);
                this.completedFlows.set(id, flow);
                // Release resources
                this.releaseResources(flow);
                // Record execution time for predictive scheduling
                if (flow.startTime && flow.endTime && this.options.enablePredictiveScheduling) {
                    const executionTime = flow.endTime - flow.startTime;
                    const flowType = flow.flow.constructor.name;
                    const history = this.flowExecutionHistory.get(flowType);
                    if (history) {
                        history.push(executionTime);
                        // Keep history bounded
                        if (history.length > 100) {
                            history.shift();
                        }
                    }
                }
                // Update dependents
                this.updateDependentFlows(id);
            }
        }
        // Update ready flows before scheduling
        this.updateReadyFlows();
        // Schedule flows until we hit resource limits or no more ready flows
        while (this.readyQueue.length > 0) {
            // Check if we've hit concurrency limit
            if (this.runningFlows.size >= this.options.maxConcurrency) {
                break;
            }
            // Check if we should apply backpressure
            if (this.options.enableBackpressure && this.isSystemOverloaded()) {
                break;
            }
            // Get highest priority flow
            const flow = this.readyQueue.shift();
            if (!flow)
                break;
            // Check if resources are available
            if (!this.canAllocateResources(flow)) {
                // Put back at head of queue for next scheduling cycle
                this.readyQueue.unshift(flow);
                break;
            }
            // Allocate resources and execute
            this.allocateResources(flow);
            this.executeFlow(flow);
        }
        // Emit stats event
        this.emit('scheduler_stats', {
            pendingCount: this.pendingFlows.size,
            readyCount: this.readyQueue.length,
            runningCount: this.runningFlows.size,
            completedCount: this.completedFlows.size,
            resourceUsage: { ...this.resourceUsage }
        });
    }
    /**
     * Check if the system is overloaded and should apply backpressure
     */
    isSystemOverloaded() {
        // Simple overload detection
        const cpuPercentage = 1 - (this.resourceUsage.availableCpu /
            (this.options.resourceLimits.availableCpu || 4));
        const memoryPercentage = 1 - (this.resourceUsage.availableMemory /
            (this.options.resourceLimits.availableMemory || 1024));
        // System is overloaded if either CPU or memory usage is above 90%
        return cpuPercentage > 0.9 || memoryPercentage > 0.9;
    }
    /**
     * Execute a flow
     */
    executeFlow(flow) {
        flow.state = 'running';
        flow.startTime = performance.now();
        flow.attempt++;
        this.runningFlows.set(flow.id, flow);
        // Notify tracker
        if (this.tracker) {
            this.tracker.startFlowExecution(flow.id);
        }
        this.emit('flow_started', { id: flow.id, attempt: flow.attempt });
    }
    /**
     * Mark a flow as completed
     */
    markFlowCompleted(flowId, success, result) {
        const flow = this.flowMap.get(flowId);
        if (!flow)
            return;
        flow.state = success ? 'completed' : 'failed';
        flow.endTime = performance.now();
        if (flow.startTime) {
            flow.executionTime = flow.endTime - flow.startTime;
        }
        // Update tracker
        if (this.tracker) {
            this.tracker.completeFlowExecution(flowId, success, result);
        }
        this.emit('flow_completed', {
            id: flowId,
            success,
            executionTime: flow.executionTime
        });
        // The running flow will be cleaned up in the next scheduling cycle
    }
    /**
     * Update dependent flows when a flow completes
     */
    updateDependentFlows(flowId) {
        const dependents = this.flowsBlocking.get(flowId);
        if (!dependents)
            return;
        for (const dependentId of dependents) {
            const blockers = this.flowsBlockedBy.get(dependentId);
            if (blockers) {
                blockers.delete(flowId);
                // If no more blockers, this flow might be ready now
                if (blockers.size === 0) {
                    const dependent = this.flowMap.get(dependentId);
                    if (dependent && dependent.state === 'pending') {
                        dependent.state = 'ready';
                        dependent.readyTime = performance.now();
                        this.readyQueue.push(dependent);
                        this.pendingFlows.delete(dependentId);
                        // Re-sort the ready queue
                        this.sortReadyQueue();
                    }
                }
            }
        }
    }
    /**
     * Check if resources can be allocated for a flow
     */
    canAllocateResources(flow) {
        const { cpu, memory, io, network } = flow.estimatedResourceUsage;
        return (this.resourceUsage.availableCpu >= cpu &&
            this.resourceUsage.availableMemory >= memory &&
            this.resourceUsage.maxConcurrentIo >= io &&
            this.resourceUsage.maxConcurrentNetwork >= network);
    }
    /**
     * Allocate resources for a flow
     */
    allocateResources(flow) {
        const { cpu, memory, io, network } = flow.estimatedResourceUsage;
        this.resourceUsage.availableCpu -= cpu;
        this.resourceUsage.availableMemory -= memory;
        this.resourceUsage.maxConcurrentIo -= io;
        this.resourceUsage.maxConcurrentNetwork -= network;
    }
    /**
     * Release resources allocated to a flow
     */
    releaseResources(flow) {
        const { cpu, memory, io, network } = flow.estimatedResourceUsage;
        this.resourceUsage.availableCpu += cpu;
        this.resourceUsage.availableMemory += memory;
        this.resourceUsage.maxConcurrentIo += io;
        this.resourceUsage.maxConcurrentNetwork += network;
    }
    /**
     * Get all scheduled flows
     */
    getFlows() {
        return new Map(this.flowMap);
    }
    /**
     * Get a flow by ID
     */
    getFlow(flowId) {
        return this.flowMap.get(flowId);
    }
    /**
     * Get current scheduler stats
     */
    getStats() {
        return {
            pendingCount: this.pendingFlows.size,
            readyCount: this.readyQueue.length,
            runningCount: this.runningFlows.size,
            completedCount: this.completedFlows.size,
            totalFlows: this.flowMap.size,
            resourceUsage: { ...this.resourceUsage }
        };
    }
}
//# sourceMappingURL=FlowScheduler.js.map