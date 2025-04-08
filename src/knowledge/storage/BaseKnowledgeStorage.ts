/**
 * Base Knowledge Storage Interface
 * Abstract class that defines the storage backend interface
 */

import { KnowledgeChunk, KnowledgeFilter, KnowledgeSearchResult, EmbedderConfig } from '../types.js';

/**
 * Abstract base class for knowledge storage backends
 */
export abstract class BaseKnowledgeStorage {
  /**
   * Initialize the storage backend
   * This should be called before using the storage
   */
  abstract initialize(): Promise<void>;

  /**
   * Add a single knowledge chunk to the storage
   * @param chunk - Knowledge chunk to add
   */
  abstract addChunk(chunk: KnowledgeChunk): Promise<void>;

  /**
   * Add multiple knowledge chunks in a batch operation
   * This is more efficient than adding chunks individually
   * @param chunks - Array of knowledge chunks to add
   */
  abstract addChunks(chunks: KnowledgeChunk[]): Promise<void>;

  /**
   * Search for knowledge chunks based on semantic similarity
   * @param query - Text queries to search for
   * @param limit - Maximum number of results to return
   * @param filter - Optional filter to apply to the search
   * @param scoreThreshold - Minimum similarity score (0-1) to include in results
   * @returns Array of search results sorted by relevance
   */
  abstract search(
    query: string[],
    limit?: number,
    filter?: KnowledgeFilter,
    scoreThreshold?: number
  ): Promise<KnowledgeSearchResult[]>;

  /**
   * Generate embeddings for text
   * @param texts - Array of texts to generate embeddings for
   * @returns Promise resolving to array of embeddings
   */
  abstract generateEmbeddings(texts: string[]): Promise<Float32Array[] | number[][]>;

  /**
   * Reset the storage (clear all data)
   */
  abstract reset(): Promise<void>;

  /**
   * Delete specific chunks by ID
   * @param ids - Array of chunk IDs to delete
   */
  abstract deleteChunks(ids: string[]): Promise<void>;

  /**
   * Get chunks by ID
   * @param ids - Array of chunk IDs to retrieve
   * @returns Array of knowledge chunks
   */
  abstract getChunks(ids: string[]): Promise<KnowledgeChunk[]>;

  /**
   * Get all chunks in the storage
   * @returns Array of all knowledge chunks
   */
  abstract getAllChunks(): Promise<KnowledgeChunk[]>;

  /**
   * Create a new collection (if supported by the backend)
   * @param collectionName - Name of the collection to create
   */
  abstract createCollection(collectionName: string): Promise<void>;

  /**
   * Delete a collection (if supported by the backend)
   * @param collectionName - Name of the collection to delete
   */
  abstract deleteCollection(collectionName: string): Promise<void>;

  /**
   * List all collections (if supported by the backend)
   * @returns Array of collection names
   */
  abstract listCollections(): Promise<string[]>;

  /**
   * Close the storage connection and release resources
   */
  abstract close(): Promise<void>;
}
