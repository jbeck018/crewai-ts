/**
 * FastEmbedder Implementation
 * 
 * Lightweight, efficient local embeddings using fastembed
 * Optimized for performance and low resource usage
 */

import { BaseEmbedder, BaseEmbedderOptions } from './BaseEmbedder.js';

/**
 * FastEmbedder Options
 */
export interface FastEmbedderOptions extends BaseEmbedderOptions {
  /**
   * Model name
   */
  model: string;

  /**
   * Model path
   */
  modelPath: string;

  /**
   * Dimensions of the embeddings
   */
  dimensions: number;

  /**
   * Maximum sequence length
   */
  maxLength?: number;

  /**
   * Whether to use average pooling
   */
  useAveragePooling?: boolean;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Path to the model cache directory
   * @default 'node_modules/.cache/fastembed'
   */
  cacheDir?: string;

  /**
   * Use multilingual model
   * @default false
   */
  multilingual?: boolean;

  /**
   * Whether to batch inputs internally
   * @default true
   */
  useBatching?: boolean;

  /**
   * Internal batch size for processing
   * @default 32
   */
  internalBatchSize?: number;
}

/**
 * Let TypeScript know about optional dependencies
 */
declare global {
  // Optional FastEmbed dependencies will be dynamically imported
  var FastEmbed: any;
}

/**
 * FastEmbedder
 * 
 * Efficient local embeddings with minimal resource usage
 * Uses fastembed library for optimized performance
 */
export class FastEmbedder extends BaseEmbedder<FastEmbedderOptions> {
  /**
   * FastEmbed model instance (lazy loaded)
   */
  private model: any = null;

  /**
   * Whether the model is ready
   */
  private modelReady: boolean = false;

  /**
   * Model initialization promise (for concurrent calls)
   */
  private initializationPromise: Promise<void> | null = null;

  /**
   * Whether to use multilingual model
   */
  private multilingual: boolean;

  /**
   * Path to model cache directory
   */
  private cacheDir: string;

  /**
   * Maximum text length
   */
  private maxLength: number;

  /**
   * Whether to use internal batching
   */
  private useBatching: boolean;

  /**
   * Internal batch size
   */
  private internalBatchSize: number;

  /**
   * Model path
   */
  protected _modelPath: string;

  /**
   * Dimensions of the embeddings
   */
  protected _dimensions: number;

  /**
   * Maximum sequence length
   */
  protected _maxLength: number;

  /**
   * Whether to use average pooling
   */
  protected _useAveragePooling: boolean;

  /**
   * Request timeout in milliseconds
   */
  protected _timeout: number;

  /**
   * Model instance
   */
  protected _modelInstance: any;

  /**
   * Constructor for FastEmbedder
   */
  constructor(options: FastEmbedderOptions) {
    // Set provider to fastembed
    super(options);
    if (!options.model) {
      throw new Error('Model is required for FastEmbedder');
    }
    if (!options.modelPath) {
      throw new Error('Model path is required for FastEmbedder');
    }
    this._model = options.model;
    this._modelPath = options.modelPath;
    this._dimensions = options.dimensions;
    this._maxLength = options.maxLength || 512;
    this._useAveragePooling = options.useAveragePooling || true;
    this._timeout = options.timeout || 30000;
    this._modelInstance = null;

    // Set model options
    this.multilingual = options.multilingual || false;
    this.cacheDir = options.cacheDir || 'node_modules/.cache/fastembed';
    this.maxLength = options.maxLength || 512;
    this.useBatching = options.useBatching !== undefined ? options.useBatching : true;
    this.internalBatchSize = options.internalBatchSize || 32;

    // Initialize model
    this.initializeModel().catch(error => {
      if (this.options.debug) {
        console.error('Failed to initialize FastEmbed model:', error);
      }
    });
  }

  // /**
  //  * Initialize the FastEmbed model
  //  * @returns Promise resolving when model is loaded
  //  */
  // private async initializeModel(): Promise<void> {
  //   // Return existing initialization if in progress
  //   if (this.initializationPromise) {
  //     return this.initializationPromise;
  //   }

  //   // Create new initialization promise
  //   this.initializationPromise = this._initializeModel();
  //   return this.initializationPromise;
  // }

  /**
   * Internal initialization logic
   */
  private async _initializeModel(): Promise<void> {
    try {
      // Check if fastembed is available
      try {
        // Dynamic import for fastembed
        // @ts-ignore - Optional dependency that might not be installed
        const { FastEmbed } = await import('fastembed');
        global.FastEmbed = FastEmbed;
      } catch (e) {
        throw new Error('FastEmbedder requires fastembed. Install it with npm install fastembed');
      }

      if (this.options.debug) {
        console.log(`Initializing FastEmbed model: ${this.options.model}`);
      }

      // Initialize model based on configuration
      const FastEmbed = global.FastEmbed;

      // Select the right model based on configuration
      const modelName = this.multilingual ? 'BAAI/bge-small-en-v1.5' : this.options.model;

      // Initialize the model
      this.model = new FastEmbed({
        model: modelName,
        cacheDir: this.cacheDir,
        maxLength: this.maxLength,
        useBatching: this.useBatching,
        batchSize: this.internalBatchSize
      });

      // Wait for model to be ready
      await this.model.init();
      this.modelReady = true;

      if (this.options.debug) {
        console.log('FastEmbed model initialized successfully');
      }
    } catch (error) {
      this.modelReady = false;
      this.initializationPromise = null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize FastEmbed model: ${errorMessage}`);
    }
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
      if (!this._modelInstance) {
        await this.initializeModel();
      }

      const embedding = await this._modelInstance.embed(text);
      this.cache.set(cacheKey, embedding);
      return embedding;
    } catch (error) {
      console.error('Fast embedding failed:', error);
      return new Float32Array(this._dimensions);
    }
  }

  private async initializeModel(): Promise<void> {
    try {
      // Load the model
      const model = await import(this._modelPath);
      this._modelInstance = model[this._model];
      
      if (this.options.debug) {
        console.log(`Loaded model: ${this._model}`);
      }
    } catch (error) {
      console.error('Failed to initialize model:', error);
      throw error;
    }
  }
}
