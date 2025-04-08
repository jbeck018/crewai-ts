/**
 * OpenAI LLM Provider Implementation
 *
 * High-performance implementation of the BaseLLM interface for OpenAI's models.
 * Optimized for efficient token usage, batching, streaming, and error handling.
 */
import { BaseLLM, LLMMessage, LLMOptions, LLMResult } from '../BaseLLM.js';
export interface OpenAILLMConfig {
    apiKey?: string;
    modelName?: string;
    baseUrl?: string;
    organization?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
    enableLogging?: boolean;
    cache?: Map<string, LLMResult>;
}
/**
 * OpenAI LLM implementation optimized for performance and reliability
 */
export declare class OpenAILLM implements BaseLLM {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly defaultModel;
    private readonly organization?;
    private readonly defaultMaxTokens?;
    private readonly defaultTemperature;
    private readonly timeout;
    private readonly maxRetries;
    private readonly retryDelay;
    private readonly enableLogging;
    private readonly cache;
    private tokenUsage;
    private openAIFetchCount;
    private static tokenizer;
    constructor(config?: OpenAILLMConfig);
    /**
     * Send a completion request to the OpenAI API
     * Optimized with caching, retries, and token management
     */
    complete(messages: LLMMessage[], options?: Partial<LLMOptions>): Promise<LLMResult>;
    /**
     * Send a streaming completion request to the OpenAI API
     * Optimized for low-latency streaming and efficient token handling
     */
    completeStreaming(messages: LLMMessage[], options?: Partial<LLMOptions>, callbacks?: {
        onToken?: (token: string) => void;
        onComplete?: (result: LLMResult) => void;
        onError?: (error: Error) => void;
    }): Promise<ReadableStream<Uint8Array> | null>;
    /**
     * Count tokens in text using cached encoder for performance
     */
    countTokens(text: string): Promise<number>;
    /**
     * Get the total tokens used across all requests
     */
    getTokenUsage(): {
        prompt: number;
        completion: number;
        total: number;
    };
    /**
     * Get the number of API requests made
     */
    getRequestCount(): number;
    /**
     * Clear the response cache
     */
    clearCache(): void;
    /**
     * Execute a fetch request with automatic retries
     */
    private executeWithRetries;
    /**
     * Generate a cache key from messages and settings
     */
    private generateCacheKey;
    /**
     * Serialize messages to a single string for token counting
     */
    private serializeMessages;
    /**
     * Get headers for OpenAI API requests
     */
    private getHeaders;
    /**
     * Format error for consistent error handling
     */
    private formatError;
}
//# sourceMappingURL=OpenAILLM.d.ts.map