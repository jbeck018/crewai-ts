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
 */
// Core Flow classes and interfaces
export { Flow } from './Flow.js';
export { FlowState } from './FlowState.js';
export { plotFlow } from './visualization/FlowVisualizer.js';
// Flow types and constants - Harmonized with Python implementation
export { CONTINUE, STOP, 
// Error classes for compatibility with Python implementation
FlowExecutionError, FlowValidationError } from './types.js';
// Decorators with both camelCase (TypeScript style) and PascalCase (Python style) exports
export { 
// Original TypeScript-style exports
start, listen, router, and_, or_, 
// Python-compatible aliases
Start, Listen, Router, AND, OR } from './decorators.js';
// Memory connector exports for Flow system
export { FlowMemoryConnector } from './memory/FlowMemoryConnector.js';
// Memory optimization utilities
export { ContextualMemory, VectorStoreMemory } from './memory/types.js';
//# sourceMappingURL=index.js.map