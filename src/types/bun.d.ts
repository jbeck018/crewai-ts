/**
 * TypeScript declarations for Bun runtime and testing
 */

declare module 'bun:test' {
  export interface Mock<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): ReturnType<T>;
    mock: {
      calls: Array<Parameters<T>>;
      results: Array<{ type: 'return' | 'throw'; value: any }>;
      instances: Array<any>;
      invocationCallOrder: Array<number>;
      lastCall: Parameters<T>;
    };
    mockImplementation(fn: T): this;
    mockReturnValue(value: ReturnType<T>): this;
    mockResolvedValue(value: Awaited<ReturnType<T>>): this;
    mockRejectedValue(error: any): this;
    mockReturnValueOnce(value: ReturnType<T>): this;
    mockResolvedValueOnce(value: Awaited<ReturnType<T>>): this;
    mockRejectedValueOnce(error: any): this;
    mockReset(): void;
    mockRestore(): void;
    mockClear(): void;
  }

  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect<T>(value: T): ExpectResult<T>;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function spyOn(object: any, method: string): Mock<any>;
  export function jest: {
    fn<T extends (...args: any[]) => any>(implementation?: T): Mock<T>;
    spyOn(object: any, method: string): Mock<any>;
    clearAllMocks(): void;
  };

  interface ExpectResult<T> {
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeInstanceOf(constructor: new (...args: any[]) => any): void;
    toContain(item: any): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThan(expected: number): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledWith(...args: any[]): void;
    toHaveBeenCalledTimes(number: number): void;
    toThrow(error?: any): void;
    rejects: ExpectResult<Promise<T>>;
    resolves: ExpectResult<Promise<T>>;
    not: ExpectResult<T>;
  }
}

// Add Node.js globals for test environment
declare var global: typeof globalThis & {
  import: (path: string) => Promise<any>;
};

declare var process: {
  env: Record<string, string | undefined>;
  memoryUsage: () => {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
};
