/**
 * Knowledge System
 * 
 * Exports all components of the knowledge management system
 * with optimized implementations for performance, memory efficiency,
 * and type safety.
 */

// Re-export types
export * from './types.js';

// Re-export all knowledge sources
// Import all knowledge source types
export type { KnowledgeSourceOptions } from './source/BaseKnowledgeSource.js';
export { BaseKnowledgeSource } from './source/BaseKnowledgeSource.js';
export { StringKnowledgeSource } from './source/StringKnowledgeSource.js';
export { FileKnowledgeSource } from './source/FileKnowledgeSource.js';
export { URLKnowledgeSource } from './source/URLKnowledgeSource.js';
export { JSONKnowledgeSource } from './source/JSONKnowledgeSource.js';

// Re-export embedders
export * from './embedder/index.js';

// Re-export the EmbedderFactory (the primary way to create embedders)
export { EmbedderFactory } from './embedder/EmbedderFactory.js';
export type { EmbedderFactoryOptions } from './embedder/EmbedderFactory.js';

// TODO: Implement Knowledge class
// export { Knowledge } from './Knowledge.js';
// export default Knowledge;
