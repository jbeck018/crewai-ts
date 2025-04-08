#!/usr/bin/env node

/**
 * CrewAI CLI entry point with optimized performance.
 */
import { runCLI } from '../dist/cli/index.js';

// Run with optimizations for startup performance
requireOptimizations();

// Execute the CLI
runCLI().catch(error => {
  console.error('Unhandled CLI error:', error);
  process.exit(1);
});

/**
 * Apply Node.js runtime optimizations for CLI performance
 */
function requireOptimizations() {
  // Optimize V8 for faster startup
  // These flags improve startup time and reduce memory usage
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --no-lazy`;
  
  // Increase stack trace limit for better debugging
  Error.stackTraceLimit = 30;
  
  // Optimize async hooks (reduces overhead for Promise operations)
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --async-stack-traces`;
}
