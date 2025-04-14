/**
 * Type declarations for Node.js APIs
 * This provides optimized typing for Node.js process and streams
 */

import { EventEmitter } from 'events';

declare namespace NodeJS {
  interface Process extends EventEmitter {
    stdin: ReadableStream;
    stdout: WritableStream;
    stderr: WritableStream;
    env: Record<string, string | undefined>;
    exit(code?: number): never;
    on(event: string, listener: (...args: any[]) => void): Process;
    cpuUsage(): { user: number; system: number; };
    memoryUsage(): { 
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
    cwd(): string;
    uptime(): number;
  }

  interface ReadableStream {
    read(size?: number): string | Buffer;
    on(event: string, listener: (...args: any[]) => void): ReadableStream;
    setEncoding(encoding: string): void;
  }

  interface WritableStream {
    write(buffer: Uint8Array | string, cb?: (err?: Error | null) => void): boolean;
    write(str: string, encoding?: string, cb?: (err?: Error | null) => void): boolean;
    end(cb?: () => void): void;
    end(data: string | Uint8Array, cb?: () => void): void;
    end(str: string, encoding?: string, cb?: () => void): void;
  }
}

declare global {
  namespace NodeJS {
    interface Process {
      cpuUsage(): { user: number; system: number; };
      memoryUsage(): {
        heapTotal: number;
        heapUsed: number;
        external: number;
        arrayBuffers: number;
      };
      stdout: {
        write(buffer: string | Uint8Array): boolean;
      };
      stdin: {
        setEncoding(encoding: string): void;
      };
    }

    interface Global {
      process: Process;
    }
  }
}

// Make the global process object available
declare const process: NodeJS.Process;

export {};
