/**
 * OpenAI LLM Provider Implementation
 *
 * High-performance implementation of the BaseLLM interface for OpenAI's models.
 * Optimized for efficient token usage, batching, streaming, and error handling.
 */
import { encode } from 'gpt-tokenizer';
// Default settings optimized for performance
const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds
const MAX_RETRIES = 3;
const RETRY_STATUS_CODES = [429, 500, 502, 503, 504];
// Token limits by model for optimization
const MODEL_CONTEXT_WINDOW = {
    'gpt-3.5-turbo': 16385,
    'gpt-3.5-turbo-16k': 16385,
    'gpt-4': 8192,
    'gpt-4-32k': 32768,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000
};
/**
 * OpenAI LLM implementation optimized for performance and reliability
 */
export class OpenAILLM {
    apiKey;
    baseUrl;
    defaultModel;
    organization;
    defaultMaxTokens;
    defaultTemperature;
    timeout;
    maxRetries;
    retryDelay;
    enableLogging;
    // Performance optimizations
    cache;
    tokenUsage = { prompt: 0, completion: 0, total: 0 };
    openAIFetchCount = 0;
    // Token encoder instance cache for better performance
    static tokenizer = null;
    constructor(config = {}) {
        // Core configuration
        this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
        this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
        this.defaultModel = config.modelName || DEFAULT_MODEL;
        this.organization = config.organization || process.env.OPENAI_ORGANIZATION;
        this.defaultMaxTokens = config.maxTokens;
        this.defaultTemperature = config.temperature !== undefined ? config.temperature : 0.7;
        // Performance settings
        this.timeout = config.timeout || DEFAULT_TIMEOUT_MS;
        this.maxRetries = config.maxRetries || MAX_RETRIES;
        this.retryDelay = config.retryDelay || 1000;
        this.enableLogging = config.enableLogging || false;
        // Initialize result cache for optimization
        this.cache = config.cache || new Map();
        // Validate API key
        if (!this.apiKey) {
            throw new Error('OpenAI API key is required. Set it in the config or as OPENAI_API_KEY environment variable.');
        }
    }
    /**
     * Send a completion request to the OpenAI API
     * Optimized with caching, retries, and token management
     */
    async complete(messages, options = {}) {
        // Apply options with defaults
        const modelName = options.modelName || this.defaultModel;
        const temperature = options.temperature !== undefined ? options.temperature : this.defaultTemperature;
        const maxTokens = options.maxTokens || this.defaultMaxTokens;
        // Generate cache key for message/settings combination
        const cacheKey = this.generateCacheKey(messages, modelName, temperature, maxTokens);
        // Check cache first (if not explicitly disabled)
        if (!options.streaming && this.cache.has(cacheKey)) {
            if (this.enableLogging)
                console.log('✓ Using cached LLM response');
            return this.cache.get(cacheKey);
        }
        // Verify token count against model limit and optimize if needed
        const estimatedPromptTokens = await this.countTokens(this.serializeMessages(messages));
        const modelLimit = MODEL_CONTEXT_WINDOW[modelName] || 8192;
        const maxAllowedTokens = modelLimit - estimatedPromptTokens;
        // Adjust maxTokens if it would exceed the model's context window
        const actualMaxTokens = maxTokens && maxTokens > 0
            ? Math.min(maxTokens, maxAllowedTokens)
            : Math.min(4096, maxAllowedTokens);
        if (actualMaxTokens <= 0) {
            throw new Error(`Prompt exceeds maximum token limit for model ${modelName}. ` +
                `Estimated tokens: ${estimatedPromptTokens}, model limit: ${modelLimit}`);
        }
        try {
            // Track API call count
            this.openAIFetchCount++;
            // Prepare request payload
            const payload = {
                model: modelName,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                    ...(msg.name ? { name: msg.name } : {})
                })),
                temperature,
                max_tokens: actualMaxTokens,
                ...(options.topP !== undefined ? { top_p: options.topP } : {}),
                ...(options.frequencyPenalty !== undefined ? { frequency_penalty: options.frequencyPenalty } : {}),
                ...(options.presencePenalty !== undefined ? { presence_penalty: options.presencePenalty } : {})
            };
            // Execute request with automatic retries
            const response = await this.executeWithRetries(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(this.timeout)
            });
            // Process response
            const result = {
                content: response.choices[0]?.message?.content || '',
                totalTokens: response.usage?.total_tokens,
                promptTokens: response.usage?.prompt_tokens,
                completionTokens: response.usage?.completion_tokens,
                finishReason: response.choices[0]?.finish_reason
            };
            // Update token usage stats
            if (response.usage) {
                this.tokenUsage.prompt += response.usage.prompt_tokens;
                this.tokenUsage.completion += response.usage.completion_tokens;
                this.tokenUsage.total += response.usage.total_tokens;
            }
            // Cache the result (if not streaming)
            if (!options.streaming) {
                this.cache.set(cacheKey, result);
            }
            return result;
        }
        catch (error) {
            if (this.enableLogging) {
                console.error('OpenAI API Error:', error);
            }
            throw this.formatError(error);
        }
    }
    /**
     * Send a streaming completion request to the OpenAI API
     * Optimized for low-latency streaming and efficient token handling
     */
    async completeStreaming(messages, options = {}, callbacks) {
        // Apply options with defaults
        const modelName = options.modelName || this.defaultModel;
        const temperature = options.temperature !== undefined ? options.temperature : this.defaultTemperature;
        const maxTokens = options.maxTokens || this.defaultMaxTokens;
        // Verify token count against model limit
        const estimatedPromptTokens = await this.countTokens(this.serializeMessages(messages));
        const modelLimit = MODEL_CONTEXT_WINDOW[modelName] || 8192;
        const maxAllowedTokens = modelLimit - estimatedPromptTokens;
        // Adjust maxTokens to stay within context window
        const actualMaxTokens = maxTokens && maxTokens > 0
            ? Math.min(maxTokens, maxAllowedTokens)
            : Math.min(4096, maxAllowedTokens);
        if (actualMaxTokens <= 0) {
            throw new Error(`Prompt exceeds maximum token limit for model ${modelName}. ` +
                `Estimated tokens: ${estimatedPromptTokens}, model limit: ${modelLimit}`);
        }
        // Prepare streaming request payload
        const payload = {
            model: modelName,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                ...(msg.name ? { name: msg.name } : {})
            })),
            temperature,
            max_tokens: actualMaxTokens,
            stream: true,
            ...(options.topP !== undefined ? { top_p: options.topP } : {}),
            ...(options.frequencyPenalty !== undefined ? { frequency_penalty: options.frequencyPenalty } : {}),
            ...(options.presencePenalty !== undefined ? { presence_penalty: options.presencePenalty } : {})
        };
        try {
            // Track API call
            this.openAIFetchCount++;
            // Execute fetch request without retries for streaming
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(this.timeout)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API Error (${response.status}): ${errorText}`);
            }
            if (!response.body) {
                throw new Error('Stream not available');
            }
            // Process the stream efficiently with minimal overhead
            let buffer = '';
            let finishReason = null;
            let responseContent = '';
            let estimatedCompletionTokens = 0;
            // Capture 'this' for use in the TransformStream
            const self = this;
            // Create a TransformStream to process the response chunks
            const processor = new TransformStream({
                async transform(chunk, controller) {
                    // Forward the chunk
                    controller.enqueue(chunk);
                    // Convert chunk to string for processing
                    const chunkText = new TextDecoder().decode(chunk);
                    buffer += chunkText;
                    // Process data chunks
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    // Process each line
                    for (const line of lines) {
                        if (line.trim() === '')
                            continue;
                        if (line.trim() === 'data: [DONE]')
                            continue;
                        try {
                            // Parse the data string
                            const data = line.startsWith('data: ')
                                ? JSON.parse(line.slice(6))
                                : JSON.parse(line);
                            // Process OpenAI stream format
                            const delta = data.choices[0]?.delta;
                            if (delta?.content) {
                                responseContent += delta.content;
                                estimatedCompletionTokens += Math.ceil(delta.content.length / 4);
                                if (callbacks?.onToken) {
                                    callbacks.onToken(delta.content);
                                }
                            }
                            // Check for finish reason
                            if (data.choices[0]?.finish_reason) {
                                finishReason = data.choices[0].finish_reason;
                            }
                        }
                        catch (e) {
                            // Skip invalid JSON lines
                            if (line.trim() !== 'data: [DONE]' && !line.trim().startsWith('{')) {
                                console.warn('Error parsing stream line:', line);
                            }
                        }
                    }
                },
                async flush(controller) {
                    // Process any remaining buffer
                    if (buffer.trim() && !buffer.trim().startsWith('data: [DONE]')) {
                        try {
                            // Parse the data string
                            const data = buffer.startsWith('data: ')
                                ? JSON.parse(buffer.slice(6))
                                : JSON.parse(buffer);
                            // Process OpenAI stream format
                            const delta = data.choices[0]?.delta;
                            if (delta?.content) {
                                responseContent += delta.content;
                                estimatedCompletionTokens += Math.ceil(delta.content.length / 4);
                                if (callbacks?.onToken) {
                                    callbacks.onToken(delta.content);
                                }
                            }
                            // Check for finish reason
                            if (data.choices[0]?.finish_reason) {
                                finishReason = data.choices[0].finish_reason;
                            }
                        }
                        catch (e) {
                            // Skip invalid JSON
                        }
                    }
                    // Invoke onComplete callback with result summary
                    if (callbacks?.onComplete) {
                        callbacks.onComplete({
                            content: responseContent,
                            totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
                            promptTokens: estimatedPromptTokens,
                            completionTokens: estimatedCompletionTokens,
                            finishReason: finishReason || undefined
                        });
                    }
                    // Update token usage estimates - using the captured 'self'
                    self.tokenUsage.prompt += estimatedPromptTokens;
                    self.tokenUsage.completion += estimatedCompletionTokens;
                    self.tokenUsage.total += estimatedPromptTokens + estimatedCompletionTokens;
                }
            });
            // Return the transformed stream
            return response.body.pipeThrough(processor);
        }
        catch (error) {
            if (callbacks?.onError) {
                callbacks.onError(this.formatError(error));
            }
            throw this.formatError(error);
        }
    }
    /**
     * Count tokens in text using cached encoder for performance
     */
    async countTokens(text) {
        // First ensure we have a tokenizer loaded
        if (!OpenAILLM.tokenizer) {
            OpenAILLM.tokenizer = encode;
        }
        // Use the cached tokenizer to count tokens
        return OpenAILLM.tokenizer(text).length;
    }
    /**
     * Get the total tokens used across all requests
     */
    getTokenUsage() {
        return { ...this.tokenUsage };
    }
    /**
     * Get the number of API requests made
     */
    getRequestCount() {
        return this.openAIFetchCount;
    }
    /**
     * Clear the response cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Execute a fetch request with automatic retries
     */
    async executeWithRetries(url, init, attempt = 1) {
        try {
            const response = await fetch(url, init);
            if (response.ok) {
                return await response.json();
            }
            // Handle retryable error status codes
            const status = response.status;
            const retryable = RETRY_STATUS_CODES.includes(status);
            if (retryable && attempt <= this.maxRetries) {
                // Calculate backoff with jitter for better performance under load
                const delay = Math.min(this.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 100, 10000 // Max 10s delay
                );
                if (this.enableLogging) {
                    console.log(`Retrying OpenAI request after ${delay}ms (attempt ${attempt}/${this.maxRetries})`);
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.executeWithRetries(url, init, attempt + 1);
            }
            // Not retryable or max retries reached
            const errorText = await response.text();
            throw new Error(`OpenAI API Error (${status}): ${errorText}`);
        }
        catch (error) {
            // Special handling for timeout or network errors on retries
            if (error instanceof Error && error.name === 'TimeoutError' && attempt <= this.maxRetries) {
                const delay = Math.min(this.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 100, 10000 // Max 10s delay
                );
                if (this.enableLogging) {
                    console.log(`Retrying OpenAI request after timeout (${delay}ms, attempt ${attempt}/${this.maxRetries})`);
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.executeWithRetries(url, init, attempt + 1);
            }
            throw error;
        }
    }
    /**
     * Generate a cache key from messages and settings
     */
    generateCacheKey(messages, model, temperature, maxTokens) {
        // Use a deterministic string representation of messages and settings as the cache key
        return JSON.stringify({
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                ...(msg.name ? { name: msg.name } : {})
            })),
            model,
            temperature,
            maxTokens
        });
    }
    /**
     * Serialize messages to a single string for token counting
     */
    serializeMessages(messages) {
        return messages.map(msg => {
            // Use a consistent format that approximates token usage
            return `${msg.role}: ${msg.content}`;
        }).join('\n');
    }
    /**
     * Get headers for OpenAI API requests
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
        };
        if (this.organization) {
            headers['OpenAI-Organization'] = this.organization;
        }
        return headers;
    }
    /**
     * Format error for consistent error handling
     */
    formatError(error) {
        if (error instanceof Error) {
            // Add OpenAI prefix for clarity
            return new Error(`OpenAI Error: ${error.message}`);
        }
        return new Error(`OpenAI unknown error: ${String(error)}`);
    }
}
//# sourceMappingURL=OpenAILLM.js.map