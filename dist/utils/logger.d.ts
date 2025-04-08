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
export declare class Logger {
    private static levelPriority;
    private minLevel;
    private async;
    private context;
    private formatter;
    private transports;
    private enableTracing;
    private traceId?;
    private buffer;
    private isFlushPending;
    constructor(options?: LoggerOptions);
    /**
     * Create a child logger with additional context
     */
    child(context: Record<string, any>): Logger;
    /**
     * Log a message at the specified level
     */
    log(level: LogLevel, message: string, context?: Record<string, any>): void;
    /**
     * Log a debug message
     */
    debug(message: string, context?: Record<string, any>): void;
    /**
     * Log an info message
     */
    info(message: string, context?: Record<string, any>): void;
    /**
     * Log a warning message
     */
    warn(message: string, context?: Record<string, any>): void;
    /**
     * Log an error message
     */
    error(message: string, error?: Error, context?: Record<string, any>): void;
    /**
     * Set the minimum log level
     */
    setMinLevel(level: LogLevel): void;
    /**
     * Add a transport
     */
    addTransport(transport: LogTransport): void;
    /**
     * Flush the log buffer
     */
    flush(): Promise<void>;
    /**
     * Default formatter for log entries
     */
    private defaultFormatter;
    /**
     * Console transport for log entries
     */
    private consoleTransport;
    /**
     * Process a log entry through all transports
     */
    private processLogEntry;
    /**
     * Schedule a buffer flush
     */
    private scheduleFlush;
    /**
     * Generate a trace ID for request tracking
     */
    private generateTraceId;
}
/**
 * Create a global logger instance
 */
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map