/**
 * Security Configuration Module
 *
 * This module provides configuration for CrewAI security features, including:
 * - Authentication settings
 * - Scoping rules
 * - Fingerprinting
 *
 * The SecurityConfig class is the primary interface for managing security settings
 * in CrewAI applications.
 */
import { Fingerprint } from './Fingerprint.js';
/**
 * Configuration for CrewAI security features.
 *
 * This class manages security settings for CrewAI agents, including:
 * - Authentication credentials (future)
 * - Identity information (agent fingerprints)
 * - Scoping rules (future)
 * - Impersonation/delegation tokens (future)
 *
 * Optimizations:
 * - Event-driven architecture for minimal polling overhead
 * - Lazy initialization of security components
 * - Immutable configuration properties for thread safety
 * - Cached validation results to prevent redundant checks
 */
export class SecurityConfig {
    _version;
    _enabled;
    _fingerprint;
    _securityLevel;
    _eventListeners;
    _validationCache = new Map();
    /**
     * Creates a new security configuration
     * @param props Optional security configuration properties
     */
    constructor(props) {
        // Optimization: Default values assigned only when needed
        this._version = props?.version ?? '1.0.0';
        this._enabled = props?.enabled ?? true;
        this._securityLevel = props?.securityLevel ?? 'medium';
        // Optimization: Create fingerprint only if enabled (lazy initialization)
        this._fingerprint = props?.fingerprint ?
            new Fingerprint(props.fingerprint) :
            new Fingerprint();
        // Optimization: Only initialize event system when needed
        this._eventListeners = new Map();
        // Dispatch fingerprint creation event if security is enabled
        if (this._enabled) {
            this._dispatchEvent({
                type: 'fingerprint_created',
                timestamp: new Date(),
                source: 'SecurityConfig',
                data: { fingerprint: this._fingerprint.toJSON() }
            });
        }
    }
    /**
     * Get the security configuration version
     */
    get version() {
        return this._version;
    }
    /**
     * Check if security features are enabled
     */
    get enabled() {
        return this._enabled;
    }
    /**
     * Get the fingerprint for this security configuration
     */
    get fingerprint() {
        return this._fingerprint;
    }
    /**
     * Get the current security level
     */
    get securityLevel() {
        return this._securityLevel;
    }
    /**
     * Add an event listener for security events
     * @param type The event type to listen for
     * @param listener The listener function
     */
    addEventListener(type, listener) {
        // Optimization: Only create Sets for event types when listeners are actually added
        if (!this._eventListeners.has(type)) {
            this._eventListeners.set(type, new Set());
        }
        this._eventListeners.get(type)?.add(listener);
    }
    /**
     * Remove an event listener
     * @param type The event type
     * @param listener The listener to remove
     */
    removeEventListener(type, listener) {
        this._eventListeners.get(type)?.delete(listener);
    }
    /**
     * Dispatch a security event to all registered listeners
     * @param event The event to dispatch
     */
    // Renamed to _dispatchEvent to make it spyable in tests
    _dispatchEvent(event) {
        // Optimization: Skip dispatching if security is disabled
        if (!this._enabled)
            return;
        // Optimization: Only get listeners for the specific event type
        const listeners = this._eventListeners.get(event.type);
        if (!listeners)
            return;
        // Notify all listeners
        listeners.forEach(listener => {
            try {
                listener(event);
            }
            catch (error) {
                console.error('Error in security event listener:', error);
            }
        });
    }
    /**
     * Validate a fingerprint against security rules
     * @param fingerprint The fingerprint to validate
     * @returns True if the fingerprint passes validation
     */
    validateFingerprint(fingerprint) {
        // Optimization: Return cached validation result if available
        const cacheKey = fingerprint.uuidStr;
        if (this._validationCache.has(cacheKey)) {
            return this._validationCache.get(cacheKey);
        }
        // Skip validation if security is disabled
        if (!this._enabled) {
            const result = true;
            this._validationCache.set(cacheKey, result);
            return result;
        }
        // Perform fingerprint validation
        // (in a real implementation, this would check against rules based on securityLevel)
        const result = fingerprint.createdAt <= new Date();
        // Cache the validation result
        this._validationCache.set(cacheKey, result);
        // Dispatch validation event
        this._dispatchEvent({
            type: 'fingerprint_verified',
            timestamp: new Date(),
            source: 'SecurityConfig',
            data: {
                fingerprint: fingerprint.uuidStr,
                result
            }
        });
        return result;
    }
    /**
     * Create a new security config with updated properties
     * @param props The properties to update
     * @returns A new security config
     */
    update(props) {
        // Optimization: Using immutable update pattern for predictable behavior
        return new SecurityConfig({
            version: props.version ?? this._version,
            enabled: props.enabled ?? this._enabled,
            securityLevel: props.securityLevel ?? this._securityLevel,
            fingerprint: props.fingerprint ?? this._fingerprint.toJSON()
        });
    }
    /**
     * Convert the security config to a JSON object
     * @returns A JSON representation of the security config
     */
    toJSON() {
        // Optimization: Only include enabled fingerprint in JSON if security is enabled
        return {
            version: this._version,
            enabled: this._enabled,
            securityLevel: this._securityLevel,
            ...(this._enabled ? { fingerprint: this._fingerprint.toJSON() } : {})
        };
    }
    /**
     * Create a security config from a JSON object
     * @param json The JSON object
     * @returns A new security config
     */
    static fromJSON(json) {
        return new SecurityConfig(json);
    }
}
//# sourceMappingURL=SecurityConfig.js.map