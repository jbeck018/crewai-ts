/**
 * Security Module Types
 *
 * This file contains type definitions for the security module.
 */

export interface MetadataRecord {
  [key: string]: any;
}

/**
 * Fingerprint interface representing a unique identifier for components
 * Optimized with read-only properties to encourage immutability
 */
export interface FingerprintProps {
  readonly uuidStr?: string;
  readonly createdAt?: Date;
  readonly metadata?: MetadataRecord;
}

/**
 * Security configuration properties interface
 * Uses optional properties for memory-efficient instantiation
 */
export interface SecurityConfigProps {
  readonly version?: string;
  readonly enabled?: boolean;
  readonly fingerprint?: FingerprintProps;
  readonly securityLevel?: 'low' | 'medium' | 'high';
}

/**
 * Security event types for the event dispatching system
 * Using a string literal union for type safety and optimization
 */
export type SecurityEventType = 
  | 'authentication'
  | 'authorization'
  | 'fingerprint_created'
  | 'fingerprint_verified'
  | 'security_violation';

/**
 * Security event interface for the event system
 * Designed for minimal memory footprint when dispatching events
 */
export interface SecurityEvent {
  readonly type: SecurityEventType;
  readonly timestamp: Date;
  readonly source?: string;
  readonly data?: Record<string, unknown>;
}
