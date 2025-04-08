/**
 * Async utilities implementation
 * Optimized for efficient asynchronous operations with concurrency control
 */
/**
 * Options for batch processing
 */
export interface BatchOptions<T = any> {
    /**
     * Maximum number of promises to process concurrently
     * @default 5
     */
    concurrency?: number;
    /**
     * Callback to execute before each batch
     */
    onBatchStart?: (batch: T[], batchIndex: number) => void | Promise<void>;
    /**
     * Callback to execute after each batch
     */
    onBatchComplete?: (results: any[], batchIndex: number) => void | Promise<void>;
    /**
     * Callback to execute on error
     * Return true to continue processing, false to abort
     */
    onError?: (error: any, item: T, index: number) => boolean | Promise<boolean>;
    /**
     * Delay between batches in milliseconds
     * @default 0
     */
    batchDelayMs?: number;
    /**
     * Maximum batch size (items per batch)
     * @default same as concurrency
     */
    batchSize?: number;
}
/**
 * Sequential map - process items one after another
 */
export declare function mapSequential<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]>;
/**
 * Process items in parallel with concurrency control
 */
export declare function mapLimit<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>;
/**
 * Process items in batches with concurrency control
 */
export declare function batchProcess<T, R>(items: T[], processFn: (item: T, index: number) => Promise<R>, options?: BatchOptions<T>): Promise<R[]>;
/**
 * Apply a timeout to a promise
 * Returns a new promise that rejects with TimeoutError if the original promise doesn't settle within the specified timeout
 */
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName?: string): Promise<T>;
/**
 * Pool for managing async tasks with concurrency limits and priorities
 */
export declare class TaskPool {
    private concurrency;
    private queue;
    private activeCount;
    private isPaused;
    constructor(concurrency?: number);
    /**
     * Schedule a task for execution
     */
    schedule<T>(task: () => Promise<T>, priority?: number): Promise<T>;
    /**
     * Get the current size of the queue
     */
    get size(): number;
    /**
     * Get the number of active tasks
     */
    get active(): number;
    /**
     * Pause task processing
     */
    pause(): void;
    /**
     * Resume task processing
     */
    resume(): void;
    /**
     * Change the concurrency limit
     */
    setConcurrency(concurrency: number): void;
    /**
     * Clear all pending tasks
     */
    clear(): void;
    /**
     * Wait for all tasks to complete
     */
    drain(): Promise<void>;
    /**
     * Process next tasks in the queue
     */
    private processNext;
}
/**
 * Create a debounced version of a function
 */
export declare function debounce<T extends (...args: any[]) => any>(fn: T, wait: number, options?: {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
}): ((...args: Parameters<T>) => void) & {
    cancel: () => void;
};
/**
 * Create a throttled version of a function
 */
export declare function throttle<T extends (...args: any[]) => any>(fn: T, wait: number, options?: {
    leading?: boolean;
    trailing?: boolean;
}): T & {
    cancel: () => void;
};
//# sourceMappingURL=async.d.ts.map