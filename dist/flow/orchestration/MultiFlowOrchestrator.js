/**
 * MultiFlowOrchestrator
 *
 * High-performance orchestration system that integrates all flow orchestration components
 * with advanced optimizations for memory efficiency, execution speed, and resource management.
 */
import { EventEmitter } from 'events';
import { FlowOrchestrator } from './FlowOrchestrator.js';
import { FlowExecutionTracker } from './FlowExecutionTracker.js';
import { FlowScheduler } from './FlowScheduler.js';
import { FlowDependencyVisualizer } from './FlowDependencyVisualizer.js';
import { FlowMemoryConnector } from '../memory/FlowMemoryConnector.js';
/**
 * MultiFlowOrchestrator integrates the execution tracker, scheduler, visualizer,
 * and memory connector to provide a comprehensive system for orchestrating
 * multiple flows with optimized performance and resource utilization.
 */
export class MultiFlowOrchestrator extends EventEmitter {
    flows = new Map();
    orchestrator;
    tracker;
    scheduler;
    visualizer;
    memoryConnector;
    // Performance optimization: in-memory result cache
    resultCache = new Map();
    // Track memory usage
    initialMemoryUsage = 0;
    peakMemoryUsage = 0;
    // Track overall execution performance
    executionStartTime = 0;
    executionEndTime;
    // Keep critical path tracking
    criticalPathTime = 0;
    criticalPathFlows = [];
    options;
    constructor(options = {}) {
        super();
        // Default options with performance-optimized values
        this.options = {
            optimizeFor: 'balanced',
            enableMemoryIntegration: false,
            memoryConnector: undefined,
            scheduler: {},
            execution: {
                maxConcurrency: navigator?.hardwareConcurrency || 4,
                timeout: 30000, // 30 seconds
                retryCount: 3,
                checkpointInterval: 5000, // 5 seconds
                optimisticExecution: true,
                strategy: 'breadth-first'
            },
            memory: {
                aggressiveCleanup: true,
                enableStateSharing: true,
                budgetMB: 1024, // 1GB
                compressionLevel: 'fast'
            },
            metrics: {
                enableDetailedTracking: true,
                samplingRate: 1.0, // Track everything
                exportToConsole: false,
                maxHistorySize: 1000
            },
            debug: {
                verbose: false,
                logLevel: 'info'
            },
            visualization: {
                outputPath: './visualizations',
                optimizationLevel: 'medium',
                colorScheme: 'status',
                includeExecutionMetrics: true
            },
            ...options
        };
        // Initialize memory connector if enabled
        if (this.options.enableMemoryIntegration) {
            this.memoryConnector = this.options.memoryConnector || new FlowMemoryConnector({
                compressionLevel: this.options.memory.compressionLevel,
                enableCaching: true
            });
        }
        // Initialize tracker with optimized settings
        this.tracker = new FlowExecutionTracker({
            enableMemoryTracking: this.options.memory.aggressiveCleanup,
            maxHistorySize: this.options.metrics.maxHistorySize,
            trackBottlenecks: true,
            samplingRate: this.options.metrics.samplingRate,
            timeSeriesInterval: this.options.metrics.enableDetailedTracking ? 1000 : 0
        });
        // Initialize scheduler with optimized settings
        const schedulerOptions = {
            maxConcurrency: this.options.execution.maxConcurrency,
            optimizeFor: this.options.optimizeFor,
            enablePredictiveScheduling: true,
            resourceLimits: {
                // Set reasonable defaults based on system
                availableCpu: navigator?.hardwareConcurrency || 4,
                availableMemory: this.options.memory.budgetMB
            },
            ...this.options.scheduler
        };
        this.scheduler = new FlowScheduler(schedulerOptions, this.tracker);
        // Initialize orchestrator with integrated components
        this.orchestrator = new FlowOrchestrator({
            optimizeFor: this.options.optimizeFor,
            enableMemoryIntegration: this.options.enableMemoryIntegration,
            memoryConnector: this.memoryConnector,
            execution: {
                maxConcurrency: this.options.execution.maxConcurrency,
                timeout: this.options.execution.timeout,
                retryCount: this.options.execution.retryCount,
                checkpointInterval: this.options.execution.checkpointInterval
            }
        });
        // Wire up event handlers for coordinated execution
        this.setupEventHandlers();
    }
    /**
     * Set up internal event handlers with optimized event flow
     */
    setupEventHandlers() {
        // Forward important events from inner components
        this.orchestrator.events.on('flow_started', (event) => {
            this.scheduler.markFlowCompleted(event.id, true);
            this.emit('flow_started', event);
        });
        this.orchestrator.events.on('flow_completed', (event) => {
            this.scheduler.markFlowCompleted(event.id, event.success, event.result);
            // Cache result for future reference
            if (event.success && event.result !== undefined) {
                this.resultCache.set(event.id, event.result);
            }
            this.emit('flow_completed', event);
            // Track peak memory usage
            this.updateMemoryUsage();
        });
        this.orchestrator.events.on('flow_error', (event) => {
            this.tracker.recordFlowError(event.id, event.error);
            this.emit('flow_error', event);
        });
        // Process scheduler events
        this.scheduler.on('flow_started', (event) => {
            this.emit('scheduler_flow_started', event);
        });
        this.scheduler.on('scheduler_stats', (stats) => {
            this.emit('scheduler_stats', stats);
        });
        // Process tracker events
        this.tracker.on('flow_registered', (event) => {
            this.emit('tracker_flow_registered', event);
        });
    }
    /**
     * Track memory usage for performance monitoring
     */
    updateMemoryUsage() {
        try {
            const memoryUsage = process.memoryUsage().heapUsed / (1024 * 1024); // MB
            this.peakMemoryUsage = Math.max(this.peakMemoryUsage, memoryUsage);
        }
        catch (e) {
            // Memory tracking not supported
        }
    }
    /**
     * Register a flow with the orchestration system
     */
    registerFlow(definition) {
        // Generate ID if not provided
        const id = definition.id || `${definition.flow.constructor.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        // Register with orchestrator
        const registeredId = this.orchestrator.registerFlow(definition.flow, {
            id,
            priority: definition.priority,
            metadata: {
                ...definition.metadata,
                name: definition.name,
                description: definition.description,
                tags: definition.tags
            }
        });
        // Store flow definition for future reference
        this.flows.set(registeredId, definition);
        // Register with scheduler
        this.scheduler.registerFlow(registeredId, definition.flow, {
            priority: definition.priority,
            resourceEstimate: definition.resourceEstimate,
            dependencies: definition.dependencies || []
        });
        // Set up dependencies if provided
        if (definition.dependencies && definition.dependencies.length > 0) {
            for (const dependencyId of definition.dependencies) {
                // Register dependency with orchestrator
                this.orchestrator.addDependency(dependencyId, registeredId, {
                    condition: definition.condition,
                    dataMapping: definition.dataMapping
                });
                // Also register with scheduler
                this.scheduler.addDependency(registeredId, dependencyId);
            }
        }
        return registeredId;
    }
    /**
     * Add a dependency between flows
     */
    addDependency(dependencyId, dependentId, options) {
        // Add dependency in orchestrator
        this.orchestrator.addDependency(dependencyId, dependentId, options);
        // Also register with scheduler
        this.scheduler.addDependency(dependentId, dependencyId);
    }
    /**
     * Execute all registered flows with optimized multi-flow orchestration
     */
    async execute(options) {
        const startTime = performance.now();
        this.executionStartTime = startTime;
        this.initialMemoryUsage = process.memoryUsage?.().heapUsed / (1024 * 1024) || 0;
        this.peakMemoryUsage = this.initialMemoryUsage;
        // Initialize tracking components
        this.tracker.initialize();
        this.resultCache.clear();
        // Use scheduler for optimized execution order
        this.scheduler.start();
        // Execute flows through orchestrator
        const results = await this.orchestrator.execute({
            inputData: options?.inputData,
            strategy: this.options.execution.strategy
        });
        // Stop scheduler
        this.scheduler.stop();
        // Finalize tracking
        this.tracker.finalize();
        this.executionEndTime = performance.now();
        // Get metrics
        const trackerMetrics = this.tracker.getMetrics();
        // Generate visualization if requested
        let visualizationPath;
        if (options?.generateVisualization) {
            visualizationPath = await this.visualizeFlows();
        }
        // Compute critical path
        this.calculateCriticalPath();
        // Clean up memory if aggressive cleanup is enabled
        if (this.options.memory.aggressiveCleanup) {
            this.cleanupMemory();
        }
        // Extract errors
        const errors = new Map();
        for (const [flowId, data] of this.tracker.getFlows?.() || []) {
            if (data.errors && data.errors.length > 0) {
                errors.set(flowId, data.errors[0]);
            }
        }
        // Build comprehensive result
        return {
            results,
            metrics: {
                totalExecutionTime: this.executionEndTime - this.executionStartTime,
                flowsExecuted: trackerMetrics.flowCount,
                flowsSucceeded: trackerMetrics.completedFlows,
                flowsFailed: trackerMetrics.failedFlows,
                averageFlowExecutionTime: trackerMetrics.averageFlowExecutionTime,
                peakMemoryUsageMB: this.peakMemoryUsage - this.initialMemoryUsage,
                criticalPathTime: this.criticalPathTime
            },
            errors: errors.size > 0 ? errors : undefined,
            visualizationPath
        };
    }
    /**
     * Calculate the critical execution path
     */
    calculateCriticalPath() {
        // Get flow graph from orchestrator
        const graph = this.orchestrator.getFlowGraph();
        const executionTimes = this.tracker.getMetrics().flowExecutionTimes;
        // Initialize time maps
        const earliestStart = new Map();
        const earliestFinish = new Map();
        const latestStart = new Map();
        const latestFinish = new Map();
        const slack = new Map();
        // Initial pass: calculate earliest times (forward)
        const calculateEarliestTimes = () => {
            // Find source nodes (no incoming edges)
            const sourceNodes = graph.nodes.filter(node => !graph.edges.some(edge => edge.to === node.id));
            // Initialize source nodes
            for (const node of sourceNodes) {
                earliestStart.set(node.id, 0);
                earliestFinish.set(node.id, executionTimes[node.id] || 0);
            }
            // Process remaining nodes in topological order
            const visited = new Set(sourceNodes.map(n => n.id));
            let allVisited = false;
            while (!allVisited) {
                allVisited = true;
                for (const node of graph.nodes) {
                    if (visited.has(node.id))
                        continue;
                    // Check if all dependencies are processed
                    const dependencies = graph.edges
                        .filter(edge => edge.to === node.id)
                        .map(edge => edge.from);
                    if (dependencies.every(dep => visited.has(dep))) {
                        // Calculate earliest start time
                        const maxDependencyFinish = Math.max(0, ...dependencies.map(dep => earliestFinish.get(dep) || 0));
                        earliestStart.set(node.id, maxDependencyFinish);
                        earliestFinish.set(node.id, maxDependencyFinish + (executionTimes[node.id] || 0));
                        visited.add(node.id);
                    }
                    else {
                        allVisited = false;
                    }
                }
            }
        };
        // Second pass: calculate latest times (backward)
        const calculateLatestTimes = () => {
            // Find sink nodes (no outgoing edges)
            const sinkNodes = graph.nodes.filter(node => !graph.edges.some(edge => edge.from === node.id));
            // Maximum earliest finish
            const maxFinish = Math.max(0, ...Array.from(earliestFinish.values()));
            // Initialize sink nodes
            for (const node of sinkNodes) {
                latestFinish.set(node.id, maxFinish);
                latestStart.set(node.id, maxFinish - (executionTimes[node.id] || 0));
            }
            // Process remaining nodes in reverse topological order
            const visited = new Set(sinkNodes.map(n => n.id));
            let allVisited = false;
            while (!allVisited) {
                allVisited = true;
                for (const node of graph.nodes) {
                    if (visited.has(node.id))
                        continue;
                    // Check if all dependents are processed
                    const dependents = graph.edges
                        .filter(edge => edge.from === node.id)
                        .map(edge => edge.to);
                    if (dependents.every(dep => visited.has(dep))) {
                        // Calculate latest finish time
                        const minDependentStart = Math.min(maxFinish, ...dependents.map(dep => latestStart.get(dep) || maxFinish));
                        latestFinish.set(node.id, minDependentStart);
                        latestStart.set(node.id, minDependentStart - (executionTimes[node.id] || 0));
                        visited.add(node.id);
                    }
                    else {
                        allVisited = false;
                    }
                }
            }
        };
        // Calculate slack and find critical path
        const findCriticalPath = () => {
            // Calculate slack for each node
            for (const node of graph.nodes) {
                const nodeSlack = (latestStart.get(node.id) || 0) -
                    (earliestStart.get(node.id) || 0);
                slack.set(node.id, nodeSlack);
            }
            // Flows with zero slack are on the critical path
            const criticalFlows = graph.nodes
                .filter(node => (slack.get(node.id) || Infinity) <= 0.001) // Account for floating point imprecision
                .map(node => node.id);
            this.criticalPathFlows = criticalFlows;
            // Calculate critical path time
            const maxFinishTime = Math.max(0, ...Array.from(earliestFinish.values()));
            this.criticalPathTime = maxFinishTime;
        };
        // Execute algorithm
        calculateEarliestTimes();
        calculateLatestTimes();
        findCriticalPath();
    }
    /**
     * Generate visualization of flow dependencies and execution
     */
    async visualizeFlows() {
        // Create visualizer if not exists
        if (!this.visualizer) {
            this.visualizer = new FlowDependencyVisualizer(this.orchestrator, this.options.visualization);
        }
        // Generate visualization
        return await this.visualizer.visualize();
    }
    /**
     * Clean up memory for completed flows
     */
    cleanupMemory() {
        if (!this.options.memory.aggressiveCleanup)
            return;
        // Get completed flows
        const metrics = this.tracker.getMetrics();
        const completedFlows = Object.keys(metrics.flowExecutionTimes);
        for (const flowId of completedFlows) {
            const flow = this.orchestrator.getFlow(flowId);
            if (flow) {
                // Clear the state but keep the return value
                if (flow.state && typeof flow.state === 'object') {
                    // Keep minimal information and clear the rest
                    const returnValue = flow.getReturnValue();
                    // Simplify state object to reduce memory
                    for (const key in flow.state) {
                        if (Object.prototype.hasOwnProperty.call(flow.state, key)) {
                            // @ts-ignore - Dynamically clearing properties
                            flow.state[key] = null;
                        }
                    }
                    // Preserve return value
                    flow.setReturnValue(returnValue);
                }
            }
        }
        // Force garbage collection if supported
        if (global.gc) {
            try {
                global.gc();
            }
            catch (e) {
                // Garbage collection not accessible
            }
        }
    }
    /**
     * Get detailed execution metrics
     */
    getMetrics() {
        if (!this.executionEndTime) {
            return { message: 'No execution has completed yet' };
        }
        const trackerMetrics = this.tracker.getMetrics();
        return {
            execution: {
                totalTime: this.executionEndTime - this.executionStartTime,
                flowsExecuted: trackerMetrics.flowCount,
                flowsSucceeded: trackerMetrics.completedFlows,
                flowsFailed: trackerMetrics.failedFlows,
                flowsPending: trackerMetrics.pendingFlows,
                averageFlowTime: trackerMetrics.averageFlowExecutionTime,
                medianFlowTime: trackerMetrics.medianFlowExecutionTime,
                maxFlowTime: trackerMetrics.maxFlowExecutionTime,
                criticalPathTime: this.criticalPathTime,
                criticalPathFlows: this.criticalPathFlows
            },
            memory: {
                initialUsageMB: this.initialMemoryUsage,
                peakUsageMB: this.peakMemoryUsage,
                deltaMB: this.peakMemoryUsage - this.initialMemoryUsage
            },
            bottlenecks: trackerMetrics.bottlenecks,
            flowExecutionTimes: trackerMetrics.flowExecutionTimes,
            timeSeriesData: trackerMetrics.timeSeriesData
        };
    }
    /**
     * Reset the orchestrator to initial state
     */
    reset() {
        this.flows.clear();
        this.resultCache.clear();
        this.orchestrator.reset();
        this.scheduler.reset();
        this.tracker.reset();
        this.initialMemoryUsage = 0;
        this.peakMemoryUsage = 0;
        this.executionStartTime = 0;
        this.executionEndTime = undefined;
        this.criticalPathTime = 0;
        this.criticalPathFlows = [];
        this.emit('orchestrator_reset');
    }
    /**
     * Get a registered flow definition
     */
    getFlowDefinition(flowId) {
        return this.flows.get(flowId);
    }
    /**
     * Get a flow by ID
     */
    getFlow(flowId) {
        return this.orchestrator.getFlow(flowId);
    }
    /**
     * Get all registered flows
     */
    getFlows() {
        return new Map(this.flows);
    }
    /**
     * Get the flow dependency graph
     */
    getFlowGraph() {
        return this.orchestrator.getFlowGraph();
    }
    /**
     * Get scheduler statistics
     */
    getSchedulerStats() {
        return this.scheduler.getStats();
    }
}
//# sourceMappingURL=MultiFlowOrchestrator.js.map