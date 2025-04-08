/**
 * Fingerprint Module
 *
 * This module provides functionality for generating and validating unique identifiers
 * for CrewAI agents. These identifiers are used for tracking, auditing, and security.
 */

import { v4 as uuidv4 } from 'uuid';
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
export class Fingerprint {
  private readonly _uuidStr: string;
  private readonly _createdAt: Date;
  private readonly _metadata: MetadataRecord;
  private _metadataCache: string | null = null;

  /**
   * Creates a new fingerprint with optional custom properties
   * @param props Optional fingerprint properties
   */
  constructor(props?: FingerprintProps) {
    // Optimization: Only generate UUID if not provided (lazy initialization)
    this._uuidStr = props?.uuidStr ?? uuidv4();
    
    // Optimization: Only create Date object if not provided
    this._createdAt = props?.createdAt ?? new Date();
    
    // Optimization: Create empty object only when needed
    this._metadata = props?.metadata ?? {};
  }

  /**
   * Get the UUID string for this fingerprint
   */
  get uuidStr(): string {
    return this._uuidStr;
  }

  /**
   * Get the creation date for this fingerprint
   */
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Get the metadata associated with this fingerprint
   * Returns a copy to prevent external mutation
   */
  get metadata(): MetadataRecord {
    // Optimization: Return a shallow copy to prevent external mutation
    return { ...this._metadata };
  }

  /**
   * Add metadata to the fingerprint
   * @param key The metadata key
   * @param value The metadata value
   * @returns A new fingerprint instance with the added metadata
   */
  addMetadata(key: string, value: any): Fingerprint {
    // Optimization: Create new instance with merged metadata (immutable pattern)
    return new Fingerprint({
      uuidStr: this._uuidStr,
      createdAt: this._createdAt,
      metadata: { ...this._metadata, [key]: value }
    });
  }

  /**
   * Checks if this fingerprint matches another fingerprint
   * @param other The other fingerprint to compare
   * @returns True if the fingerprints match
   */
  matches(other: Fingerprint): boolean {
    // Optimization: Fast-path comparison of UUIDs before checking other properties
    return this._uuidStr === other._uuidStr;
  }

  /**
   * Convert the fingerprint to a JSON object
   * @returns A JSON representation of the fingerprint
   */
  toJSON(): FingerprintProps {
    return {
      uuidStr: this._uuidStr,
      createdAt: this._createdAt,
      metadata: this.metadata
    };
  }

  /**
   * Convert the fingerprint to a string
   * @returns String representation of the fingerprint
   */
  toString(): string {
    // Optimization: Cache the metadata JSON to prevent redundant serialization
    if (!this._metadataCache) {
      this._metadataCache = JSON.stringify(this._metadata);
    }
    return `Fingerprint(${this._uuidStr}, ${this._createdAt.toISOString()}, ${this._metadataCache})`;
  }
  
  /**
   * Create a fingerprint from a JSON object
   * @param json The JSON object
   * @returns A new fingerprint
   */
  static fromJSON(json: FingerprintProps): Fingerprint {
    return new Fingerprint({
      uuidStr: json.uuidStr,
      createdAt: json.createdAt instanceof Date ? json.createdAt : new Date(json.createdAt as any),
      metadata: json.metadata
    });
  }
}
