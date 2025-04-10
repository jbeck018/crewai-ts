/**
 * Ollama LLM Provider Implementation
 * 
 * High-performance implementation of the BaseLLM interface for Ollama's local models.
 * Optimized for efficient token usage, streaming, and error handling.
 */

import { BaseLLM, LLMMessage, LLMOptions, LLMResult } from '../BaseLLM.js';

// Default settings optimized for performance
const DEFAULT_MODEL = 'llama3';
const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds
const MAX_RETRIES = 3;
const RETRY_STATUS_CODES = [429, 500, 502, 503, 504];

// Approximate token limits by model - these may vary by Ollama configuration
const MODEL_CONTEXT_WINDOW: Record<string, number> = {
  'llama2': 4096,
  'llama3': 8192,
  'mistral': 8192,
  'mixtral': 32768,
  'codellama': 16384,
  'phi': 2048,
  'gemma': 8192,
  'mpt': 8192
};

// Interface for Ollama API responses
interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// Interface for Ollama streaming responses
interface OllamaStreamResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface OllamaLLMConfig {
  baseUrl?: string;
  modelName?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  cache?: Map<string, LLMResult>;
}

/**
 * Ollama LLM implementation optimized for performance and reliability
 */
export class OllamaLLM implements BaseLLM {
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
  private ollamaFetchCount = 0;
  
  constructor(config: OllamaLLMConfig = {}) {
    // Core configuration
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
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
  }
  
  /**
   * Send a completion request to the Ollama API
   * Optimized with caching, retries, and token management
   */
  async complete(messages: LLMMessage[], options: Partial<LLMOptions> = {}): Promise<LLMResult> {
    // Apply options with defaults
    const modelName = options.modelName || this.defaultModel;
    const temperature = options.temperature !== undefined ? options.temperature : this.defaultTemperature;
    const maxTokens = options.maxTokens || this.defaultMaxTokens || 2048;
    
    // Generate cache key for message/settings combination
    const cacheKey = this.generateCacheKey(messages, modelName, temperature, maxTokens);
    
    // Check cache first (not using streaming)
    if (!options.streaming && this.cache.has(cacheKey)) {
      if (this.enableLogging) {
        console.log(`[OllamaLLM] Cache hit for model ${modelName}`);
      }
      return this.cache.get(cacheKey)!;
    }
    
    try {
      // Prepare Ollama-formatted messages
      const ollamaMessages = this.convertToOllamaMessages(messages);
      
      // Prepare API request
      const url = `${this.baseUrl}/api/chat`;
      const requestBody = {
        model: modelName,
        messages: ollamaMessages,
        options: {
          temperature: temperature,
          num_predict: maxTokens
        },
        stream: false
      };
      
      // Execute with retries for better reliability
      this.ollamaFetchCount++;
      const response = await this.executeWithRetries<OllamaResponse>(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
        // Custom abort signal not supported in LLMOptions interface
      });
      
      // Approximate token counting
      const promptTokens = await this.countTokens(this.serializeMessages(messages));
      const completionTokens = await this.countTokens(response.response);
      
      // Update token usage metrics
      this.tokenUsage.prompt += promptTokens;
      this.tokenUsage.completion += completionTokens;
      this.tokenUsage.total += promptTokens + completionTokens;
      
      // Format response
      const result: LLMResult = {
        content: response.response,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      };
      
      // Cache result for future use (when not streaming)
      if (!options.streaming) {
        this.cache.set(cacheKey, result);
      }
      
      return result;
      
    } catch (error) {
      throw this.formatError(error);
    }
  }
  
  /**
   * Send a streaming completion request to the Ollama API
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
    try {
      // Apply options with defaults
      const modelName = options.modelName || this.defaultModel;
      const temperature = options.temperature !== undefined ? options.temperature : this.defaultTemperature;
      const maxTokens = options.maxTokens || this.defaultMaxTokens || 2048;
      
      // Prepare Ollama-formatted messages
      const ollamaMessages = this.convertToOllamaMessages(messages);
      
      // Prepare API request
      const url = `${this.baseUrl}/api/chat`;
      const requestBody = {
        model: modelName,
        messages: ollamaMessages,
        options: {
          temperature: temperature,
          num_predict: maxTokens
        },
        stream: true
      };
      
      // Track API usage
      this.ollamaFetchCount++;
      
      // Execute request
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody)
        // Custom abort signal not supported in LLMOptions interface
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API Error (${response.status}): ${errorText}`);
      }
      
      if (!response.body) {
        throw new Error('Stream response body is undefined');
      }
      
      let fullContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      
      // Approximate token counting for prompt
      promptTokens = await this.countTokens(this.serializeMessages(messages));
      this.tokenUsage.prompt += promptTokens;
      
      // Reference to the OllamaLLM instance for use in the transform stream
      const self = this;

      // Create TransformStream to process the response chunks
      const transformStream = new TransformStream<Uint8Array, Uint8Array>({
        async transform(chunk, controller) {
          try {
            const text = new TextDecoder().decode(chunk);
            const lines = text.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
              try {
                const data = JSON.parse(line) as OllamaStreamResponse;
                
                // Pass token to callback if provided
                if (callbacks?.onToken && data.response) {
                  callbacks.onToken(data.response);
                }
                
                fullContent += data.response;
                // Forward the chunk
                controller.enqueue(chunk);
                
                // If this is the final chunk, calculate completion tokens
                if (data.done) {
                  completionTokens = await self.countTokens(fullContent);
                  
                  // Update token usage metrics
                  self.tokenUsage.completion += completionTokens;
                  self.tokenUsage.total += promptTokens + completionTokens;
                  
                  if (callbacks?.onComplete) {
                    callbacks.onComplete({
                      content: fullContent,
                      promptTokens,
                      completionTokens,
                      totalTokens: promptTokens + completionTokens
                    });
                  }
                }
              } catch (error) {
                console.error('Error parsing streaming response:', error);
              }
            }
          } catch (error) {
            console.error('Error in transform stream:', error);
            if (callbacks?.onError) {
              callbacks.onError(error instanceof Error ? error : new Error(String(error)));
            }
          }
        },
        
        async flush(controller) {
          try {
            // Ensure we have properly tracked token usage even if the stream ended unexpectedly
            if (!completionTokens && fullContent) {
              completionTokens = await self.countTokens(fullContent);
              
              // Update token usage metrics
              self.tokenUsage.completion += completionTokens;
              self.tokenUsage.total += promptTokens + completionTokens;
              
              if (callbacks?.onComplete) {
                callbacks.onComplete({
                  content: fullContent,
                  promptTokens,
                  completionTokens,
                  totalTokens: promptTokens + completionTokens
                });
              }
            }
          } catch (error) {
            console.error('Error in flush:', error);
            if (callbacks?.onError) {
              callbacks.onError(error instanceof Error ? error : new Error(String(error)));
            }
          }
        }
      });
      
      // Create and return the transformed stream
      return response.body.pipeThrough(transformStream);
      
    } catch (error) {
      // Handle errors gracefully
      if (callbacks?.onError) {
        callbacks.onError(this.formatError(error));
      }
      throw this.formatError(error);
    }
  }
  
  /**
   * Count tokens in text using a simple approximation
   * Note: This is a rough approximation only - Ollama's exact tokenization varies by model
   */
  async countTokens(text: string): Promise<number> {
    // Simple approximation: ~4 characters per token for most models
    // This could be improved with model-specific tokenizers
    return Math.ceil(text.length / 4);
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
    return this.ollamaFetchCount;
  }
  
  /**
   * Clear the response cache
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Convert standard LLM messages to Ollama format
   */
  private convertToOllamaMessages(messages: LLMMessage[]): Array<{ role: string; content: string }> {
    const ollamaMessages: Array<{ role: string; content: string }> = [];
    
    // Process messages in order
    for (const message of messages) {
      const { role, content } = message;
      
      if (role === 'system') {
        // Ollama expects system messages to have the 'system' role
        ollamaMessages.push({
          role: 'system',
          content: content
        });
      } else if (role === 'user' || role === 'assistant') {
        // Map directly to user and assistant roles
        ollamaMessages.push({
          role: role,
          content: content
        });
      }
      // Skip 'function' role messages as Ollama doesn't support them directly
    }
    
    // If no system message was provided, add a default one
    if (!messages.some(msg => msg.role === 'system')) {
      ollamaMessages.unshift({
        role: 'system',
        content: 'You are a helpful assistant.'
      });
    }
    
    return ollamaMessages;
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
          this.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 100,
          10000 // Max 10s delay
        );
        
        if (this.enableLogging) {
          console.log(`Retrying Ollama request after ${delay}ms (attempt ${attempt}/${this.maxRetries})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetries<T>(url, init, attempt + 1);
      }
      
      // Not retryable or max retries reached
      const errorText = await response.text();
      throw new Error(`Ollama API Error (${status}): ${errorText}`);
    } catch (error) {
      // Special handling for timeout or network errors on retries
      if (error instanceof Error && error.name === 'TimeoutError' && attempt <= this.maxRetries) {
        const delay = Math.min(
          this.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 100,
          10000 // Max 10s delay
        );
        
        if (this.enableLogging) {
          console.log(`Retrying Ollama request after timeout (${delay}ms, attempt ${attempt}/${this.maxRetries})`);
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
   * Serialize messages to a single string for token counting
   */
  private serializeMessages(messages: LLMMessage[]): string {
    return messages.map(msg => {
      // Use a consistent format that approximates token usage
      return `${msg.role}: ${msg.content}`;
    }).join('\n');
  }
  
  /**
   * Get headers for Ollama API requests
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Format error for consistent error handling
   */
  private formatError(error: any): Error {
    if (error instanceof Error) {
      // Add Ollama prefix for clarity
      return new Error(`Ollama Error: ${error.message}`);
    }
    return new Error(`Ollama unknown error: ${String(error)}`);
  }
}
