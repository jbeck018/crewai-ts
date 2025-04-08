// Specialized vitest configuration for Flow tests
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Increase timeout for Flow tests specifically
    testTimeout: 30000,
    // Enable more verbose output for debugging
    reporters: ['verbose'],
    // Provide more detailed stack traces
    logHeapUsage: true,
    // Bail after first failure - for efficiency during test debugging
    bail: 1,
    // Retry tests once in case of flakiness due to async timing
    retry: 1
  },
});
