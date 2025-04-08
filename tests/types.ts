/**
 * Type declarations for Bun tests
 */

// Re-export types from Bun's test module
declare module 'bun:test' {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => Promise<void> | void) => void;
  export const expect: <T>(value: T) => {
    toBe: (expected: any) => void;
    toEqual: (expected: any) => void;
    toBeGreaterThan: (expected: number) => void;
    toBeGreaterThanOrEqual: (expected: number) => void;
    toBeLessThan: (expected: number) => void;
    toBeLessThanOrEqual: (expected: number) => void;
    toBeCloseTo: (expected: number, precision?: number) => void;
    toContain: (expected: string) => void;
    toHaveBeenCalled: () => void;
    toHaveBeenCalledWith: (...args: any[]) => void;
    toBeDefined: () => void;
    toBeUndefined: () => void;
    toBeNull: () => void;
    toBeTruthy: () => void;
    toBeFalsy: () => void;
    toThrow: () => void;
    not: {
      toBe: (expected: any) => void;
      toEqual: (expected: any) => void;
      toHaveBeenCalled: () => void;
    };
  };
  export const beforeAll: (fn: () => void | Promise<void>) => void;
  export const afterAll: (fn: () => void | Promise<void>) => void;
  export const beforeEach: (fn: () => void | Promise<void>) => void;
  export const afterEach: (fn: () => void | Promise<void>) => void;
  export const mock: <T extends (...args: any[]) => any>(fn: T) => jest.Mock<ReturnType<T>, Parameters<T>>;
}

// Jest mock types
declare namespace jest {
  interface Mock<T = any, Y extends any[] = any[]> {
    (...args: Y): T;
    mock: {
      calls: Y[];
      instances: any[];
      invocationCallOrder: number[];
      results: Array<{
        type: 'return' | 'throw';
        value: any;
      }>;
    };
    mockClear(): void;
    mockReset(): void;
    mockImplementation(fn: (...args: Y) => T): this;
    mockImplementationOnce(fn: (...args: Y) => T): this;
    mockReturnValue(value: T): this;
    mockReturnValueOnce(value: T): this;
  }
}
