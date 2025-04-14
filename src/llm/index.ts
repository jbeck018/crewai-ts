/**
 * LLM Module
 * 
 * Provides interfaces and implementations for language model interactions,
 * optimized for performance, reliability, and efficient resource usage.
 */

// Core interfaces
export * from './BaseLLM.js';

// Provider implementations 
export * from './providers/index.js';

// Export OpenAILLM with an alias as OpenAIChat for backward compatibility with documentation
import { OpenAILLM, OpenAILLMConfig } from './providers/OpenAILLM.js';
export { OpenAILLM, OpenAILLMConfig };

// Export OpenAILLM as OpenAIChat for documentation compatibility
export { OpenAILLM as OpenAIChat };
export type { OpenAILLMConfig as OpenAIChatConfig };
