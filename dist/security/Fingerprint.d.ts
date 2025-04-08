/**
 * Fingerprint Module
 *
 * This module provides functionality for generating and validating unique identifiers
 * for CrewAI agents. These identifiers are used for tracking, auditing, and security.
 */
import { FingerprintProps, MetadataRecord } from './types.js';
/**
 * A class for generating and managing unique identifiers for agents.
 *
 * Each agent has dual identifiers:
 * - Human-readable ID: For debugging and reference (derived from role if not specified)
 * - Fingerprint UUID: Unique runtime identifier for tracking and auditing
 *
 * Optimizations:
 * - Lazy initialization of UUID and timestamps for more efficient instantiation
 * - Immutable properties to prevent unexpected state mutations
 * - Metadata caching to prevent redundant serialization/deserialization
 * - Optimized equality comparison for fast validation
 */
export declare class Fingerprint {
    private readonly _uuidStr;
    private readonly _createdAt;
    private readonly _metadata;
    private _metadataCache;
    /**
     * Creates a new fingerprint with optional custom properties
     * @param props Optional fingerprint properties
     */
    constructor(props?: FingerprintProps);
    /**
     * Get the UUID string for this fingerprint
     */
    get uuidStr(): string;
    /**
     * Get the creation date for this fingerprint
     */
    get createdAt(): Date;
    /**
     * Get the metadata associated with this fingerprint
     * Returns a copy to prevent external mutation
     */
    get metadata(): MetadataRecord;
    /**
     * Add metadata to the fingerprint
     * @param key The metadata key
     * @param value The metadata value
     * @returns A new fingerprint instance with the added metadata
     */
    addMetadata(key: string, value: any): Fingerprint;
    /**
     * Checks if this fingerprint matches another fingerprint
     * @param other The other fingerprint to compare
     * @returns True if the fingerprints match
     */
    matches(other: Fingerprint): boolean;
    /**
     * Convert the fingerprint to a JSON object
     * @returns A JSON representation of the fingerprint
     */
    toJSON(): FingerprintProps;
    /**
     * Convert the fingerprint to a string
     * @returns String representation of the fingerprint
     */
    toString(): string;
    /**
     * Create a fingerprint from a JSON object
     * @param json The JSON object
     * @returns A new fingerprint
     */
    static fromJSON(json: FingerprintProps): Fingerprint;
}
//# sourceMappingURL=Fingerprint.d.ts.map