/**
 * Fingerprint Tests
 * 
 * Optimized test suite for the Fingerprint component with performance considerations
 */

import { describe, it, expect } from 'vitest';
import { Fingerprint } from '../../src/security/Fingerprint';

describe('Fingerprint', () => {
  // Performance optimization: Pre-create test data to avoid redundant object creation
  const testUuid = '12345678-1234-5678-1234-567812345678';
  const testDate = new Date(2023, 0, 1);
  const testMetadata = { key1: 'value1', key2: 'value2' };

  // Create a reusable fingerprint instance for tests that don't modify state
  const createTestFingerprint = () => new Fingerprint({
    uuidStr: testUuid,
    createdAt: testDate,
    metadata: testMetadata
  });

  describe('creation', () => {
    it('should create a fingerprint with default values', () => {
      const fingerprint = new Fingerprint();
      
      // Validate UUID format without regex for better performance
      expect(fingerprint.uuidStr).toBeDefined();
      expect(fingerprint.uuidStr.length).toBe(36);
      expect(fingerprint.uuidStr.split('-').length).toBe(5);
      
      expect(fingerprint.createdAt).toBeInstanceOf(Date);
      expect(fingerprint.metadata).toEqual({});
    });

    it('should create a fingerprint with custom values', () => {
      const fingerprint = createTestFingerprint();
      
      expect(fingerprint.uuidStr).toBe(testUuid);
      expect(fingerprint.createdAt).toEqual(testDate);
      expect(fingerprint.metadata).toEqual(testMetadata);
    });
  });

  describe('metadata management', () => {
    it('should return a copy of metadata to prevent external mutation', () => {
      const fingerprint = createTestFingerprint();
      const metadata = fingerprint.metadata;
      
      // Mutation should not affect the internal state
      metadata.key1 = 'modified';
      
      expect(fingerprint.metadata.key1).toBe('value1');
    });

    it('should create a new instance when adding metadata', () => {
      const fingerprint = createTestFingerprint();
      const newFingerprint = fingerprint.addMetadata('key3', 'value3');
      
      // Original should be unchanged
      expect(fingerprint.metadata).toEqual(testMetadata);
      
      // New fingerprint should have the added metadata
      expect(newFingerprint.metadata).toEqual({
        ...testMetadata,
        key3: 'value3'
      });
      
      // Core properties should be maintained
      expect(newFingerprint.uuidStr).toBe(testUuid);
      expect(newFingerprint.createdAt).toEqual(testDate);
    });
  });

  describe('matching', () => {
    it('should match fingerprints with the same UUID', () => {
      const fingerprint1 = createTestFingerprint();
      const fingerprint2 = new Fingerprint({
        uuidStr: testUuid,
        // Different date and metadata shouldn't affect matching
        createdAt: new Date(),
        metadata: { different: 'values' }
      });
      
      expect(fingerprint1.matches(fingerprint2)).toBe(true);
    });

    it('should not match fingerprints with different UUIDs', () => {
      const fingerprint1 = createTestFingerprint();
      const fingerprint2 = new Fingerprint();
      
      expect(fingerprint1.matches(fingerprint2)).toBe(false);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON correctly', () => {
      const fingerprint = createTestFingerprint();
      const json = fingerprint.toJSON();
      
      expect(json).toEqual({
        uuidStr: testUuid,
        createdAt: testDate,
        metadata: testMetadata
      });
    });

    it('should create from JSON correctly', () => {
      const json = {
        uuidStr: testUuid,
        createdAt: testDate,
        metadata: testMetadata
      };
      
      const fingerprint = Fingerprint.fromJSON(json);
      
      expect(fingerprint.uuidStr).toBe(testUuid);
      expect(fingerprint.createdAt).toEqual(testDate);
      expect(fingerprint.metadata).toEqual(testMetadata);
    });

    it('should handle string dates in fromJSON', () => {
      // Test handling of ISO date strings from JSON serialization
      const dateStr = '2023-01-01T00:00:00.000Z';
      const json = {
        uuidStr: testUuid,
        createdAt: dateStr,
        metadata: testMetadata
      };
      
      const fingerprint = Fingerprint.fromJSON(json);
      
      expect(fingerprint.createdAt).toBeInstanceOf(Date);
      expect(fingerprint.createdAt.toISOString()).toBe(dateStr);
    });
  });
});
