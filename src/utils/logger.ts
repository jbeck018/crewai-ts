/**
 * Logger implementation
 * Optimized for efficient and structured logging with minimal overhead
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  traceId?: string;
}

export type LogFormatter = (entry: LogEntry) => string;
export type LogTransport = (entry: LogEntry) => void | Promise<void>;

export interface LoggerOptions {
  /**
   * Minimum log level to output
   * @default 'info'
   */
  minLevel?: LogLevel;
  
  /**
   * Whether to log asynchronously
   * @default true
   */
  async?: boolean;
  
  /**
   * Context to include with all log entries
   */
  context?: Record<string, any>;
  
  /**
   * Custom formatter for log entries
   */
  formatter?: LogFormatter;
  
  /**
   * Custom transports for log entries
   */
  transports?: LogTransport[];
  
  /**
   * Enable trace ID generation for request tracking
   * @default true
   */
  enableTracing?: boolean;
}

/**
 * Logger class for efficient and structured logging
 * Optimized for:
 * - Minimal overhead with async logging
 * - Structured log format for machine processing
 * - Context propagation across log entries
 */
export class Logger {
  private static levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  
  private minLevel: LogLevel;
  private async: boolean;
  private context: Record<string, any>;
  private formatter: LogFormatter;
  private transports: LogTransport[];
  private enableTracing: boolean;
  private traceId?: string;
  private buffer: LogEntry[] = [];
  private isFlushPending = false;
  
  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel ?? 'info';
    this.async = options.async ?? true;
    this.context = options.context ?? {};
    this.formatter = options.formatter ?? this.defaultFormatter;
    this.transports = options.transports ?? [this.consoleTransport];
    this.enableTracing = options.enableTracing ?? true;
    
    if (this.enableTracing) {
      this.traceId = this.generateTraceId();
    }
  }
  
  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger({
      minLevel: this.minLevel,
      async: this.async,
      context: { ...this.context, ...context },
      formatter: this.formatter,
      transports: this.transports,
      enableTracing: this.enableTracing
    });
    
    // Inherit trace ID from parent
    if (this.traceId) {
      childLogger.traceId = this.traceId;
    }
    
    return childLogger;
  }
  
  /**
   * Log a message at the specified level
   */
  log(level: LogLevel, message: string, context?: Record<string, any>): void {
    // Check if this level should be logged
    if (Logger.levelPriority[level] < Logger.levelPriority[this.minLevel]) {
      return;
    }
    
    // Create log entry
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: context ? { ...this.context, ...context } : this.context,
      traceId: this.traceId
    };
    
    if (this.async) {
      // Add to buffer and schedule flush
      this.buffer.push(entry);
      this.scheduleFlush();
    } else {
      // Log synchronously
      this.processLogEntry(entry);
    }
  }
  
  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }
  
  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }
  
  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }
  
  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    const errorContext = error ? {
      errorName: error.name,
      errorMessage: error.message,
      stackTrace: error.stack,
      ...context
    } : context;
    
    this.log('error', message, errorContext);
  }
  
  /**
   * Set the minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }
  
  /**
   * Add a transport
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }
  
  /**
   * Flush the log buffer
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      this.isFlushPending = false;
      return;
    }
    
    // Get all entries and clear buffer
    const entries = [...this.buffer];
    this.buffer = [];
    this.isFlushPending = false;
    
    // Process entries
    await Promise.all(entries.map(entry => this.processLogEntry(entry)));
  }
  
  /**
   * Default formatter for log entries
   */
  private defaultFormatter(entry: LogEntry): string {
    const { level, message, timestamp, context, traceId } = entry;
    const levelPadded = level.toUpperCase().padEnd(5);
    
    let formatted = `[${timestamp}] ${levelPadded} ${message}`;
    
    if (traceId) {
      formatted += ` (trace: ${traceId})`;
    }
    
    if (context && Object.keys(context).length > 0) {
      formatted += `\n${JSON.stringify(context, null, 2)}`;
    }
    
    return formatted;
  }
  
  /**
   * Console transport for log entries
   */
  private consoleTransport(entry: LogEntry): void {
    const formatted = this.formatter(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }
  
  /**
   * Process a log entry through all transports
   */
  private async processLogEntry(entry: LogEntry): Promise<void> {
    for (const transport of this.transports) {
      try {
        await transport.call(this, entry);
      } catch (error) {
        // Avoid recursive error logging
        console.error(`Failed to log message: ${error}`);
      }
    }
  }
  
  /**
   * Schedule a buffer flush
   */
  private scheduleFlush(): void {
    if (this.isFlushPending) {
      return;
    }
    
    this.isFlushPending = true;
    
    // Use queueMicrotask for more efficient scheduling than setTimeout(0)
    queueMicrotask(() => {
      this.flush().catch(error => {
        console.error('Failed to flush log buffer:', error);
      });
    });
  }
  
  /**
   * Generate a trace ID for request tracking
   */
  private generateTraceId(): string {
    // Simple implementation - in production, consider using a more robust algorithm
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${random}`;
  }
}

/**
 * Create a global logger instance
 */
export const logger = new Logger();
