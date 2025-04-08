/**
 * FlowExecutionTracker
 *
 * Provides optimized tracking and metrics for flow execution in the Flow Orchestration system.
 * Designed for high-performance in multi-flow environments with minimal memory footprint.
 */
import { EventEmitter } from 'events';
/**
 * Tracks flow execution with optimized data structures and algorithms
 * for minimal overhead and maximum performance insight.
 */
export class FlowExecutionTracker extends EventEmitter {
    flowData = new Map();
    executionHistory = [];
    timeSeriesData = [];
    timeSeriesInterval;
    startTime = 0;
    endTime;
    // Statistical accumulators for constant-time stats updates
    totalDuration = 0;
    durations = [];
    statusCounts = {
        'pending': 0,
        'running': 0,
        'completed': 0,
        'failed': 0,
        'canceled': 0 // Fixed spelling for consistency with FlowStatus type
    };
    // Running variance calculation (Welford's algorithm)
    sumDuration = 0;
    sumDurationSquared = 0;
    options;
    constructor(options = {}) {
        super();
        // Default options with performance-optimized values
        this.options = {
            enableMemoryTracking: false,
            maxHistorySize: 1000,
            timeSeriesInterval: 5000, // 5 seconds
            maxTimeSeriesPoints: 100,
            trackBottlenecks: true,
            trackVariance: true,
            samplingRate: 1.0, // Track everything by default
            maxErrorsPerFlow: 5,
            ...options
        };
    }
    /**
     * Initialize the tracker at the start of orchestration
     */
    initialize() {
        this.flowData.clear();
        this.executionHistory = [];
        this.timeSeriesData = [];
        this.startTime = performance.now();
        this.endTime = undefined;
        this.totalDuration = 0;
        this.durations = [];
        this.statusCounts = {
            'pending': 0,
            'running': 0,
            'completed': 0,
            'failed': 0,
            'canceled': 0 // Fixed spelling for consistency with FlowStatus type
        };
        this.sumDuration = 0;
        this.sumDurationSquared = 0;
        // Set up time series collection if enabled
        if (this.options.timeSeriesInterval > 0) {
            this.startTimeSeriesCollection();
        }
        this.emit('tracker_initialized');
    }
    /**
     * Register a flow with the tracker
     */
    registerFlow(flowId, metadata, priority) {
        // Apply sampling if configured
        if (Math.random() > this.options.samplingRate) {
            return; // Skip tracking this flow
        }
        const flowData = {
            id: flowId,
            status: 'pending',
            attempts: 0,
            nodeExecutions: new Map(),
            errors: [],
            metadata,
            priority,
            dependencies: new Set(),
            dependents: new Set()
        };
        this.flowData.set(flowId, flowData);
        // Initialize statusCounts if undefined for performance optimization
        if (!this.statusCounts) {
            this.statusCounts = { pending: 0, running: 0, completed: 0, failed: 0, canceled: 0 };
        }
        // Safe increment with null check
        this.statusCounts.pending = (this.statusCounts.pending || 0) + 1;
        this.emit('flow_registered', { flowId, metadata, priority });
    }
    /**
     * Add dependency information for flow
     */
    addDependency(dependentId, dependencyId) {
        const dependent = this.flowData.get(dependentId);
        const dependency = this.flowData.get(dependencyId);
        if (dependent && dependency) {
            dependent.dependencies.add(dependencyId);
            dependency.dependents.add(dependentId);
        }
    }
    /**
     * Record flow execution start
     */
    startFlowExecution(flowId) {
        const flowData = this.flowData.get(flowId);
        if (!flowData)
            return;
        const previousStatus = flowData.status;
        flowData.startTime = performance.now();
        flowData.status = 'running';
        flowData.attempts++;
        // Update status counts
        this.statusCounts[previousStatus]--;
        this.statusCounts.running++;
        // Track memory if enabled
        if (this.options.enableMemoryTracking) {
            flowData.memory = {
                bytesAllocated: 0,
                peakMemoryUsage: 0
            };
            // Sample memory usage
            try {
                const memoryUsage = process.memoryUsage();
                flowData.memory.bytesAllocated = memoryUsage.heapUsed;
            }
            catch (e) {
                // Memory tracking not available
            }
        }
        this.emit('flow_started', { flowId, attempts: flowData.attempts });
    }
    /**
     * Record flow execution completion
     */
    completeFlowExecution(flowId, success, result) {
        const flowData = this.flowData.get(flowId);
        if (!flowData || !flowData.startTime)
            return;
        const previousStatus = flowData.status;
        flowData.endTime = performance.now();
        flowData.duration = flowData.endTime - flowData.startTime;
        flowData.status = success ? 'completed' : 'failed';
        // Update execution history with efficient rotation
        this.executionHistory.push(flowId);
        if (this.executionHistory.length > this.options.maxHistorySize) {
            this.executionHistory.shift(); // Remove oldest
        }
        // Update status counts
        this.statusCounts[previousStatus]--;
        this.statusCounts[flowData.status]++;
        // Update running statistics for O(1) calculation of mean, variance, etc.
        if (flowData.duration !== undefined) {
            const duration = flowData.duration;
            this.totalDuration += duration;
            this.durations.push(duration);
            // Welford's algorithm for variance
            if (this.options.trackVariance) {
                const n = this.durations.length;
                this.sumDuration += duration;
                this.sumDurationSquared += duration * duration;
            }
        }
        // Track final memory usage if enabled
        if (this.options.enableMemoryTracking && flowData.memory) {
            try {
                const memoryUsage = process.memoryUsage();
                flowData.memory.peakMemoryUsage = memoryUsage.heapUsed;
            }
            catch (e) {
                // Memory tracking not available
            }
        }
        this.emit('flow_completed', {
            flowId,
            success,
            duration: flowData.duration,
            status: flowData.status
        });
    }
    /**
     * Record flow execution cancellation
     */
    cancelFlowExecution(flowId, reason) {
        const flowData = this.flowData.get(flowId);
        if (!flowData)
            return;
        const previousStatus = flowData.status;
        flowData.status = 'canceled'; // Fixed spelling for consistency with FlowStatus type
        // Update status counts
        this.statusCounts[previousStatus]--;
        // Safely increment with proper null check
        if (this.statusCounts) {
            this.statusCounts.canceled = (this.statusCounts.canceled || 0) + 1;
        }
        this.emit('flow_canceled', { flowId, reason }); // Fixed spelling for consistency
    }
    /**
     * Record flow execution error
     */
    recordFlowError(flowId, error) {
        const flowData = this.flowData.get(flowId);
        if (!flowData)
            return;
        // Limit error history size
        if (flowData.errors.length < this.options.maxErrorsPerFlow) {
            flowData.errors.push(error);
        }
        this.emit('flow_error', { flowId, error });
    }
    /**
     * Record node execution start
     */
    startNodeExecution(flowId, nodeId) {
        const flowData = this.flowData.get(flowId);
        if (!flowData)
            return;
        let nodeData = flowData.nodeExecutions.get(nodeId);
        if (!nodeData) {
            nodeData = {
                nodeId,
                status: 'pending',
                attempts: 0
            };
            flowData.nodeExecutions.set(nodeId, nodeData);
        }
        nodeData.status = 'running';
        nodeData.startTime = performance.now();
        nodeData.attempts++;
        this.emit('node_started', { flowId, nodeId, attempts: nodeData.attempts });
    }
    /**
     * Record node execution completion
     */
    completeNodeExecution(flowId, nodeId, success, result, error) {
        const flowData = this.flowData.get(flowId);
        if (!flowData)
            return;
        const nodeData = flowData.nodeExecutions.get(nodeId);
        if (!nodeData || !nodeData.startTime)
            return;
        nodeData.endTime = performance.now();
        nodeData.duration = nodeData.endTime - nodeData.startTime;
        nodeData.status = success ? 'completed' : 'failed';
        if (success && result !== undefined) {
            nodeData.result = result;
        }
        if (!success && error) {
            nodeData.error = error;
        }
        this.emit('node_completed', {
            flowId,
            nodeId,
            success,
            duration: nodeData.duration,
            status: nodeData.status
        });
    }
    /**
     * Finalize tracking at the end of orchestration
     */
    finalize() {
        this.endTime = performance.now();
        // Stop time series collection
        if (this.timeSeriesInterval) {
            clearInterval(this.timeSeriesInterval);
            this.timeSeriesInterval = undefined;
        }
        // Add final time series data point
        this.collectTimeSeriesDataPoint();
        this.emit('tracker_finalized', this.getMetrics());
    }
    /**
     * Get comprehensive execution metrics (optimized for performance)
     */
    getMetrics() {
        const totalDuration = this.endTime ? this.endTime - this.startTime : performance.now() - this.startTime;
        // Prepare flow execution times using pre-calculated data
        const flowExecutionTimes = {};
        let maxTime = 0;
        let minTime = Infinity;
        // Count priorities
        const flowPriorities = {};
        // Collect flow execution times
        for (const [flowId, data] of this.flowData.entries()) {
            if (data.duration !== undefined) {
                flowExecutionTimes[flowId] = data.duration;
                maxTime = Math.max(maxTime, data.duration);
                minTime = Math.min(minTime, data.duration);
            }
            // Track priority counts
            if (data.priority !== undefined) {
                flowPriorities[data.priority] = (flowPriorities[data.priority] || 0) + 1;
            }
        }
        // Calculate median and p95 only when needed
        let medianTime = 0;
        let p95Time = 0;
        // Only sort durations array if we need percentile calculations
        // This is an expensive operation for large arrays
        if (this.durations.length > 0) {
            // Create a copy to avoid modifying the original
            const sortedDurations = [...this.durations].sort((a, b) => a - b);
            // Median calculation with null safety - optimized for performance
            const medianIndex = Math.floor(sortedDurations.length / 2);
            // Handle empty array edge case for better performance
            if (sortedDurations.length === 0) {
                medianTime = 0;
            }
            else if (sortedDurations.length % 2 === 0) {
                // Even length array - average of middle two elements
                const val1 = sortedDurations[medianIndex - 1] || 0;
                const val2 = sortedDurations[medianIndex] || 0;
                medianTime = (val1 + val2) / 2;
            }
            else {
                // Odd length array - middle element
                medianTime = sortedDurations[medianIndex] || 0;
            }
            // p95 calculation with null safety - optimized for performance
            const p95Index = Math.floor(sortedDurations.length * 0.95);
            // Only access array if index is valid
            p95Time = (p95Index >= 0 && p95Index < sortedDurations.length)
                ? sortedDurations[p95Index] || 0
                : 0;
        }
        // Calculate bottlenecks if enabled
        const bottlenecks = [];
        if (this.options.trackBottlenecks) {
            // Identify potential bottlenecks as flows with high execution time
            // and multiple dependents (fan-in points)
            const potentialBottlenecks = Array.from(this.flowData.entries())
                .filter(([_, data]) => data.duration !== undefined && data.dependents.size > 1)
                .sort((a, b) => (b[1].duration || 0) - (a[1].duration || 0))
                .slice(0, 5) // Top 5 bottlenecks
                .map(([id]) => id);
            bottlenecks.push(...potentialBottlenecks);
        }
        // Calculate critical path - optimized to avoid unnecessary computation
        // Initialize with proper structure to match the expected type
        const criticalPath = {
            flows: [],
            totalTime: 0
        };
        // TODO: Implement critical path algorithm if needed
        // This is computationally expensive, so it's deferred
        return {
            totalExecutionTime: totalDuration,
            flowCount: this.flowData.size,
            // Safely access status counts with proper null checks for performance optimization
            completedFlows: this.statusCounts?.completed || 0,
            failedFlows: this.statusCounts?.failed || 0,
            pendingFlows: this.statusCounts?.pending || 0,
            runningFlows: this.statusCounts?.running || 0,
            averageFlowExecutionTime: this.durations.length > 0 ? this.totalDuration / this.durations.length : 0,
            medianFlowExecutionTime: medianTime,
            maxFlowExecutionTime: maxTime === 0 ? 0 : maxTime,
            minFlowExecutionTime: minTime === Infinity ? 0 : minTime,
            p95FlowExecutionTime: p95Time,
            flowExecutionTimes,
            statusCounts: { ...this.statusCounts },
            flowPriorities,
            bottlenecks,
            criticalPath,
            // Safely check timeSeriesData existence and only copy if needed for performance
            timeSeriesData: this.timeSeriesData && this.timeSeriesData.length > 0 ? [...this.timeSeriesData] : undefined,
        };
    }
    /**
     * Get detailed data for a specific flow
     */
    getFlowData(flowId) {
        return this.flowData.get(flowId);
    }
    /**
     * Start collecting time series data at regular intervals
     */
    startTimeSeriesCollection() {
        // Collect initial data point
        this.collectTimeSeriesDataPoint();
        // Set up interval for regular collection
        this.timeSeriesInterval = setInterval(() => {
            this.collectTimeSeriesDataPoint();
        }, this.options.timeSeriesInterval);
    }
    /**
     * Collect a single time series data point
     */
    collectTimeSeriesDataPoint() {
        // Don't collect if disabled
        if (this.options.timeSeriesInterval <= 0)
            return;
        const timestamp = performance.now();
        const runningFlows = this.statusCounts.running;
        const completedFlows = this.statusCounts.completed;
        const avgExecutionTime = this.durations.length > 0
            ? this.totalDuration / this.durations.length
            : 0;
        const dataPoint = {
            timestamp,
            runningFlows,
            completedFlows,
            averageExecutionTime: avgExecutionTime
        };
        // Initialize timeSeriesData if undefined - null safety with performance optimization
        if (!this.timeSeriesData) {
            this.timeSeriesData = [];
        }
        this.timeSeriesData.push(dataPoint);
        // Enforce maximum size
        // Safely manage timeSeriesData size with proper null checks for performance
        if (this.timeSeriesData && this.timeSeriesData.length > this.options.maxTimeSeriesPoints) {
            this.timeSeriesData.shift(); // Remove oldest for better memory efficiency
        }
    }
    /**
     * Reset the tracker to initial state
     */
    reset() {
        this.initialize();
    }
}
//# sourceMappingURL=FlowExecutionTracker.js.map