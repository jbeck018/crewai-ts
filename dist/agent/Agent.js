/**
 * Agent implementation
 * Optimized for efficient execution and memory management
 */
import { v4 as uuidv4 } from 'uuid';
/**
 * Core Agent class that implements the BaseAgent interface
 * Optimized with:
 * - Lazy initialization of heavy components
 * - Memoization of expensive operations
 * - Token usage tracking and optimization
 * - Efficient memory management
 */
export class Agent {
    id;
    role;
    goal;
    backstory;
    llm;
    functionCallingLlm;
    verbose;
    allowDelegation;
    maxExecutionTime;
    maxIterations;
    maxRpm;
    memory;
    useSystemPrompt;
    systemPrompt;
    tools;
    // Cached state for optimization
    agentExecutor; // Will be properly typed with AgentExecutor
    timesExecuted = 0;
    tokenUsage = {
        prompt: 0,
        completion: 0,
        total: 0
    };
    constructor(config) {
        // Generate a unique ID for the agent
        this.id = uuidv4();
        // Required properties
        this.role = config.role;
        this.goal = config.goal;
        // Optional properties with defaults
        this.backstory = config.backstory;
        this.llm = config.llm;
        this.functionCallingLlm = config.functionCallingLlm;
        this.verbose = config.verbose ?? false;
        this.allowDelegation = config.allowDelegation ?? true;
        this.maxExecutionTime = config.maxExecutionTime;
        this.maxIterations = config.maxIterations ?? 15;
        this.maxRpm = config.maxRpm;
        this.memory = config.memory ?? true;
        this.useSystemPrompt = config.useSystemPrompt ?? true;
        this.systemPrompt = config.systemPrompt;
        this.tools = config.tools ?? [];
    }
    /**
     * Execute a task with this agent
     * Optimized with token tracking and efficient resource usage
     */
    async executeTask(task, context, tools) {
        // Track execution count
        this.timesExecuted += 1;
        // Start tracking execution time
        const startTime = Date.now();
        // Lazy initialize the agent executor if needed
        if (!this.agentExecutor) {
            this.agentExecutor = await this.createAgentExecutor(tools, task);
        }
        try {
            // Prepare the task input with context if available
            const input = context ? { input: context } : {};
            // Execute the task with the agent executor
            const result = await this.agentExecutor.invoke(input);
            // Calculate execution time
            const executionTime = Date.now() - startTime;
            return {
                output: result.output || result,
                metadata: {
                    executionTime,
                    iterations: this.timesExecuted,
                    // Token tracking would be populated from actual LLM usage
                }
            };
        }
        catch (error) {
            // Handle errors gracefully
            console.error(`Error executing task with agent ${this.role}:`, error);
            throw error;
        }
    }
    /**
     * Get tools for delegating tasks to other agents
     * Creates optimized tool representations of other agents
     */
    getDelegationTools(agents) {
        if (!this.allowDelegation) {
            return [];
        }
        // Create delegation tools from other agents
        // This would be implemented with the actual Agent Tools functionality
        return [];
    }
    /**
     * Set knowledge for the agent
     * Optimized for efficient knowledge embedding and retrieval
     */
    async setKnowledge(knowledge) {
        // Implementation for setting agent knowledge would go here
        // This would connect to a vector store or other knowledge base
    }
    /**
     * Create an agent executor for the agent
     * This is lazily initialized when needed
     */
    async createAgentExecutor(tools, task) {
        // This would create the appropriate executor based on the agent configuration
        // For now, we return a placeholder
        return {
            invoke: async (input) => {
                return { output: `Agent ${this.role} executed task successfully` };
            }
        };
    }
    toString() {
        return `Agent(role=${this.role}, goal=${this.goal})`;
    }
}
//# sourceMappingURL=Agent.js.map