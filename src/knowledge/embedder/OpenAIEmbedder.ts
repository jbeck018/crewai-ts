/**
 * OpenAI Embedder Implementation
 * 
 * Optimized embedder using OpenAI's text embedding models
 * with performance enhancements for production use
 */

import { BaseEmbedder, BaseEmbedderOptions } from './BaseEmbedder.js';

/**
 * OpenAI API response type for embeddings
 */
interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Embedder Options
 */
export interface OpenAIEmbedderOptions extends BaseEmbedderOptions {
  /**
   * OpenAI API key
   */
  apiKey?: string;

  /**
   * OpenAI Organization ID
   */
  organization?: string;

  /**
   * OpenAI API URL
   * @default 'https://api.openai.com/v1/embeddings'
   */
  apiUrl?: string;

  /**
   * Timeout for API requests in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;
}

/**
 * OpenAI Embedder Implementation
 * 
 * Uses OpenAI's powerful embedding models with optimized performance
 */
export class OpenAIEmbedder extends BaseEmbedder {
  /**
   * API key for OpenAI
   */
  private apiKey: string;

  /**
   * API URL
   */
  private apiUrl: string;

  /**
   * OpenAI Organization ID
   */
  private organization?: string;

  /**
   * Request timeout
   */
  private timeout: number;

  /**
   * Constructor for OpenAIEmbedder
   */
  constructor(options: OpenAIEmbedderOptions = {}) {
    // Set provider to OpenAI
    super({
      ...options,
      provider: 'openai',
      // Default model if not specified
      model: options.model || 'text-embedding-ada-002',
      // Dimensions based on model
      dimensions: options.dimensions || 1536
    });

    // Get API key from options or environment
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required. Provide it in options or set OPENAI_API_KEY environment variable.');
    }

    // Set organization if provided
    this.organization = options.organization || process.env.OPENAI_ORGANIZATION;

    // Set API URL
    this.apiUrl = options.apiUrl || 'https://api.openai.com/v1/embeddings';

    // Set timeout
    this.timeout = options.timeout || 30000;
  }

  /**
   * Embed text using OpenAI's embedding API
   * @param text Text to embed
   * @returns Promise resolving to Float32Array of embeddings
   */
  protected async embedText(text: string): Promise<Float32Array> {
    try {
      // Prepare request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      };

      // Add organization header if provided
      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      // Prepare request body
      const body = JSON.stringify({
        input: text,
        model: this.options.model
      });

      // Execute request with retry logic
      const embedding = await this.executeWithRetry(async () => {
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(this.timeout)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
        }

        const result = await response.json() as OpenAIEmbeddingResponse;
        return result.data[0].embedding;
      });

      // Convert to Float32Array and normalize if needed
      const float32Embedding = new Float32Array(embedding);
      
      return this.options.normalize 
        ? this.normalizeVector(float32Embedding)
        : float32Embedding;
    } catch (error) {
      // Enhance error with helpful context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI embedding failed: ${errorMessage}`);
    }
  }

  /**
   * Execute a function with retry logic for API resilience
   * @param fn Function to execute
   * @returns Promise resolving to the function's result
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let retries = 0;
    let lastError: Error | null = null;
    let backoff = this.options.retry.initialBackoff;

    while (retries <= this.options.retry.maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Only retry on transient errors
        if (this.isTransientError(lastError)) {
          retries++;
          
          if (retries > this.options.retry.maxRetries) {
            break;
          }
          
          // Log retry attempt if debug is enabled
          if (this.options.debug) {
            console.warn(`OpenAI API request failed, retrying (${retries}/${this.options.retry.maxRetries}):`, lastError.message);
          }
          
          // Wait with exponential backoff
          await new Promise(resolve => setTimeout(resolve, backoff));
          
          // Increase backoff for next retry, with maximum cap
          backoff = Math.min(backoff * 2, this.options.retry.maxBackoff);
        } else {
          // Non-transient error, don't retry
          throw lastError;
        }
      }
    }
    
    // If we've exhausted retries, throw the last error
    throw lastError || new Error('Unknown error during API request');
  }

  /**
   * Check if an error is transient (i.e., worth retrying)
   * @param error Error to check
   * @returns Boolean indicating if error is transient
   */
  private isTransientError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('etimedout') || 
        message.includes('econnreset') || 
        message.includes('econnrefused') ||
        message.includes('network error') ||
        message.includes('aborted') ||
        message.includes('timeout')) {
      return true;
    }
    
    // Rate limiting and server errors
    if (message.includes('rate limit') || 
        message.includes('too many requests') ||
        message.includes('429') ||
        message.includes('500') ||
        message.includes('503')) {
      return true;
    }
    
    return false;
  }
}
