/**
 * Error handling system implementation
 * Optimized for efficient error management with contextual information
 */

/**
 * Base error class for all CrewAI errors
 * Provides consistent error structure and handling
 */
export class CrewAIError extends Error {
  /**
   * Error code for programmatic handling
   */
  public code: string;
  
  /**
   * HTTP status code (if applicable)
   */
  public status?: number;
  
  /**
   * Additional contextual information
   */
  public context: Record<string, any>;
  
  /**
   * Whether this error is retryable
   */
  public retryable: boolean;
  
  /**
   * Original error if this is a wrapped error
   */
  public override cause?: Error;
  
  /**
   * Create a new CrewAIError instance
   */
  constructor(message: string, options?: {
    code?: string;
    status?: number;
    context?: Record<string, any>;
    retryable?: boolean;
    cause?: Error;
  }) {
    super(message);
    
    // Set name to the class name for better debugging
    this.name = this.constructor.name;
    
    // Set error properties
    this.code = options?.code ?? 'CREW_ERROR';
    this.status = options?.status;
    this.context = options?.context ?? {};
    this.retryable = options?.retryable ?? false;
    this.cause = options?.cause;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // Handle cause for better stack traces
    if (this.cause && this.cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${this.cause.stack}`;
    }
  }
  
  /**
   * Convert error to JSON for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      context: this.context,
      retryable: this.retryable,
      stack: this.stack,
      cause: this.cause ? (
        // Check if cause has a toJSON method that's a function
        'toJSON' in this.cause && typeof (this.cause as any).toJSON === 'function'
          ? (this.cause as any).toJSON()
          : { message: this.cause.message, stack: this.cause.stack }
      ) : undefined
    };
  }
  
  /**
   * Get a string representation of the error
   * @override
   */
  override toString(): string {
    let result = `${this.name}: ${this.message}`;
    
    if (Object.keys(this.context).length > 0) {
      result += ` (${JSON.stringify(this.context)})`;
    }
    
    return result;
  }
}

/**
 * Validation error - thrown when input validation fails
 */
export class ValidationError extends CrewAIError {
  constructor(message: string, options?: {
    context?: Record<string, any>;
    cause?: Error;
  }) {
    super(message, {
      code: 'VALIDATION_ERROR',
      status: 400,
      retryable: false,
      ...options
    });
  }
}

/**
 * Configuration error - thrown when there's an issue with configuration
 */
export class ConfigurationError extends CrewAIError {
  constructor(message: string, options?: {
    context?: Record<string, any>;
    cause?: Error;
  }) {
    super(message, {
      code: 'CONFIGURATION_ERROR',
      status: 500,
      retryable: false,
      ...options
    });
  }
}

/**
 * LLM error - thrown when there's an issue with LLM interaction
 */
export class LLMError extends CrewAIError {
  constructor(message: string, options?: {
    context?: Record<string, any>;
    cause?: Error;
    retryable?: boolean;
  }) {
    super(message, {
      code: 'LLM_ERROR',
      status: 502,
      retryable: options?.retryable ?? true,  // LLM errors are often retryable
      ...options
    });
  }
}

/**
 * Rate limit error - thrown when rate limits are exceeded
 */
export class RateLimitError extends CrewAIError {
  constructor(message: string, options?: {
    context?: Record<string, any>;
    cause?: Error;
    retryAfterMs?: number;
  }) {
    super(message, {
      code: 'RATE_LIMIT_ERROR',
      status: 429,
      retryable: true,
      context: {
        retryAfterMs: options?.retryAfterMs,
        ...options?.context
      },
      cause: options?.cause
    });
  }
  
  /**
   * Get the recommended retry delay
   */
  getRetryAfterMs(): number {
    return this.context.retryAfterMs ?? 1000;
  }
}

/**
 * Memory error - thrown when there's an issue with memory operations
 */
export class MemoryError extends CrewAIError {
  constructor(message: string, options?: {
    context?: Record<string, any>;
    cause?: Error;
  }) {
    super(message, {
      code: 'MEMORY_ERROR',
      status: 500,
      retryable: false,
      ...options
    });
  }
}

/**
 * Task execution error - thrown when task execution fails
 */
export class TaskExecutionError extends CrewAIError {
  constructor(message: string, options?: {
    context?: Record<string, any>;
    cause?: Error;
    taskId?: string;
    agentId?: string;
  }) {
    super(message, {
      code: 'TASK_EXECUTION_ERROR',
      status: 500,
      retryable: false,
      context: {
        taskId: options?.taskId,
        agentId: options?.agentId,
        ...options?.context
      },
      cause: options?.cause
    });
  }
}

/**
 * Tool execution error - thrown when tool execution fails
 */
export class ToolExecutionError extends CrewAIError {
  constructor(message: string, options?: {
    context?: Record<string, any>;
    cause?: Error;
    toolName?: string;
  }) {
    super(message, {
      code: 'TOOL_EXECUTION_ERROR',
      status: 500,
      retryable: false,
      context: {
        toolName: options?.toolName,
        ...options?.context
      },
      cause: options?.cause
    });
  }
}

/**
 * Timeout error - thrown when an operation times out
 */
export class TimeoutError extends CrewAIError {
  constructor(message: string, options?: {
    context?: Record<string, any>;
    cause?: Error;
    operationName?: string;
    timeoutMs?: number;
  }) {
    super(message, {
      code: 'TIMEOUT_ERROR',
      status: 408,
      retryable: true,
      context: {
        operationName: options?.operationName,
        timeoutMs: options?.timeoutMs,
        ...options?.context
      },
      cause: options?.cause
    });
  }
}

/**
 * Authentication error - thrown when authentication fails
 */
export class AuthenticationError extends CrewAIError {
  constructor(message: string, options?: {
    context?: Record<string, any>;
    cause?: Error;
  }) {
    super(message, {
      code: 'AUTHENTICATION_ERROR',
      status: 401,
      retryable: false,
      ...options
    });
  }
}

/**
 * Authorization error - thrown when authorization fails
 */
export class AuthorizationError extends CrewAIError {
  constructor(message: string, options?: {
    context?: Record<string, any>;
    cause?: Error;
  }) {
    super(message, {
      code: 'AUTHORIZATION_ERROR',
      status: 403,
      retryable: false,
      ...options
    });
  }
}

/**
 * Network error - thrown when network operations fail
 */
export class NetworkError extends CrewAIError {
  constructor(message: string, options?: {
    context?: Record<string, any>;
    cause?: Error;
  }) {
    super(message, {
      code: 'NETWORK_ERROR',
      status: 503,
      retryable: true,
      ...options
    });
  }
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
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const backoffFactor = options.backoffFactor ?? 2;
  const maxDelayMs = options.maxDelayMs ?? 30000;
  const jitter = options.jitter ?? 0.2;
  const retryPredicate = options.retryPredicate ?? ((error: any) => {
    return error?.retryable === true;
  });
  const onRetry = options.onRetry;
  
  let attempt = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      // If we've reached max retries or the error is not retryable, throw
      if (attempt >= maxRetries || !retryPredicate(error)) {
        throw error;
      }
      
      // Calculate backoff delay with jitter
      const backoffMs = Math.min(
        maxDelayMs,
        initialDelayMs * Math.pow(backoffFactor, attempt - 1)
      );
      
      // Add jitter (random variance) to prevent thundering herd
      const jitterMs = backoffMs * jitter * (Math.random() * 2 - 1);
      const delayMs = Math.max(0, Math.floor(backoffMs + jitterMs));
      
      // Call retry callback if provided
      if (onRetry) {
        await Promise.resolve(onRetry(error, attempt, delayMs));
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Error boundary for handling errors in async contexts
 */
export async function errorBoundary<T>(
  fn: () => Promise<T>,
  options?: {
    onError?: (error: any) => void | Promise<void>;
    fallback?: T | (() => T | Promise<T>);
  }
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Call error handler if provided
    if (options?.onError) {
      await Promise.resolve(options.onError(error));
    }
    
    // Return fallback value if provided
    if (options?.fallback !== undefined) {
      if (typeof options.fallback === 'function') {
        return await Promise.resolve((options.fallback as Function)());
      }
      return options.fallback as T;
    }
    
    // Re-throw the error
    throw error;
  }
}
