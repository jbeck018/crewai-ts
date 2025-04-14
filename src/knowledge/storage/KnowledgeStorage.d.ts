/**
 * Type declarations for KnowledgeStorage
 * Optimized for memory efficiency and type safety
 */

/**
 * Configuration options for knowledge storage
 */
export interface KnowledgeStorageOptions {
  /**
   * Base directory for storage
   */
  baseDir?: string;
  
  /**
   * Use hot cache for improved performance
   */
  useHotCache?: boolean;
  
  /**
   * Compression level for stored data (0-9)
   */
  compressionLevel?: number;
}

/**
 * Memory-optimized knowledge storage interface
 */
export class KnowledgeStorage {
  /**
   * Base directory for storage
   */
  baseDir: string;

  /**
   * Create a new knowledge storage instance
   * @param options Configuration options
   */
  constructor(options?: KnowledgeStorageOptions);
  
  /**
   * Store knowledge in the storage
   * @param key Storage key
   * @param data Data to store
   */
  store(key: string, data: unknown): Promise<void>;
  
  /**
   * Retrieve knowledge from storage
   * @param key Storage key
   */
  retrieve(key: string): Promise<unknown>;
  
  /**
   * Clear all knowledge from storage
   * Optimized for memory efficiency
   */
  clear(): Promise<void>;
  
  /**
   * Delete specific knowledge entry
   * @param key Storage key
   */
  delete(key: string): Promise<boolean>;

  /**
   * Delete all knowledge entries
   * Optimized for batch operations
   */
  deleteAll(): Promise<void>;

  /**
   * List all keys in storage
   * Memory-optimized implementation
   */
  list(): Promise<string[]>;
}
