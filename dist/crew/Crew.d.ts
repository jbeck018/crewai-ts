/**
 * Crew implementation
 * Orchestrates agents and tasks with optimized workflow execution
 */
import { BaseAgent } from '../agent/BaseAgent.js';
import { Task, TaskOutput } from '../task/Task.js';
import { BaseLLM } from '../llm/BaseLLM.js';
import { CrewOutput } from './CrewOutput.js';
import { MemoryManager, MemoryConfig, MemoryType } from '../memory/MemoryManager.js';
export type ProcessType = 'sequential' | 'hierarchical' | 'custom';
export interface CrewConfig {
    agents: BaseAgent[];
    tasks: Task[];
    process?: ProcessType;
    verbose?: boolean;
    managerLlm?: BaseLLM | string;
    managerAgent?: BaseAgent;
    memory?: boolean;
    memoryConfig?: Record<MemoryType, Partial<MemoryConfig>>;
    maxConcurrency?: number;
    functionCallingLlm?: BaseLLM | string;
    cache?: boolean;
    maxRpm?: number;
    taskCallback?: (task: Task, output: TaskOutput) => void;
    stepCallback?: (step: any) => void;
    tools?: Record<string, boolean>;
}
/**
 * Crew class that orchestrates agents and tasks
 * Optimized for:
 * - Efficient workflow execution
 * - Resource management
 * - Error resilience
 * - Performance monitoring
 */
export declare class Crew {
    readonly id: string;
    readonly agents: BaseAgent[];
    readonly tasks: Task[];
    readonly process: ProcessType;
    readonly verbose: boolean;
    readonly managerLlm?: BaseLLM | string;
    readonly managerAgent?: BaseAgent;
    readonly memory: boolean;
    readonly memoryManager: MemoryManager;
    readonly maxConcurrency: number;
    readonly functionCallingLlm?: BaseLLM | string;
    readonly cache: boolean;
    readonly maxRpm?: number;
    readonly tools: Record<string, boolean>;
    private readonly taskCallback?;
    private readonly stepCallback?;
    private taskOutputs;
    private currentlyRunningTasks;
    private taskQueue;
    private metrics;
    constructor(config: CrewConfig);
    /**
     * Execute the crew's workflow
     * Optimized with task prioritization and parallel execution
     */
    /**
     * Reset specific memory types or all memories
     * @param type Memory type to reset (short, long, entity, contextual, or all)
     * @returns Result of the reset operation
     */
    resetMemory(type?: MemoryType): Promise<{
        success: boolean;
        errors?: Record<string, string>;
    }>;
    /**
     * Execute the crew's workflow
     * Optimized with task prioritization and parallel execution
     */
    kickoff(inputs?: Record<string, any>): Promise<CrewOutput>;
    /**
     * Run crew for each input in a list and aggregate results
     * Optimized with batch processing and resource sharing
     */
    kickoffForEach(inputs: Record<string, any>[]): Promise<CrewOutput[]>;
    /**
     * Create a copy of the crew for isolated execution
     */
    private createCopy;
    /**
     * Initialize the task queue based on the process type
     * Optimized with priority-based sorting for maximum efficiency
     */
    private initializeTaskQueue;
    /**
     * Run the sequential process
     * Optimized with context passing and parallel execution where possible
     */
    private runSequentialProcess;
    /**
     * Run the hierarchical process with a manager agent
     * Optimized with intelligent task delegation, resource allocation,
     * and parallel execution where beneficial
     */
    private runHierarchicalProcess;
    /**
     * Execute a single task
     * Optimized with caching and error handling
     */
    private executeTask;
    /**
     * Validate the crew configuration
     */
    private validateConfig;
    /**
     * Validate that async tasks are configured correctly
     */
    private validateAsyncTasks;
    toString(): string;
}
//# sourceMappingURL=Crew.d.ts.map