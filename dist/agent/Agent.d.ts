/**
 * Agent implementation
 * Optimized for efficient execution and memory management
 */
import { BaseAgent, AgentConfig, TaskExecutionResult } from './BaseAgent.js';
import { Task } from '../task/Task.js';
import { BaseTool } from '../tools/BaseTool.js';
/**
 * Core Agent class that implements the BaseAgent interface
 * Optimized with:
 * - Lazy initialization of heavy components
 * - Memoization of expensive operations
 * - Token usage tracking and optimization
 * - Efficient memory management
 */
export declare class Agent implements BaseAgent {
    readonly id: string;
    readonly role: string;
    readonly goal: string;
    readonly backstory?: string;
    private readonly llm?;
    private readonly functionCallingLlm?;
    private readonly verbose;
    private readonly allowDelegation;
    private readonly maxExecutionTime?;
    private readonly maxIterations;
    private readonly maxRpm?;
    private readonly memory;
    private readonly useSystemPrompt;
    private readonly systemPrompt?;
    private readonly tools;
    private agentExecutor?;
    private timesExecuted;
    private tokenUsage;
    constructor(config: AgentConfig);
    /**
     * Execute a task with this agent
     * Optimized with token tracking and efficient resource usage
     */
    executeTask(task: Task, context?: string, tools?: BaseTool[]): Promise<TaskExecutionResult>;
    /**
     * Get tools for delegating tasks to other agents
     * Creates optimized tool representations of other agents
     */
    getDelegationTools(agents: BaseAgent[]): BaseTool[];
    /**
     * Set knowledge for the agent
     * Optimized for efficient knowledge embedding and retrieval
     */
    setKnowledge(knowledge: unknown): Promise<void>;
    /**
     * Create an agent executor for the agent
     * This is lazily initialized when needed
     */
    private createAgentExecutor;
    toString(): string;
}
//# sourceMappingURL=Agent.d.ts.map