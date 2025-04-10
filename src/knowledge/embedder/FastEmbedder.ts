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
   * Path to the model cache directory
   * @default 'node_modules/.cache/fastembed'
   */
  cacheDir?: string;

  /**
   * Maximum text length to process
   * @default 512
   */
  maxLength?: number;

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
export class FastEmbedder extends BaseEmbedder {
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
   * Constructor for FastEmbedder
   */
  constructor(options: FastEmbedderOptions = {}) {
    // Set provider to fastembed
    super({
      ...options,
      provider: 'fastembed',
      // Default model if not specified
      model: options.model || 'BAAI/bge-small-en',
      // Set dimensions based on model
      dimensions: options.dimensions || 384
    });

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

  /**
   * Initialize the FastEmbed model
   * @returns Promise resolving when model is loaded
   */
  private async initializeModel(): Promise<void> {
    // Return existing initialization if in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Create new initialization promise
    this.initializationPromise = this._initializeModel();
    return this.initializationPromise;
  }

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

  /**
   * Embed text using FastEmbed
   * @param text Text to embed
   * @returns Promise resolving to Float32Array of embeddings
   */
  protected async embedText(text: string): Promise<Float32Array> {
    try {
      // Ensure model is initialized
      if (!this.modelReady) {
        await this.initializeModel();
        if (!this.modelReady) {
          throw new Error('Failed to initialize FastEmbed model');
        }
      }

      // Generate embedding
      const embeddings = await this.model.embed(text);
      
      if (!embeddings || !embeddings[0]) {
        throw new Error('FastEmbed returned empty embedding');
      }

      // Convert to Float32Array
      const float32Embedding = new Float32Array(embeddings[0]);
      
      return this.options.normalize 
        ? this.normalizeVector(float32Embedding)
        : float32Embedding;
    } catch (error) {
      // Enhance error with helpful context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`FastEmbed embedding failed: ${errorMessage}`);
    }
  }

  /**
   * Override batch embedding to use FastEmbed's native batching for better performance
   * @param texts Array of texts to embed
   * @returns Promise resolving to array of Float32Array embeddings
   */
  override async embedBatch(texts: string[]): Promise<Float32Array[]> {
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

    try {
      // Ensure model is initialized
      if (!this.modelReady) {
        await this.initializeModel();
        if (!this.modelReady) {
          throw new Error('Failed to initialize FastEmbed model');
        }
      }

      // Extract texts for embedding
      const justTexts = textsToEmbed.map(item => item.text);

      // Use native batch embedding for optimal performance
      const embeddings = await this.model.embed(justTexts);

      // Process results and cache them
      const batchResults: { index: number; embedding: Float32Array }[] = textsToEmbed.map((item, i) => {
        const embedding = new Float32Array(embeddings[i]);
        const normalizedEmbedding = this.options.normalize 
          ? this.normalizeVector(embedding)
          : embedding;
        
        // Cache the result
        this.cacheEmbedding(this.generateCacheKey(item.text), normalizedEmbedding);
        
        return {
          index: item.index,
          embedding: normalizedEmbedding
        };
      });

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
      // Fall back to individual processing if batch fails
      if (this.options.debug) {
        console.error('Error in batch embedding, falling back to individual embedding:', error);
      }
      
      // Use super.embedBatch as fallback
      return super.embedBatch(texts);
    }
  }
}
