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
   * Path to FastText model file (.bin or .ftz format)
   * If not provided, will attempt to download a default model
   */
  modelPath?: string;

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
export class FastTextEmbedder extends BaseEmbedder {
  /**
   * FastText model instance (lazy loaded)
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
   * Path to FastText model file
   */
  private modelPath: string;

  /**
   * Whether to use quantized models
   */
  private useQuantized: boolean;

  /**
   * Language for pre-trained model
   */
  private language: string;

  /**
   * Whether to remove OOV words
   */
  private removeOOV: boolean;

  /**
   * Maximum vocabulary size
   */
  private maxVocabSize: number;

  /**
   * Word vectors cache for performance
   * Uses a Map for O(1) lookup performance
   */
  private vectorCache: Map<string, Float32Array> = new Map();

  /**
   * Constructor for FastTextEmbedder
   */
  constructor(options: FastTextEmbedderOptions = {}) {
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
    this.modelPath = options.modelPath || '';
    this.useQuantized = options.useQuantized !== undefined ? options.useQuantized : true;
    this.language = options.language || 'en';
    this.removeOOV = options.removeOOV || false;
    this.maxVocabSize = options.maxVocabSize || 100000;

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
      let modelPath = this.modelPath;
      
      if (!modelPath) {
        // If no model path is provided, use a pre-trained model based on language
        const extension = this.useQuantized ? '.ftz' : '.bin';
        const modelName = `cc.${this.language}.300${extension}`;
        
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
        maxVocabSize: this.maxVocabSize
      });
      
      this.model = fastText;
      this.modelReady = true;

      if (this.options.debug) {
        console.log('FastText model initialized successfully');
      }
    } catch (error) {
      this.modelReady = false;
      this.initializationPromise = null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize FastText model: ${errorMessage}`);
    }
  }

  /**
   * Get word vector from FastText model
   * @param word Word to get vector for
   * @returns Promise resolving to word vector
   */
  private async getWordVector(word: string): Promise<Float32Array> {
    // Check cache first
    if (this.vectorCache.has(word)) {
      return this.vectorCache.get(word)!;
    }
    
    // Get vector from model (ensure model is available)
    if (!this.model || typeof this.model.getWordVector !== 'function') {
      throw new Error('FastText model not initialized properly');
    }
    
    const vector = await this.model.getWordVector(word);
    
    // Convert to Float32Array for memory efficiency (ensure vector exists)
    if (!vector || !Array.isArray(vector)) {
      throw new Error(`Failed to get vector for word: ${word}`);
    }
    
    const float32Vector = new Float32Array(vector);
    
    // Cache vector for future use
    this.vectorCache.set(word, float32Vector);
    
    return float32Vector;
  }

  /**
   * Embed text using FastText
   * Optimized average word embedding approach
   * @param text Text to embed
   * @returns Promise resolving to Float32Array of embeddings
   */
  protected async embedText(text: string): Promise<Float32Array> {
    try {
      // Ensure model is initialized
      if (!this.modelReady) {
        await this.initializeModel();
        if (!this.modelReady) {
          throw new Error('Failed to initialize FastText model');
        }
      }

      // Pre-process text for optimal FastText handling
      const words = text.toLowerCase()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 0);
      
      if (words.length === 0) {
        // Return zero vector for empty text
        return new Float32Array(this.options.dimensions!);
      }

      // Get vectors for all words in parallel for performance
      const wordVectors: Float32Array[] = [];
      
      // Ensure model is ready before processing words
      if (!this.model || !this.modelReady) {
        throw new Error('FastText model not initialized properly');
      }
      
      for (const word of words) {
        if (!word) continue; // Skip empty words
        
        try {
          const vector = await this.getWordVector(word);
          if (vector && vector.length > 0) {
            wordVectors.push(vector);
          }
        } catch (e) {
          // Skip OOV words if configured
          if (!this.removeOOV) {
            // Use zero vector for OOV words (ensure dimensions is set)
            const dimensions = this.options.dimensions || 300; // Default to 300 if undefined
            wordVectors.push(new Float32Array(dimensions));
          }
        }
      }
      
      if (wordVectors.length === 0) {
        // Return zero vector if no words were found or all were OOV and removed
        return new Float32Array(this.options.dimensions);
      }

      // Calculate average vector (memory-efficient approach)
      const result = new Float32Array(this.options.dimensions);
      
      // Sum all vectors
      for (const vector of wordVectors) {
        // Skip if vector is undefined or null
        if (!vector) continue;
        
        // Ensure vector has the expected length
        const vectorLength = Math.min(vector.length || 0, result.length);
        for (let i = 0; i < vectorLength; i++) {
          result[i] += vector[i] || 0; // Add 0 if the value is undefined
        }
      }
      
      // Divide by the number of vectors (avoid division by zero)
      const divisor = wordVectors.length || 1; // Use 1 if length is 0
      for (let i = 0; i < result.length; i++) {
        result[i] /= divisor;
      }
      
      // Normalize if needed
      return this.options.normalize 
        ? this.normalizeVector(result)
        : result;
    } catch (error) {
      // Enhance error with helpful context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`FastText embedding failed: ${errorMessage}`);
    }
  }

  /**
   * Override batch embedding for better performance with FastText
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
          throw new Error('Failed to initialize FastText model');
        }
      }

      // Process texts in parallel with controlled concurrency
      const batchSize = this.options.batchSize || 16;
      const results: { index: number; embedding: Float32Array }[] = [];
      
      // Process in batches for better memory management
      for (let i = 0; i < textsToEmbed.length; i += batchSize) {
        const batch = textsToEmbed.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchPromises = batch.map(async item => {
          try {
            const embedding = await this.embedText(item.text);
            
            // Cache the embedding
            this.cacheEmbedding(this.generateCacheKey(item.text), embedding);
            
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
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      // Combine cached and new results
      const combinedResults: Float32Array[] = new Array(validTexts.length);
      
      // Add cached results
      cacheResults.forEach((result, index) => {
        if (result !== null) {
          combinedResults[index] = result;
        }
      });
      
      // Add new results - ensure we have valid results
      results.forEach(result => {
        if (result && typeof result.index === 'number' && result.embedding instanceof Float32Array) {
          combinedResults[result.index] = result.embedding;
        }
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

  /**
   * Clean up resources when the embedder is no longer needed
   */
  async close(): Promise<void> {
    if (this.model && typeof this.model.unloadModel === 'function') {
      try {
        await this.model.unloadModel();
        this.modelReady = false;
        this.initializationPromise = null;
        this.vectorCache.clear();
        
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
