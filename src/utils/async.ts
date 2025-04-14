/**
 * Async utilities implementation
 * Optimized for efficient asynchronous operations with concurrency control
 */

import { TimeoutError } from './errors.js';

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
export async function mapSequential<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i++) {
    // Ensure item is not undefined before passing to fn
    const item = items[i];
    if (item !== undefined) {
      results.push(await fn(item, i));
    } else {
      // Handle undefined items by skipping or providing a default value
      // This approach maintains type safety
      continue;
    }
  }
  
  return results;
}

/**
 * Process items in parallel with concurrency control
 */
export async function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (concurrency <= 0) {
    throw new Error('Concurrency must be greater than 0');
  }
  
  if (items.length === 0) {
    return [];
  }
  
  // Use sequential processing if concurrency is 1
  if (concurrency === 1) {
    return mapSequential(items, fn);
  }
  
  const results: R[] = new Array(items.length);
  const inProgress = new Set<Promise<void>>();
  let nextIndex = 0;
  
  // Process next item
  const processNext = async (): Promise<void> => {
    if (nextIndex >= items.length) {
      return;
    }
    
    const index = nextIndex++;
    const item = items[index];
    
    try {
      // Ensure item is properly typed
      results[index] = await fn(item as T, index);
    } catch (error) {
      // Re-throw to be caught by the promise created below
      throw { error, index };
    }
  };
  
  // Create initial batch of promises
  const initialBatchSize = Math.min(concurrency, items.length);
  
  for (let i = 0; i < initialBatchSize; i++) {
    const promise = processNext().catch(e => e);
    inProgress.add(promise);
    
    // Clean up when promise completes
    promise.finally(() => {
      inProgress.delete(promise);
    });
  }
  
  // Process remaining items as others complete
  while (inProgress.size > 0) {
    // Wait for one promise to complete
    // Use a different approach to avoid void type issues
    // Define proper interfaces for the result types
    type SuccessResult = { promise: Promise<any>; result: any; isError: false; };
    type ErrorResult = { promise: Promise<any>; error: any; isError: true; };
    type PromiseResult = SuccessResult | ErrorResult;
    
    // Map each promise to return itself when resolved with proper typing
    const promises = Array.from(inProgress).map(p => 
      p.then(result => ({ promise: p, result, isError: false } as SuccessResult))
       .catch(error => ({ promise: p, error, isError: true } as ErrorResult))
    );
    
    // Now race will return an object with the promise and its result/error
    const completed = await Promise.race(promises) as PromiseResult;
    
    // Handle the completed promise in a type-safe way
    // Use type guard pattern that TypeScript understands
    if (completed.isError === true) {
      // With the discriminated union pattern, TypeScript knows this is ErrorResult
      throw completed.error;
    }
    
    // Remove the completed promise from the set
    inProgress.delete(completed.promise);
    
    // Start a new task if there are more items
    if (nextIndex < items.length) {
      const promise = processNext().catch(e => e);
      inProgress.add(promise);
      
      // Clean up when promise completes
      promise.finally(() => {
        inProgress.delete(promise);
      });
    }
  }
  
  return results;
}

/**
 * Process items in batches with concurrency control
 */
export async function batchProcess<T, R>(
  items: T[],
  processFn: (item: T, index: number) => Promise<R>,
  options: BatchOptions<T> = {}
): Promise<R[]> {
  const concurrency = options.concurrency ?? 5;
  const batchSize = options.batchSize ?? concurrency;
  const batchDelayMs = options.batchDelayMs ?? 0;
  
  if (items.length === 0) {
    return [];
  }
  
  // Calculate total number of batches
  const numBatches = Math.ceil(items.length / batchSize);
  const results: R[] = new Array(items.length);
  
  // Process each batch
  for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
    const start = batchIndex * batchSize;
    const end = Math.min(start + batchSize, items.length);
    const batch = items.slice(start, end);
    
    // Notify batch start if callback provided
    if (options.onBatchStart) {
      await Promise.resolve(options.onBatchStart(batch, batchIndex));
    }
    
    // Process batch with concurrency
    const processBatchWithConcurrency = async () => {
      try {
        const batchResults = await mapLimit(
          batch,
          Math.min(concurrency, batch.length),
          async (item, batchItemIndex) => {
            const originalIndex = start + batchItemIndex;
            try {
              return await processFn(item, originalIndex);
            } catch (error) {
              // Handle error if callback provided
              if (options.onError) {
                const shouldContinue = await Promise.resolve(
                  options.onError(error, item, originalIndex)
                );
                
                // Explicitly check against false, as undefined or null should continue
                if (shouldContinue === false) {
                  throw error; // Re-throw to abort processing
                }
                
                // Return null or undefined for errors that are handled
                return null as any;
              }
              
              throw error; // Re-throw if no error handler
            }
          }
        );
        
        // Store batch results
        for (let i = 0; i < batchResults.length; i++) {
          results[start + i] = batchResults[i];
        }
        
        // Notify batch completion if callback provided
        if (options.onBatchComplete) {
          await Promise.resolve(options.onBatchComplete(batchResults, batchIndex));
        }
        
        return batchResults;
      } catch (error) {
        // Propagate error
        throw error;
      }
    };
    
    // Process current batch
    await processBatchWithConcurrency();
    
    // Delay between batches if specified
    if (batchDelayMs > 0 && batchIndex < numBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, batchDelayMs));
    }
  }
  
  return results;
}

/**
 * Apply a timeout to a promise
 * Returns a new promise that rejects with TimeoutError if the original promise doesn't settle within the specified timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName = 'operation'
): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }
  
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new TimeoutError(
          `Operation timed out after ${timeoutMs}ms`,
          {
            operationName,
            timeoutMs
          }
        )
      );
    }, timeoutMs);
    
    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Pool for managing async tasks with concurrency limits and priorities
 */
export class TaskPool {
  private queue: Array<{
    task: () => Promise<any>;
    priority: number;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  
  private activeCount = 0;
  private isPaused = false;
  
  constructor(private concurrency: number = 5) {
    if (concurrency <= 0) {
      throw new Error('Concurrency must be greater than 0');
    }
  }
  
  /**
   * Schedule a task for execution
   */
  async schedule<T>(task: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        priority,
        resolve,
        reject
      });
      
      this.processNext();
    });
  }
  
  /**
   * Get the current size of the queue
   */
  get size(): number {
    return this.queue.length;
  }
  
  /**
   * Get the number of active tasks
   */
  get active(): number {
    return this.activeCount;
  }
  
  /**
   * Pause task processing
   */
  pause(): void {
    this.isPaused = true;
  }
  
  /**
   * Resume task processing
   */
  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.processNext();
    }
  }
  
  /**
   * Change the concurrency limit
   */
  setConcurrency(concurrency: number): void {
    if (concurrency <= 0) {
      throw new Error('Concurrency must be greater than 0');
    }
    
    this.concurrency = concurrency;
    this.processNext();
  }
  
  /**
   * Clear all pending tasks
   */
  clear(): void {
    const error = new Error('Task canceled due to pool clearing');
    
    for (const item of this.queue) {
      item.reject(error);
    }
    
    this.queue = [];
  }
  
  /**
   * Wait for all tasks to complete
   */
  async drain(): Promise<void> {
    if (this.queue.length === 0 && this.activeCount === 0) {
      return;
    }
    
    return new Promise<void>(resolve => {
      const checkComplete = () => {
        if (this.queue.length === 0 && this.activeCount === 0) {
          resolve();
        } else {
          setTimeout(checkComplete, 100);
        }
      };
      
      checkComplete();
    });
  }
  
  /**
   * Process next tasks in the queue
   */
  private processNext(): void {
    if (this.isPaused || this.queue.length === 0 || this.activeCount >= this.concurrency) {
      return;
    }
    
    // Sort queue by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);
    
    // Calculate how many tasks we can start
    const availableSlots = Math.min(
      this.concurrency - this.activeCount,
      this.queue.length
    );
    
    // Start tasks
    for (let i = 0; i < availableSlots; i++) {
      const item = this.queue.shift()!;
      this.activeCount++;
      
      Promise.resolve().then(async () => {
        try {
          const result = await item.task();
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        } finally {
          this.activeCount--;
          this.processNext();
        }
      });
    }
  }
}

/**
 * Create a debounced version of a function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean; maxWait?: number } = {}
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime = 0;
  let lastInvokeTime = 0;
  let leadingEdge = false;
  
  const leading = options.leading ?? false;
  const trailing = options.trailing ?? true;
  const maxWait = options.maxWait;
  
  function invokeFunc() {
    const args = lastArgs;
    lastArgs = null;
    lastInvokeTime = Date.now();
    
    if (args) {
      return fn(...args);
    }
    
    return undefined;
  }
  
  function startTimer(pendingFunc: () => void, wait: number) {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(pendingFunc, wait);
  }
  
  function shouldInvoke() {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    const timeSinceLastInvoke = now - lastInvokeTime;
    
    return (
      lastCallTime === 0 || // First call
      timeSinceLastCall >= wait || // Regular timeout elapsed
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait) // Force invoke if maxWait is reached
    );
  }
  
  function trailingEdge() {
    timeout = null;
    
    if (trailing && lastArgs) {
      return invokeFunc();
    }
    
    lastArgs = null;
    return undefined;
  }
  
  function timerExpired() {
    const now = Date.now();
    const isInvoking = shouldInvoke();
    
    if (isInvoking) {
      return trailingEdge();
    }
    
    // Restart the timer
    if (maxWait !== undefined) {
      const timeSinceLastInvoke = now - lastInvokeTime;
      const timeUntilMaxWait = maxWait - timeSinceLastInvoke;
      const timeUntilWait = wait - (now - lastCallTime);
      
      const remainingWait = Math.min(timeUntilMaxWait, timeUntilWait);
      startTimer(timerExpired, remainingWait);
    } else {
      startTimer(timerExpired, wait - (now - lastCallTime));
    }
    
    return undefined;
  }
  
  function debounced(...args: Parameters<T>): void {
    const now = Date.now();
    lastArgs = args;
    lastCallTime = now;
    
    if (timeout === null) {
      leadingEdge = true;
    }
    
    const isInvoking = shouldInvoke();
    
    if (isInvoking) {
      if (timeout === null) {
        if (leadingEdge && leading) {
          lastInvokeTime = lastCallTime;
          startTimer(timerExpired, wait);
          leadingEdge = false;
          return invokeFunc();
        }
        
        if (maxWait !== undefined) {
          startTimer(timerExpired, maxWait);
        }
      }
      
      if (trailing) {
        startTimer(timerExpired, wait);
      }
      
      return undefined;
    }
    
    if (timeout === null) {
      startTimer(timerExpired, wait);
    }
    
    return undefined;
  }
  
  debounced.cancel = function() {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    lastInvokeTime = 0;
    lastCallTime = 0;
    lastArgs = null;
    timeout = null;
    leadingEdge = false;
  };
  
  return debounced;
}

/**
 * Create a throttled version of a function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): T & { cancel: () => void } {
  return debounce(fn, wait, {
    leading: options.leading ?? true,
    trailing: options.trailing ?? true,
    maxWait: wait
  }) as T & { cancel: () => void };
}
