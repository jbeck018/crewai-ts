/**
 * Knowledge Sources
 * 
 * This module exports all knowledge source implementations
 * with optimized performance for knowledge retrieval and processing
 */

// Base knowledge source interface
export { BaseKnowledgeSource, KnowledgeSourceOptions } from './BaseKnowledgeSource.js';

// String-based knowledge source
export { StringKnowledgeSource, StringKnowledgeSourceOptions } from './StringKnowledgeSource.js';

// File-based knowledge source
export { FileKnowledgeSource, FileKnowledgeSourceOptions } from './FileKnowledgeSource.js';

// URL-based knowledge source
export { URLKnowledgeSource, URLKnowledgeSourceOptions } from './URLKnowledgeSource.js';

// JSON-based knowledge source
export { JSONKnowledgeSource, JSONKnowledgeSourceOptions, JSONPathSchema } from './JSONKnowledgeSource.js';

// Re-export common types
export type { Metadata } from '../types.js';

/**
 * Type representing any knowledge source implementation
 * This allows for polymorphic usage of different knowledge source types
 */
export type AnyKnowledgeSource = import('./BaseKnowledgeSource.js').BaseKnowledgeSource;
