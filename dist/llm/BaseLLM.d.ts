/**
 * Base interface for language model implementations
 * Optimized for streaming responses and token management
 */
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'function';
    content: string;
    name?: string;
}
export interface LLMOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    modelName?: string;
    streaming?: boolean;
    timeout?: number;
    maxRetries?: number;
    baseUrl?: string;
    apiKey?: string;
}
export interface LLMResult {
    content: string;
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    finishReason?: string;
}
export interface BaseLLM {
    /**
     * Generate a completion from the LLM
     * @param messages The messages to send to the LLM
     * @param options Options for the LLM call
     */
    complete(messages: LLMMessage[], options?: Partial<LLMOptions>): Promise<LLMResult>;
    /**
     * Generate a streaming completion from the LLM
     * @param messages The messages to send to the LLM
     * @param options Options for the LLM call
     * @param callbacks Callbacks for handling the stream
     */
    completeStreaming(messages: LLMMessage[], options?: Partial<LLMOptions>, callbacks?: {
        onToken?: (token: string) => void;
        onComplete?: (result: LLMResult) => void;
        onError?: (error: Error) => void;
    }): Promise<ReadableStream<Uint8Array> | null>;
    /**
     * Count tokens in a message
     * @param text The text to count tokens for
     */
    countTokens(text: string): Promise<number>;
}
//# sourceMappingURL=BaseLLM.d.ts.map