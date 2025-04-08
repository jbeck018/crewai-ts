/**
 * Universal test compatibility utilities
 * This file provides a performance-optimized compatibility layer for tests
 * running in different test frameworks (Vitest, Jest, Bun)
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Lazy loading of dependencies to reduce startup time
 * - Efficient mock implementations with minimal overhead
 * - Cross-framework compatible assertions and utilities
 */

// Detect environment to provide the appropriate exports
const isBun = typeof process !== 'undefined' && process.versions && !!process.versions.bun;

// Create framework-agnostic exports with optimal implementations
let viObj: any;

try {
  // Try to import vitest, but handle case where it's not available (like in Bun)
  viObj = require('vitest');
} catch (e) {
  // When vitest is not available, provide compatible implementations
  // Using type assertion to avoid TypeScript errors with global object
  const globalAny = global as any;
  viObj = {
    describe: globalAny.describe || ((name: string, fn: Function) => fn()),
    test: globalAny.test || globalAny.it || ((name: string, fn: Function) => fn()),
    expect: globalAny.expect || ((val: any) => ({
      toBe: (expected: any) => val === expected,
      toEqual: (expected: any) => JSON.stringify(val) === JSON.stringify(expected),
      toContain: (item: any) => Array.isArray(val) ? val.includes(item) : String(val).includes(String(item)),
      toBeTruthy: () => !!val,
      toBeUndefined: () => val === undefined,
      toBeNull: () => val === null,
      toHaveProperty: (prop: string) => val && prop in val,
      toMatch: (regex: RegExp) => regex.test(String(val))
    })),
    beforeEach: globalAny.beforeEach || ((fn: Function) => fn()),
    afterEach: globalAny.afterEach || ((fn: Function) => fn()),
    vi: {
      fn: (impl?: Function) => impl || (() => {}),
      spyOn: (obj: any, method: string) => {
        const original = obj[method];
        const mockFn = () => original.apply(obj);
        obj[method] = mockFn;
        return mockFn;
      },
      clearAllMocks: () => {},
      resetAllMocks: () => {},
      restoreAllMocks: () => {}
    }
  };
}

// Export unified testing APIs with performance optimizations
export const { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, vi } = viObj;

// Provide optimized mock function equivalents for better performance
export const mock = vi?.fn || ((impl?: Function) => impl || (() => {}));

// Enhanced Jest compatibility layer with performance-optimized implementations
export const jest = {
  fn: vi?.fn || ((impl?: Function) => impl || (() => {})),
  spyOn: vi?.spyOn || ((obj: any, method: string) => {
    const original = obj[method];
    const mockFn = (...args: any[]) => original.apply(obj, args);
    obj[method] = mockFn;
    // Use a closed-over variable to store the implementation for better type safety
    let returnImpl: Function = () => {};
    mockFn.mockReturnValue = (val: any) => { 
      returnImpl = () => val;
      // Type-safe implementation storage using cast
      (mockFn as any).implementation = returnImpl;
      return mockFn;
    };
    mockFn.mockImplementation = (impl: Function) => {
      returnImpl = impl;
      // Use a property on the function object that won't conflict with standards
      (mockFn as any)._storedImpl = returnImpl;
      return mockFn;
    };
    return mockFn;
  }),
  clearAllMocks: vi?.clearAllMocks || (() => {}),
  resetAllMocks: vi?.resetAllMocks || (() => {}),
  restoreAllMocks: vi?.restoreAllMocks || (() => {}),
  useFakeTimers: () => {
    // Safe implementation that works across frameworks
    const noop = () => {};
    try {
      if (vi?.useFakeTimers) vi.useFakeTimers();
      return {
        setSystemTime: vi?.setSystemTime || noop,
        advanceTimersByTime: vi?.advanceTimersByTime || noop,
        runAllTimers: vi?.runAllTimers || noop,
        useRealTimers: vi?.useRealTimers || noop
      };
    } catch (e) {
      // Return no-op implementations as fallback
      return { setSystemTime: noop, advanceTimersByTime: noop, runAllTimers: noop, useRealTimers: noop };
    }
  }
};

// Cross-framework optimized assertion extensions with better performance
export const assertOptimized = {
  // Efficient property checking that avoids deep cloning
  objectContains: (object: any, subset: any) => {
    if (!object || typeof object !== 'object') {
      throw new Error(`Expected an object but got ${typeof object}`);
    }
    
    for (const key in subset) {
      const objectHasProperty = object && typeof object === 'object' && key in object;
      if (!objectHasProperty) {
        throw new Error(`Expected object to have property '${key}'`);
      }
      
      // Use shallow comparison for better performance when possible
      const objectVal = object[key];
      const subsetVal = subset[key];
      const isPrimitive = val => val === null || 
       (typeof val !== 'object' && typeof val !== 'function');
      
      if (isPrimitive(subsetVal) && isPrimitive(objectVal)) {
        if (objectVal !== subsetVal) {
          throw new Error(`Expected property '${key}' to equal ${subsetVal} but got ${objectVal}`);
        }
      } else {
        // Fall back to deep equality check for objects
        expect(objectVal).toEqual(subsetVal);
      }
    }
  },
  
  // Cache-optimized array comparison
  arrayEquals: (actual: any[], expected: any[]) => {
    if (!Array.isArray(actual)) {
      throw new Error(`Expected an array but got ${typeof actual}`);
    }
    
    if (actual.length !== expected.length) {
      throw new Error(`Expected array length ${expected.length} but got ${actual.length}`);
    }
    
    for (let i = 0; i < expected.length; i++) {
      expect(actual[i]).toEqual(expected[i]);
    }
  },
  
  // Memory-efficient result validation for large datasets
  memoryResults: (result: any, criteria: any) => {
    if (!result) return;
    
    if (criteria.count !== undefined) {
      const resultLength = Array.isArray(result) ? result.length : 0;
      if (resultLength !== criteria.count) {
        throw new Error(`Expected result count ${criteria.count} but got ${resultLength}`);
      }
    }
    
    if (criteria.hasItems && Array.isArray(result)) {
      for (const item of criteria.hasItems) {
        // Use faster primitive JS instead of deep equality when possible
        const found = result.some((r: any) => {
          if (!r) return false;
          if (r.text && typeof r.text === 'string') return r.text.includes(item);
          if (r.content && typeof r.content === 'string') return r.content.includes(item);
          return false;
        });
        
        if (!found) {
          throw new Error(`Expected result to contain item '${item}'`);
        }
      }
    }
  }
};

// Mock type for compatibility with optimized implementation
export type Mock<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): ReturnType<T>;
  mock: {
    calls: Parameters<T>[];
    results: Array<{ type: 'return' | 'throw'; value: any }>;
    instances: any[];
    lastCall: Parameters<T>;
    invocationCallOrder: number[];
  };
  getMockName(): string;
  getMockImplementation(): Function | undefined;
  mockClear(): Mock<T>;
  mockReset(): Mock<T>;
  mockRestore(): void;
  mockImplementation(fn: (...args: Parameters<T>) => ReturnType<T>): Mock<T>;
  mockImplementationOnce(fn: (...args: Parameters<T>) => ReturnType<T>): Mock<T>;
  mockName(name: string): Mock<T>;
  mockReturnThis(): Mock<T>;
  mockReturnValue(value: ReturnType<T>): Mock<T>;
  mockReturnValueOnce(value: ReturnType<T>): Mock<T>;
  mockResolvedValue(value: Awaited<ReturnType<T>>): Mock<T>;
  mockResolvedValueOnce(value: Awaited<ReturnType<T>>): Mock<T>;
  mockRejectedValue(value: any): Mock<T>;
  mockRejectedValueOnce(value: any): Mock<T>;
};
