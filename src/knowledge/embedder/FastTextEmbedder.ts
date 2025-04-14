/**
 * FastText Embedder Implementation
 * 
 * Optimized embedder using FastText models for efficient multilingual embeddings
 * with minimal memory footprint and fast execution
 */

import { BaseEmbedder, BaseEmbedderOptions } from './BaseEmbedder.js';

/**
 * FastText Embedder Options
 */
export interface FastTextEmbedderOptions extends BaseEmbedderOptions {
  /**
   * Model name
   */
  model: string;

  /**
   * Path to FastText model file (.bin or .ftz format)
   * If not provided, will attempt to download a default model
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
   * Whether to use quantized models for memory efficiency
   * Quantized models (.ftz) use significantly less memory
   * @default true
   */
  useQuantized?: boolean;

  /**
   * Language for the pre-trained model
   * Only used if modelPath is not provided
   * @default 'en'
   */
  language?: string;

  /**
   * Whether to remove out-of-vocabulary words
   * @default false
   */
  removeOOV?: boolean;

  /**
   * Maximum vocabulary size to load
   * Smaller values improve memory usage
   * @default 100000
   */
  maxVocabSize?: number;

  /**
   * Whether to preload the model during initialization
   * @default true
   */
  preload?: boolean;
}

/**
 * Let TypeScript know about optional dependencies
 */
declare global {
  // Optional FastText dependencies will be dynamically imported
  var FastText: any;
}

/**
 * FastText Embedder
 * 
 * Memory-efficient text embeddings using FastText models
 * Optimized for multilingual support and minimal resource usage
 */
export class FastTextEmbedder extends BaseEmbedder<FastTextEmbedderOptions> {
  /**
   * FastText model instance (lazy loaded)
   */
  private _modelInstance: any = null;

  /**
   * Whether the model is ready
   */
  private _modelReady: boolean = false;

  /**
   * Model initialization promise (for concurrent calls)
   */
  private _initializationPromise: Promise<void> | null = null;

  /**
   * Path to FastText model file
   */
  private _modelPath: string;

  /**
   * Whether to use quantized models
   */
  private _useQuantized: boolean;

  /**
   * Language for pre-trained model
   */
  private _language: string;

  /**
   * Whether to remove OOV words
   */
  private _removeOOV: boolean;

  /**
   * Maximum vocabulary size
   */
  private _maxVocabSize: number;

  /**
   * Word vectors cache for performance
   * Uses a Map for O(1) lookup performance
   */
  private _vectorCache: Map<string, Float32Array> = new Map();

  /**
   * Dimensions of the embeddings
   */
  private _dimensions: number;

  /**
   * Constructor for FastTextEmbedder
   */
  constructor(options: FastTextEmbedderOptions) {
    // Set provider to custom since fasttext is not in the standard provider list
    super({
      ...options,
      provider: 'custom', // Using custom provider type for FastText

      // Default model if not specified
      model: options.model || 'cc.en.300.bin',
      // FastText typically uses 300 dimensions
      dimensions: options.dimensions || 300
    });

    // Set model options
    this._modelPath = options.modelPath || '';
    this._useQuantized = options.useQuantized !== undefined ? options.useQuantized : true;
    this._language = options.language || 'en';
    this._removeOOV = options.removeOOV || false;
    this._maxVocabSize = options.maxVocabSize || 100000;
    this._dimensions = options.dimensions || 300;

    // Preload model if needed
    if (options.preload !== false) {
      this.initializeModel().catch(error => {
        if (this.options.debug) {
          console.error('Failed to initialize FastText model:', error);
        }
      });
    }
  }

  /**
   * Initialize the FastText model
   * @returns Promise resolving when model is loaded
   */
  private async initializeModel(): Promise<void> {
    // Return existing initialization if in progress
    if (this._initializationPromise) {
      return this._initializationPromise;
    }

    // Create new initialization promise
    this._initializationPromise = this._initializeModel();
    return this._initializationPromise;
  }

  /**
   * Internal initialization logic
   */
  private async _initializeModel(): Promise<void> {
    try {
      // Check if fasttext is available
      try {
        // Dynamic import for fasttext - using the 'node-fasttext' wrapper
        // @ts-ignore - Optional dependency that might not be installed
        const FastText = await import('node-fasttext');
        global.FastText = FastText;
      } catch (e) {
        throw new Error('FastTextEmbedder requires node-fasttext. Install it with npm install node-fasttext');
      }

      if (this.options.debug) {
        console.log(`Initializing FastText model`);
      }

      const FastText = global.FastText;

      // Determine the model path
      let modelPath = this._modelPath;
      
      if (!modelPath) {
        // If no model path is provided, use a pre-trained model based on language
        const extension = this._useQuantized ? '.ftz' : '.bin';
        const modelName = `cc.${this._language}.300${extension}`;
        
        // Check if model exists in common locations
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const possiblePaths = [
          // Check current directory
          path.resolve(process.cwd(), modelName),
          // Check models directory
          path.resolve(process.cwd(), 'models', modelName),
          // Check node_modules cache
          path.resolve(process.cwd(), 'node_modules', '.cache', 'fasttext', modelName)
        ];
        
        // Find first existing model file
        for (const possiblePath of possiblePaths) {
          try {
            await fs.access(possiblePath);
            modelPath = possiblePath;
            break;
          } catch {
            // Path doesn't exist, continue checking
          }
        }
        
        if (!modelPath) {
          // Need to download model
          const modelDir = path.resolve(process.cwd(), 'node_modules', '.cache', 'fasttext');
          
          try {
            await fs.mkdir(modelDir, { recursive: true });
          } catch (e) {
            // Directory might already exist
          }
          
          modelPath = path.resolve(modelDir, modelName);
          
          if (this.options.debug) {
            console.log(`Downloading FastText model to ${modelPath}`);
          }
          
          // TODO: Add model downloading logic here
          // For now, we'll require the user to download the model manually
          throw new Error(`FastText model not found. Please download the model and provide its path in modelPath option.`);
        }
      }

      // Initialize the model with memory optimizations
      const fastText = new FastText();
      
      await fastText.loadModel(modelPath, {
        maxVocabSize: this._maxVocabSize
      });
      
      this._modelInstance = fastText;
      this._modelReady = true;

      if (this.options.debug) {
        console.log('FastText model initialized successfully');
      }
    } catch (error) {
      this._modelReady = false;
      this._initializationPromise = null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize FastText model: ${errorMessage}`);
    }
  }

  /**
   * Get word vector from FastText model
   * @param word Word to get vector for
   * @returns Promise resolving to word vector
   */
  private async getWordVector(word: string): Promise<Float32Array | null> {
    // Check cache first
    const cachedVector = this._vectorCache.get(word);
    if (cachedVector) {
      return cachedVector;
    }
    
    // Get vector from model (ensure model is available)
    if (!this._modelInstance || typeof this._modelInstance.getWordVector !== 'function') {
      throw new Error('FastText model not initialized properly');
    }
    
    const vector = await this._modelInstance.getWordVector(word);
    
    // Convert to Float32Array for memory efficiency (ensure vector exists)
    if (!vector || !Array.isArray(vector)) {
      return null;
    }
    
    const float32Vector = new Float32Array(vector);
    
    // Cache vector for future use
    this._vectorCache.set(word, float32Vector);
    
    return float32Vector;
  }

  /**
   * Embed text using FastText
   * Optimized average word embedding approach
   * @param text Text to embed
   * @returns Promise resolving to Float32Array of embeddings
   */
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

      // Tokenize text
      const tokens = text.toLowerCase().match(/[\w\']+|[.,!?;:]/g) || [];
      if (!tokens.length) {
        return new Float32Array(this._dimensions);
      }

      // Get embeddings for each token
      const embeddings: (Float32Array | null)[] = await Promise.all(
        tokens.map(async (token) => {
          const cachedVector = this._vectorCache.get(token);
          if (cachedVector) {
            return cachedVector;
          }

          const embedding = await this.getWordVector(token);
          if (embedding) {
            this._vectorCache.set(token, embedding);
            return embedding;
          }
          return null;
        })
      );

      // Calculate average embedding
      const sum = new Float32Array(this._dimensions);
      embeddings.forEach(embedding => {
        if (embedding) {
          for (let i = 0; i < this._dimensions; i++) {
            // Double null check to ensure both sum and embedding elements exist
            sum[i] = (sum[i] || 0) + (embedding[i] || 0);
          }
        }
      });

      // Average the embeddings
      const validEmbeddings = embeddings.filter((embedding): embedding is Float32Array => embedding !== null && embedding !== undefined);
      const averaged = new Float32Array(this._dimensions);
      const count = validEmbeddings.length || 1; // Prevent division by zero
      for (let i = 0; i < this._dimensions; i++) {
        averaged[i] = (sum[i] || 0) / count;
      }

      // Cache and return
      this.cache.set(cacheKey, averaged);
      return averaged;

    } catch (error) {
      console.error('FastText embedding failed:', error);
      return new Float32Array(this._dimensions);
    }
  }

  public override async embed(text: string): Promise<Float32Array> {
    return this.embedText(text);
  }

  public override async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (!texts || texts.length === 0) {
      return [];
    }
    
    // Ensure model is initialized
    if (!this._modelInstance) {
      await this.initializeModel();
    }
    
    const results: Float32Array[] = [];
    
    for (const text of texts) {
      const embedding = await this.embed(text);
      results.push(embedding);
    }
    
    return results;
  }

  /**
   * Clean up resources when the embedder is no longer needed
   */
  async close(): Promise<void> {
    if (this._modelInstance && typeof this._modelInstance.unloadModel === 'function') {
      try {
        await this._modelInstance.unloadModel();
        this._modelReady = false;
        this._initializationPromise = null;
        this._vectorCache.clear();
        
        if (this.options.debug) {
          console.log('FastText model unloaded');
        }
      } catch (error) {
        if (this.options.debug) {
          console.error('Error unloading FastText model:', error);
        }
      }
    }
  }
}
