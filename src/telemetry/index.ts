/**
 * Telemetry system for crewAI TypeScript
 * Provides lightweight, memory-efficient event tracking with minimal overhead
 * 
 * Supports multiple telemetry backends through a pluggable architecture
 */

/**
 * Telemetry system exports
 * Optimized module exports for memory-efficient usage
 */

// Core telemetry functionality - using named exports for better tree-shaking and memory optimization
export { Telemetry } from './Telemetry.js';
export { TelemetryEvent } from './TelemetryEvent.js';

// Types and interfaces - using namespace exports for convenience
export * from './types.js';

// Providers - using namespace exports to expose all providers
export * from './providers/index.js';
