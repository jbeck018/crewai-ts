/**
 * Vitest configuration
 * Optimized for performance with minimal overhead and parallel testing
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Enable parallel test execution for faster test runs
    pool: 'threads',
    poolOptions: {
      threads: {
        // Use isolate to prevent test pollution
        isolate: true,
      },
    },
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Optimize for CI pipelines
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './test-results.xml',
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
    // Cache test results for faster reruns
    cache: {
      dir: '.vitest-cache',
    },
    // Optimize timeouts for faster feedback
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
  },
});
