/**
 * Flow system for orchestrating workflows with optimized execution and visualization.
 * 
 * Performance optimizations include:
 * - Parallel method execution with Promise.all for maximum throughput
 * - Intelligent caching of method results with TTL-based expiration
 * - Memory-efficient data structures with WeakMap for reference tracking
 * - Optimized event propagation with minimal overhead
 * - Type-safe interfaces throughout the entire implementation
 */

// Core Flow classes and interfaces
export { Flow } from './Flow.js';
export { FlowState } from './FlowState.js';
export { plotFlow } from './visualization/FlowVisualizer.js';

// Flow types and constants
export {
  CONTINUE,
  STOP,
  type Condition,
  type ComplexCondition,
  type ConditionFunction,
  type FlowCreatedEvent,
  type FlowEvent,
  type FlowFinishedEvent,
  type FlowMethodMetadata,
  type FlowOptions,
  type FlowPersistence,
  type FlowPlotEvent,
  type FlowStartedEvent,
  type MethodExecutionFailedEvent,
  type MethodExecutionFinishedEvent,
  type MethodExecutionResult,
  type MethodExecutionStartedEvent,
  type SimpleCondition
} from './types.js';

// Decorators are exported separately via ./decorators.js
