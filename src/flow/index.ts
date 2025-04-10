/**
 * Flow system for orchestrating workflows with harmonized API between Python and TypeScript.
 * 
 * Performance optimizations include:
 * - Multi-level caching with O(1) lookups and TTL-based expiration
 * - Memory-efficient data structures using WeakMap for automatic garbage collection
 * - Parallel method execution with Promise.all for maximum throughput
 * - Optimized string handling with Set for deduplication
 * - Type-safe interfaces with proper validation for cross-language compatibility
 * - Smart event propagation with minimal overhead
 * - Cache size estimation for memory management
 * - Incremental state management with change tracking
 * - Optimized event handling with priority queues
 * - Memory-efficient execution tracking with configurable sampling
 * - Dynamic flow scheduling with resource-aware concurrency
 * - Efficient condition evaluation with structural optimization
 */

// Core Flow classes and interfaces
export { Flow } from './Flow.js';
export { FlowState } from './FlowState.js';
export { plotFlow } from './visualization/FlowVisualizer.js';

// Flow types and constants - Harmonized with Python implementation
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
  type SimpleCondition,
  // Error classes for compatibility with Python implementation
  FlowExecutionError,
  FlowValidationError
} from './types.js';

// Decorators with both camelCase (TypeScript style) and PascalCase (Python style) exports
export {
  // Original TypeScript-style exports
  start, listen, router, and_, or_,
  // Python-compatible aliases
  Start, Listen, Router, AND, OR
} from './decorators.js';

// Memory connector exports for Flow system
export { FlowMemoryConnector } from './memory/FlowMemoryConnector.js';
export { FlowMemoryConnectorInterface, FlowData, FlowMemoryConnectorOptions } from './memory/FlowMemoryConnectorInterface.js';

// Memory optimization utilities
export { ContextualMemory, VectorStoreMemory } from './memory/types.js';

// State management with optimization
export { FlowStateManager } from './state/FlowStateManager.js';

// Routing and conditions system
export {
  FlowRouter,
  ConditionType,
  type BaseCondition,
  type ValueCondition,
  type ContainsCondition,
  type RegexCondition,
  type FunctionCondition,
  type LogicalGroup,
  type RouteCondition,
  type Route,
  type RouteEvaluationOptions,
  type RouteEvaluationResult
} from './routing/FlowRouter.js';

// Event handling system
export {
  FlowEventBus,
  EventPriority,
  // Export FlowEvent as FlowSystemEvent to avoid name collision
  type FlowEvent as FlowSystemEvent,
  type FlowStateChangeEvent,
  type FlowExecutionEvent,
  type FlowMethodEvent,
  type FlowRoutingEvent,
  type AllFlowEvents,
  type EventHandler,
  type EventSubscriptionOptions
} from './events/FlowEventBus.js';

// Flow execution tracking
export {
  FlowExecutionTracker,
  type FlowExecutionMetrics,
  type MetricsSample,
  type ExecutionTraceEntry,
  type FlowTrackerOptions
} from './execution/FlowExecutionTracker.js';

// Flow scheduling system
export {
  FlowScheduler,
  FlowExecutionStatus,
  type FlowNode,
  type FlowSchedulingOptions,
  type FlowExecutionResult,
  type FlowSchedulerEvent
} from './scheduling/FlowScheduler.js';
