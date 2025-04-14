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
    // Only include the consolidated tests directory
    include: ['tests/**/*.test.ts'],
    // Enable globals for better compatibility with different test styles
    globals: true,
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
    // Optimize timeouts for faster feedback and prevent hanging tests
    testTimeout: 5000,
    hookTimeout: 3000,
    teardownTimeout: 2000,
    // Abort tests on first failure for faster feedback
    bail: 1,
    // Retry failed tests for better reliability
    retry: 0,
    // Ensure tests are properly isolated to prevent memory leaks
    isolate: true,
  },
});
