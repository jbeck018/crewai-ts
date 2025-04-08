/**
 * BaseTool interface
 * Defines the foundation for all tools used by agents
 */
/**
 * Base implementation for tools
 * Provides common functionality for all tools
 */
export class Tool {
    name;
    description;
    schema;
    verbose;
    cacheResults;
    timeout;
    maxRetries;
    cache = new Map();
    constructor(metadata) {
        this.name = metadata.name;
        this.description = metadata.description;
        this.schema = metadata.schema;
        this.verbose = metadata.verbose ?? false;
        this.cacheResults = metadata.cacheResults ?? false;
        this.timeout = metadata.timeout;
        this.maxRetries = metadata.maxRetries ?? 2;
    }
    /**
     * Execute the tool with the given input
     * Handles validation, caching, and error handling
     */
    async execute(input, options) {
        const startTime = Date.now();
        const timeout = options?.timeout ?? this.timeout;
        try {
            // Validate input if schema is provided
            if (this.schema) {
                try {
                    this.schema.parse(input);
                }
                catch (error) {
                    return {
                        success: false,
                        result: null,
                        error: `Invalid input: ${error instanceof Error ? error.message : String(error)}`,
                        executionTime: Date.now() - startTime
                    };
                }
            }
            // Check cache if enabled
            if (this.cacheResults) {
                const cacheKey = this.getCacheKey(input);
                const cachedResult = this.cache.get(cacheKey);
                if (cachedResult) {
                    if (this.verbose) {
                        console.log(`[Tool ${this.name}] Using cached result`);
                    }
                    return { ...cachedResult, cached: true };
                }
            }
            // Execute with retry logic
            let result;
            let lastError;
            for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
                try {
                    // Create timeout controller if needed
                    const controller = timeout ? new AbortController() : undefined;
                    const timeoutId = timeout ?
                        setTimeout(() => controller?.abort(new Error('Tool execution timeout')), timeout) :
                        undefined;
                    // Combine user-provided signal with timeout signal if both exist
                    const signal = options?.abortSignal && controller?.signal ?
                        this.createCombinedAbortSignal(options.abortSignal, controller.signal) :
                        options?.abortSignal || controller?.signal;
                    try {
                        // Execute the tool implementation
                        const toolResult = await this._execute(input, { signal });
                        result = {
                            success: true,
                            result: toolResult,
                            executionTime: Date.now() - startTime
                        };
                        // Cache successful result if enabled
                        if (this.cacheResults) {
                            const cacheKey = this.getCacheKey(input);
                            this.cache.set(cacheKey, result);
                        }
                        return result;
                    }
                    finally {
                        // Clear timeout if it was set
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                        }
                    }
                }
                catch (error) {
                    lastError = error;
                    // If this is the last attempt, don't delay
                    if (attempt < this.maxRetries) {
                        // Exponential backoff with jitter
                        const delay = Math.min(100 * Math.pow(2, attempt) + Math.random() * 100, 10000);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            // If we've exhausted retries, return error
            return {
                success: false,
                result: null,
                error: `Tool execution failed after ${this.maxRetries + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
                executionTime: Date.now() - startTime
            };
        }
        catch (error) {
            // Catch any unexpected errors
            return {
                success: false,
                result: null,
                error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
                executionTime: Date.now() - startTime
            };
        }
    }
    /**
     * Get the tool metadata for agent consumption
     */
    getMetadata() {
        return {
            name: this.name,
            description: this.description,
            schema: this.schema,
            verbose: this.verbose,
            cacheResults: this.cacheResults,
            timeout: this.timeout,
            maxRetries: this.maxRetries
        };
    }
    /**
     * Generate a cache key for a given input
     */
    getCacheKey(input) {
        return JSON.stringify(input);
    }
    /**
     * Create a combined AbortSignal that aborts when either source signal aborts
     */
    createCombinedAbortSignal(signal1, signal2) {
        const controller = new AbortController();
        const handleAbort = () => {
            controller.abort();
        };
        signal1.addEventListener('abort', handleAbort);
        signal2.addEventListener('abort', handleAbort);
        // Clean up if the controller is aborted directly
        controller.signal.addEventListener('abort', () => {
            signal1.removeEventListener('abort', handleAbort);
            signal2.removeEventListener('abort', handleAbort);
        });
        return controller.signal;
    }
}
//# sourceMappingURL=BaseTool.js.map