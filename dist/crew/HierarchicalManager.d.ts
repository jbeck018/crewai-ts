/**
 * HierarchicalManager
 *
 * Provides optimized implementation for the hierarchical process execution in CrewAI.
 * This manager handles task delegation, parallel execution, and synthesis to maximize
 * performance and resource utilization.
 */
import { BaseAgent } from '../agent/BaseAgent.js';
import { Task, TaskOutput } from '../task/Task.js';
/**
 * Interface for execution plan created by the manager agent
 */
export interface ExecutionPlan {
    taskOrder: (string | number)[];
    parallelGroups: Record<number, string[]>;
    significantTasks?: string[];
    synthesisRequired?: boolean;
}
/**
 * HierarchicalManager handles the intelligent orchestration of tasks
 * using a manager agent for optimal execution planning and resource allocation.
 */
export declare class HierarchicalManager {
    /**
     * Create a manager agent for hierarchical process execution
     */
    static createManagerAgent(config: {
        managerAgent?: BaseAgent;
        managerLlm?: any;
        verbose?: boolean;
        memory?: boolean;
    }): Promise<BaseAgent>;
    /**
     * Create an execution plan using the manager agent.
     * Optimized for minimal token usage and efficient planning.
     */
    static createExecutionPlan(manager: BaseAgent, tasks: Task[], context: string): Promise<ExecutionPlan>;
    /**
     * Efficiently manages execution of tasks according to the execution plan.
     * Optimized for parallel execution and memory usage.
     */
    static executeTasksWithPlan(plan: ExecutionPlan, tasks: Task[], context: string, options: {
        executeTask: (task: Task, context: string) => Promise<TaskOutput>;
        verbose?: boolean;
    }): Promise<{
        finalOutput: string;
        completedTaskIds: Set<string>;
        context: string;
    }>;
}
//# sourceMappingURL=HierarchicalManager.d.ts.map