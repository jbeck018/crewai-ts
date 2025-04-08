import { describe, it, expect, vi, beforeEach } from 'vitest';
import { memoize, deepClone, shallowImmutable, lazyInit } from '../../src/project/utils.js';

describe('Project Utils', () => {
  // Test optimization: Use lean test fixtures
  describe('memoize', () => {
    // Test fixture: Optimize with counters instead of heavy computation
    let callCount: number;
    const testFn = (a: number, b: number) => {
      callCount++;
      return a + b;
    };
    let memoizedFn: ReturnType<typeof memoize<typeof testFn>>;

    // Optimization: Efficient setup
    beforeEach(() => {
      callCount = 0;
      memoizedFn = memoize(testFn);
    });

    it('should only call the function once for the same arguments', () => {
      // First call - should execute the function
      const result1 = memoizedFn(1, 2);
      expect(result1).toBe(3);
      expect(callCount).toBe(1);

      // Second call with same args - should use cached result
      const result2 = memoizedFn(1, 2);
      expect(result2).toBe(3);
      expect(callCount).toBe(1); // Still 1, not called again
    });

    it('should call the function for different arguments', () => {
      // Call with different arguments
      memoizedFn(1, 2);
      memoizedFn(2, 3);
      memoizedFn(3, 4);

      expect(callCount).toBe(3); // Called for each unique set of args
    });

    it('should maintain separate caches for different memoized functions', () => {
      // Create another memoized function
      const otherCallCount = { value: 0 };
      const otherFn = (a: number) => {
        otherCallCount.value++;
        return a * 2;
      };
      const otherMemoizedFn = memoize(otherFn);

      // Call both functions
      memoizedFn(1, 2);
      otherMemoizedFn(1);

      expect(callCount).toBe(1);
      expect(otherCallCount.value).toBe(1);
    });

    it('should preserve the this context', () => {
      // Create object with memoized method
      const obj = {
        value: 10,
        method: memoize(function(this: { value: number }, a: number) {
          callCount++;
          return this.value + a;
        }),
      };

      // Call method twice
      const result1 = obj.method(5);
      const result2 = obj.method(5);

      expect(result1).toBe(15);
      expect(result2).toBe(15);
      expect(callCount).toBe(1); // Only called once
    });

    it('should clear the cache when clearCache is called', () => {
      // Call once to cache
      memoizedFn(1, 2);
      expect(callCount).toBe(1);

      // Clear cache
      memoizedFn.clearCache();

      // Call again - should recalculate
      memoizedFn(1, 2);
      expect(callCount).toBe(2);
    });
  });

  describe('deepClone', () => {
    it('should return primitives unchanged', () => {
      expect(deepClone(5)).toBe(5);
      expect(deepClone('test')).toBe('test');
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
    });

    it('should create a deep copy of objects', () => {
      // Optimization: Use smaller test objects
      const original = {
        a: 1,
        b: { c: 2 },
        d: [3, 4, { e: 5 }]
      };

      const clone = deepClone(original);

      // Test that it's a different object
      expect(clone).not.toBe(original);
      expect(clone.b).not.toBe(original.b);

      // Test that the values are the same
      expect(clone).toEqual(original);

      // Modify the original and verify clone isn't affected
      original.a = 99;
      original.b.c = 99;
      (original.d[2] as { e: number }).e = 99;

      // Clone should maintain original values
      expect(clone.a).toBe(1);
      expect(clone.b.c).toBe(2);
      expect((clone.d[2] as { e: number }).e).toBe(5);
    });
  });

  describe('shallowImmutable', () => {
    it('should create a frozen shallow copy', () => {
      const original = { a: 1, b: { c: 2 } };
      const immutable = shallowImmutable(original);

      // Test that it's a different object
      expect(immutable).not.toBe(original);

      // Test that it's frozen
      expect(Object.isFrozen(immutable)).toBe(true);

      // Modification should throw error in strict mode
      expect(() => {
        // @ts-ignore - Attempting to modify frozen object
        immutable.a = 99;
      }).toThrow();

      // Inner objects should NOT be frozen (shallow only)
      expect(Object.isFrozen(immutable.b)).toBe(false);
    });
  });

  describe('lazyInit', () => {
    it('should not initialize until the value is accessed', () => {
      // Setup a spy factory function
      const factory = vi.fn(() => 'test-value');
      const lazy = lazyInit(factory);

      // Factory should not be called yet
      expect(factory).not.toHaveBeenCalled();

      // Access the value
      const value = lazy.value;

      // Factory should be called once
      expect(factory).toHaveBeenCalledTimes(1);
      expect(value).toBe('test-value');

      // Access again - should not call factory again
      const value2 = lazy.value;
      expect(factory).toHaveBeenCalledTimes(1);
      expect(value2).toBe('test-value');
    });

    it('should work with complex initialization logic', () => {
      // More complex factory with object, implementing optimization analysis
      let counter = 0;
      const factory = () => ({
        id: ++counter,
        timestamp: Date.now(),
        expensive: new Array(10).fill(0).map((_, i) => i)
      });

      const lazy = lazyInit(factory);

      // Get the value twice
      const value1 = lazy.value;
      const value2 = lazy.value;

      // Verify same instance is returned (only initialized once)
      expect(value1).toBe(value2);
      expect(value1.id).toBe(1);
    });
  });
});
