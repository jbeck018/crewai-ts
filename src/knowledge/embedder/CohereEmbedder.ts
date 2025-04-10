/**
 * Cohere Embedder Implementation
 * 
 * Optimized embedder using Cohere's embedding API
 * with performance enhancements for production use
 */

import { BaseEmbedder, BaseEmbedderOptions } from './BaseEmbedder.js';

/**
 * Cohere API response type for embeddings
 */
interface CohereEmbeddingResponse {
  id: string;
  texts: string[];
  embeddings: number[][];
  meta?: {
    api_version?: {
      version: string;
    };
  };
}

/**
 * Cohere Embedder Options
 */
export interface CohereEmbedderOptions extends BaseEmbedderOptions {
  /**
   * Cohere API key
   */
  apiKey?: string;

  /**
   * Cohere API URL
   * @default 'https://api.cohere.ai/v1/embed'
   */
  apiUrl?: string;

  /**
   * Input type for embedding
   * @default 'search_query'
   */
  inputType?: 'search_query' | 'search_document' | 'classification' | 'clustering';

  /**
   * Truncation method
   * @default 'END'
   */
  truncate?: 'NONE' | 'START' | 'END';

  /**
   * Timeout for API requests in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;
}

/**
 * Cohere Embedder Implementation
 * 
 * Uses Cohere's embedding models with optimized performance characteristics
 */
export class CohereEmbedder extends BaseEmbedder {
  /**
   * API key for Cohere
   */
  private apiKey: string;

  /**
   * API URL
   */
  private apiUrl: string;

  /**
   * Input type
   */
  private inputType: 'search_query' | 'search_document' | 'classification' | 'clustering';

  /**
   * Truncation method
   */
  private truncate: 'NONE' | 'START' | 'END';

  /**
   * Request timeout
   */
  private timeout: number;

  /**
   * Constructor for CohereEmbedder
   */
  constructor(options: CohereEmbedderOptions = {}) {
    // Set provider to Cohere
    super({
      ...options,
      provider: 'cohere',
      // Default model if not specified
      model: options.model || 'embed-english-v3.0',
      // Dimensions based on model (Cohere embed-english-v3.0 is 1024 dimensions)
      dimensions: options.dimensions || 1024
    });

    // Get API key from options or environment
    this.apiKey = options.apiKey || process.env.COHERE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Cohere API key is required. Provide it in options or set COHERE_API_KEY environment variable.');
    }

    // Set API URL
    this.apiUrl = options.apiUrl || 'https://api.cohere.ai/v1/embed';

    // Set input type
    this.inputType = options.inputType || 'search_query';

    // Set truncation method
    this.truncate = options.truncate || 'END';

    // Set timeout
    this.timeout = options.timeout || 30000;
  }

  /**
   * Embed text using Cohere's embedding API
   * @param text Text to embed
   * @returns Promise resolving to Float32Array of embeddings
   */
  protected async embedText(text: string): Promise<Float32Array> {
    try {
      // Prepare request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json'
      };

      // Prepare request body
      const body = JSON.stringify({
        texts: [text],
        model: this.options.model,
        input_type: this.inputType,
        truncate: this.truncate
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
          throw new Error(`Cohere API error (${response.status}): ${errorText}`);
        }

        const result = await response.json() as CohereEmbeddingResponse;
        return result.embeddings[0];
      });

      // Convert to Float32Array and normalize if needed
      const float32Embedding = new Float32Array(embedding);
      
      return this.options.normalize 
        ? this.normalizeVector(float32Embedding)
        : float32Embedding;
    } catch (error) {
      // Enhance error with helpful context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Cohere embedding failed: ${errorMessage}`);
    }
  }

  /**
   * Optimize batch embedding by overriding the base implementation
   * to use Cohere's batch API capability
   * @param texts Array of texts to embed
   * @returns Promise resolving to array of Float32Array embeddings
   */
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    // Filter empty texts
    const validTexts = texts.filter(text => text && text.trim() !== '');
    
    if (validTexts.length === 0) {
      if (this.options.debug) {
        console.warn('No valid texts provided for batch embedding');
      }
      return [];
    }

    // Check cache for all texts first
    const cacheResults: (Float32Array | null)[] = validTexts.map(text => {
      const cacheKey = this.generateCacheKey(text);
      return this.getCachedEmbedding(cacheKey);
    });

    // If all results are cached, return them
    if (cacheResults.every(result => result !== null)) {
      return cacheResults as Float32Array[];
    }

    // Find texts that need embedding
    const textsToEmbed: { text: string; index: number }[] = validTexts
      .map((text, index) => ({ text, index }))
      .filter((item, index) => cacheResults[index] === null);

    // Create optimal batches based on batch size
    const batches = this.createBatches(
      textsToEmbed,
      this.options.batchSize
    );

    // Process batches with controlled concurrency
    const batchResults: { index: number; embedding: Float32Array }[] = [];

    try {
      // Process batches in sequence for API rate limit compliance
      for (const batch of batches) {
        // Send a single request for the entire batch for better efficiency
        try {
          const batchTexts = batch.map(item => item.text);
          const embeddings = await this.batchEmbedRequest(batchTexts);
          
          // Cache each embedding
          batch.forEach((item, i) => {
            const embedding = embeddings[i];
            const float32Embedding = new Float32Array(embedding);
            const normalizedEmbedding = this.options.normalize 
              ? this.normalizeVector(float32Embedding)
              : float32Embedding;
              
            // Cache the result
            this.cacheEmbedding(this.generateCacheKey(item.text), normalizedEmbedding);
            
            // Add to results
            batchResults.push({ 
              index: item.index, 
              embedding: normalizedEmbedding 
            });
          });
        } catch (error) {
          if (this.options.debug) {
            console.error(`Error in batch embedding, falling back to individual requests:`, error);
          }
          
          // Fallback to individual embeddings on batch failure
          const batchPromises = batch.map(async item => {
            try {
              const embedding = await this.embedText(item.text);
              return { index: item.index, embedding };
            } catch (error) {
              if (this.options.debug) {
                console.error(`Error embedding text at index ${item.index}:`, error);
              }
              // Return zero vector for failed embeddings
              return {
                index: item.index,
                embedding: new Float32Array(this.options.dimensions)
              };
            }
          });

          // Wait for all embeddings in this batch
          const results = await Promise.all(batchPromises);
          batchResults.push(...results);
        }
      }

      // Combine cached and new results
      const combinedResults: Float32Array[] = new Array(validTexts.length);
      
      // Add cached results
      cacheResults.forEach((result, index) => {
        if (result !== null) {
          combinedResults[index] = result;
        }
      });
      
      // Add new results
      batchResults.forEach(result => {
        combinedResults[result.index] = result.embedding;
      });

      return combinedResults;
    } catch (error) {
      if (this.options.debug) {
        console.error('Error in batch embedding:', error);
      }
      throw error;
    }
  }

  /**
   * Send a batch request to the Cohere API
   * @param texts Array of texts to embed
   * @returns Promise resolving to array of embeddings
   */
  private async batchEmbedRequest(texts: string[]): Promise<number[][]> {
    // Prepare request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'application/json'
    };

    // Prepare request body
    const body = JSON.stringify({
      texts,
      model: this.options.model,
      input_type: this.inputType,
      truncate: this.truncate
    });

    // Execute request with retry logic
    return this.executeWithRetry(async () => {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cohere API error (${response.status}): ${errorText}`);
      }

      const result = await response.json() as CohereEmbeddingResponse;
      return result.embeddings;
    });
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
            console.warn(`Cohere API request failed, retrying (${retries}/${this.options.retry.maxRetries}):`, lastError.message);
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
