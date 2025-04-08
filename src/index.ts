/**
 * CrewAI TypeScript
 * A modern TypeScript port of crewAI optimized for ESM and Node.js
 */

// Core exports - use selective exports to avoid duplicates
export * from './agent/index.js';
export * from './crew/index.js';

// Export task components selectively to avoid duplication
import { Task, TaskPriority, ConditionFunction } from './task/index.js';
export { Task, TaskPriority, ConditionFunction };
export * from './task/index.js';

export * from './tools/index.js';

// Memory exports with selective re-exports to avoid duplicates
import { MemorySearchResult, ContextualMemory } from './memory/index.js';
export { MemorySearchResult, ContextualMemory };
export * from './memory/index.js';

export * from './llm/index.js';
export * from './utils/index.js';
export * from './flow/index.js';

// Re-export flow decorators separately
import * as FlowDecorators from './flow/decorators.js';
export { FlowDecorators };

// Version info
export const VERSION = '0.1.0';
