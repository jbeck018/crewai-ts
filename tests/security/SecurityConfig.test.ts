/**
 * SecurityConfig Tests
 * 
 * Optimized test suite for the SecurityConfig component with performance considerations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityConfig } from '../../src/security/SecurityConfig';
import { Fingerprint } from '../../src/security/Fingerprint';
import { SecurityEvent } from '../../src/security/types';

describe('SecurityConfig', () => {
  // Performance optimization: Pre-create test data to minimize object creation during tests
  const testVersion = '2.0.0';
  const testUuid = '12345678-1234-5678-1234-567812345678';
  const testDate = new Date(2023, 0, 1);
  
  // Create a reusable fingerprint for tests
  const createTestFingerprint = () => new Fingerprint({
    uuidStr: testUuid,
    createdAt: testDate,
    metadata: { source: 'test' }
  });

  describe('creation', () => {
    it('should create a security config with default values', () => {
      const config = new SecurityConfig();
      
      expect(config.version).toBe('1.0.0');
      expect(config.enabled).toBe(true);
      expect(config.securityLevel).toBe('medium');
      expect(config.fingerprint).toBeInstanceOf(Fingerprint);
    });

    it('should create a security config with custom values', () => {
      const fingerprint = createTestFingerprint();
      const config = new SecurityConfig({
        version: testVersion,
        enabled: false,
        securityLevel: 'high',
        fingerprint: fingerprint.toJSON()
      });
      
      expect(config.version).toBe(testVersion);
      expect(config.enabled).toBe(false);
      expect(config.securityLevel).toBe('high');
      expect(config.fingerprint.uuidStr).toBe(testUuid);
    });
  });

  describe('event handling', () => {
    // Test data for event tests
    let config: SecurityConfig;
    let eventListener: (event: SecurityEvent) => void;
    
    beforeEach(() => {
      // Create a fresh config for each test to avoid event listener pollution
      config = new SecurityConfig({
        enabled: true
      });
      
      // Create a spy function for the event listener
      eventListener = vi.fn();
    });

    it('should register and trigger event listeners', () => {
      // Add event listener
      config.addEventListener('fingerprint_verified', eventListener);
      
      // Validate a fingerprint to trigger the event
      config.validateFingerprint(createTestFingerprint());
      
      // Check if the listener was called
      expect(eventListener).toHaveBeenCalledTimes(1);
      expect(eventListener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'fingerprint_verified',
        source: 'SecurityConfig',
        data: expect.objectContaining({
          fingerprint: testUuid
        })
      }));
    });

    it('should allow removing event listeners', () => {
      // Add and then remove listener
      config.addEventListener('fingerprint_verified', eventListener);
      config.removeEventListener('fingerprint_verified', eventListener);
      
      // Validate a fingerprint to potentially trigger the event
      config.validateFingerprint(createTestFingerprint());
      
      // Listener should not have been called
      expect(eventListener).not.toHaveBeenCalled();
    });

    it('should not dispatch events when security is disabled', () => {
      // Create disabled config
      const disabledConfig = new SecurityConfig({
        enabled: false
      });
      
      // Add event listener
      disabledConfig.addEventListener('fingerprint_verified', eventListener);
      
      // Validate a fingerprint which would normally trigger the event
      disabledConfig.validateFingerprint(createTestFingerprint());
      
      // Listener should not have been called
      expect(eventListener).not.toHaveBeenCalled();
    });
  });

  describe('fingerprint validation', () => {
    it('should validate legitimate fingerprints', () => {
      const config = new SecurityConfig();
      const fingerprint = createTestFingerprint();
      
      expect(config.validateFingerprint(fingerprint)).toBe(true);
    });

    it('should cache validation results for performance', () => {
      const config = new SecurityConfig();
      const fingerprint = createTestFingerprint();
      
      // First validation should compute and cache the result
      const result1 = config.validateFingerprint(fingerprint);
      expect(result1).toBe(true);
      
      // Second validation with the same fingerprint should use the cache
      // Spy on the internal dispatchEvent method
      const spyValidate = vi.spyOn(config as any, '_dispatchEvent');
      const result2 = config.validateFingerprint(fingerprint);
      
      // Result should be the same (from cache)
      expect(result2).toBe(result1);
      
      // No additional events should be dispatched for cached validations
      expect(spyValidate).not.toHaveBeenCalled();
    });

    it('should always pass validation when security is disabled', () => {
      const config = new SecurityConfig({
        enabled: false
      });
      
      // Even with an invalid fingerprint (future date), it should pass
      const futureDate = new Date(Date.now() + 10000000);
      const invalidFingerprint = new Fingerprint({
        createdAt: futureDate
      });
      
      expect(config.validateFingerprint(invalidFingerprint)).toBe(true);
    });
  });

  describe('update', () => {
    it('should create a new instance with updated properties', () => {
      const originalConfig = new SecurityConfig({
        version: '1.0.0',
        enabled: true,
        securityLevel: 'low'
      });
      
      const updatedConfig = originalConfig.update({
        version: '2.0.0',
        securityLevel: 'high'
      });
      
      // Original should be unchanged
      expect(originalConfig.version).toBe('1.0.0');
      expect(originalConfig.securityLevel).toBe('low');
      
      // New instance should have updated properties
      expect(updatedConfig.version).toBe('2.0.0');
      expect(updatedConfig.securityLevel).toBe('high');
      
      // Unchanged properties should be maintained
      expect(updatedConfig.enabled).toBe(true);
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON correctly', () => {
      const fingerprint = createTestFingerprint();
      const config = new SecurityConfig({
        version: testVersion,
        enabled: true,
        securityLevel: 'high',
        fingerprint: fingerprint.toJSON()
      });
      
      const json = config.toJSON();
      
      expect(json).toEqual({
        version: testVersion,
        enabled: true,
        securityLevel: 'high',
        fingerprint: expect.objectContaining({
          uuidStr: testUuid
        })
      });
    });

    it('should not include fingerprint in JSON when security is disabled', () => {
      const fingerprint = createTestFingerprint();
      const config = new SecurityConfig({
        version: testVersion,
        enabled: false,
        fingerprint: fingerprint.toJSON()
      });
      
      const json = config.toJSON();
      
      expect(json).toEqual({
        version: testVersion,
        enabled: false,
        securityLevel: 'medium'
      });
      expect(json).not.toHaveProperty('fingerprint');
    });

    it('should create from JSON correctly', () => {
      const json = {
        version: testVersion,
        enabled: true,
        securityLevel: 'high',
        fingerprint: {
          uuidStr: testUuid,
          createdAt: testDate,
          metadata: { source: 'test' }
        }
      };
      
      const config = SecurityConfig.fromJSON(json);
      
      expect(config.version).toBe(testVersion);
      expect(config.enabled).toBe(true);
      expect(config.securityLevel).toBe('high');
      expect(config.fingerprint.uuidStr).toBe(testUuid);
    });
  });
});
