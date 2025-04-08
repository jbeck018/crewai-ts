/**
 * FlowAgentAdapter
 *
 * Integrates the Flow System with the Agent/Crew framework, optimized for
 * efficient execution, shared memory contexts, and minimal overhead.
 */
import { BaseAgent } from '../agent/BaseAgent.js';
import { BaseTool } from '../tools/BaseTool.js';
import { Flow } from '../flow/index.js';
import { MultiFlowOrchestrator } from '../flow/orchestration/MultiFlowOrchestrator.js';
import { FlowMemoryConnector } from '../flow/memory/FlowMemoryConnector.js';
import { ContextualMemory } from '../memory/contextual-memory.js';
import { Task } from '../task/Task.js';
/**
 * Configuration for the FlowAgentAdapter
 */
export interface FlowAgentAdapterConfig {
    /** Enable shared memory between flows and agents */
    enableSharedMemory?: boolean;
    /** Pre-initialize the adapter with these flows */
    flows?: Flow<any>[];
    /** Memory connector to use (will create one if not provided) */
    memoryConnector?: FlowMemoryConnector;
    /** Memory instance to use (will create one if not provided) */
    memory?: ContextualMemory;
    /** Enable flow visualizations */
    enableVisualizations?: boolean;
    /** Optimization level for flow execution */
    optimizationLevel?: 'minimal' | 'balanced' | 'aggressive';
    /** Automatically convert flows to agent tools */
    autoRegisterFlowTools?: boolean;
    /** Custom tool formatting function */
    flowToolFormatter?: (flow: Flow<any>) => Partial<BaseTool>;
}
/**
 * Adapter that enables bidirectional integration between the Flow System
 * and the Agent/Crew framework. Provides optimized mechanisms for sharing
 * context, memory, and execution between the two systems.
 */
export declare class FlowAgentAdapter {
    private orchestrator;
    private memoryConnector;
    private memory;
    private registeredFlows;
    private flowTools;
    private agentFlowMap;
    private toolDescriptionCache;
    private flowStateCache;
    private executionTimes;
    constructor(config?: FlowAgentAdapterConfig);
    /**
     * Register a flow with the adapter
     */
    registerFlow(flow: Flow<any>, id?: string): string;
    /**
     * Link an agent with a flow to enable context sharing
     */
    linkAgentToFlow(agent: BaseAgent, flowId: string): void;
    /**
     * Execute a flow from an agent context with optimized data passing
     */
    executeFlow(flowId: string, inputs?: Record<string, any>): Promise<any>;
    /**
     * Create a task that executes a flow as part of its execution
     */
    createFlowTask(flowId: string, agent: BaseAgent, description: string): Task;
    /**
     * Create a tool that allows agents to execute a flow
     */
    createFlowTool(flowId: string, customToolProps?: Partial<BaseTool>): BaseTool;
    /**
     * Register all flows as agent tools for easy usage
     */
    registerAllFlowsAsTools(formatter?: (flow: Flow<any>) => Partial<BaseTool>): BaseTool[];
    /**
     * Extract agent context for use in flows
     */
    extractAgentContext(agent: BaseAgent): Record<string, any>;
    /**
     * Generate a visualization of the flows in this adapter
     */
    visualizeFlows(): Promise<string>;
    /**
     * Estimate flow execution time based on history
     */
    estimateExecutionTime(flowId: string): number;
    /**
     * Get flow metrics for observability
     */
    getFlowMetrics(): Record<string, any>;
    /**
     * Map optimization level to concrete settings
     */
    private getOptimizationSettings;
    /**
     * Try to extract a flow's purpose from its name or state
     */
    private getFlowPurpose;
    /**
     * Get the orchestrator for direct access
     */
    getOrchestrator(): MultiFlowOrchestrator;
    /**
     * Get the memory connector for direct access
     */
    getMemoryConnector(): FlowMemoryConnector;
}
//# sourceMappingURL=FlowAgentAdapter.d.ts.map