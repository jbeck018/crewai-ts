/**
 * Error handling system implementation
 * Optimized for efficient error management with contextual information
 */
/**
 * Base error class for all CrewAI errors
 * Provides consistent error structure and handling
 */
export declare class CrewAIError extends Error {
    /**
     * Error code for programmatic handling
     */
    code: string;
    /**
     * HTTP status code (if applicable)
     */
    status?: number;
    /**
     * Additional contextual information
     */
    context: Record<string, any>;
    /**
     * Whether this error is retryable
     */
    retryable: boolean;
    /**
     * Original error if this is a wrapped error
     */
    cause?: Error;
    /**
     * Create a new CrewAIError instance
     */
    constructor(message: string, options?: {
        code?: string;
        status?: number;
        context?: Record<string, any>;
        retryable?: boolean;
        cause?: Error;
    });
    /**
     * Convert error to JSON for logging
     */
    toJSON(): Record<string, any>;
    /**
     * Get a string representation of the error
     * @override
     */
    toString(): string;
}
/**
 * Validation error - thrown when input validation fails
 */
export declare class ValidationError extends CrewAIError {
    constructor(message: string, options?: {
        context?: Record<string, any>;
        cause?: Error;
    });
}
/**
 * Configuration error - thrown when there's an issue with configuration
 */
export declare class ConfigurationError extends CrewAIError {
    constructor(message: string, options?: {
        context?: Record<string, any>;
        cause?: Error;
    });
}
/**
 * LLM error - thrown when there's an issue with LLM interaction
 */
export declare class LLMError extends CrewAIError {
    constructor(message: string, options?: {
        context?: Record<string, any>;
        cause?: Error;
        retryable?: boolean;
    });
}
/**
 * Rate limit error - thrown when rate limits are exceeded
 */
export declare class RateLimitError extends CrewAIError {
    constructor(message: string, options?: {
        context?: Record<string, any>;
        cause?: Error;
        retryAfterMs?: number;
    });
    /**
     * Get the recommended retry delay
     */
    getRetryAfterMs(): number;
}
/**
 * Memory error - thrown when there's an issue with memory operations
 */
export declare class MemoryError extends CrewAIError {
    constructor(message: string, options?: {
        context?: Record<string, any>;
        cause?: Error;
    });
}
/**
 * Task execution error - thrown when task execution fails
 */
export declare class TaskExecutionError extends CrewAIError {
    constructor(message: string, options?: {
        context?: Record<string, any>;
        cause?: Error;
        taskId?: string;
        agentId?: string;
    });
}
/**
 * Tool execution error - thrown when tool execution fails
 */
export declare class ToolExecutionError extends CrewAIError {
    constructor(message: string, options?: {
        context?: Record<string, any>;
        cause?: Error;
        toolName?: string;
    });
}
/**
 * Timeout error - thrown when an operation times out
 */
export declare class TimeoutError extends CrewAIError {
    constructor(message: string, options?: {
        context?: Record<string, any>;
        cause?: Error;
        operationName?: string;
        timeoutMs?: number;
    });
}
/**
 * Authentication error - thrown when authentication fails
 */
export declare class AuthenticationError extends CrewAIError {
    constructor(message: string, options?: {
        context?: Record<string, any>;
        cause?: Error;
    });
}
/**
 * Authorization error - thrown when authorization fails
 */
export declare class AuthorizationError extends CrewAIError {
    constructor(message: string, options?: {
        context?: Record<string, any>;
        cause?: Error;
    });
}
/**
 * Network error - thrown when network operations fail
 */
export declare class NetworkError extends CrewAIError {
    constructor(message: string, options?: {
        context?: Record<string, any>;
        cause?: Error;
    });
}
/**
 * Retry mechanism for handling retryable errors
 */
export interface RetryOptions {
    /**
     * Maximum number of retry attempts
     * @default 3
     */
    maxRetries?: number;
    /**
     * Initial backoff delay in milliseconds
     * @default 1000 (1 second)
     */
    initialDelayMs?: number;
    /**
     * Backoff factor for exponential backoff
     * @default 2
     */
    backoffFactor?: number;
    /**
     * Maximum backoff delay in milliseconds
     * @default 30000 (30 seconds)
     */
    maxDelayMs?: number;
    /**
     * Jitter factor to add randomness to backoff (0-1)
     * @default 0.2
     */
    jitter?: number;
    /**
     * Predicate to determine if an error is retryable
     * @default error.retryable === true
     */
    retryPredicate?: (error: any) => boolean;
    /**
     * Callback for retry attempts
     */
    onRetry?: (error: any, attempt: number, delayMs: number) => void | Promise<void>;
}
/**
 * Retry a function with exponential backoff
 */
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
/**
 * Error boundary for handling errors in async contexts
 */
export declare function errorBoundary<T>(fn: () => Promise<T>, options?: {
    onError?: (error: any) => void | Promise<void>;
    fallback?: T | (() => T | Promise<T>);
}): Promise<T>;
//# sourceMappingURL=errors.d.ts.map