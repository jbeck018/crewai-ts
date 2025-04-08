/**
 * Anthropic LLM Provider Implementation
 *
 * High-performance implementation of the BaseLLM interface for Anthropic's Claude models.
 * Optimized for efficient token usage, streaming, and error handling.
 */
import { BaseLLM, LLMMessage, LLMOptions, LLMResult } from '../BaseLLM.js';
export interface AnthropicLLMConfig {
    apiKey?: string;
    modelName?: string;
    baseUrl?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
    enableLogging?: boolean;
    cache?: Map<string, LLMResult>;
}
/**
 * Anthropic Claude LLM implementation optimized for performance and reliability
 */
export declare class AnthropicLLM implements BaseLLM {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly defaultModel;
    private readonly defaultMaxTokens?;
    private readonly defaultTemperature;
    private readonly timeout;
    private readonly maxRetries;
    private readonly retryDelay;
    private readonly enableLogging;
    private readonly cache;
    private tokenUsage;
    private anthropicFetchCount;
    constructor(config?: AnthropicLLMConfig);
    /**
     * Send a completion request to the Anthropic API
     * Optimized with caching, retries, and token management
     */
    complete(messages: LLMMessage[], options?: Partial<LLMOptions>): Promise<LLMResult>;
    /**
     * Send a streaming completion request to the Anthropic API
     * Optimized for low-latency streaming and efficient token handling
     */
    completeStreaming(messages: LLMMessage[], options?: Partial<LLMOptions>, callbacks?: {
        onToken?: (token: string) => void;
        onComplete?: (result: LLMResult) => void;
        onError?: (error: Error) => void;
    }): Promise<ReadableStream<Uint8Array> | null>;
    /**
     * Count tokens in text using a simple approximation
     * Note: This is a rough approximation only - Claude's exact tokenization is not public
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
     * Convert standard LLM messages to Anthropic format
     */
    private convertToAnthropicMessages;
    /**
     * Execute a fetch request with automatic retries
     */
    private executeWithRetries;
    /**
     * Generate a cache key from messages and settings
     */
    private generateCacheKey;
    /**
     * Get headers for Anthropic API requests
     */
    private getHeaders;
    /**
     * Format error for consistent error handling
     */
    private formatError;
}
//# sourceMappingURL=AnthropicLLM.d.ts.map