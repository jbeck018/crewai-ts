/**
 * Memory system optimizations index
 * Exports all memory optimization components for easy access
 */

// Export cache optimizations
export * from '../cache/OptimizedMemoryCache.js';

// Export incremental loader
export * from '../loaders/IncrementalMemoryLoader.js';

// Export retention policies
export * from '../retention/RetentionPolicy.js';

// Export embedding storage optimizations
export * from '../embeddings/OptimizedEmbeddingStorage.js';

// Export tiered memory storage
export * from '../tiered/SegmentedMemory.js';

// Export content deduplication
export * from '../deduplication/DeduplicatedContentStorage.js';

// Export compressed memory storage
export * from '../compressed/CompressedMemoryStorage.js';

// Export optimized short term memory
export * from '../OptimizedShortTermMemory.js';

/**
 * Memory optimization utilities
 */
export const MemoryOptimizations = {
  /**
   * Create an optimized memory cache with WeakRef support
   */
  createOptimizedCache: (options = {}) => {
    const { OptimizedMemoryCache } = require('../cache/OptimizedMemoryCache.js');
    return new OptimizedMemoryCache(options);
  },
  
  /**
   * Create an incremental memory loader for pagination
   */
  createIncrementalLoader: <T>(fetchFn: (offset: number, limit: number) => Promise<T[]>, options = {}) => {
    const { IncrementalMemoryLoader } = require('../loaders/IncrementalMemoryLoader.js');
    return new IncrementalMemoryLoader(fetchFn, options);
  },
  
  /**
   * Create a retention policy factory for memory management
   */
  createRetentionPolicy: () => {
    const { RetentionPolicyFactory } = require('../retention/RetentionPolicy.js');
    return RetentionPolicyFactory;
  },
  
  /**
   * Create an optimized embedding storage
   */
  createEmbeddingStorage: (options = {}) => {
    const { OptimizedEmbeddingStorage } = require('../embeddings/OptimizedEmbeddingStorage.js');
    return new OptimizedEmbeddingStorage(options);
  },
  
  /**
   * Create a segmented memory with tiered storage
   */
  createSegmentedMemory: (options = {}) => {
    const { SegmentedMemory } = require('../tiered/SegmentedMemory.js');
    return new SegmentedMemory(options);
  },
  
  /**
   * Create a deduplicated content storage
   */
  createDeduplicatedStorage: (options = {}) => {
    const { DeduplicatedContentStorage } = require('../deduplication/DeduplicatedContentStorage.js');
    return new DeduplicatedContentStorage(options);
  },
  
  /**
   * Create a compressed memory storage
   */
  createCompressedStorage: (options = {}) => {
    const { CompressedMemoryStorage } = require('../compressed/CompressedMemoryStorage.js');
    return new CompressedMemoryStorage(options);
  },
  
  /**
   * Create an optimized short term memory with all optimizations
   */
  createOptimizedShortTermMemory: (options = {}) => {
    const { OptimizedShortTermMemory } = require('../OptimizedShortTermMemory.js');
    return new OptimizedShortTermMemory(options);
  }
};
