/**
 * OpenAI Embedder Implementation
 * 
 * Optimized embedder using OpenAI's text embedding models
 * with performance enhancements for production use
 */

import { BaseEmbedder, BaseEmbedderOptions } from './BaseEmbedder.js';
import OpenAI from 'openai';

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
export class OpenAIEmbedder extends BaseEmbedder<OpenAIEmbedderOptions> {
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
   * OpenAI client
   */
  protected override client: OpenAI = {} as OpenAI;

  /**
   * Constructor for OpenAIEmbedder
   */
  constructor(options: OpenAIEmbedderOptions = {}) {
    // Set provider to OpenAI
    super({
      ...options,
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

    // Initialize OpenAI client
    this.client = new OpenAI({
      apiKey: this.apiKey,
      organization: this.organization,
      baseURL: this.apiUrl,
      timeout: this.timeout
    });
  }

  /**
   * Embed text using OpenAI's embedding API
   * @param text Text to embed
   * @returns Promise resolving to Float32Array of embeddings
   */
  public override async embed(text: string): Promise<Float32Array> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response: OpenAIEmbeddingResponse = await this.client.embeddings.create({
        model: this.options.model || 'text-embedding-3-small',
        input: text,
      });

      if (!response.data[0]?.embedding) {
        throw new Error('Invalid response from OpenAI API');
      }

      return new Float32Array(response.data[0].embedding);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to embed text: ${errorMessage}`);
    }
  }

  /**
   * Embed batch of texts using OpenAI's embedding API
   * @param texts Texts to embed
   * @returns Promise resolving to Float32Array[] of embeddings
   */
  public override async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response: OpenAIEmbeddingResponse = await this.client.embeddings.create({
        model: this.options.model || 'text-embedding-3-small',
        input: texts,
      });

      if (!response.data) {
        throw new Error('Invalid response from OpenAI API');
      }

      return response.data.map((d) => {
        if (!d.embedding) {
          throw new Error('Invalid embedding data');
        }
        return new Float32Array(d.embedding);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to embed batch: ${errorMessage}`);
    }
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
}
