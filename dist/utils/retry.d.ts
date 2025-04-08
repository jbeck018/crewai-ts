/**
 * Retry Utility Implementation
 * Provides optimized retrying of operations with configurable backoff strategies
 */
/**
 * Backoff strategies for retries
 */
export declare enum BackoffStrategy {
    CONSTANT = "constant",
    LINEAR = "linear",
    EXPONENTIAL = "exponential",
    FIBONACCI = "fibonacci"
}
/**
 * Options for the retry policy
 * Different from RetryOptions in errors.ts which is more basic
 */
export interface RetryPolicyOptions<T = any> {
    /**
     * Maximum number of retry attempts
     * @default 3
     */
    maxAttempts?: number;
    /**
     * Initial delay in milliseconds
     * @default 100
     */
    initialDelayMs?: number;
    /**
     * Maximum delay in milliseconds
     * @default 10000 (10 seconds)
     */
    maxDelayMs?: number;
    /**
     * Backoff strategy to use
     * @default BackoffStrategy.EXPONENTIAL
     */
    backoffStrategy?: BackoffStrategy;
    /**
     * Factor for backoff calculation
     * @default 2
     */
    backoffFactor?: number;
    /**
     * Whether to add jitter to the delay
     * @default true
     */
    jitter?: boolean;
    /**
     * Maximum jitter factor (0-1)
     * @default 0.25
     */
    jitterFactor?: number;
    /**
     * Operation timeout in milliseconds
     * If set, each attempt will be aborted if it takes longer than this
     */
    timeoutMs?: number;
    /**
     * Function to determine if a specific error should be retried
     * Return true to retry, false to stop
     * @default All errors are retried
     */
    retryPredicate?: (error: any, attempt: number) => boolean | Promise<boolean>;
    /**
     * Callback for retry events
     */
    onRetry?: (error: any, attempt: number, delayMs: number) => void | Promise<void>;
    /**
     * Operation name for logging and error messages
     */
    operationName?: string;
    /**
     * AbortSignal to abort the retry operation
     */
    abortSignal?: AbortSignal;
}
/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
    /**
     * The final result if successful
     */
    result: T;
    /**
     * Number of attempts made
     */
    attempts: number;
    /**
     * Total time taken across all attempts in milliseconds
     */
    totalTimeMs: number;
    /**
     * Whether the operation succeeded
     */
    success: boolean;
    /**
     * The last error if the operation failed
     */
    lastError?: any;
}
/**
 * Error thrown when the maximum number of retries is exceeded
 */
export declare class MaxRetriesExceededError extends Error {
    readonly attempts: number;
    readonly lastError: any;
    constructor(message: string, attempts: number, lastError: any);
}
/**
 * Retry an async operation with configurable backoff
 */
export declare function retry<T>(operation: () => Promise<T>, options?: RetryPolicyOptions<T>): Promise<RetryResult<T>>;
/**
 * Decorator function to make a function retryable
 */
export declare function retryable<T extends (...args: any[]) => Promise<any>>(options?: RetryPolicyOptions): (target: T) => (...args: Parameters<T>) => Promise<ReturnType<T>>;
/**
 * Create a retry policy with default options that can be used across multiple operations
 */
export declare function createRetryPolicy(defaultOptions?: RetryPolicyOptions): {
    /**
     * Retry an operation using this policy's defaults
     */
    retry: <T>(operation: () => Promise<T>, overrideOptions?: RetryPolicyOptions) => Promise<RetryResult<T>>;
    /**
     * Create a retryable function using this policy's defaults
     */
    retryable: <T extends (...args: any[]) => Promise<any>>(fn: T, overrideOptions?: RetryPolicyOptions) => ((...args: Parameters<T>) => Promise<ReturnType<T>>);
};
//# sourceMappingURL=retry.d.ts.map