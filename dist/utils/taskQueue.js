/**
 * Task Queue System Implementation
 * Provides optimized scheduling and execution of tasks with priority handling and dependency resolution
 */
import { EventEmitter } from './events.js';
import { TaskPool } from './async.js';
import { withTimeout } from './async.js';
/**
 * Priority levels for tasks
 */
export var TaskPriority;
(function (TaskPriority) {
    TaskPriority[TaskPriority["LOW"] = 0] = "LOW";
    TaskPriority[TaskPriority["NORMAL"] = 1] = "NORMAL";
    TaskPriority[TaskPriority["HIGH"] = 2] = "HIGH";
    TaskPriority[TaskPriority["CRITICAL"] = 3] = "CRITICAL";
})(TaskPriority || (TaskPriority = {}));
/**
 * Task status values
 */
export var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["RUNNING"] = "running";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["CANCELLED"] = "cancelled";
    TaskStatus["WAITING"] = "waiting"; // Waiting for dependencies
})(TaskStatus || (TaskStatus = {}));
/**
 * Optimized queue system for managing task execution with priority and dependencies
 */
export class TaskQueue {
    /**
     * Event emitter for queue events
     */
    events = new EventEmitter();
    /**
     * Task pool for managing concurrent execution
     */
    pool;
    /**
     * All tasks in the queue indexed by ID
     */
    tasks = new Map();
    /**
     * Tasks that are ready to be processed (dependencies resolved)
     */
    readyTasks = [];
    /**
     * Tasks that are waiting for dependencies
     */
    waitingTasks = new Map();
    /**
     * Map of tasks that depend on each task
     */
    dependentTasks = new Map();
    /**
     * Whether the queue is currently paused
     */
    isPaused = false;
    /**
     * Task queue metrics
     */
    metrics = {
        tasksAdded: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        tasksCancelled: 0,
        totalProcessingTimeMs: 0,
        averageProcessingTimeMs: 0
    };
    /**
     * Default task timeout in milliseconds
     */
    defaultTimeoutMs;
    /**
     * Create a new task queue
     */
    constructor(options = {}) {
        const concurrency = options.concurrency ?? 5;
        this.pool = new TaskPool(concurrency);
        this.defaultTimeoutMs = options.defaultTimeoutMs;
        if (options.autoStart !== false) {
            // Start processing in the next event loop tick
            setTimeout(() => this.processNext(), 0);
        }
    }
    /**
     * Add a task to the queue
     */
    enqueue(task) {
        // Make sure task ID is unique
        if (this.tasks.has(task.id)) {
            throw new Error(`Task with ID ${task.id} already exists in the queue`);
        }
        return new Promise((resolve, reject) => {
            const now = Date.now();
            // Create task instance
            const taskInstance = {
                ...task,
                status: TaskStatus.PENDING,
                createdAt: now,
                resolve,
                reject,
                pendingDependencies: 0,
                canceled: false,
                priority: task.priority ?? TaskPriority.NORMAL
            };
            // Add to task map
            this.tasks.set(task.id, taskInstance);
            this.metrics.tasksAdded++;
            // Check dependencies
            if (task.dependencies && task.dependencies.length > 0) {
                // Count pending dependencies and register as dependent
                taskInstance.status = TaskStatus.WAITING;
                taskInstance.pendingDependencies = 0;
                for (const depId of task.dependencies) {
                    // Get dependency task
                    const depTask = this.tasks.get(depId);
                    // If dependency exists and is not complete, add to waiting
                    if (!depTask || depTask.status !== TaskStatus.COMPLETED) {
                        taskInstance.pendingDependencies++;
                        // Register this task as dependent on the dependency
                        if (!this.dependentTasks.has(depId)) {
                            this.dependentTasks.set(depId, new Set());
                        }
                        this.dependentTasks.get(depId).add(task.id);
                    }
                }
                // If there are pending dependencies, add to waiting tasks
                if (taskInstance.pendingDependencies > 0) {
                    this.waitingTasks.set(task.id, taskInstance);
                }
                else {
                    // All dependencies are already completed, add to ready tasks
                    this.addToReadyTasks(taskInstance);
                }
            }
            else {
                // No dependencies, add directly to ready tasks
                this.addToReadyTasks(taskInstance);
            }
            // Emit event
            this.events.emit('taskAdded', task);
            // Process next if not paused
            if (!this.isPaused) {
                this.processNext();
            }
        });
    }
    /**
     * Cancel a task by ID
     * If the task is already running, this will not stop it
     */
    cancel(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }
        // Mark as canceled
        task.canceled = true;
        // If task is still pending or waiting, we can fully cancel it
        if (task.status === TaskStatus.PENDING || task.status === TaskStatus.WAITING) {
            task.status = TaskStatus.CANCELLED;
            task.completedAt = Date.now();
            this.metrics.tasksCancelled++;
            // Remove from relevant collections
            this.tasks.delete(taskId);
            this.waitingTasks.delete(taskId);
            // Remove from ready tasks if it's there
            const readyIndex = this.readyTasks.findIndex(t => t.id === taskId);
            if (readyIndex >= 0) {
                this.readyTasks.splice(readyIndex, 1);
            }
            // Resolve with cancellation
            task.reject(new Error(`Task ${taskId} was cancelled`));
            // Emit event
            this.events.emit('taskCancelled', task);
            return true;
        }
        // If already completed or failed, cannot cancel
        return false;
    }
    /**
     * Pause the queue (prevent new tasks from starting)
     */
    pause() {
        if (!this.isPaused) {
            this.isPaused = true;
            this.pool.pause();
            this.events.emit('queuePaused', null);
        }
    }
    /**
     * Resume processing tasks
     */
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.pool.resume();
            this.events.emit('queueResumed', null);
            this.processNext();
        }
    }
    /**
     * Get current queue statistics
     */
    getStats() {
        return {
            pending: this.readyTasks.length,
            waiting: this.waitingTasks.size,
            active: this.pool.active,
            total: this.tasks.size,
            ...this.metrics
        };
    }
    /**
     * Get a task by ID
     */
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    /**
     * Clear all pending and waiting tasks
     * Running tasks will continue to completion
     */
    clear() {
        // Cancel all ready tasks
        for (const task of this.readyTasks) {
            this.cancel(task.id);
        }
        // Cancel all waiting tasks
        for (const taskId of this.waitingTasks.keys()) {
            this.cancel(taskId);
        }
        // Clear collections
        this.readyTasks = [];
        this.waitingTasks.clear();
    }
    /**
     * Wait for all tasks to complete
     */
    async drain() {
        if (this.tasks.size === 0) {
            return;
        }
        return new Promise(resolve => {
            // Store the unsubscribe function for cleanup
            let unsubscribe;
            const onQueueEmpty = () => {
                // Clean up listener using the unsubscribe function instead of 'off'
                if (unsubscribe) {
                    unsubscribe();
                }
                resolve();
            };
            // Register listener and get unsubscribe function
            unsubscribe = this.events.on('queueEmpty', onQueueEmpty);
            // If nothing is running or pending, resolve immediately
            if (this.pool.active === 0 && this.readyTasks.length === 0 && this.waitingTasks.size === 0) {
                this.events.emit('queueEmpty', null);
            }
        });
    }
    /**
     * Subscribe to queue events
     */
    on(event, listener) {
        // Get the unsubscribe function
        const unsubscribe = this.events.on(event, listener);
        // Store for later cleanup
        this.listenerUnsubscribers.set(listener, unsubscribe);
        // Return enhanced unsubscribe that also cleans up our map
        return () => {
            unsubscribe();
            this.listenerUnsubscribers.delete(listener);
        };
    }
    /**
     * One-time subscription to queue events
     */
    once(event, listener) {
        // For once listeners, we don't need to store the unsubscribe function
        // since they automatically clean up after triggering
        return this.events.once(event, listener);
    }
    /**
     * Map to store unsubscribe functions for event listeners
     * This optimizes memory usage and provides proper cleanup
     */
    listenerUnsubscribers = new Map();
    /**
     * Remove event listener - optimized to use stored references
     */
    removeListener(event, listener) {
        // Get the stored unsubscribe function if it exists
        const unsubscribe = this.listenerUnsubscribers.get(listener);
        if (unsubscribe) {
            // Call unsubscribe and remove from map
            unsubscribe();
            this.listenerUnsubscribers.delete(listener);
        }
    }
    /**
     * Add a task to the ready queue
     */
    addToReadyTasks(task) {
        if (task.status === TaskStatus.WAITING) {
            task.status = TaskStatus.PENDING;
        }
        this.readyTasks.push(task);
        // Sort by priority (higher priority first)
        this.readyTasks.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }
    /**
     * Process the next batch of tasks
     */
    processNext() {
        if (this.isPaused || this.readyTasks.length === 0) {
            return;
        }
        // Get the highest priority task
        const task = this.readyTasks.shift();
        if (!task) {
            return;
        }
        // If task was already cancelled, skip it
        if (task.canceled) {
            // Process next task
            this.processNext();
            return;
        }
        // Mark as running
        task.status = TaskStatus.RUNNING;
        task.startedAt = Date.now();
        // Emit event
        this.events.emit('taskStarted', task);
        // Create execution function
        const executeTask = async () => {
            try {
                // Execute task, potentially with timeout
                let result;
                // Determine timeout (individual task timeout or default)
                const timeoutMs = task.timeoutMs ?? this.defaultTimeoutMs;
                if (timeoutMs) {
                    // Execute with timeout
                    result = await withTimeout(task.execute(task.input), timeoutMs, `Task ${task.id}`);
                }
                else {
                    // Execute without timeout
                    result = await task.execute(task.input);
                }
                // Only process result if not cancelled during execution
                if (!task.canceled) {
                    // Update task status
                    task.status = TaskStatus.COMPLETED;
                    task.completedAt = Date.now();
                    task.result = result;
                    // Update metrics
                    this.metrics.tasksCompleted++;
                    if (task.startedAt) {
                        const processingTime = task.completedAt - task.startedAt;
                        this.metrics.totalProcessingTimeMs += processingTime;
                        this.metrics.averageProcessingTimeMs =
                            this.metrics.totalProcessingTimeMs / this.metrics.tasksCompleted;
                    }
                    // Resolve the task promise
                    task.resolve(result);
                    // Emit completion event - combine parameters into a single object to match EventHandler type
                    this.events.emit('taskCompleted', { task: task, result });
                    // Process dependent tasks
                    this.processDependentTasks(task.id);
                }
            }
            catch (error) {
                // Only process error if not cancelled during execution
                if (!task.canceled) {
                    // Update task status
                    task.status = TaskStatus.FAILED;
                    task.completedAt = Date.now();
                    task.error = error;
                    // Update metrics
                    this.metrics.tasksFailed++;
                    // Reject the task promise
                    task.reject(error);
                    // Emit failure event - combine parameters into a single object to match EventHandler type
                    this.events.emit('taskFailed', { task: task, error });
                }
            }
            finally {
                // Remove task from tasks map if completed or failed
                if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
                    this.tasks.delete(task.id);
                }
                // Check if queue is empty
                if (this.tasks.size === 0) {
                    this.events.emit('queueEmpty', null);
                }
                else {
                    // Process next task
                    this.processNext();
                }
            }
        };
        // Schedule task execution
        this.pool.schedule(executeTask, task.priority);
    }
    /**
     * Process tasks that depend on a completed task
     */
    processDependentTasks(taskId) {
        // Get tasks that depend on this one
        const dependents = this.dependentTasks.get(taskId);
        if (!dependents || dependents.size === 0) {
            return;
        }
        // For each dependent task
        for (const depId of dependents) {
            const task = this.waitingTasks.get(depId);
            if (!task) {
                continue;
            }
            // Decrement pending dependencies
            task.pendingDependencies--;
            // If all dependencies are resolved, move to ready queue
            if (task.pendingDependencies <= 0) {
                // Remove from waiting tasks
                this.waitingTasks.delete(depId);
                // Add to ready tasks if not cancelled
                if (!task.canceled) {
                    this.addToReadyTasks(task);
                    // Process next task if not paused
                    if (!this.isPaused) {
                        this.processNext();
                    }
                }
            }
        }
        // Clear this task's dependents
        this.dependentTasks.delete(taskId);
    }
}
//# sourceMappingURL=taskQueue.js.map