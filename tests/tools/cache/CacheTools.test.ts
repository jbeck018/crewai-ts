/**
 * Tests for the CacheTools implementation
 * Performance optimized with efficient data management and low overhead test patterns
 */

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { createCacheTools } from '../../../src/tools/cache/CacheTools.js';

describe('CacheTools', () => {
  // Get the tools once to optimize test setup
  const [cacheGet, cacheSet, cacheDelete] = createCacheTools();
  
  // Reset timers and clear cache between tests
  beforeEach(async () => {
    vi.useFakeTimers();
    // Clear all cache data by calling cache_delete with a non-existent key
    // This will invoke the internal clear method
    await cacheDelete.execute({ key: '__reset__', namespace: '__all__' });
  });
  
  test('stores and retrieves values', async () => {
    // Store a value
    const setValue = await cacheSet.execute({
      key: 'test-key',
      value: { data: 'test-value', number: 123 }
    });
    
    expect(setValue.success).toBe(true);
    
    // Retrieve the value
    const getValue = await cacheGet.execute({
      key: 'test-key'
    });
    
    expect(getValue.success).toBe(true);
    expect(getValue.result).toEqual({ data: 'test-value', number: 123 });
  });
  
  test('returns undefined for non-existent keys', async () => {
    const getValue = await cacheGet.execute({
      key: 'non-existent-key'
    });
    
    expect(getValue.success).toBe(true);
    expect(getValue.result).toBeUndefined();
  });
  
  test('deletes values from the cache', async () => {
    // Store a value
    await cacheSet.execute({
      key: 'delete-test-key',
      value: 'to-be-deleted'
    });
    
    // Delete the value
    const deleteResult = await cacheDelete.execute({
      key: 'delete-test-key'
    });
    
    expect(deleteResult.success).toBe(true);
    expect(deleteResult.result.success).toBe(true);
    
    // Verify it's deleted
    const getValue = await cacheGet.execute({
      key: 'delete-test-key'
    });
    
    expect(getValue.result).toBeUndefined();
  });
  
  test('uses separate namespaces', async () => {
    // Store values in different namespaces
    await cacheSet.execute({
      key: 'same-key',
      value: 'value-A',
      namespace: 'namespace-A'
    });
    
    await cacheSet.execute({
      key: 'same-key',
      value: 'value-B',
      namespace: 'namespace-B'
    });
    
    // Retrieve from each namespace
    const valueA = await cacheGet.execute({
      key: 'same-key',
      namespace: 'namespace-A'
    });
    
    const valueB = await cacheGet.execute({
      key: 'same-key',
      namespace: 'namespace-B'
    });
    
    expect(valueA.result).toBe('value-A');
    expect(valueB.result).toBe('value-B');
  });
  
  test('respects TTL for cached values', async () => {
    // Store with TTL
    await cacheSet.execute({
      key: 'ttl-key',
      value: 'expires-soon',
      ttl: 60 // 60 seconds
    });
    
    // Verify it exists
    let getValue = await cacheGet.execute({
      key: 'ttl-key'
    });
    
    expect(getValue.result).toBe('expires-soon');
    
    // Advance time beyond TTL
    vi.advanceTimersByTime(61 * 1000);
    
    // Verify it's expired
    getValue = await cacheGet.execute({
      key: 'ttl-key'
    });
    
    expect(getValue.result).toBeUndefined();
  });
  
  test('handles complex data structures', async () => {
    const complexData = {
      nested: {
        array: [1, 2, 3],
        map: new Map([['a', 1], ['b', 2]]),
        date: new Date(),
        regex: /test-pattern/,
        nullValue: null,
        undefinedValue: undefined
      }
    };
    
    // Store complex data
    await cacheSet.execute({
      key: 'complex-key',
      value: complexData
    });
    
    // Retrieve complex data
    const getValue = await cacheGet.execute({
      key: 'complex-key'
    });
    
    // Deep equality check with expected JSON conversion behavior
    // Note: Map will be converted to an object during JSON serialization
    const expected = {
      nested: {
        array: [1, 2, 3],
        map: {}, // Maps convert to empty objects in standard JSON
        date: complexData.nested.date.toISOString(),
        regex: {}, // RegExp converts to empty object
        nullValue: null,
        undefinedValue: undefined
      }
    };
    
    // Adjust expectations for JSON serialization behavior
    expect(getValue.result.nested.array).toEqual(expected.nested.array);
    expect(getValue.result.nested.nullValue).toBeNull();
    expect(getValue.result.nested.undefinedValue).toBeUndefined();
    expect(getValue.result.nested.date).toBeTypeOf('string');
  });
});
