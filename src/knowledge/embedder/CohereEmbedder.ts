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
  embeddings: number[][] | null;
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
  apiKey: string;

  /**
   * Model to use for embeddings
   */
  model?: string;

  /**
   * API URL
   */
  apiUrl?: string;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Cohere Embedder Implementation
 * 
 * Uses Cohere's embedding models with optimized performance characteristics
 */
export class CohereEmbedder extends BaseEmbedder<CohereEmbedderOptions> {
  protected _apiKey: string;
  protected _apiUrl: string;

  constructor(options: CohereEmbedderOptions) {
    super(options);
    if (!options.apiKey) {
      throw new Error('API key is required for CohereEmbedder');
    }
    this._apiKey = options.apiKey;
    this._model = options.model || 'small';
    this._apiUrl = options.apiUrl || 'https://api.cohere.ai/v1/embed';
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
      const response = await fetch(this._apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this._apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          texts: [text],
          model: this._model,
          truncate: 'END'
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const embedding = new Float32Array(data.embeddings[0]);

      this.cache.set(cacheKey, embedding);
      return embedding;
    } catch (error) {
      console.error('Cohere embedding failed:', error);
      return new Float32Array(this.options.dimensions!);
    }
  }
}
