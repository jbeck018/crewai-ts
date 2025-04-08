/**
 * Anthropic LLM Provider Implementation
 * 
 * High-performance implementation of the BaseLLM interface for Anthropic's Claude models.
 * Optimized for efficient token usage, streaming, and error handling.
 */

import { BaseLLM, LLMMessage, LLMOptions, LLMResult } from '../BaseLLM.js';

// Default settings optimized for performance
const DEFAULT_MODEL = 'claude-3-opus-20240229';
const DEFAULT_TIMEOUT_MS = 120000; // 120 seconds (Claude can be slower)
const MAX_RETRIES = 4;
const RETRY_STATUS_CODES = [429, 500, 502, 503, 504];

// Token limits by model for optimization
const MODEL_CONTEXT_WINDOW: Record<string, number> = {
  'claude-2': 100000,
  'claude-2.0': 100000,
  'claude-2.1': 200000,
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
  'claude-instant-1': 100000,
  'claude-instant-1.2': 100000
};

// Interface for Anthropic API responses
interface AnthropicResponse {
  id: string;
  type: string;
  model: string;
  content: { type: string; text: string }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason: string;
  stop_sequence?: string;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | { type: 'text'; text: string }[];
}

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
export class AnthropicLLM implements BaseLLM {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens?: number;
  private readonly defaultTemperature: number;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly enableLogging: boolean;
  
  // Performance optimizations
  private readonly cache: Map<string, LLMResult>;
  private tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  } = { prompt: 0, completion: 0, total: 0 };
  private anthropicFetchCount = 0;
  
  constructor(config: AnthropicLLMConfig = {}) {
    // Core configuration
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.defaultModel = config.modelName || DEFAULT_MODEL;
    this.defaultMaxTokens = config.maxTokens;
    this.defaultTemperature = config.temperature !== undefined ? config.temperature : 0.7;
    
    // Performance settings
    this.timeout = config.timeout || DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries || MAX_RETRIES;
    this.retryDelay = config.retryDelay || 1000;
    this.enableLogging = config.enableLogging || false;
    
    // Initialize result cache for optimization
    this.cache = config.cache || new Map<string, LLMResult>();
    
    // Validate API key
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required. Set it in the config or as ANTHROPIC_API_KEY environment variable.');
    }
  }
  
  /**
   * Send a completion request to the Anthropic API
   * Optimized with caching, retries, and token management
   */
  async complete(messages: LLMMessage[], options: Partial<LLMOptions> = {}): Promise<LLMResult> {
    // Apply options with defaults
    const modelName = options.modelName || this.defaultModel;
    const temperature = options.temperature !== undefined ? options.temperature : this.defaultTemperature;
    const maxTokens = options.maxTokens || this.defaultMaxTokens || 4096;
    
    // Generate cache key for message/settings combination
    const cacheKey = this.generateCacheKey(messages, modelName, temperature, maxTokens);
    
    // Check cache first (if not explicitly disabled)
    if (!options.streaming && this.cache.has(cacheKey)) {
      if (this.enableLogging) console.log('u2713 Using cached LLM response');
      return this.cache.get(cacheKey)!;
    }
    
    try {
      // Track API call count
      this.anthropicFetchCount++;
      
      // Convert to Anthropic message format
      const anthropicMessages = this.convertToAnthropicMessages(messages);
      
      // Prepare request payload
      const payload = {
        model: modelName,
        messages: anthropicMessages,
        temperature,
        max_tokens: maxTokens,
        ...(options.topP !== undefined ? { top_p: options.topP } : {})
      };
      
      // Execute request with automatic retries
      const response = await this.executeWithRetries<AnthropicResponse>(
        `${this.baseUrl}/messages`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeout)
        }
      );
      
      // Extract text from the response
      const content = response.content[0]?.text || '';
      
      // Process response
      const result: LLMResult = {
        content,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
        promptTokens: response.usage?.input_tokens,
        completionTokens: response.usage?.output_tokens,
        finishReason: response.stop_reason
      };
      
      // Update token usage stats
      if (response.usage) {
        this.tokenUsage.prompt += response.usage.input_tokens;
        this.tokenUsage.completion += response.usage.output_tokens;
        this.tokenUsage.total += response.usage.input_tokens + response.usage.output_tokens;
      }
      
      // Cache the result (if not streaming)
      if (!options.streaming) {
        this.cache.set(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      if (this.enableLogging) {
        console.error('Anthropic API Error:', error);
      }
      throw this.formatError(error);
    }
  }
  
  /**
   * Send a streaming completion request to the Anthropic API
   * Optimized for low-latency streaming and efficient token handling
   */
  async completeStreaming(
    messages: LLMMessage[],
    options: Partial<LLMOptions> = {},
    callbacks?: {
      onToken?: (token: string) => void;
      onComplete?: (result: LLMResult) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<ReadableStream<Uint8Array> | null> {
    // Apply options with defaults
    const modelName = options.modelName || this.defaultModel;
    const temperature = options.temperature !== undefined ? options.temperature : this.defaultTemperature;
    const maxTokens = options.maxTokens || this.defaultMaxTokens || 4096;
    
    try {
      // Track API call
      this.anthropicFetchCount++;
      
      // Convert to Anthropic message format
      const anthropicMessages = this.convertToAnthropicMessages(messages);
      
      // Prepare streaming request payload
      const payload = {
        model: modelName,
        messages: anthropicMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        ...(options.topP !== undefined ? { top_p: options.topP } : {})
      };
      
      // Execute fetch request without retries for streaming
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API Error (${response.status}): ${errorText}`);
      }
      
      if (!response.body) {
        throw new Error('Stream not available');
      }
      
      // Process the stream efficiently with minimal overhead
      let buffer = '';
      let responseContent = '';
      let stopReason: string | null = null;
      let inputTokens = 0;
      let outputTokens = 0;
      
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
            if (line.trim() === '') continue;
            if (line.trim() === 'data: [DONE]') continue;
            
            try {
              if (!line.startsWith('data: ')) continue;
              
              // Parse the data string
              const data = JSON.parse(line.slice(6));
              
              // Process Anthropic stream format
              if (data.type === 'content_block_delta') {
                const deltaText = data.delta?.text || '';
                responseContent += deltaText;
                outputTokens += 1; // Rough approximation
                
                if (callbacks?.onToken) {
                  callbacks.onToken(deltaText);
                }
              } else if (data.type === 'message_stop' && data.message) {
                stopReason = data.message.stop_reason || null;
                // Safely access nested properties with optional chaining
                if (data.message.usage) {
                  inputTokens = data.message.usage.input_tokens || 0;
                  outputTokens = data.message.usage.output_tokens || 0;
                }
              }
            } catch (e) {
              // Skip invalid JSON lines
              console.warn('Error parsing stream line:', e);
            }
          }
        },
        async flush(controller) {
          // Process any remaining buffer
          if (buffer.trim() && !buffer.trim().startsWith('data: [DONE]')) {
            try {
              if (buffer.startsWith('data: ')) {
                const data = JSON.parse(buffer.slice(6));
                
                // Process Anthropic stream format
                if (data.type === 'content_block_delta') {
                  const deltaText = data.delta?.text || '';
                  responseContent += deltaText;
                  outputTokens += 1; // Rough approximation
                  
                  if (callbacks?.onToken) {
                    callbacks.onToken(deltaText);
                  }
                } else if (data.type === 'message_stop' && data.message) {
                  stopReason = data.message.stop_reason || null;
                  // Safely access nested properties with optional chaining
                  if (data.message.usage) {
                    inputTokens = data.message.usage.input_tokens || 0;
                    outputTokens = data.message.usage.output_tokens || 0;
                  }
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
          
          // Update token usage using the captured 'self' reference
          self.tokenUsage.prompt += inputTokens;
          self.tokenUsage.completion += outputTokens;
          self.tokenUsage.total += inputTokens + outputTokens;
          
          // Invoke onComplete callback with result summary
          if (callbacks?.onComplete) {
            callbacks.onComplete({
              content: responseContent,
              totalTokens: inputTokens + outputTokens,
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              finishReason: stopReason || undefined
            });
          }
        }
      });
      
      // Return the transformed stream
      return response.body.pipeThrough(processor);
    } catch (error) {
      if (callbacks?.onError) {
        callbacks.onError(this.formatError(error));
      }
      throw this.formatError(error);
    }
  }
  
  /**
   * Count tokens in text using a simple approximation
   * Note: This is a rough approximation only - Claude's exact tokenization is not public
   */
  async countTokens(text: string): Promise<number> {
    // Use a 3.5 words to 1 token approximation for Claude
    const words = text.split(/\s+/).length;
    return Math.ceil(words / 3.5);
  }
  
  /**
   * Get the total tokens used across all requests
   */
  getTokenUsage(): { prompt: number; completion: number; total: number } {
    return { ...this.tokenUsage };
  }
  
  /**
   * Get the number of API requests made
   */
  getRequestCount(): number {
    return this.anthropicFetchCount;
  }
  
  /**
   * Clear the response cache
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Convert standard LLM messages to Anthropic format
   */
  private convertToAnthropicMessages(messages: LLMMessage[]): AnthropicMessage[] {
    const anthropicMessages: AnthropicMessage[] = [];
    let pendingSystemMessage = '';
    
    // Process messages and handle system messages appropriately
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      // Early continue if message is undefined
      if (!message) continue;
      
      const role = message.role || '';
      const content = message.content || '';
      
      if (role === 'system') {
        // Collect system messages to prepend to the first user message
        pendingSystemMessage += content + '\n';
      } else if (role === 'user' || role === 'assistant') {
        // For user and assistant, map directly
        if (role === 'user' && pendingSystemMessage && content) {
          // Prepend system message to the first user message
          anthropicMessages.push({
            role: 'user',
            content: pendingSystemMessage.trim() + '\n\n' + content
          });
          pendingSystemMessage = ''; // Clear pending system message
        } else {
          anthropicMessages.push({
            role: role === 'user' ? 'user' : 'assistant',
            content: content
          });
        }
      }
      // Skip 'function' role messages as Anthropic doesn't support them directly
    }
    
    // If we had system messages but no user message followed, add a default user message
    if (pendingSystemMessage) {
      anthropicMessages.push({
        role: 'user',
        content: pendingSystemMessage.trim() + '\n\nPlease respond to the above instructions.'
      });
    }
    
    return anthropicMessages;
  }
  
  /**
   * Execute a fetch request with automatic retries
   */
  private async executeWithRetries<T>(url: string, init: RequestInit, attempt = 1): Promise<T> {
    try {
      const response = await fetch(url, init);
      
      if (response.ok) {
        return await response.json() as T;
      }
      
      // Handle retryable error status codes
      const status = response.status;
      const retryable = RETRY_STATUS_CODES.includes(status);
      
      if (retryable && attempt <= this.maxRetries) {
        // Calculate backoff with jitter for better performance under load
        const delay = Math.min(
          this.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 200,
          15000 // Max 15s delay (Claude can be slower)
        );
        
        if (this.enableLogging) {
          console.log(`Retrying Anthropic request after ${delay}ms (attempt ${attempt}/${this.maxRetries})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetries<T>(url, init, attempt + 1);
      }
      
      // Not retryable or max retries reached
      const errorText = await response.text();
      throw new Error(`Anthropic API Error (${status}): ${errorText}`);
    } catch (error) {
      // Special handling for timeout or network errors on retries
      if (error instanceof Error && error.name === 'TimeoutError' && attempt <= this.maxRetries) {
        const delay = Math.min(
          this.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 200,
          15000 // Max 15s delay
        );
        
        if (this.enableLogging) {
          console.log(`Retrying Anthropic request after timeout (${delay}ms, attempt ${attempt}/${this.maxRetries})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetries<T>(url, init, attempt + 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Generate a cache key from messages and settings
   */
  private generateCacheKey(messages: LLMMessage[], model: string, temperature: number, maxTokens?: number): string {
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
   * Get headers for Anthropic API requests
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01'
    };
  }
  
  /**
   * Format error for consistent error handling
   */
  private formatError(error: any): Error {
    if (error instanceof Error) {
      // Add Anthropic prefix for clarity
      return new Error(`Anthropic Error: ${error.message}`);
    }
    return new Error(`Anthropic unknown error: ${String(error)}`);
  }
}
