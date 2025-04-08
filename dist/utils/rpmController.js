/**
 * RPM Controller implementation
 * Optimized for efficient rate limiting with minimal overhead
 */
/**
 * RPMController class for efficient API rate limiting
 * Optimized for:
 * - Precise rate management with token bucket algorithm
 * - Non-blocking waiting with Promise-based design
 * - Efficient time tracking with minimal overhead
 */
export class RPMController {
    maxRPM;
    useTokenBucket;
    bucketSize;
    trackRequestDurations;
    adaptiveRateLimit;
    logger;
    // State tracking
    requestTimestamps = [];
    requestDurations = [];
    tokens;
    lastRefillTime;
    requestQueue = [];
    isProcessingQueue = false;
    consecutiveThrottles = 0;
    constructor(options = {}) {
        this.maxRPM = options.maxRPM ?? 60;
        this.useTokenBucket = options.useTokenBucket ?? true;
        this.bucketSize = options.bucketSize ?? this.maxRPM;
        this.trackRequestDurations = options.trackRequestDurations ?? false;
        this.adaptiveRateLimit = options.adaptiveRateLimit ?? false;
        this.logger = options.logger;
        // Initialize token bucket
        this.tokens = this.bucketSize;
        this.lastRefillTime = Date.now();
    }
    /**
     * Check if a request is within the rate limit
     * If not, wait until it is
     */
    async checkOrWait(priority = 0) {
        if (this.useTokenBucket) {
            return this.checkOrWaitTokenBucket(priority);
        }
        else {
            return this.checkOrWaitFixedWindow(priority);
        }
    }
    /**
     * Track a completed request
     */
    trackRequestCompleted(durationMs) {
        if (this.trackRequestDurations && durationMs != null) {
            this.requestDurations.push(durationMs);
            // Keep only the last 100 durations
            if (this.requestDurations.length > 100) {
                this.requestDurations.shift();
            }
        }
        // Reset consecutive throttles counter
        if (this.consecutiveThrottles > 0) {
            this.consecutiveThrottles = 0;
        }
    }
    /**
     * Track a throttled request
     */
    trackThrottled() {
        if (this.adaptiveRateLimit) {
            this.consecutiveThrottles++;
            // If we've been throttled multiple times in a row, reduce the rate limit
            if (this.consecutiveThrottles >= 3) {
                const oldMaxRPM = this.maxRPM;
                this.maxRPM = Math.max(1, Math.floor(this.maxRPM * 0.8));
                if (this.logger) {
                    this.logger.warn(`Reducing rate limit from ${oldMaxRPM} to ${this.maxRPM} RPM due to consecutive throttles`);
                }
                this.consecutiveThrottles = 0;
            }
        }
    }
    /**
     * Get current RPM based on recent activity
     */
    getCurrentRPM() {
        // Clean up old timestamps
        this.cleanupOldRequests();
        // Calculate current RPM
        return this.requestTimestamps.length;
    }
    /**
     * Get average request duration (if tracking is enabled)
     */
    getAverageRequestDuration() {
        if (!this.trackRequestDurations || this.requestDurations.length === 0) {
            return null;
        }
        const sum = this.requestDurations.reduce((acc, duration) => acc + duration, 0);
        return sum / this.requestDurations.length;
    }
    /**
     * Check or wait using token bucket algorithm
     */
    async checkOrWaitTokenBucket(priority) {
        // Refill tokens based on elapsed time
        this.refillTokens();
        // If we have tokens available, consume one and proceed
        if (this.tokens >= 1) {
            this.tokens -= 1;
            this.requestTimestamps.push(Date.now());
            return;
        }
        // Otherwise, wait in the queue
        return new Promise((resolve) => {
            this.requestQueue.push({
                resolve,
                priority,
                timestamp: Date.now()
            });
            // Start processing the queue if not already
            if (!this.isProcessingQueue) {
                this.processQueue();
            }
        });
    }
    /**
     * Check or wait using fixed window algorithm
     */
    async checkOrWaitFixedWindow(priority) {
        // Clean up old timestamps
        this.cleanupOldRequests();
        // If we're under the limit, proceed
        if (this.requestTimestamps.length < this.maxRPM) {
            this.requestTimestamps.push(Date.now());
            return;
        }
        // Otherwise, wait in the queue
        return new Promise((resolve) => {
            this.requestQueue.push({
                resolve,
                priority,
                timestamp: Date.now()
            });
            // Start processing the queue if not already
            if (!this.isProcessingQueue) {
                this.processQueue();
            }
        });
    }
    /**
     * Refill tokens in the token bucket based on elapsed time
     */
    refillTokens() {
        const now = Date.now();
        const elapsedMs = now - this.lastRefillTime;
        if (elapsedMs <= 0) {
            return;
        }
        // Calculate tokens to add based on elapsed time
        // Rate of token refill is maxRPM per minute = maxRPM / 60000 per millisecond
        const tokensToAdd = (elapsedMs / 60000) * this.maxRPM;
        this.tokens = Math.min(this.bucketSize, this.tokens + tokensToAdd);
        this.lastRefillTime = now;
    }
    /**
     * Clean up request timestamps older than 1 minute
     */
    cleanupOldRequests() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        // Remove timestamps older than 1 minute
        this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp >= oneMinuteAgo);
    }
    /**
     * Process the request queue
     */
    async processQueue() {
        if (this.requestQueue.length === 0) {
            this.isProcessingQueue = false;
            return;
        }
        this.isProcessingQueue = true;
        // Sort queue by priority (higher priority first) and then by timestamp (oldest first)
        this.requestQueue.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            return a.timestamp - b.timestamp;
        });
        // Check if we can process the next request
        let canProcess = false;
        if (this.useTokenBucket) {
            this.refillTokens();
            canProcess = this.tokens >= 1;
            if (canProcess) {
                this.tokens -= 1;
            }
        }
        else {
            this.cleanupOldRequests();
            canProcess = this.requestTimestamps.length < this.maxRPM;
        }
        if (canProcess) {
            // Process the highest priority request
            const request = this.requestQueue.shift();
            this.requestTimestamps.push(Date.now());
            request.resolve();
            // Process the next request after a small delay
            setTimeout(() => this.processQueue(), 50);
        }
        else {
            // Wait and try again
            const waitTime = this.calculateWaitTime();
            if (this.logger && this.requestQueue.length > 5) {
                this.logger.info(`Rate limit reached. Waiting ${waitTime}ms with ${this.requestQueue.length} requests in queue`);
            }
            setTimeout(() => this.processQueue(), waitTime);
        }
    }
    /**
     * Calculate wait time before processing the next request
     */
    calculateWaitTime() {
        if (this.useTokenBucket) {
            // Calculate time until next token is available
            // Each token becomes available at rate of 60000 / maxRPM milliseconds
            return Math.ceil(60000 / this.maxRPM);
        }
        else {
            // For fixed window, find the oldest timestamp and calculate when it expires
            const now = Date.now();
            const oneMinuteAgo = now - 60000;
            // Find the oldest timestamp in the window
            const oldestTimestamp = Math.min(...this.requestTimestamps);
            // Calculate when it will be outside the window
            const timeUntilExpiry = Math.max(0, oldestTimestamp - oneMinuteAgo + 50); // Add small buffer
            return timeUntilExpiry;
        }
    }
}
//# sourceMappingURL=rpmController.js.map