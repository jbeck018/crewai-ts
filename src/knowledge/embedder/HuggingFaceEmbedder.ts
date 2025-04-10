/**
 * HuggingFace Embedder Implementation
 * 
 * Optimized embedder using HuggingFace's embedding models
 * with support for both API-based and local inference
 */

import { BaseEmbedder, BaseEmbedderOptions } from './BaseEmbedder.js';

/**
 * HuggingFace API response type for embeddings
 */
interface HuggingFaceEmbeddingResponse {
  embeddings?: number[][];
  error?: string;
}

/**
 * HuggingFace Embedder Options
 */
export interface HuggingFaceEmbedderOptions extends BaseEmbedderOptions {
  /**
   * HuggingFace API token
   */
  apiToken?: string;

  /**
   * HuggingFace API URL
   * @default 'https://api-inference.huggingface.co/models/'
   */
  apiUrl?: string;

  /**
   * Whether to use local inference (requires optional dependencies)
   * @default false
   */
  useLocal?: boolean;

  /**
   * Local model path (only used if useLocal is true)
   * Only relevant when useLocal is true
   */
  localModelPath?: string;

  /**
   * Maximum sequence length for the model
   * @default 512
   */
  maxLength?: number;

  /**
   * Whether to use the average of token embeddings (vs CLS token)
   * @default true
   */
  useAveragePooling?: boolean;

  /**
   * Timeout for API requests in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;
}

/**
 * Let TypeScript know about optional dependencies
 */
declare global {
  interface Window {
    // Optional dependencies will be dynamically imported
    transformer?: any;
  }
}

/**
 * HuggingFace Embedder Implementation
 * 
 * Uses HuggingFace's embedding models with optimized performance
 * Supports both API-based and local inference
 */
export class HuggingFaceEmbedder extends BaseEmbedder {
  /**
   * API token for HuggingFace
   */
  private apiToken: string;

  /**
   * API URL
   */
  private apiUrl: string;

  /**
   * Whether to use local inference
   */
  private useLocal: boolean;

  /**
   * Local model path
   */
  private localModelPath?: string;

  /**
   * Local model instance (lazy loaded)
   */
  private localModel: any = null;

  /**
   * Transformer tokenizer instance (lazy loaded)
   */
  private tokenizer: any = null;

  /**
   * Maximum sequence length
   */
  private maxLength: number;

  /**
   * Whether to use average pooling
   */
  private useAveragePooling: boolean;

  /**
   * Request timeout
   */
  private timeout: number;

  /**
   * Constructor for HuggingFaceEmbedder
   */
  constructor(options: HuggingFaceEmbedderOptions = {}) {
    // Set provider to HuggingFace
    super({
      ...options,
      provider: 'huggingface',
      // Default model if not specified
      model: options.model || 'sentence-transformers/all-MiniLM-L6-v2',
      // Dimensions based on model
      dimensions: options.dimensions || 384
    });

    // Set local inference flag
    this.useLocal = options.useLocal || false;

    // Setup API or local inference
    if (this.useLocal) {
      // Local inference setup
      this.localModelPath = options.localModelPath || this.options.model;
      this.apiToken = '';
      this.apiUrl = '';
    } else {
      // API inference setup
      this.apiToken = options.apiToken || process.env.HUGGINGFACE_API_TOKEN || '';
      if (!this.apiToken) {
        throw new Error('HuggingFace API token is required for API inference. Provide it in options or set HUGGINGFACE_API_TOKEN environment variable.');
      }
      this.apiUrl = options.apiUrl || 'https://api-inference.huggingface.co/models/';
    }

    // Set maximum sequence length
    this.maxLength = options.maxLength || 512;

    // Set pooling strategy
    this.useAveragePooling = options.useAveragePooling !== undefined ? options.useAveragePooling : true;

    // Set timeout
    this.timeout = options.timeout || 30000;

    // Initialize local model if needed
    if (this.useLocal) {
      this.initializeLocalModel().catch(error => {
        console.error('Failed to initialize local model:', error);
      });
    }
  }

  /**
   * Initialize local model
   * @returns Promise resolving when model is loaded
   */
  private async initializeLocalModel(): Promise<void> {
    if (!this.useLocal) return;

    try {
      // Check if transformers.js is available
      let transformer;
      try {
        // Dynamic import for transformers.js
        // We're using dynamic import for optional dependency
        // @ts-ignore - Optional dependency that might not be installed
        transformer = await import('@xenova/transformers');
      } catch (e) {
        throw new Error('Local inference requires @xenova/transformers. Install it with npm install @xenova/transformers');
      }

      if (this.options.debug) {
        console.log(`Loading local model: ${this.localModelPath}`);
      }

      // Load tokenizer and model
      this.tokenizer = await transformer.AutoTokenizer.from_pretrained(this.localModelPath);
      this.localModel = await transformer.AutoModel.from_pretrained(this.localModelPath);

      if (this.options.debug) {
        console.log('Local model loaded successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize local model: ${errorMessage}`);
    }
  }

  /**
   * Embed text using HuggingFace's embedding models
   * @param text Text to embed
   * @returns Promise resolving to Float32Array of embeddings
   */
  protected async embedText(text: string): Promise<Float32Array> {
    try {
      let embedding: number[];

      if (this.useLocal) {
        // Use local inference
        embedding = await this.getLocalEmbedding(text);
      } else {
        // Use API inference
        embedding = await this.getApiEmbedding(text);
      }

      // Convert to Float32Array and normalize if needed
      const float32Embedding = new Float32Array(embedding);
      
      return this.options.normalize 
        ? this.normalizeVector(float32Embedding)
        : float32Embedding;
    } catch (error) {
      // Enhance error with helpful context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`HuggingFace embedding failed: ${errorMessage}`);
    }
  }

  /**
   * Get embedding using local model
   * @param text Text to embed
   * @returns Promise resolving to embedding vector
   */
  private async getLocalEmbedding(text: string): Promise<number[]> {
    // Ensure model is initialized
    if (!this.localModel || !this.tokenizer) {
      await this.initializeLocalModel();
      
      // Double-check initialization
      if (!this.localModel || !this.tokenizer) {
        throw new Error('Failed to initialize local model');
      }
    }

    try {
      // Tokenize input
      const inputs = await this.tokenizer(text, {
        padding: true,
        truncation: true,
        max_length: this.maxLength,
        return_tensors: 'pt'
      });

      // Get model outputs
      const output = await this.localModel(inputs);
      
      // Extract embeddings based on pooling strategy
      let embedding: number[];
      
      if (this.useAveragePooling) {
        // Use average pooling over all tokens (better for sentence-transformers models)
        const lastHiddenState = output.last_hidden_state;
        const attentionMask = inputs.attention_mask;
        
        // Average the token embeddings
        embedding = this.averagePooling(lastHiddenState, attentionMask);
      } else {
        // Use CLS token embedding (first token)
        embedding = Array.from(output.last_hidden_state[0][0].data);
      }

      // Convert to correct dimensions if needed
      if (embedding.length !== this.options.dimensions) {
        console.warn(`Model output dimensions (${embedding.length}) don't match configured dimensions (${this.options.dimensions})`);
      }

      return embedding;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Local embedding generation failed: ${errorMessage}`);
    }
  }

  /**
   * Average pooling for token embeddings
   * @param lastHiddenState Last hidden state from model
   * @param attentionMask Attention mask from tokenizer
   * @returns Average pooled embedding
   */
  private averagePooling(lastHiddenState: any, attentionMask: any): number[] {
    try {
      const batchSize = lastHiddenState.shape[0];
      const seqLength = lastHiddenState.shape[1];
      const hiddenSize = lastHiddenState.shape[2];
      
      // Initialize result array
      const result = new Array(hiddenSize).fill(0);
      
      // Sum token embeddings (for first item in batch only)
      let validTokens = 0;
      
      for (let i = 0; i < seqLength; i++) {
        if (attentionMask.data[i] > 0) { // Only consider tokens with attention
          validTokens++;
          for (let j = 0; j < hiddenSize; j++) {
            result[j] += lastHiddenState.data[i * hiddenSize + j];
          }
        }
      }
      
      // Average by dividing by number of valid tokens
      if (validTokens > 0) {
        for (let j = 0; j < hiddenSize; j++) {
          result[j] /= validTokens;
        }
      }
      
      return result;
    } catch (error) {
      if (this.options.debug) {
        console.error('Error in average pooling:', error);
      }
      
      // Fallback to first token if pooling fails
      return Array.from(lastHiddenState[0][0].data);
    }
  }

  /**
   * Get embedding using HuggingFace API
   * @param text Text to embed
   * @returns Promise resolving to embedding vector
   */
  private async getApiEmbedding(text: string): Promise<number[]> {
    const modelUrl = `${this.apiUrl}${encodeURIComponent(this.options.model)}`;
    
    // Prepare request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiToken}`
    };

    // Prepare request options based on model type
    const isSentenceTransformer = this.options.model.includes('sentence-transformers');
    
    // Body structure depends on model type
    const body = isSentenceTransformer
      ? JSON.stringify({ inputs: text })
      : JSON.stringify({
          inputs: text,
          options: {
            use_cache: true,
            wait_for_model: true
          }
        });

    // Execute request with retry logic
    const response = await this.executeWithRetry(async () => {
      const response = await fetch(modelUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HuggingFace API error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      
      // Check for API error
      if (result.error) {
        throw new Error(`HuggingFace API error: ${result.error}`);
      }

      return result;
    });

    // Handle different response formats based on model type
    if (isSentenceTransformer) {
      // Sentence transformers return direct embeddings
      return response;
    } else if (Array.isArray(response)) {
      // Some models return array of arrays
      return response[0];
    } else if (response.embeddings && Array.isArray(response.embeddings)) {
      // Feature extraction API
      return response.embeddings[0];
    } else {
      // Last resort - try to find embeddings in response
      const firstKey = Object.keys(response)[0];
      if (firstKey && response[firstKey] && Array.isArray(response[firstKey])) {
        return response[firstKey];
      }
      
      throw new Error(`Unexpected response format from HuggingFace API: ${JSON.stringify(response)}`);
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
    let backoff = this.options.retry?.initialBackoff || 500; // Default to 500ms if not specified

    while (retries <= (this.options.retry?.maxRetries || 3)) { // Default to 3 retries
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Only retry on transient errors
        if (this.isTransientError(lastError)) {
          retries++;
          
          if (retries > (this.options.retry?.maxRetries || 3)) { // Default to 3 retries
            break;
          }
          
          // Log retry attempt if debug is enabled
          if (this.options.debug) {
            console.warn(`HuggingFace API request failed, retrying (${retries}/${this.options.retry?.maxRetries || 3}):`, lastError.message);
          }
          
          // Wait with exponential backoff
          await new Promise(resolve => setTimeout(resolve, backoff));
          
          // Increase backoff for next retry, with maximum cap
          backoff = Math.min(backoff * 2, this.options.retry?.maxBackoff || 30000); // Default to 30s max backoff
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
    
    // HuggingFace specific errors
    if (message.includes('model is loading') ||
        message.includes('wait for model') ||
        message.includes('currently loading') ||
        message.includes('server is overloaded')) {
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
