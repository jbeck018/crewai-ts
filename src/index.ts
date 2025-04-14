/**
 * CrewAI TypeScript
 * A modern TypeScript port of crewAI optimized for ESM and Node.js
 */

// Core exports - use selective exports to avoid duplicates
import { Agent, AgentConfig } from './agent/index.js';
export { Agent, AgentConfig };
export * from './agent/index.js';

import { Crew, CrewConfig } from './crew/index.js';
export { Crew, CrewConfig };
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
// Export utils selectively to avoid ambiguity
export { Cache } from './utils/cache.js';
export { Logger, LogLevel } from './utils/logger.js';
// Avoid exporting non-existent modules
export * from './utils/decorators.js';
export * from './flow/index.js';

// Re-export flow decorators separately
import * as FlowDecorators from './flow/decorators.js';
export { FlowDecorators };

// Define override type locally instead of importing from external module
export type override = 'override';

// Export core types explicitly to ensure they're included in the package
export * from './types/core.js';
