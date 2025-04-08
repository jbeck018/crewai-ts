/**
 * Task implementation
 * Optimized for efficient execution, context management, and error handling
 */
import { v4 as uuidv4 } from 'uuid';
/**
 * Task class that represents work to be done by an agent
 * Optimized for:
 * - Efficient execution tracking
 * - Result caching
 * - Context management
 * - Error handling with retries
 */
export class Task {
    id;
    description;
    agent;
    expectedOutput;
    context;
    priority;
    isAsync;
    tools;
    kpi;
    cachingStrategy;
    maxRetries;
    timeoutMs;
    // Execution state
    output;
    executionCount = 0;
    lastExecutionTime = 0;
    cacheKey;
    constructor(config) {
        this.id = uuidv4();
        this.description = config.description;
        this.agent = config.agent;
        this.expectedOutput = config.expectedOutput;
        this.context = config.context || [];
        this.priority = config.priority || 'medium';
        this.isAsync = config.async || false;
        this.tools = config.tools || [];
        this.kpi = config.kpi;
        this.cachingStrategy = config.cachingStrategy || 'none';
        this.maxRetries = config.maxRetries || 3;
        this.timeoutMs = config.timeoutMs;
        // Optimize by pre-computing cache key if caching is enabled
        if (this.cachingStrategy !== 'none') {
            this.cacheKey = this.computeCacheKey();
        }
    }
    /**
     * Execute the task with the assigned agent
     * Optimized with caching, retries, and timeout management
     */
    async execute(context) {
        // Check cache first if caching is enabled
        if (this.cachingStrategy !== 'none' && this.checkCache()) {
            return this.output;
        }
        // Track execution metrics
        const startTime = Date.now();
        this.executionCount++;
        let retries = 0;
        let error = null;
        // Setup timeout controller if needed
        const abortController = this.timeoutMs ? new AbortController() : undefined;
        const timeoutId = this.timeoutMs
            ? setTimeout(() => abortController?.abort(new Error('Task execution timeout')), this.timeoutMs)
            : undefined;
        try {
            // Prepare context by joining existing context with new context
            const fullContext = this.prepareContext(context);
            // Execute task with retry logic
            for (let i = 0; i <= this.maxRetries; i++) {
                try {
                    // Execute the task with the agent
                    const result = await this.agent.executeTask(this, fullContext, this.tools);
                    // Process and store the result
                    this.output = {
                        result: result.output,
                        metadata: {
                            taskId: this.id,
                            agentId: this.agent.id,
                            executionTime: Date.now() - startTime,
                            tokenUsage: result.metadata?.totalTokens ? {
                                prompt: result.metadata.promptTokens || 0,
                                completion: result.metadata.completionTokens || 0,
                                total: result.metadata.totalTokens
                            } : undefined,
                            iterations: result.metadata?.iterations,
                            retries
                        }
                    };
                    // Store in cache if enabled
                    if (this.cachingStrategy !== 'none') {
                        this.updateCache();
                    }
                    return this.output;
                }
                catch (err) {
                    error = err;
                    retries++;
                    // Only retry if we haven't exceeded max retries
                    if (i < this.maxRetries) {
                        // Exponential backoff with jitter
                        const delay = Math.min(100 * Math.pow(2, i) + Math.random() * 100, 10000);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            // If we've exhausted retries, throw the last error
            throw error || new Error('Task execution failed after retries');
        }
        finally {
            // Clear timeout if it was set
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            this.lastExecutionTime = Date.now() - startTime;
        }
    }
    /**
     * Get execution status
     */
    getStatus() {
        if (this.executionCount === 0)
            return 'pending';
        return this.output ? 'completed' : 'failed';
    }
    /**
     * Prepare context by combining existing context with new context
     * Optimized to avoid redundant string operations
     */
    prepareContext(additionalContext) {
        if (!additionalContext && this.context.length === 0) {
            return '';
        }
        // Efficiently join context strings
        const contextParts = [...this.context];
        if (additionalContext) {
            contextParts.push(additionalContext);
        }
        return contextParts.join('\n\n');
    }
    /**
     * Compute a cache key for this task
     * Optimized to use minimal string operations
     */
    computeCacheKey() {
        // Create a stable representation of the task for caching
        const keyParts = [
            this.description,
            this.agent.id,
            ...this.context,
            this.tools.map(t => t.name).join(',')
        ];
        // Use a fast hashing function (in a real implementation)
        return keyParts.join('||');
    }
    /**
     * Check if a cached result exists
     */
    checkCache() {
        // This would interface with a caching system
        // For now, just check if we have a previous output
        return !!this.output;
    }
    /**
     * Update the cache with the latest result
     */
    updateCache() {
        // This would interface with a caching system to store the result
        // using this.cacheKey and this.output
    }
    toString() {
        return `Task(id=${this.id}, description=${this.description}, agent=${this.agent.role})`;
    }
}
//# sourceMappingURL=Task.js.map