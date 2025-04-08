/**
 * Logger implementation
 * Optimized for efficient and structured logging with minimal overhead
 */
/**
 * Logger class for efficient and structured logging
 * Optimized for:
 * - Minimal overhead with async logging
 * - Structured log format for machine processing
 * - Context propagation across log entries
 */
export class Logger {
    static levelPriority = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    };
    minLevel;
    async;
    context;
    formatter;
    transports;
    enableTracing;
    traceId;
    buffer = [];
    isFlushPending = false;
    constructor(options = {}) {
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
    child(context) {
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
    log(level, message, context) {
        // Check if this level should be logged
        if (Logger.levelPriority[level] < Logger.levelPriority[this.minLevel]) {
            return;
        }
        // Create log entry
        const entry = {
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
        }
        else {
            // Log synchronously
            this.processLogEntry(entry);
        }
    }
    /**
     * Log a debug message
     */
    debug(message, context) {
        this.log('debug', message, context);
    }
    /**
     * Log an info message
     */
    info(message, context) {
        this.log('info', message, context);
    }
    /**
     * Log a warning message
     */
    warn(message, context) {
        this.log('warn', message, context);
    }
    /**
     * Log an error message
     */
    error(message, error, context) {
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
    setMinLevel(level) {
        this.minLevel = level;
    }
    /**
     * Add a transport
     */
    addTransport(transport) {
        this.transports.push(transport);
    }
    /**
     * Flush the log buffer
     */
    async flush() {
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
    defaultFormatter(entry) {
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
    consoleTransport(entry) {
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
    async processLogEntry(entry) {
        for (const transport of this.transports) {
            try {
                await transport.call(this, entry);
            }
            catch (error) {
                // Avoid recursive error logging
                console.error(`Failed to log message: ${error}`);
            }
        }
    }
    /**
     * Schedule a buffer flush
     */
    scheduleFlush() {
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
    generateTraceId() {
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
//# sourceMappingURL=logger.js.map