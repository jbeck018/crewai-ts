/**
 * Task Queue System Implementation
 * Provides optimized scheduling and execution of tasks with priority handling and dependency resolution
 */
import { EventHandler } from './events.js';
/**
 * Priority levels for tasks
 */
export declare enum TaskPriority {
    LOW = 0,
    NORMAL = 1,
    HIGH = 2,
    CRITICAL = 3
}
/**
 * Task status values
 */
export declare enum TaskStatus {
    PENDING = "pending",
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled",
    WAITING = "waiting"
}
/**
 * Task definition interface
 */
export interface Task<T = any, R = any> {
    /**
     * Unique ID for the task
     */
    id: string;
    /**
     * Human-readable name for the task
     */
    name: string;
    /**
     * Function that executes the task
     */
    execute: (input: T) => Promise<R>;
    /**
     * Input data for the task
     */
    input: T;
    /**
     * Priority level (higher is processed first)
     */
    priority?: TaskPriority;
    /**
     * IDs of tasks that must complete before this one can start
     */
    dependencies?: string[];
    /**
     * Maximum time in milliseconds the task is allowed to run
     */
    timeoutMs?: number;
    /**
     * Tags for categorizing and querying tasks
     */
    tags?: string[];
    /**
     * Additional task metadata
     */
    metadata?: Record<string, any>;
}
/**
 * Task queue events
 */
export interface TaskQueueEvents<T = any, R = any> {
    /**
     * Fired when a task is added to the queue
     */
    taskAdded: Task<T, R>;
    /**
     * Fired when a task starts executing
     */
    taskStarted: Task<T, R>;
    /**
     * Fired when a task completes successfully
     */
    taskCompleted: {
        task: Task<T, R>;
        result: R;
    };
    /**
     * Fired when a task fails
     */
    taskFailed: {
        task: Task<T, R>;
        error: any;
    };
    /**
     * Fired when a task is cancelled
     */
    taskCancelled: Task<T, R>;
    /**
     * Fired when the queue becomes empty
     */
    queueEmpty: null;
    /**
     * Fired when the queue is paused
     */
    queuePaused: null;
    /**
     * Fired when the queue is resumed
     */
    queueResumed: null;
}
/**
 * Options for the task queue
 */
export interface TaskQueueOptions {
    /**
     * Maximum number of concurrent tasks
     * @default 5
     */
    concurrency?: number;
    /**
     * Whether to automatically start processing tasks
     * @default true
     */
    autoStart?: boolean;
    /**
     * Default timeout for all tasks in milliseconds
     * Individual task timeouts will override this value
     * @default undefined (no timeout)
     */
    defaultTimeoutMs?: number;
}
/**
 * Optimized queue system for managing task execution with priority and dependencies
 */
export declare class TaskQueue<T = any, R = any> {
    /**
     * Event emitter for queue events
     */
    private events;
    /**
     * Task pool for managing concurrent execution
     */
    private pool;
    /**
     * All tasks in the queue indexed by ID
     */
    private tasks;
    /**
     * Tasks that are ready to be processed (dependencies resolved)
     */
    private readyTasks;
    /**
     * Tasks that are waiting for dependencies
     */
    private waitingTasks;
    /**
     * Map of tasks that depend on each task
     */
    private dependentTasks;
    /**
     * Whether the queue is currently paused
     */
    private isPaused;
    /**
     * Task queue metrics
     */
    private metrics;
    /**
     * Default task timeout in milliseconds
     */
    private defaultTimeoutMs?;
    /**
     * Create a new task queue
     */
    constructor(options?: TaskQueueOptions);
    /**
     * Add a task to the queue
     */
    enqueue(task: Task<T, R>): Promise<R>;
    /**
     * Cancel a task by ID
     * If the task is already running, this will not stop it
     */
    cancel(taskId: string): boolean;
    /**
     * Pause the queue (prevent new tasks from starting)
     */
    pause(): void;
    /**
     * Resume processing tasks
     */
    resume(): void;
    /**
     * Get current queue statistics
     */
    getStats(): {
        tasksAdded: number;
        tasksCompleted: number;
        tasksFailed: number;
        tasksCancelled: number;
        totalProcessingTimeMs: number;
        averageProcessingTimeMs: number;
        pending: number;
        waiting: number;
        active: number;
        total: number;
    };
    /**
     * Get a task by ID
     */
    getTask(taskId: string): Task<T, R> | undefined;
    /**
     * Clear all pending and waiting tasks
     * Running tasks will continue to completion
     */
    clear(): void;
    /**
     * Wait for all tasks to complete
     */
    drain(): Promise<void>;
    /**
     * Subscribe to queue events
     */
    on<K extends keyof TaskQueueEvents<T, R>>(event: K, listener: EventHandler<any>): () => void;
    /**
     * One-time subscription to queue events
     */
    once<K extends keyof TaskQueueEvents<T, R>>(event: K, listener: EventHandler<any>): () => void;
    /**
     * Map to store unsubscribe functions for event listeners
     * This optimizes memory usage and provides proper cleanup
     */
    private listenerUnsubscribers;
    /**
     * Remove event listener - optimized to use stored references
     */
    removeListener<K extends keyof TaskQueueEvents<T, R>>(event: K, listener: EventHandler<any>): void;
    /**
     * Add a task to the ready queue
     */
    private addToReadyTasks;
    /**
     * Process the next batch of tasks
     */
    private processNext;
    /**
     * Process tasks that depend on a completed task
     */
    private processDependentTasks;
}
//# sourceMappingURL=taskQueue.d.ts.map