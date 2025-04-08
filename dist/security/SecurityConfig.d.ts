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
import { SecurityConfigProps, SecurityEvent, SecurityEventType } from './types.js';
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
export declare class SecurityConfig {
    private readonly _version;
    private readonly _enabled;
    private readonly _fingerprint;
    private readonly _securityLevel;
    private readonly _eventListeners;
    private _validationCache;
    /**
     * Creates a new security configuration
     * @param props Optional security configuration properties
     */
    constructor(props?: SecurityConfigProps);
    /**
     * Get the security configuration version
     */
    get version(): string;
    /**
     * Check if security features are enabled
     */
    get enabled(): boolean;
    /**
     * Get the fingerprint for this security configuration
     */
    get fingerprint(): Fingerprint;
    /**
     * Get the current security level
     */
    get securityLevel(): 'low' | 'medium' | 'high';
    /**
     * Add an event listener for security events
     * @param type The event type to listen for
     * @param listener The listener function
     */
    addEventListener(type: SecurityEventType, listener: (event: SecurityEvent) => void): void;
    /**
     * Remove an event listener
     * @param type The event type
     * @param listener The listener to remove
     */
    removeEventListener(type: SecurityEventType, listener: (event: SecurityEvent) => void): void;
    /**
     * Dispatch a security event to all registered listeners
     * @param event The event to dispatch
     */
    private _dispatchEvent;
    /**
     * Validate a fingerprint against security rules
     * @param fingerprint The fingerprint to validate
     * @returns True if the fingerprint passes validation
     */
    validateFingerprint(fingerprint: Fingerprint): boolean;
    /**
     * Create a new security config with updated properties
     * @param props The properties to update
     * @returns A new security config
     */
    update(props: Partial<SecurityConfigProps>): SecurityConfig;
    /**
     * Convert the security config to a JSON object
     * @returns A JSON representation of the security config
     */
    toJSON(): SecurityConfigProps;
    /**
     * Create a security config from a JSON object
     * @param json The JSON object
     * @returns A new security config
     */
    static fromJSON(json: SecurityConfigProps): SecurityConfig;
}
//# sourceMappingURL=SecurityConfig.d.ts.map