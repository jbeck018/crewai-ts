/**
 * Base Agent Interface
 * Defines the core functionality required for all agent implementations
 */
import { BaseLLM } from '../llm/BaseLLM.js';
import { Task } from '../task/Task.js';
import { BaseTool } from '../tools/BaseTool.js';
export interface AgentConfig {
    role: string;
    goal: string;
    backstory?: string;
    llm?: BaseLLM | string;
    functionCallingLlm?: BaseLLM | string;
    verbose?: boolean;
    allowDelegation?: boolean;
    maxExecutionTime?: number;
    maxIterations?: number;
    maxRpm?: number;
    memory?: boolean;
    useSystemPrompt?: boolean;
    systemPrompt?: string;
    tools?: BaseTool[];
}
export interface TaskExecutionResult {
    output: string;
    metadata?: {
        totalTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
        executionTime?: number;
        iterations?: number;
    };
}
/**
 * Base interface that all agents must implement
 */
export interface BaseAgent {
    readonly id: string;
    readonly role: string;
    readonly goal: string;
    readonly backstory?: string;
    /**
     * Execute a task with the agent
     * @param task Task to execute
     * @param context Additional context for the task
     * @param tools Optional tools for the task
     */
    executeTask(task: Task, context?: string, tools?: BaseTool[]): Promise<TaskExecutionResult>;
    /**
     * Get tools for delegating tasks to other agents
     * @param agents Agents that can be delegated to
     */
    getDelegationTools(agents: BaseAgent[]): BaseTool[];
    /**
     * Set knowledge for the agent
     * @param knowledge Knowledge sources or embeddings
     */
    setKnowledge(knowledge: unknown): Promise<void>;
}
//# sourceMappingURL=BaseAgent.d.ts.map