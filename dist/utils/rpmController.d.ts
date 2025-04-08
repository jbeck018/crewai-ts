/**
 * RPM Controller implementation
 * Optimized for efficient rate limiting with minimal overhead
 */
/**
 * Options for configuring RPM Controller behavior
 */
export interface RPMControllerOptions {
    /**
     * Maximum requests per minute
     * @default 60
     */
    maxRPM?: number;
    /**
     * Whether to use token bucket algorithm (more precise but higher overhead)
     * @default true
     */
    useTokenBucket?: boolean;
    /**
     * Size of the token bucket (only relevant if useTokenBucket is true)
     * @default Same as maxRPM
     */
    bucketSize?: number;
    /**
     * Whether to track request durations for analytics
     * @default false
     */
    trackRequestDurations?: boolean;
    /**
     * Whether to dynamically adjust rates based on service responses
     * @default false
     */
    adaptiveRateLimit?: boolean;
    /**
     * Optional logger instance for RPM Controller events
     */
    logger?: {
        info: (msg: string) => void;
        warn: (msg: string) => void;
    };
}
/**
 * RPMController class for efficient API rate limiting
 * Optimized for:
 * - Precise rate management with token bucket algorithm
 * - Non-blocking waiting with Promise-based design
 * - Efficient time tracking with minimal overhead
 */
export declare class RPMController {
    private maxRPM;
    private useTokenBucket;
    private bucketSize;
    private trackRequestDurations;
    private adaptiveRateLimit;
    private logger?;
    private requestTimestamps;
    private requestDurations;
    private tokens;
    private lastRefillTime;
    private requestQueue;
    private isProcessingQueue;
    private consecutiveThrottles;
    constructor(options?: RPMControllerOptions);
    /**
     * Check if a request is within the rate limit
     * If not, wait until it is
     */
    checkOrWait(priority?: number): Promise<void>;
    /**
     * Track a completed request
     */
    trackRequestCompleted(durationMs?: number): void;
    /**
     * Track a throttled request
     */
    trackThrottled(): void;
    /**
     * Get current RPM based on recent activity
     */
    getCurrentRPM(): number;
    /**
     * Get average request duration (if tracking is enabled)
     */
    getAverageRequestDuration(): number | null;
    /**
     * Check or wait using token bucket algorithm
     */
    private checkOrWaitTokenBucket;
    /**
     * Check or wait using fixed window algorithm
     */
    private checkOrWaitFixedWindow;
    /**
     * Refill tokens in the token bucket based on elapsed time
     */
    private refillTokens;
    /**
     * Clean up request timestamps older than 1 minute
     */
    private cleanupOldRequests;
    /**
     * Process the request queue
     */
    private processQueue;
    /**
     * Calculate wait time before processing the next request
     */
    private calculateWaitTime;
}
//# sourceMappingURL=rpmController.d.ts.map