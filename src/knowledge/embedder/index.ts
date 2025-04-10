/**
 * Knowledge System Embedders
 * 
 * This module exports all embedder implementations for the knowledge system.
 * Each embedder is optimized for specific use cases and performance characteristics.
 */

// Base embedder interface and types
export { BaseEmbedder } from './BaseEmbedder.js';
export type { BaseEmbedderOptions } from './BaseEmbedder.js';

// OpenAI embedder
export { OpenAIEmbedder } from './OpenAIEmbedder.js';
export type { OpenAIEmbedderOptions } from './OpenAIEmbedder.js';

// Cohere embedder
export { CohereEmbedder } from './CohereEmbedder.js';
export type { CohereEmbedderOptions } from './CohereEmbedder.js';

// HuggingFace embedder
export { HuggingFaceEmbedder } from './HuggingFaceEmbedder.js';
export type { HuggingFaceEmbedderOptions } from './HuggingFaceEmbedder.js';

// FastEmbedder (local, efficient embedding)
export { FastEmbedder } from './FastEmbedder.js';
export type { FastEmbedderOptions } from './FastEmbedder.js';

// FastText embedder (multilingual word embeddings)
export { FastTextEmbedder } from './FastTextEmbedder.js';
export type { FastTextEmbedderOptions } from './FastTextEmbedder.js';

// Custom embedder for user-provided embedding functions
export { CustomEmbedder } from './CustomEmbedder.js';
export type { CustomEmbedderOptions } from './CustomEmbedder.js';

/**
 * Convenience type for any embedder implementation
 * Import the actual classes to prevent undefined names
 */
import { BaseEmbedder } from './BaseEmbedder.js';
import { OpenAIEmbedder } from './OpenAIEmbedder.js';
import { CohereEmbedder } from './CohereEmbedder.js';
import { HuggingFaceEmbedder } from './HuggingFaceEmbedder.js';
import { FastEmbedder } from './FastEmbedder.js';
import { FastTextEmbedder } from './FastTextEmbedder.js';
import { CustomEmbedder } from './CustomEmbedder.js';

/**
 * Convenience type for any embedder implementation
 */
export type AnyEmbedder = 
  | BaseEmbedder
  | OpenAIEmbedder
  | CohereEmbedder
  | HuggingFaceEmbedder
  | FastEmbedder
  | FastTextEmbedder
  | CustomEmbedder;
