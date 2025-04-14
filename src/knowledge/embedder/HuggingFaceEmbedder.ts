/**
 * HuggingFace Embedder Implementation
 * 
 * Optimized embedder using HuggingFace's embedding models
 * with support for both API-based and local inference
 */

import { BaseEmbedder, BaseEmbedderOptions } from './BaseEmbedder.js';
import { AutoTokenizer, AutoModel } from '@xenova/transformers';

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
   * Model to use for embeddings
   */
  model: string;

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
export class HuggingFaceEmbedder extends BaseEmbedder<HuggingFaceEmbedderOptions> {
  // Initialize with a default value to avoid overwrite error
  protected override _model: string = '';
  protected _apiToken: string;
  protected _apiUrl: string;
  protected override client: any = null;
  protected _localModel: AutoModel | null = null;
  protected _tokenizer: AutoTokenizer | null = null;
  protected _isLocal: boolean;

  constructor(options: HuggingFaceEmbedderOptions) {
    super(options);
    if (!options.model) {
      throw new Error('Model is required for HuggingFaceEmbedder');
    }
    if (!options.apiToken && !options.useLocal) {
      throw new Error('API token is required for API-based inference');
    }
    if (options.useLocal && !options.localModelPath) {
      throw new Error('Local model path is required for local inference');
    }
    this._model = options.model;
    this._apiToken = options.apiToken || '';
    this._apiUrl = options.apiUrl || 'https://api-inference.huggingface.co/models/';
    this._isLocal = options.useLocal || false;
    this.client = {}; // Initialize client
  }

  public override async embed(text: string): Promise<Float32Array> {
    if (!text) {
      throw new Error('Text is required for embedding');
    }

    const embedding = await this.executeWithRetry(async () => {
      const result = await this.embedText(text);
      return result;
    });

    return this.options.normalize ? this.normalizeVector(embedding) : embedding;
  }

  public override async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (!texts?.length) {
      return [];
    }

    const embeddings = await this.executeBatchWithRetry(async () => {
      const results = await Promise.all(texts.map(text => this.embedText(text)));
      return results;
    });

    return this.options.normalize ? embeddings.map(e => this.normalizeVector(e)) : embeddings;
  }

  protected override async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries?: number,
    initialBackoff?: number,
    maxBackoff?: number
  ): Promise<T> {
    return await operation();
  }

  protected override async executeBatchWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries?: number,
    initialBackoff?: number,
    maxBackoff?: number
  ): Promise<T> {
    return await operation();
  }

  protected override isTransientError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network error') ||
      message.includes('connection') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('500') ||
      message.includes('503')
    );
  }

  protected override async embedText(text: string): Promise<Float32Array> {
    if (!text) {
      if (this.options.debug) {
        console.warn('Empty text provided for embedding, returning zero vector');
      }
      return new Float32Array(this.options.dimensions!);
    }

    const cacheKey = this.generateCacheKey(text);
    const cached = this.getCachedEmbedding(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      let embedding: Float32Array;

      if (this._isLocal) {
        // Use local inference
        const localEmbedding = await this.getLocalEmbedding(text);
        embedding = new Float32Array(localEmbedding);
      } else {
        // Use API inference
        const response = await this.getApiEmbedding(text);
        embedding = new Float32Array(response);
      }

      this.cache.set(cacheKey, embedding);
      return embedding;
    } catch (error) {
      console.error(`HuggingFace embedding failed:`, error);
      return new Float32Array(this.options.dimensions!);
    }
  }

  private async initializeLocalModel(): Promise<void> {
    if (!this._isLocal) return;

    try {
      // Check if transformers.js is available
      const transformer = await import('@xenova/transformers');

      if (this.options.debug) {
        console.log(`Loading local model: ${this._model}`);
      }

      // Load tokenizer and model
      this._tokenizer = await transformer.AutoTokenizer.from_pretrained(this._model);
      this._localModel = await transformer.AutoModel.from_pretrained(this._model);

      if (this.options.debug) {
        console.log('Local model loaded successfully');
      }
    } catch (error) {
      console.error('Failed to initialize local model:', error);
      throw error;
    }
  }

  private async getLocalEmbedding(text: string): Promise<number[]> {
    // Ensure model is initialized
    if (!this._localModel || !this._tokenizer) {
      await this.initializeLocalModel();
      
      // Double-check initialization
      if (!this._localModel || !this._tokenizer) {
        throw new Error('Failed to initialize local model');
      }
    }

    try {
      // Tokenize input
      const inputs = await this._tokenizer.encode(text, {
        padding: true,
        truncation: true,
        max_length: this.options.maxLength,
        return_tensors: 'pt'
      });

      // Get embeddings
      const output = await this._localModel.forward(inputs);
      
      // Extract embeddings based on pooling strategy
      let embedding: number[];
      
      if (this.options.useAveragePooling) {
        // Use average pooling over all tokens (better for sentence-transformers models)
        const lastHiddenState = output.last_hidden_state;
        const attentionMask = inputs.attention_mask;
        const mask = attentionMask.unsqueeze(-1).expand(lastHiddenState.shape);
        const masked = lastHiddenState.mul(mask);
        const summed = masked.sum(1);
        const summedMask = mask.sum(1);
        const embeddingTensor = summed.div(summedMask);
        embedding = Array.from(embeddingTensor.data);
      } else {
        // Use CLS token (first token) embedding
        const clsEmbedding = output.last_hidden_state.slice(1, 0, 1);
        embedding = Array.from(clsEmbedding.data);
      }

      return embedding;
    } catch (error) {
      console.error('Error in local embedding:', error);
      throw error;
    }
  }

  private async getApiEmbedding(text: string): Promise<number[]> {
    const modelUrl = `${this._apiUrl}${encodeURIComponent(this._model)}`;
    
    // Prepare request headers
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this._apiToken}`,
      'Content-Type': 'application/json'
    };

    // Prepare request options based on model type
    const isSentenceTransformer = this._model.includes('sentence-transformers');
    
    // Body structure depends on model type
    const body = isSentenceTransformer
      ? { inputs: text }
      : { inputs: { text } };

    try {
      const response = await fetch(modelUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Handle different response formats
      if (Array.isArray(data)) {
        return data[0];
      } else if (data.embeddings) {
        return data.embeddings[0];
      } else if (data.error) {
        throw new Error(`API error: ${data.error}`);
      } else {
        throw new Error(`Unexpected response format from HuggingFace API: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('Error calling HuggingFace API:', error);
      throw error;
    }
  }
}
