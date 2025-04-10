/**
 * MongoDBStorageAdapter
 * 
 * A MongoDB-based implementation of the StorageAdapter interface
 * Optimized for distributed systems with high scalability requirements
 */

import { BaseStorageAdapter, StorageAdapterOptions } from './StorageAdapter.js';

/**
 * MongoDBStorageAdapter Options
 */
export interface MongoDBStorageOptions extends StorageAdapterOptions {
  /**
   * MongoDB connection URI
   */
  uri: string;
  
  /**
   * Database name
   */
  database: string;
  
  /**
   * Collection name prefix
   * The actual collection will be `${collectionPrefix}_${namespace}`
   */
  collectionPrefix?: string;
  
  /**
   * Connection options
   */
  connectionOptions?: any; // MongoDB connection options
  
  /**
   * Enable client-side caching
   */
  enableCache?: boolean;
  
  /**
   * Maximum number of items to cache
   */
  maxCacheSize?: number;
  
  /**
   * Enable bulk operations for better performance
   */
  enableBulkOperations?: boolean;
  
  /**
   * Bulk operation batch size
   */
  bulkBatchSize?: number;
  
  /**
   * Create indexes for better query performance
   */
  createIndexes?: boolean;
}

/**
 * MongoDBStorageAdapter implements the StorageAdapter interface
 * using MongoDB for highly scalable distributed storage
 * 
 * Note: This implementation requires the 'mongodb' package
 * npm install mongodb
 */
export class MongoDBStorageAdapter extends BaseStorageAdapter {
  private client: any; // MongoDB client instance
  private db: any; // MongoDB database instance
  private collection: any; // MongoDB collection instance
  private connected = false;
  private connecting = false;
  private connectionPromise: Promise<void> | null = null;
  private enableCache: boolean;
  private maxCacheSize: number;
  private cache: Map<string, { value: any; timestamp: number }> = new Map();
  private bulkOps: boolean;
  private bulkBatchSize: number;
  private pendingOps: Array<any> = [];
  private bulkTimer: NodeJS.Timeout | null = null;
  private collectionName: string;
  
  constructor(options: MongoDBStorageOptions) {
    super(options);
    
    // Initialize options with defaults
    this.enableCache = options.enableCache ?? true;
    this.maxCacheSize = options.maxCacheSize || 1000;
    this.bulkOps = options.enableBulkOperations ?? true;
    this.bulkBatchSize = options.bulkBatchSize || 100;
    
    // Set collection name based on namespace
    const prefix = options.collectionPrefix || 'memory';
    this.collectionName = `${prefix}_${this.options.namespace}`;
    
    // Initialize MongoDB client (lazy initialization on first use)
    this.initClient(options);
  }
  
  /**
   * Initialize MongoDB client with optimal configuration
   */
  private initClient(options: MongoDBStorageOptions): void {
    try {
      const initMongo = async () => {
        try {
          // Dynamically import MongoDB to avoid requiring it when other adapters are used
          const mongodb = require('mongodb');
          const { MongoClient } = mongodb;
          
          // Connection options with reasonable defaults
          const connectionOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            minPoolSize: 1,
            connectTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            ...options.connectionOptions
          };
          
          // Create client
          this.client = new MongoClient(options.uri, connectionOptions);
          
          // Connect and initialize
          await this.ensureConnected();
          
          // Get database and collection
          this.db = this.client.db(options.database);
          this.collection = this.db.collection(this.collectionName);
          
          // Create indexes if enabled
          if (options.createIndexes) {
            await this.createIndexes();
          }
        } catch (error) {
          if (this.options.debug) {
            console.error('Failed to initialize MongoDB client:', error);
          }
          throw new Error(`MongoDB initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      
      // Initialize immediately but don't block constructor
      initMongo();
    } catch (error) {
      if (this.options.debug) {
        console.error('Error in MongoDBStorageAdapter constructor:', error);
      }
    }
  }
  
  /**
   * Create indexes for better performance
   */
  private async createIndexes(): Promise<void> {
    try {
      // Create index on timestamp for expiration queries
      await this.collection.createIndex({ timestamp: 1 });
      
      // Create unique index on key field for faster lookups
      await this.collection.createIndex({ key: 1 }, { unique: true });
      
      if (this.options.debug) {
        console.log('Created MongoDB indexes for better performance');
      }
    } catch (error) {
      if (this.options.debug) {
        console.warn('Failed to create indexes:', error);
      }
    }
  }
  
  /**
   * Ensure MongoDB client is connected
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
      
      if (this.options.debug) {
        console.log('Connected to MongoDB');
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('Error connecting to MongoDB:', error);
      }
      throw error;
    } finally {
      this.connecting = false;
      this.connectionPromise = null;
    }
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
   * Schedule bulk operations execution
   */
  private scheduleBulkOps(): void {
    if (this.bulkTimer) return; // Already scheduled
    
    this.bulkTimer = setTimeout(() => {
      this.executeBulkOps();
      this.bulkTimer = null;
    }, 50); // Execute after 50ms of inactivity
  }
  
  /**
   * Execute pending bulk operations
   */
  private async executeBulkOps(): Promise<void> {
    if (this.pendingOps.length === 0) return;
    
    try {
      await this.ensureConnected();
      
      // Create bulk operation
      const bulk = this.collection.initializeUnorderedBulkOp();
      
      // Add all pending operations
      for (const op of this.pendingOps) {
        if (op.type === 'save') {
          bulk.find({ key: op.key }).upsert().replaceOne({
            key: op.key,
            value: op.value,
            timestamp: op.timestamp
          });
        } else if (op.type === 'delete') {
          bulk.find({ key: op.key }).deleteOne();
        }
      }
      
      // Execute bulk operation
      await bulk.execute();
      
      // Clear pending operations
      this.pendingOps = [];
    } catch (error) {
      if (this.options.debug) {
        console.error('Error executing bulk operations:', error);
      }
      
      // On error, fall back to individual operations
      for (const op of this.pendingOps) {
        try {
          if (op.type === 'save') {
            await this.collection.updateOne(
              { key: op.key },
              { $set: { key: op.key, value: op.value, timestamp: op.timestamp } },
              { upsert: true }
            );
          } else if (op.type === 'delete') {
            await this.collection.deleteOne({ key: op.key });
          }
        } catch (e) {
          if (this.options.debug) {
            console.error(`Error during fallback operation for ${op.key}:`, e);
          }
        }
      }
      
      // Clear pending operations
      this.pendingOps = [];
    }
  }
  
  /**
   * Save a value to MongoDB with high optimization
   */
  async save(key: string, value: any): Promise<void> {
    const namespacedKey = this.getNamespacedKey(key);
    const timestamp = Date.now();
    const serializedValue = this.serialize(value);
    
    // Update cache immediately
    if (this.enableCache) {
      this.addToCache(namespacedKey, value, timestamp);
    }
    
    try {
      if (this.bulkOps) {
        // Add to pending bulk operations
        this.pendingOps.push({
          type: 'save',
          key: namespacedKey,
          value: serializedValue,
          timestamp
        });
        
        // Execute immediately if batch size exceeded
        if (this.pendingOps.length >= this.bulkBatchSize) {
          await this.executeBulkOps();
        } else {
          this.scheduleBulkOps();
        }
      } else {
        // Individual operation mode
        await this.ensureConnected();
        
        await this.collection.updateOne(
          { key: namespacedKey },
          { $set: { key: namespacedKey, value: serializedValue, timestamp } },
          { upsert: true }
        );
      }
    } catch (error) {
      if (this.options.debug) {
        console.error(`Error saving key ${key}:`, error);
      }
      throw error;
    }
  }
  
  /**
   * Load a value from MongoDB with caching
   */
  async load(key: string): Promise<any | null> {
    const namespacedKey = this.getNamespacedKey(key);
    
    // Check cache first if enabled
    if (this.enableCache) {
      const cachedItem = this.cache.get(namespacedKey);
      if (cachedItem) {
        // Check for expiration
        if (this.isExpired(cachedItem.timestamp)) {
          // Remove expired item
          this.cache.delete(namespacedKey);
          await this.delete(key);
          return null;
        }
        
        return cachedItem.value;
      }
    }
    
    try {
      await this.ensureConnected();
      
      // Find document
      const doc = await this.collection.findOne({ key: namespacedKey });
      
      if (!doc) return null;
      
      // Check for expiration
      if (this.isExpired(doc.timestamp)) {
        await this.delete(key);
        return null;
      }
      
      // Deserialize value
      const value = this.deserialize(doc.value);
      
      // Update cache
      if (this.enableCache) {
        this.addToCache(namespacedKey, value, doc.timestamp);
      }
      
      return value;
    } catch (error) {
      if (this.options.debug) {
        console.error(`Error loading key ${key}:`, error);
      }
      return null;
    }
  }
  
  /**
   * Delete a value from MongoDB with cache invalidation
   */
  async delete(key: string): Promise<boolean> {
    const namespacedKey = this.getNamespacedKey(key);
    
    // Remove from cache immediately
    if (this.enableCache) {
      this.cache.delete(namespacedKey);
    }
    
    try {
      if (this.bulkOps) {
        // Add to pending bulk operations
        this.pendingOps.push({
          type: 'delete',
          key: namespacedKey
        });
        
        // Execute immediately if batch size exceeded
        if (this.pendingOps.length >= this.bulkBatchSize) {
          await this.executeBulkOps();
        } else {
          this.scheduleBulkOps();
        }
        
        return true; // Assume success for bulk operations
      } else {
        // Individual operation mode
        await this.ensureConnected();
        
        const result = await this.collection.deleteOne({ key: namespacedKey });
        return result.deletedCount > 0;
      }
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
    // Clear cache for this namespace
    if (this.enableCache) {
      const namespacedPrefix = `${this.options.namespace}:`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(namespacedPrefix)) {
          this.cache.delete(key);
        }
      }
    }
    
    // Clear pending operations
    this.pendingOps = [];
    
    try {
      await this.ensureConnected();
      
      // Delete all documents in the collection
      await this.collection.deleteMany({});
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
    try {
      await this.ensureConnected();
      
      // Find all documents in the collection
      const docs = await this.collection.find().toArray();
      
      const result: string[] = [];
      const prefix = `${this.options.namespace}:`;
      const keysToDelete: string[] = [];
      
      // Process documents
      for (const doc of docs) {
        // Check for expiration
        if (this.isExpired(doc.timestamp)) {
          keysToDelete.push(doc.key);
        } else if (doc.key.startsWith(prefix)) {
          // Extract the base key
          result.push(doc.key.substring(prefix.length));
        }
      }
      
      // Delete expired keys
      if (keysToDelete.length > 0) {
        if (this.options.debug) {
          console.log(`Cleaning up ${keysToDelete.length} expired keys`);
        }
        
        // Delete in batches for better performance
        for (let i = 0; i < keysToDelete.length; i += 100) {
          const batch = keysToDelete.slice(i, i + 100);
          await this.collection.deleteMany({ key: { $in: batch } });
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
   * Close the MongoDB client connection
   */
  async close(): Promise<void> {
    // Execute any pending operations
    if (this.pendingOps.length > 0) {
      await this.executeBulkOps();
    }
    
    // Clear timeout
    if (this.bulkTimer) {
      clearTimeout(this.bulkTimer);
      this.bulkTimer = null;
    }
    
    // Close connection
    if (this.connected && this.client) {
      try {
        await this.client.close();
        this.connected = false;
      } catch (error) {
        if (this.options.debug) {
          console.error('Error closing MongoDB connection:', error);
        }
      }
    }
  }
  
  /**
   * Get MongoDB stats
   */
  async getStats(): Promise<any> {
    try {
      await this.ensureConnected();
      
      // Get collection stats
      const stats = await this.db.command({ collStats: this.collectionName });
      
      return {
        count: stats.count,
        size: stats.size,
        avgObjSize: stats.avgObjSize,
        storageSize: stats.storageSize,
        cacheSize: this.enableCache ? this.cache.size : 0,
        pendingOps: this.pendingOps.length
      };
    } catch (error) {
      if (this.options.debug) {
        console.error('Error getting MongoDB stats:', error);
      }
      return { error: 'Failed to get MongoDB stats' };
    }
  }
  
  /**
   * Perform database maintenance operations
   */
  async optimize(): Promise<void> {
    try {
      await this.ensureConnected();
      
      // Remove expired documents
      const now = Date.now();
      // Get TTL from options (BaseStorageAdapter sets this required property)
      const ttl = this.options.ttlMs;
      // If TTL is 0, don't expire anything, otherwise calculate expiration time
      const expireTime = ttl > 0 ? now - ttl : 0;
      
      await this.collection.deleteMany({ timestamp: { $lt: expireTime } });
      
      // Run compact command if supported
      try {
        await this.db.command({ compact: this.collectionName });
      } catch (e) {
        // Compact may not be available in all MongoDB deployments
        if (this.options.debug) {
          console.warn('Compact command not supported or failed:', e);
        }
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('Error optimizing MongoDB storage:', error);
      }
    }
  }
}
