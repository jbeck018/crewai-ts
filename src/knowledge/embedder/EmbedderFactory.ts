/**
 * Embedder Factory
 * 
 * Simplified creation of optimized embedders for the knowledge system
 * with standardized configuration and performance optimizations
 */

import {
  BaseEmbedder,
  OpenAIEmbedder, OpenAIEmbedderOptions,
  CohereEmbedder, CohereEmbedderOptions,
  HuggingFaceEmbedder, HuggingFaceEmbedderOptions,
  FastEmbedder, FastEmbedderOptions,
  FastTextEmbedder, FastTextEmbedderOptions,
  CustomEmbedder, CustomEmbedderOptions,
  AnyEmbedder
} from './index.js';

import { EmbedderConfig } from '../types.js';

/**
 * Factory options for creating embedders
 */
export interface EmbedderFactoryOptions {
  /**
   * Default cache size for all embedders
   * @default 1000
   */
  defaultCacheSize?: number;

  /**
   * Default cache TTL in milliseconds
   * @default 3600000 (1 hour)
   */
  defaultCacheTTL?: number;

  /**
   * Default batch size for embedding operations
   * @default 16
   */
  defaultBatchSize?: number;

  /**
   * Whether to enable debugging by default
   * @default false
   */
  debug?: boolean;

  /**
   * Whether to normalize embeddings by default
   * @default true
   */
  normalize?: boolean;

  /**
   * API keys for different providers
   */
  apiKeys?: {
    openai?: string;
    cohere?: string;
    huggingface?: string;
  };
}

/**
 * EmbedderFactory - Simplified creation of optimized embedders
 * 
 * Provides easy access to all embedder implementations with smart defaults
 * and performance optimizations
 */
export class EmbedderFactory {
  /**
   * Default options for all embedders
   */
  private options: Required<EmbedderFactoryOptions>;

  /**
   * Constructor for the EmbedderFactory
   */
  constructor(options: EmbedderFactoryOptions = {}) {
    // Set default options with performance optimizations
    this.options = {
      defaultCacheSize: options.defaultCacheSize || 1000,
      defaultCacheTTL: options.defaultCacheTTL || 3600000, // 1 hour
      defaultBatchSize: options.defaultBatchSize || 16,
      debug: options.debug || false,
      normalize: options.normalize !== undefined ? options.normalize : true,
      apiKeys: {
        openai: options.apiKeys?.openai || process.env.OPENAI_API_KEY || '',
        cohere: options.apiKeys?.cohere || process.env.COHERE_API_KEY || '',
        huggingface: options.apiKeys?.huggingface || process.env.HUGGINGFACE_API_TOKEN || ''
      }
    };
  }

  /**
   * Create an OpenAI embedder with optimized settings
   */
  createOpenAIEmbedder(options: Partial<OpenAIEmbedderOptions> = {}): OpenAIEmbedder {
    return new OpenAIEmbedder({
      apiKey: options.apiKey || this.options.apiKeys.openai,
      model: options.model || 'text-embedding-3-small',
      dimensions: options.dimensions || 1536,
      cacheSize: options.cacheSize || this.options.defaultCacheSize,
      cacheTTL: options.cacheTTL || this.options.defaultCacheTTL,
      batchSize: options.batchSize || this.options.defaultBatchSize,
      debug: options.debug !== undefined ? options.debug : this.options.debug,
      normalize: options.normalize !== undefined ? options.normalize : this.options.normalize,
      ...options
    });
  }

  /**
   * Create a Cohere embedder with optimized settings
   */
  createCohereEmbedder(options: Partial<CohereEmbedderOptions> = {}): CohereEmbedder {
    return new CohereEmbedder({
      apiKey: options.apiKey || this.options.apiKeys.cohere,
      model: options.model || 'embed-english-v3.0',
      dimensions: options.dimensions || 1024,
      cacheSize: options.cacheSize || this.options.defaultCacheSize,
      cacheTTL: options.cacheTTL || this.options.defaultCacheTTL,
      batchSize: options.batchSize || this.options.defaultBatchSize,
      debug: options.debug !== undefined ? options.debug : this.options.debug,
      normalize: options.normalize !== undefined ? options.normalize : this.options.normalize,
      ...options
    });
  }

  /**
   * Create a HuggingFace embedder with optimized settings
   */
  createHuggingFaceEmbedder(options: Partial<HuggingFaceEmbedderOptions> = {}): HuggingFaceEmbedder {
    return new HuggingFaceEmbedder({
      apiToken: options.apiToken || this.options.apiKeys.huggingface,
      model: options.model || 'sentence-transformers/all-MiniLM-L6-v2',
      dimensions: options.dimensions || 384,
      cacheSize: options.cacheSize || this.options.defaultCacheSize,
      cacheTTL: options.cacheTTL || this.options.defaultCacheTTL,
      batchSize: options.batchSize || this.options.defaultBatchSize,
      debug: options.debug !== undefined ? options.debug : this.options.debug,
      normalize: options.normalize !== undefined ? options.normalize : this.options.normalize,
      ...options
    });
  }

  /**
   * Create a FastEmbed local embedder with optimized settings
   */
  createFastEmbedder(options: Partial<FastEmbedderOptions> = {}): FastEmbedder {
    return new FastEmbedder({
      model: options.model || 'BAAI/bge-small-en',
      dimensions: options.dimensions || 384,
      cacheSize: options.cacheSize || this.options.defaultCacheSize,
      cacheTTL: options.cacheTTL || this.options.defaultCacheTTL,
      batchSize: options.batchSize || this.options.defaultBatchSize,
      debug: options.debug !== undefined ? options.debug : this.options.debug,
      normalize: options.normalize !== undefined ? options.normalize : this.options.normalize,
      ...options
    });
  }

  /**
   * Create a FastText embedder with optimized settings
   */
  createFastTextEmbedder(options: Partial<FastTextEmbedderOptions> = {}): FastTextEmbedder {
    return new FastTextEmbedder({
      model: options.model || 'cc.en.300.bin',
      dimensions: options.dimensions || 300,
      cacheSize: options.cacheSize || this.options.defaultCacheSize,
      cacheTTL: options.cacheTTL || this.options.defaultCacheTTL,
      batchSize: options.batchSize || this.options.defaultBatchSize,
      debug: options.debug !== undefined ? options.debug : this.options.debug,
      normalize: options.normalize !== undefined ? options.normalize : this.options.normalize,
      ...options
    });
  }

  /**
   * Create a custom embedder with optimized settings
   */
  createCustomEmbedder(options: CustomEmbedderOptions): CustomEmbedder {
    return new CustomEmbedder({
      cacheSize: options.cacheSize || this.options.defaultCacheSize,
      cacheTTL: options.cacheTTL || this.options.defaultCacheTTL,
      batchSize: options.batchSize || this.options.defaultBatchSize,
      debug: options.debug !== undefined ? options.debug : this.options.debug,
      normalize: options.normalize !== undefined ? options.normalize : this.options.normalize,
      ...options
    });
  }

  /**
   * Create an embedder based on provider type and options
   * Automatically selects the appropriate embedder implementation
   */
  createEmbedder(config: EmbedderConfig): AnyEmbedder {
    // Use the specified provider, or detect based on available API keys
    const provider = config.provider || this.detectDefaultProvider();

    switch (provider) {
      case 'openai':
        return this.createOpenAIEmbedder(config as Partial<OpenAIEmbedderOptions>);
      
      case 'cohere':
        return this.createCohereEmbedder(config as Partial<CohereEmbedderOptions>);
      
      case 'huggingface':
        return this.createHuggingFaceEmbedder(config as Partial<HuggingFaceEmbedderOptions>);
      
      case 'fastembed':
        return this.createFastEmbedder(config as Partial<FastEmbedderOptions>);
      
      case 'custom':
        if (!config.embeddingFunction) {
          throw new Error('Custom embedding function required for custom provider');
        }
        return this.createCustomEmbedder(config as CustomEmbedderOptions);
      
      default:
        // Fall back to OpenAI as default if available
        if (this.options.apiKeys.openai) {
          return this.createOpenAIEmbedder(config as Partial<OpenAIEmbedderOptions>);
        }
        
        // Otherwise use local model
        return this.createFastEmbedder(config as Partial<FastEmbedderOptions>);
    }
  }

  /**
   * Auto-detect the best provider based on available API keys
   */
  private detectDefaultProvider(): 'openai' | 'cohere' | 'huggingface' | 'fastembed' {
    if (this.options.apiKeys.openai) {
      return 'openai';
    }
    
    if (this.options.apiKeys.cohere) {
      return 'cohere';
    }
    
    if (this.options.apiKeys.huggingface) {
      return 'huggingface';
    }
    
    // Default to local model if no API keys are available
    return 'fastembed';
  }
}
