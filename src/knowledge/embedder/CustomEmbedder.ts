/**
 * Custom Embedder Implementation
 * 
 * Wrapper for user-provided embedding functions
 * with the same optimizations as built-in embedders
 */

import { BaseEmbedder, BaseEmbedderOptions } from './BaseEmbedder.js';

/**
 * Custom Embedder Options
 */
export interface CustomEmbedderOptions extends BaseEmbedderOptions {
  /**
   * Embedding function to use
   */
  embeddingFunction: (text: string) => Promise<Float32Array>;

  /**
   * Model name
   */
  model?: string;

  /**
   * Provider name
   */
  provider?: string;

  /**
   * Cache size
   * @default 1000
   */
  cacheSize?: number;

  /**
   * Cache TTL in milliseconds
   * @default 3600000 (1 hour)
   */
  cacheTTL?: number;

  /**
   * Dimensions of the embeddings
   */
  dimensions: number;
}

/**
 * Custom Embedder Implementation
 * 
 * Allows using any embedding function with the standardized interface
 * while benefiting from the optimizations in BaseEmbedder
 */
export class CustomEmbedder extends BaseEmbedder<CustomEmbedderOptions> {
  protected _embeddingFunction: (text: string) => Promise<Float32Array>;
  protected _dimensions: number;

  constructor(options: CustomEmbedderOptions) {
    super(options);
    if (!options.embeddingFunction) {
      throw new Error('Embedding function is required for CustomEmbedder');
    }
    this._embeddingFunction = options.embeddingFunction;
    this._dimensions = options.dimensions;
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
      return new Float32Array(this._dimensions);
    }

    const cacheKey = this.generateCacheKey(text);
    const cached = this.getCachedEmbedding(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const embedding = await this._embeddingFunction(text);
      this.cache.set(cacheKey, embedding);
      return embedding;
    } catch (error) {
      console.error('Custom embedding failed:', error);
      return new Float32Array(this._dimensions);
    }
  }
}
