/**
 * RedisStorageAdapter
 * 
 * A Redis-based implementation of the StorageAdapter interface
 * Optimized for distributed systems with high throughput requirements
 */

import { BaseStorageAdapter, StorageAdapterOptions } from './StorageAdapter.js';

/**
 * RedisStorageAdapter Options
 */
export interface RedisStorageOptions extends StorageAdapterOptions {
  /**
   * Redis connection URL (redis://user:password@host:port/db)
   */
  url?: string;
  
  /**
   * Redis host
   */
  host?: string;
  
  /**
   * Redis port
   */
  port?: number;
  
  /**
   * Redis password
   */
  password?: string;
  
  /**
   * Redis database index
   */
  db?: number;
  
  /**
   * Cluster nodes configuration for Redis cluster mode
   * Array of {host, port} objects
   */
  clusterNodes?: Array<{host: string; port: number}>;
  
  /**
   * Key prefix for all Redis keys
   */
  keyPrefix?: string;
  
  /**
   * Connection timeout in milliseconds
   */
  connectTimeout?: number;
  
  /**
   * Operation timeout in milliseconds
   */
  commandTimeout?: number;
  
  /**
   * Enable client-side caching
   */
  enableCache?: boolean;
  
  /**
   * Maximum cache size
   */
  maxCacheSize?: number;
  
  /**
   * Whether to use Redis cluster mode
   */
  useCluster?: boolean;
  
  /**
   * Default key expiration time in seconds (TTL)
   */
  defaultExpireSeconds?: number;
}

/**
 * RedisStorageAdapter implements the StorageAdapter interface
 * using Redis for high-performance distributed storage
 * 
 * Note: This implementation requires the 'redis' package
 * npm install redis
 */
export class RedisStorageAdapter extends BaseStorageAdapter {
  private client: any; // Redis client instance
  private connected = false;
  private connecting = false;
  private connectionPromise: Promise<void> | null = null;
  private enableCache: boolean;
  private maxCacheSize: number;
  private cache: Map<string, { value: any; timestamp: number }> = new Map();
  private keyPrefix: string;
  private defaultExpireSeconds: number;
  private useCluster: boolean;
  
  constructor(options: RedisStorageOptions) {
    super(options);
    
    this.enableCache = options.enableCache ?? true;
    this.maxCacheSize = options.maxCacheSize || 1000;
    this.keyPrefix = options.keyPrefix || `${this.options.namespace}:`;
    this.defaultExpireSeconds = options.defaultExpireSeconds || 0; // 0 means no expiration
    this.useCluster = options.useCluster || false;
    
    // Initialize Redis client (lazy initialization on first use)
    this.initClient(options);
  }
  
  /**
   * Initialize Redis client with optimal configuration
   */
  private initClient(options: RedisStorageOptions): void {
    try {
      const getClient = () => {
        // Dynamically import Redis to avoid requiring it when other adapters are used
        try {
          const redis = require('redis');
          
          const redisOptions: any = {
            socket: {
              reconnectStrategy: (retries: number) => {
                // Exponential backoff with max delay of 10 seconds
                return Math.min(retries * 100, 10000);
              }
            }
          };
          
          // Set connection timeout
          if (options.connectTimeout) {
            redisOptions.socket.connectTimeout = options.connectTimeout;
          }
          
          // Set command timeout
          if (options.commandTimeout) {
            redisOptions.socket.timeout = options.commandTimeout;
          }
          
          // Set password if provided
          if (options.password) {
            redisOptions.password = options.password;
          }
          
          // Set database if provided
          if (options.db !== undefined) {
            redisOptions.database = options.db;
          }
          
          // Create client
          let client: any;
          
          if (options.url) {
            // Connect using URL
            client = redis.createClient({
              url: options.url,
              ...redisOptions
            });
          } else if (options.host) {
            // Connect using host/port
            client = redis.createClient({
              socket: {
                host: options.host,
                port: options.port || 6379,
                ...redisOptions.socket
              },
              ...redisOptions
            });
          } else if (this.useCluster) {
            // Connect to cluster
            client = redis.createClusterClient({
              rootNodes: options.clusterNodes || [],
              ...redisOptions
            });
          } else {
            // Connect to default
            client = redis.createClient(redisOptions);
          }
          
          // Setup event handlers
          client.on('error', (err: Error) => {
            this.connected = false;
            if (this.options.debug) {
              console.error('Redis connection error:', err);
            }
          });
          
          client.on('ready', () => {
            this.connected = true;
            if (this.options.debug) {
              console.log('Redis connection ready');
            }
          });
          
          return client;
        } catch (error) {
          if (this.options.debug) {
            console.error('Failed to initialize Redis client:', error);
          }
          throw new Error(`Redis initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      
      this.client = getClient();
    } catch (error) {
      if (this.options.debug) {
        console.error('Error in RedisStorageAdapter constructor:', error);
      }
    }
  }
  
  /**
   * Ensure Redis client is connected
   */
  private async ensureConnected(): Promise<void> {
    if (this.connected) return;
    
    if (this.connecting) {
      // Wait for existing connection attempt to complete
      if (this.connectionPromise) {
        await this.connectionPromise;
      }
      return;
    }
    
    this.connecting = true;
    
    try {
      this.connectionPromise = this.client.connect();
      await this.connectionPromise;
      this.connected = true;
    } catch (error) {
      if (this.options.debug) {
        console.error('Error connecting to Redis:', error);
      }
      throw error;
    } finally {
      this.connecting = false;
      this.connectionPromise = null;
    }
  }
  
  /**
   * Get the full Redis key with namespace and key prefix
   */
  private getRedisKey(key: string): string {
    return `${this.keyPrefix}${this.getNamespacedKey(key)}`;
  }
  
  /**
   * Add an item to the cache with LRU eviction
   */
  private addToCache(key: string, value: any, timestamp: number): void {
    if (!this.enableCache) return;
    
    // If cache is full, remove least recently used item
    if (this.cache.size >= this.maxCacheSize) {
      // Get the oldest item (first inserted)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    // Add to cache
    this.cache.set(key, { value, timestamp });
  }
  
  /**
   * Save a value to Redis with optional expiration
   */
  async save(key: string, value: any): Promise<void> {
    await this.ensureConnected();
    
    const redisKey = this.getRedisKey(key);
    const timestamp = Date.now();
    
    // Prepare data with timestamp for expiration check
    const data = {
      value,
      timestamp
    };
    
    const serializedData = this.serialize(data);
    
    try {
      // Save to Redis with optional expiration
      if (this.defaultExpireSeconds > 0) {
        await this.client.setEx(redisKey, this.defaultExpireSeconds, serializedData);
      } else {
        await this.client.set(redisKey, serializedData);
      }
      
      // Update cache
      if (this.enableCache) {
        this.addToCache(redisKey, value, timestamp);
      }
    } catch (error) {
      if (this.options.debug) {
        console.error(`Error saving key ${key}:`, error);
      }
      throw error;
    }
  }
  
  /**
   * Load a value from Redis with caching
   */
  async load(key: string): Promise<any | null> {
    await this.ensureConnected();
    
    const redisKey = this.getRedisKey(key);
    
    // Check cache first if enabled
    if (this.enableCache) {
      const cachedItem = this.cache.get(redisKey);
      if (cachedItem) {
        // Check for expiration
        if (this.isExpired(cachedItem.timestamp)) {
          // Remove expired item
          this.cache.delete(redisKey);
          await this.delete(key);
          return null;
        }
        
        return cachedItem.value;
      }
    }
    
    try {
      // Load from Redis
      const data = await this.client.get(redisKey);
      
      if (!data) return null;
      
      // Deserialize data
      const parsed = this.deserialize(data);
      
      // Check for expiration
      if (this.isExpired(parsed.timestamp)) {
        await this.delete(key);
        return null;
      }
      
      // Update cache
      if (this.enableCache) {
        this.addToCache(redisKey, parsed.value, parsed.timestamp);
      }
      
      return parsed.value;
    } catch (error) {
      if (this.options.debug) {
        console.error(`Error loading key ${key}:`, error);
      }
      return null;
    }
  }
  
  /**
   * Delete a value from Redis with cache invalidation
   */
  async delete(key: string): Promise<boolean> {
    await this.ensureConnected();
    
    const redisKey = this.getRedisKey(key);
    
    try {
      // Delete from Redis
      const result = await this.client.del(redisKey);
      
      // Remove from cache
      if (this.enableCache) {
        this.cache.delete(redisKey);
      }
      
      return result > 0;
    } catch (error) {
      if (this.options.debug) {
        console.error(`Error deleting key ${key}:`, error);
      }
      return false;
    }
  }
  
  /**
   * Clear all values in the namespace
   */
  async clear(): Promise<void> {
    await this.ensureConnected();
    
    const pattern = `${this.keyPrefix}${this.options.namespace}:*`;
    
    try {
      // Find all keys matching pattern
      let cursor = 0;
      let keys: string[] = [];
      
      do {
        // Use SCAN for efficient iteration over large key spaces
        const scanResult = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        
        // Ensure we have valid scan results
        const result = scanResult || { cursor: 0, keys: [] };
        
        cursor = result.cursor;
        keys = keys.concat(result.keys);
      } while (cursor !== 0);
      
      // Delete all matching keys
      if (keys.length > 0) {
        await this.client.del(keys.filter(Boolean));
      }
      
      // Clear cache for this namespace
      if (this.enableCache) {
        for (const key of this.cache.keys()) {
          if (key.startsWith(this.keyPrefix)) {
            this.cache.delete(key);
          }
        }
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('Error clearing storage:', error);
      }
      throw error;
    }
  }
  
  /**
   * Get all keys in the namespace
   */
  async keys(): Promise<string[]> {
    await this.ensureConnected();
    
    const pattern = `${this.keyPrefix}${this.options.namespace}:*`;
    const keysToExpire: string[] = [];
    
    try {
      // Find all keys matching pattern
      let cursor = 0;
      let redisKeys: string[] = [];
      
      do {
        // Use SCAN for efficient iteration over large key spaces
        const scanResult = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        
        // Ensure we have valid scan results
        const result = scanResult || { cursor: 0, keys: [] };
        
        cursor = result.cursor;
        redisKeys = redisKeys.concat(result.keys);
      } while (cursor !== 0);
      
      // Process keys
      const result: string[] = [];
      const prefix = `${this.keyPrefix}${this.options.namespace}:`;
      
      // Check each key for expiration
      for (const redisKey of redisKeys) {
        try {
          const data = await this.client.get(redisKey);
          
          if (data) {
            const parsed = this.deserialize(data);
            
            // Check for expiration
            if (this.isExpired(parsed.timestamp)) {
              keysToExpire.push(redisKey);
            } else if (redisKey.startsWith(prefix)) {
              // Extract the base key
              result.push(redisKey.substring(prefix.length));
            }
          }
        } catch (e) {
          // Skip keys with parsing errors
          if (this.options.debug) {
            console.warn(`Skipping key with parse error: ${redisKey}`);
          }
        }
      }
      
      // Batch delete expired keys
      if (keysToExpire.length > 0) {
        // Filter out any undefined keys for safety
        const validKeys = keysToExpire.filter(Boolean);
        if (validKeys.length > 0) {
          await this.client.del(validKeys);
        }
      }
      
      return result;
    } catch (error) {
      if (this.options.debug) {
        console.error('Error getting keys:', error);
      }
      return [];
    }
  }
  
  /**
   * Close the Redis client connection
   */
  async close(): Promise<void> {
    if (this.connected) {
      try {
        await this.client.quit();
        this.connected = false;
      } catch (error) {
        if (this.options.debug) {
          console.error('Error closing Redis connection:', error);
        }
      }
    }
  }
  
  /**
   * Get Redis stats
   */
  async getStats(): Promise<any> {
    await this.ensureConnected();
    
    try {
      // Get Redis INFO
      // Ensure client exists before calling info()
      if (!this.client) {
        return { error: 'Redis client not initialized' };
      }
      const info = await this.client.info();
      
      // Parse INFO response
      const sections: Record<string, Record<string, string>> = {};
      let currentSection = '';
      
      // Use a simplified, safer approach to parse Redis INFO
      try {
        if (typeof info === 'string') {
          // Initialize with a default section for simplicity
          sections['server'] = {}; 
          currentSection = 'server';
          
          // Process line by line
          const lines = info.split('\n');
          
          for (const line of lines) {
            // Skip empty lines
            if (!line || line.trim() === '') continue;
            
            // Handle section headers
            if (line.startsWith('#')) {
              const sectionName = line.substring(2).trim().toLowerCase();
              if (sectionName) {
                currentSection = sectionName;
                // Create new section object
                sections[currentSection] = {};
              }
            }
            // Handle key-value pairs
            else if (line.includes(':')) {
              const parts = line.split(':');
              if (parts && parts.length >= 2 && typeof parts[0] === 'string' && typeof parts[1] === 'string') {
                const key = parts[0].trim();
                const value = parts[1].trim();
                
                // Add to current section if we have valid data
                if (key && value && currentSection && typeof sections === 'object') {
                  // Type assertion to help TypeScript understand our checks
                  const sectionsObj = sections as Record<string, Record<string, string>>;
                  
                  // Ensure section exists
                  if (!sectionsObj[currentSection]) {
                    sectionsObj[currentSection] = {};
                  }
                  
                  // Use safe indexed access
                  const section = sectionsObj[currentSection];
                  if (section) {
                    section[key] = value;
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // Safely handle any parsing errors
        if (this.options.debug) {
          console.error('Error parsing Redis INFO response:', e);
        }
      }
      return {
        serverInfo: sections,
        cacheSize: this.enableCache ? this.cache.size : 0,
        keyPrefix: this.keyPrefix
      };
    } catch (error) {
      if (this.options.debug) {
        console.error('Error getting Redis stats:', error);
      }
      return { error: 'Failed to get Redis stats' };
    }
  }
}
