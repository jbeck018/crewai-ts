/**
 * Retry Utility Implementation
 * Provides optimized retrying of operations with configurable backoff strategies
 */
import { withTimeout } from './async.js';
/**
 * Backoff strategies for retries
 */
export var BackoffStrategy;
(function (BackoffStrategy) {
    BackoffStrategy["CONSTANT"] = "constant";
    BackoffStrategy["LINEAR"] = "linear";
    BackoffStrategy["EXPONENTIAL"] = "exponential";
    BackoffStrategy["FIBONACCI"] = "fibonacci";
})(BackoffStrategy || (BackoffStrategy = {}));
/**
 * Error thrown when the maximum number of retries is exceeded
 */
export class MaxRetriesExceededError extends Error {
    attempts;
    lastError;
    constructor(message, attempts, lastError) {
        super(message);
        this.attempts = attempts;
        this.lastError = lastError;
        this.name = 'MaxRetriesExceededError';
    }
}
/**
 * Calculate delay based on the selected backoff strategy
 */
function calculateDelay(attempt, initialDelay, maxDelay, strategy, factor, jitter, jitterFactor) {
    let delay;
    // Calculate base delay
    switch (strategy) {
        case BackoffStrategy.CONSTANT:
            delay = initialDelay;
            break;
        case BackoffStrategy.LINEAR:
            delay = initialDelay * attempt;
            break;
        case BackoffStrategy.EXPONENTIAL:
            delay = initialDelay * Math.pow(factor, attempt - 1);
            break;
        case BackoffStrategy.FIBONACCI:
            // Calculate Fibonacci sequence dynamically
            let prev = 1;
            let curr = 1;
            for (let i = 2; i < attempt; i++) {
                const temp = curr;
                curr = prev + curr;
                prev = temp;
            }
            delay = initialDelay * curr;
            break;
        default:
            delay = initialDelay * Math.pow(2, attempt - 1); // Default to exponential
    }
    // Apply jitter if enabled
    if (jitter && jitterFactor > 0) {
        // Calculate jitter amount (up to jitterFactor % of delay)
        const jitterAmount = delay * jitterFactor;
        // Apply random jitter (both up and down to avoid always increasing)
        delay = delay + (Math.random() * 2 - 1) * jitterAmount;
    }
    // Ensure delay is within bounds
    return Math.min(Math.max(delay, initialDelay), maxDelay);
}
/**
 * Retry an async operation with configurable backoff
 */
export async function retry(operation, options = {}) {
    const startTime = Date.now();
    const maxAttempts = options.maxAttempts ?? 3;
    const initialDelay = options.initialDelayMs ?? 100;
    const maxDelay = options.maxDelayMs ?? 10000;
    const strategy = options.backoffStrategy ?? BackoffStrategy.EXPONENTIAL;
    const factor = options.backoffFactor ?? 2;
    const jitter = options.jitter ?? true;
    const jitterFactor = options.jitterFactor ?? 0.25;
    const operationName = options.operationName ?? 'operation';
    let attempt = 0;
    let lastError;
    // Check if retry operation was aborted before starting
    if (options.abortSignal?.aborted) {
        throw new Error('Retry operation aborted');
    }
    // Create abort controller for timeout if needed
    let timeoutController;
    let timeoutSignal;
    if (options.timeoutMs && options.timeoutMs > 0) {
        timeoutController = new AbortController();
        timeoutSignal = timeoutController.signal;
    }
    // Combine user's abort signal with timeout signal if both exist
    const abortSignal = options.abortSignal || timeoutSignal;
    // Watch for abort signals
    const abortPromise = abortSignal
        ? new Promise((_, reject) => {
            abortSignal.addEventListener('abort', () => {
                const abortReason = options.abortSignal?.reason ?? 'Retry operation aborted';
                reject(new Error(String(abortReason)));
            }, { once: true });
        })
        : null;
    try {
        while (attempt < maxAttempts) {
            attempt++;
            try {
                // Create a wrapped operation that respects timeout
                const wrappedOperation = async () => {
                    // Use the withTimeout utility if timeout is specified
                    if (options.timeoutMs && options.timeoutMs > 0) {
                        return withTimeout(operation(), options.timeoutMs, operationName);
                    }
                    return operation();
                };
                // If we have an abort promise, race against it
                const result = abortPromise
                    ? await Promise.race([wrappedOperation(), abortPromise])
                    : await wrappedOperation();
                // Operation succeeded, return result
                return {
                    result,
                    attempts: attempt,
                    totalTimeMs: Date.now() - startTime,
                    success: true
                };
            }
            catch (error) {
                lastError = error;
                // Check if we should retry this specific error
                const shouldRetry = options.retryPredicate
                    ? await Promise.resolve(options.retryPredicate(error, attempt))
                    : true;
                // No more attempts or error shouldn't be retried
                if (attempt >= maxAttempts || !shouldRetry) {
                    break;
                }
                // Calculate delay for next attempt
                const delayMs = calculateDelay(attempt, initialDelay, maxDelay, strategy, factor, jitter, jitterFactor);
                // Notify callback if provided
                if (options.onRetry) {
                    await Promise.resolve(options.onRetry(error, attempt, delayMs));
                }
                // Wait before next attempt, unless aborted
                if (abortPromise) {
                    await Promise.race([
                        new Promise(resolve => setTimeout(resolve, delayMs)),
                        abortPromise
                    ]);
                }
                else {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }
        // If we got here, we've exhausted our retries
        throw new MaxRetriesExceededError(`${operationName} failed after ${attempt} attempts`, attempt, lastError);
    }
    finally {
        // Clean up timeout controller if we created one
        if (timeoutController) {
            timeoutController.abort();
        }
    }
}
/**
 * Decorator function to make a function retryable
 */
export function retryable(options = {}) {
    return (target) => {
        return async (...args) => {
            try {
                // Ensure proper typing with ReturnType<T>
                const result = await retry(() => target(...args), options);
                return result.result;
            }
            catch (error) {
                if (error instanceof MaxRetriesExceededError) {
                    throw error.lastError;
                }
                throw error;
            }
        };
    };
}
/**
 * Create a retry policy with default options that can be used across multiple operations
 */
export function createRetryPolicy(defaultOptions = {}) {
    return {
        /**
         * Retry an operation using this policy's defaults
         */
        retry: (operation, overrideOptions = {}) => {
            return retry(operation, { ...defaultOptions, ...overrideOptions });
        },
        /**
         * Create a retryable function using this policy's defaults
         */
        retryable: (fn, overrideOptions = {}) => {
            // Properly type the wrapper function to avoid double Promise wrapping
            return async (...args) => {
                try {
                    const result = await retry(() => fn(...args), { ...defaultOptions, ...overrideOptions });
                    return result.result;
                }
                catch (error) {
                    if (error instanceof MaxRetriesExceededError) {
                        throw error.lastError;
                    }
                    throw error;
                }
            };
        }
    };
}
//# sourceMappingURL=retry.js.map