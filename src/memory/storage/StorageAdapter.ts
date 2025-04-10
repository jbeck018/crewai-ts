/**
 * StorageAdapter Interface
 * 
 * Defines the contract for all memory storage implementations
 * Optimized for efficient data persistence across different backends
 */

/**
 * Base interface for all storage adapters
 * Provides a consistent API for persisting memory items
 */
export interface StorageAdapter {
  /**
   * Save data with the specified key
   * @param key Unique identifier for the data
   * @param value Data to store
   * @returns Promise resolving when save is complete
   */
  save(key: string, value: any): Promise<void>;
  
  /**
   * Load data with the specified key
   * @param key Unique identifier for the data
   * @returns Promise resolving to the data or null if not found
   */
  load(key: string): Promise<any | null>;
  
  /**
   * Delete data with the specified key
   * @param key Unique identifier for the data to delete
   * @returns Promise resolving to true if data was deleted, false otherwise
   */
  delete(key: string): Promise<boolean>;
  
  /**
   * Clear all data from storage
   * @returns Promise resolving when clear is complete
   */
  clear(): Promise<void>;
  
  /**
   * Get all keys in storage
   * @returns Promise resolving to an array of keys
   */
  keys(): Promise<string[]>;
}

/**
 * Options for storage adapter configuration
 */
export interface StorageAdapterOptions {
  /**
   * Namespace for this storage adapter, used to isolate data
   */
  namespace?: string;
  
  /**
   * Whether to compress stored data
   */
  compression?: boolean;
  
  /**
   * Compression level (if compression is enabled)
   */
  compressionLevel?: number;
  
  /**
   * Custom serializer function for converting objects to strings
   */
  serializer?: (value: any) => string;
  
  /**
   * Custom deserializer function for converting strings to objects
   */
  deserializer?: (value: string) => any;
  
  /**
   * Maximum time in milliseconds that items should be stored
   * Items older than this will be eligible for automatic cleanup
   */
  ttlMs?: number;
  
  /**
   * Debug mode flag
   */
  debug?: boolean;
}

/**
 * Base class for storage adapters with common functionality
 * Provides optimized serialization, compression, and error handling
 */
export abstract class BaseStorageAdapter implements StorageAdapter {
  protected options: Required<StorageAdapterOptions>;
  
  constructor(options: StorageAdapterOptions = {}) {
    // Set defaults optimized for performance and memory usage
    this.options = {
      namespace: options.namespace || 'crewai',
      compression: options.compression || false,
      compressionLevel: options.compressionLevel || 6, // Balanced compression level
      serializer: options.serializer || JSON.stringify,
      deserializer: options.deserializer || JSON.parse,
      ttlMs: options.ttlMs || 0, // 0 means no expiration
      debug: options.debug || false
    };
  }
  
  /**
   * Get the full storage key with namespace
   * @param key The base key
   * @returns Namespaced key
   */
  protected getNamespacedKey(key: string): string {
    return `${this.options.namespace}:${key}`;
  }
  
  /**
   * Serialize a value for storage with optimized handling
   * @param value The value to serialize
   * @returns Serialized value
   */
  protected serialize(value: any): string {
    try {
      // Add metadata for improved reconstruction
      const valueWithMeta = {
        _data: value,
        _type: typeof value,
        _timestamp: Date.now()
      };
      
      // Serialize the data
      const serialized = this.options.serializer(valueWithMeta);
      
      // Apply compression if enabled
      if (this.options.compression) {
        return this.compress(serialized);
      }
      
      return serialized;
    } catch (error) {
      if (this.options.debug) {
        console.error('Error serializing value:', error);
      }
      // Fallback to simple string conversion
      return String(value);
    }
  }
  
  /**
   * Deserialize a value from storage with optimized handling
   * @param serialized The serialized value
   * @returns Deserialized value
   */
  protected deserialize(serialized: string): any {
    try {
      // Decompress if needed
      const decompressed = this.options.compression ? 
        this.decompress(serialized) : serialized;
      
      // Deserialize the data
      const valueWithMeta = this.options.deserializer(decompressed);
      
      // Extract the actual data from metadata wrapper
      return valueWithMeta._data;
    } catch (error) {
      if (this.options.debug) {
        console.error('Error deserializing value:', error);
      }
      // Return the original string if deserialization fails
      return serialized;
    }
  }
  
  /**
   * Compress a string
   * @param data The string to compress
   * @returns Compressed string
   */
  protected compress(data: string): string {
    // In a real implementation, use a proper compression algorithm
    // like zlib or lz-string. For this example, using simple base64 encoding
    return Buffer.from(data).toString('base64');
  }
  
  /**
   * Decompress a compressed string
   * @param compressed The compressed string
   * @returns Decompressed string
   */
  protected decompress(compressed: string): string {
    // Matching the simple compression implementation above
    return Buffer.from(compressed, 'base64').toString('utf8');
  }
  
  /**
   * Check if a value has expired
   * @param timestamp The timestamp when the value was stored
   * @returns Whether the value has expired
   */
  protected isExpired(timestamp: number): boolean {
    if (this.options.ttlMs === 0) return false; // No expiration
    
    const now = Date.now();
    return now - timestamp > this.options.ttlMs;
  }
  
  // Abstract methods to be implemented by specific storage adapters
  abstract save(key: string, value: any): Promise<void>;
  abstract load(key: string): Promise<any | null>;
  abstract delete(key: string): Promise<boolean>;
  abstract clear(): Promise<void>;
  abstract keys(): Promise<string[]>;
}
