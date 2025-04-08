/**
 * FlowAgentAdapter
 *
 * Integrates the Flow System with the Agent/Crew framework, optimized for
 * efficient execution, shared memory contexts, and minimal overhead.
 */
import { Agent } from '../agent/Agent.js';
import { MultiFlowOrchestrator } from '../flow/orchestration/MultiFlowOrchestrator.js';
import { FlowMemoryConnector } from '../flow/memory/FlowMemoryConnector.js';
import { ContextualMemory } from '../memory/contextual-memory.js';
import { Task } from '../task/Task.js';
/**
 * Adapter that enables bidirectional integration between the Flow System
 * and the Agent/Crew framework. Provides optimized mechanisms for sharing
 * context, memory, and execution between the two systems.
 */
export class FlowAgentAdapter {
    orchestrator;
    memoryConnector;
    memory;
    registeredFlows = new Map();
    flowTools = new Map();
    agentFlowMap = new Map();
    // Cache for performance optimization
    toolDescriptionCache = new Map();
    flowStateCache = new Map();
    // Performance tracking
    executionTimes = new Map();
    constructor(config = {}) {
        // Initialize memory components with optimization settings
        this.memory = config.memory || new ContextualMemory();
        this.memoryConnector = config.memoryConnector || new FlowMemoryConnector({
            memory: this.memory,
            enableCaching: true,
            compressionLevel: config.optimizationLevel === 'aggressive' ? 'high' : 'fast'
        });
        // Map optimization strategy to concrete settings
        const optimizationSettings = this.getOptimizationSettings(config.optimizationLevel || 'balanced');
        // Initialize orchestrator with optimized settings
        this.orchestrator = new MultiFlowOrchestrator({
            enableMemoryIntegration: config.enableSharedMemory !== false,
            memoryConnector: this.memoryConnector,
            ...optimizationSettings
        });
        // Register initial flows if provided
        if (config.flows && config.flows.length > 0) {
            for (const flow of config.flows) {
                this.registerFlow(flow);
            }
        }
        // Automatically register flows as tools if enabled
        if (config.autoRegisterFlowTools !== false) {
            this.registerAllFlowsAsTools(config.flowToolFormatter);
        }
    }
    /**
     * Register a flow with the adapter
     */
    registerFlow(flow, id) {
        const flowId = this.orchestrator.registerFlow({
            flow,
            id: id || flow.constructor.name
        });
        this.registeredFlows.set(flowId, flow);
        return flowId;
    }
    /**
     * Link an agent with a flow to enable context sharing
     */
    linkAgentToFlow(agent, flowId) {
        // Initialize the map entry if it doesn't exist
        if (!this.agentFlowMap.has(agent.id)) {
            this.agentFlowMap.set(agent.id, new Set());
        }
        // Add the flow to the agent's set
        this.agentFlowMap.get(agent.id).add(flowId);
        // Initialize execution time tracking
        if (!this.executionTimes.has(flowId)) {
            this.executionTimes.set(flowId, []);
        }
    }
    /**
     * Execute a flow from an agent context with optimized data passing
     */
    async executeFlow(flowId, inputs) {
        const startTime = performance.now();
        try {
            // Execute the flow through the orchestrator
            const result = await this.orchestrator.execute({
                inputData: inputs
            });
            // Cache the flow state for faster access later
            const flow = this.registeredFlows.get(flowId);
            if (flow && flow.state) {
                this.flowStateCache.set(flowId, { ...flow.state });
            }
            // Track execution time for adaptive optimization
            const endTime = performance.now();
            const duration = endTime - startTime;
            const times = this.executionTimes.get(flowId) || [];
            times.push(duration);
            // Keep only the last 10 execution times for this flow
            if (times.length > 10) {
                times.shift();
            }
            this.executionTimes.set(flowId, times);
            // Extract and return the flow's result
            return result.results.get(flowId);
        }
        catch (error) {
            console.error(`Error executing flow ${flowId}:`, error);
            throw error;
        }
    }
    /**
     * Create a task that executes a flow as part of its execution
     */
    createFlowTask(flowId, agent, description) {
        const flow = this.registeredFlows.get(flowId);
        if (!flow) {
            throw new Error(`Flow ${flowId} not found`);
        }
        return new Task({
            description,
            agent,
            // Include a tool for executing the flow
            tools: [this.createFlowTool(flowId)],
            // Optimize for performance
            cachingStrategy: 'memory',
        });
    }
    /**
     * Create a tool that allows agents to execute a flow
     */
    createFlowTool(flowId, customToolProps) {
        const flow = this.registeredFlows.get(flowId);
        if (!flow) {
            throw new Error(`Flow ${flowId} not found`);
        }
        // Check if we already have a cached tool for this flow
        if (this.flowTools.has(flowId)) {
            return this.flowTools.get(flowId);
        }
        // Generate an optimized tool description if not in cache
        let description = this.toolDescriptionCache.get(flowId);
        if (!description) {
            description = `Execute the ${flow.constructor.name} flow to ${this.getFlowPurpose(flow)}.`;
            this.toolDescriptionCache.set(flowId, description);
        }
        // Create the flow execution tool with performance optimizations
        const tool = {
            name: `execute_${flowId}_flow`,
            description,
            call: async (args) => {
                try {
                    const result = await this.executeFlow(flowId, args);
                    return JSON.stringify(result);
                }
                catch (error) {
                    return `Error executing flow: ${error.message}`;
                }
            },
            // Use custom tool props to override defaults if provided
            ...customToolProps
        };
        // Cache the tool for future use
        this.flowTools.set(flowId, tool);
        return tool;
    }
    /**
     * Register all flows as agent tools for easy usage
     */
    registerAllFlowsAsTools(formatter) {
        const tools = [];
        for (const [flowId, flow] of this.registeredFlows.entries()) {
            const customProps = formatter ? formatter(flow) : undefined;
            const tool = this.createFlowTool(flowId, customProps);
            tools.push(tool);
        }
        return tools;
    }
    /**
     * Extract agent context for use in flows
     */
    extractAgentContext(agent) {
        // If the agent is our Agent implementation, use optimized extraction
        if (agent instanceof Agent) {
            return {
                role: agent.role,
                goal: agent.goal,
                backstory: agent.backstory,
                // Extract more if needed in a memory-efficient way
            };
        }
        // Fallback for other agent implementations
        return {
            id: agent.id,
            role: agent.role
        };
    }
    /**
     * Generate a visualization of the flows in this adapter
     */
    async visualizeFlows() {
        return this.orchestrator.visualizeFlows();
    }
    /**
     * Estimate flow execution time based on history
     */
    estimateExecutionTime(flowId) {
        const times = this.executionTimes.get(flowId);
        if (!times || times.length === 0) {
            return 1000; // Default estimate: 1 second
        }
        // Calculate average with outlier rejection for more reliable estimates
        if (times.length >= 4) {
            // Sort times and remove the highest and lowest 25%
            const sortedTimes = [...times].sort((a, b) => a - b);
            const q1Index = Math.floor(sortedTimes.length * 0.25);
            const q3Index = Math.floor(sortedTimes.length * 0.75);
            const middleTimes = sortedTimes.slice(q1Index, q3Index + 1);
            // Average of middle 50%
            const sum = middleTimes.reduce((acc, time) => acc + time, 0);
            return sum / middleTimes.length;
        }
        // Simple average for small samples
        const sum = times.reduce((acc, time) => acc + time, 0);
        return sum / times.length;
    }
    /**
     * Get flow metrics for observability
     */
    getFlowMetrics() {
        return this.orchestrator.getMetrics();
    }
    /**
     * Map optimization level to concrete settings
     */
    getOptimizationSettings(level) {
        switch (level) {
            case 'minimal':
                return {
                    optimizeFor: 'memory',
                    execution: {
                        maxConcurrency: 2,
                        checkpointInterval: 10000 // 10 seconds
                    },
                    memory: {
                        aggressiveCleanup: false,
                        compressionLevel: 'none'
                    }
                };
            case 'aggressive':
                return {
                    optimizeFor: 'speed',
                    execution: {
                        maxConcurrency: navigator?.hardwareConcurrency || 8,
                        checkpointInterval: 2000, // 2 seconds
                        optimisticExecution: true
                    },
                    memory: {
                        aggressiveCleanup: true,
                        enableStateSharing: true,
                        compressionLevel: 'high'
                    },
                    scheduler: {
                        enablePredictiveScheduling: true,
                        enableWorkStealing: true
                    }
                };
            case 'balanced':
            default:
                return {
                    optimizeFor: 'balanced',
                    execution: {
                        maxConcurrency: 4,
                        checkpointInterval: 5000 // 5 seconds
                    },
                    memory: {
                        aggressiveCleanup: true,
                        compressionLevel: 'fast'
                    }
                };
        }
    }
    /**
     * Try to extract a flow's purpose from its name or state
     */
    getFlowPurpose(flow) {
        // Extract purpose from flow name
        const name = flow.constructor.name;
        // Convert camelCase or PascalCase to words
        if (name.endsWith('Flow')) {
            const baseName = name.substring(0, name.length - 4);
            return baseName
                .replace(/([A-Z])/g, ' $1') // Insert spaces before capital letters
                .trim()
                .toLowerCase();
        }
        return 'perform an operation';
    }
    /**
     * Get the orchestrator for direct access
     */
    getOrchestrator() {
        return this.orchestrator;
    }
    /**
     * Get the memory connector for direct access
     */
    getMemoryConnector() {
        return this.memoryConnector;
    }
}
//# sourceMappingURL=FlowAgentAdapter.js.map