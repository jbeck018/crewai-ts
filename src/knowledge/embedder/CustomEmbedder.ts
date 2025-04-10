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
   * Required custom embedding function
   * Must be provided for CustomEmbedder to work
   */
  embeddingFunction: (text: string) => Promise<number[]>;

  /**
   * Optional batch embedding function for improved performance
   * If not provided, the single embedding function will be used in sequence
   */
  batchEmbeddingFunction?: (texts: string[]) => Promise<number[][]>;

  /**
   * Custom error handler for embedding errors
   */
  errorHandler?: (error: Error) => void;
}

/**
 * Custom Embedder Implementation
 * 
 * Allows using any embedding function with the standardized interface
 * while benefiting from the optimizations in BaseEmbedder
 */
export class CustomEmbedder extends BaseEmbedder {
  /**
   * Custom embedding function
   */
  private embeddingFunction: (text: string) => Promise<number[]>;

  /**
   * Custom batch embedding function (optional)
   */
  private batchEmbeddingFunction?: (texts: string[]) => Promise<number[][]>;

  /**
   * Custom error handler
   */
  private errorHandler?: (error: Error) => void;

  /**
   * Constructor for CustomEmbedder
   */
  constructor(options: CustomEmbedderOptions) {
    // Set provider to custom
    super({
      ...options,
      provider: 'custom'
    });

    // Ensure embedding function is provided
    if (!options.embeddingFunction) {
      throw new Error('Custom embedding function is required for CustomEmbedder');
    }

    // Set embedding function
    this.embeddingFunction = options.embeddingFunction;
    
    // Set optional batch function if provided
    this.batchEmbeddingFunction = options.batchEmbeddingFunction;
    
    // Set optional error handler
    this.errorHandler = options.errorHandler;
  }

  /**
   * Embed text using the custom embedding function
   * @param text Text to embed
   * @returns Promise resolving to Float32Array of embeddings
   */
  protected async embedText(text: string): Promise<Float32Array> {
    try {
      // Use the provided embedding function
      const embedding = await this.embeddingFunction(text);

      // Convert to Float32Array
      const float32Embedding = new Float32Array(embedding);
      
      return this.options.normalize 
        ? this.normalizeVector(float32Embedding)
        : float32Embedding;
    } catch (error) {
      // Use custom error handler if provided
      if (this.errorHandler && error instanceof Error) {
        this.errorHandler(error);
      }

      // Enhance error with helpful context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Custom embedding failed: ${errorMessage}`);
    }
  }

  /**
   * Override batch embedding to use custom batch function if available
   * @param texts Array of texts to embed
   * @returns Promise resolving to array of Float32Array embeddings
   */
  override async embedBatch(texts: string[]): Promise<Float32Array[]> {
    // If batch function is available and texts need embedding, use it
    if (this.batchEmbeddingFunction) {
      try {
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

        // Use custom batch function for uncached texts
        const justTexts = textsToEmbed.map(item => item.text);
        const batchEmbeddings = await this.batchEmbeddingFunction(justTexts);

        // Process and cache results
        const batchResults: { index: number; embedding: Float32Array }[] = textsToEmbed.map((item, i) => {
          // Ensure we have a valid embedding before creating Float32Array
          const embeddingData = batchEmbeddings[i] || [];
          const embedding = new Float32Array(embeddingData);
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
        // Use custom error handler if provided
        if (this.errorHandler && error instanceof Error) {
          this.errorHandler(error);
        }

        if (this.options.debug) {
          console.error('Error in custom batch embedding, falling back to individual embedding:', error);
        }
        
        // Fall back to individual processing on error
      }
    }
    
    // Use the base implementation if no batch function or batch failed
    return super.embedBatch(texts);
  }
}
