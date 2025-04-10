/**
 * SQLiteStorageAdapter
 * 
 * A SQLite-based implementation of the StorageAdapter interface
 * Optimized for efficient local persistence with high performance
 */

import { BaseStorageAdapter, StorageAdapterOptions } from './StorageAdapter.js';

/**
 * SQLiteStorageAdapter Options
 */
export interface SQLiteStorageOptions extends StorageAdapterOptions {
  /**
   * Path to SQLite database file
   */
  dbPath: string;
  
  /**
   * Schema version for automatic migrations
   */
  schemaVersion?: number;
  
  /**
   * Enable WAL mode for better performance
   */
  enableWAL?: boolean;
  
  /**
   * Enable query caching for better performance
   */
  enableQueryCache?: boolean;
  
  /**
   * Cache size in memory items
   */
  cacheSize?: number;
}

/**
 * SQLiteStorageAdapter implements the StorageAdapter interface
 * using SQLite for efficient and durable storage
 * 
 * Note: This implementation requires the 'better-sqlite3' package
 * npm install better-sqlite3
 */
export class SQLiteStorageAdapter extends BaseStorageAdapter {
  private db: any; // SQLite database instance
  private statements: Record<string, any> = {}; // Prepared statements cache
  private cache: Map<string, { value: any; timestamp: number }> = new Map();
  private cacheSize: number;
  private initialized = false;
  private addCacheMutex = false; // Simple mutex to prevent concurrent operations
  
  constructor(options: SQLiteStorageOptions) {
    super(options);
    this.cacheSize = options.cacheSize || 1000;
    
    try {
      // Dynamically import better-sqlite3
      // This allows the adapter to be used in environments where SQLite isn't needed
      const initDb = () => {
        try {
          // We use dynamic import for better-sqlite3 to avoid requiring it as a dependency
          // when other storage adapters are used
          const Database = require('better-sqlite3');
          this.db = new Database(options.dbPath, { 
            verbose: options.debug ? console.log : undefined 
          });
          
          // Enable WAL mode for better performance if requested
          if (options.enableWAL) {
            this.db.pragma('journal_mode = WAL');
          }
          
          // Enable query cache for better performance if requested
          if (options.enableQueryCache) {
            this.db.pragma('cache_size = 2000');
          }
          
          // Setup database
          this.setupDatabase(options.schemaVersion || 1);
          this.initialized = true;
        } catch (error) {
          if (options.debug) {
            console.error('Failed to initialize SQLite database:', error);
          }
          throw new Error(`SQLite initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      };
      
      // Initialize immediately but don't block constructor
      initDb();
    } catch (error) {
      if (options.debug) {
        console.error('Error in SQLiteStorageAdapter constructor:', error);
      }
    }
  }
  
  /**
   * Set up the database schema
   */
  private setupDatabase(schemaVersion: number): void {
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Create a settings table to track schema version
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    
    // Create the main storage table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS storage (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        namespace TEXT NOT NULL
      )
    `);
    
    // Create an index on namespace for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_storage_namespace 
      ON storage(namespace)
    `);
    
    // Check schema version and perform migrations if needed
    const getVersionStmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const currentVersionRow = getVersionStmt.get('schema_version');
    const currentVersion = currentVersionRow ? parseInt(currentVersionRow.value, 10) : 0;
    
    if (currentVersion < schemaVersion) {
      // Perform migrations based on version differences
      this.migrateSchema(currentVersion, schemaVersion);
      
      // Update schema version
      const setVersionStmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      setVersionStmt.run('schema_version', schemaVersion.toString());
    }
    
    // Prepare common statements for better performance
    this.prepareStatements();
  }
  
  /**
   * Prepare common SQL statements
   */
  private prepareStatements(): void {
    this.statements.insert = this.db.prepare(
      'INSERT OR REPLACE INTO storage (key, value, timestamp, namespace) VALUES (?, ?, ?, ?)'
    );
    
    this.statements.select = this.db.prepare(
      'SELECT value, timestamp FROM storage WHERE key = ?'
    );
    
    this.statements.delete = this.db.prepare(
      'DELETE FROM storage WHERE key = ?'
    );
    
    this.statements.keys = this.db.prepare(
      'SELECT key, timestamp FROM storage WHERE namespace = ?'
    );
    
    this.statements.clear = this.db.prepare(
      'DELETE FROM storage WHERE namespace = ?'
    );
    
    // Create a transaction for batch inserts with proper typing
    this.statements.batchInsert = this.db.transaction((items: Array<{key: string; value: string; timestamp: number; namespace: string}>) => {
      for (const item of items) {
        this.statements.insert.run(item.key, item.value, item.timestamp, item.namespace);
      }
    });
  }
  
  /**
   * Migrate database schema
   */
  private migrateSchema(fromVersion: number, toVersion: number): void {
    // Example migration logic
    if (fromVersion < 1 && toVersion >= 1) {
      // Migration to version 1
      // (Already handled by initial setup)
    }
    
    if (fromVersion < 2 && toVersion >= 2) {
      // Example: Add a new index for timestamp-based queries
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_storage_timestamp 
        ON storage(timestamp)
      `);
    }
  }
  
  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SQLite database not initialized');
    }
  }
  
  /**
   * Add an item to the cache with LRU eviction
   */
  private addToCache(key: string, value: any, timestamp: number): void {
    // Simple mutex to prevent concurrent cache operations
    if (this.addCacheMutex) return;
    
    try {
      this.addCacheMutex = true;
      
      // If cache is full, remove least recently used item
      if (this.cache.size >= this.cacheSize) {
        // Get the oldest item (first inserted)
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }
      
      // Add to cache
      this.cache.set(key, { value, timestamp });
    } finally {
      this.addCacheMutex = false;
    }
  }
  
  /**
   * Save a value with transaction support
   */
  async save(key: string, value: any): Promise<void> {
    this.ensureInitialized();
    
    const namespacedKey = this.getNamespacedKey(key);
    const timestamp = Date.now();
    const serializedValue = this.serialize(value);
    
    try {
      // Save to database
      this.statements.insert.run(
        namespacedKey,
        serializedValue,
        timestamp,
        this.options.namespace
      );
      
      // Update cache
      this.addToCache(namespacedKey, value, timestamp);
    } catch (error) {
      if (this.options.debug) {
        console.error(`Error saving key ${key}:`, error);
      }
      throw error;
    }
  }
  
  /**
   * Load a value with caching
   */
  async load(key: string): Promise<any | null> {
    this.ensureInitialized();
    
    const namespacedKey = this.getNamespacedKey(key);
    
    // Check cache first
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
    
    try {
      // Load from database
      const row = this.statements.select.get(namespacedKey);
      
      if (!row) return null;
      
      // Check for expiration
      if (this.isExpired(row.timestamp)) {
        await this.delete(key);
        return null;
      }
      
      // Deserialize value
      const value = this.deserialize(row.value);
      
      // Update cache
      this.addToCache(namespacedKey, value, row.timestamp);
      
      return value;
    } catch (error) {
      if (this.options.debug) {
        console.error(`Error loading key ${key}:`, error);
      }
      return null;
    }
  }
  
  /**
   * Delete a value with proper cleanup
   */
  async delete(key: string): Promise<boolean> {
    this.ensureInitialized();
    
    const namespacedKey = this.getNamespacedKey(key);
    
    try {
      // Delete from database
      const result = this.statements.delete.run(namespacedKey);
      
      // Remove from cache
      this.cache.delete(namespacedKey);
      
      return result.changes > 0;
    } catch (error) {
      if (this.options.debug) {
        console.error(`Error deleting key ${key}:`, error);
      }
      return false;
    }
  }
  
  /**
   * Clear all values for the current namespace
   */
  async clear(): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Clear from database
      this.statements.clear.run(this.options.namespace);
      
      // Clear cache for this namespace
      const namespacedPrefix = `${this.options.namespace}:`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(namespacedPrefix)) {
          this.cache.delete(key);
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
   * Get all keys with namespace and expiration handling
   */
  async keys(): Promise<string[]> {
    this.ensureInitialized();
    
    const prefix = `${this.options.namespace}:`;
    
    try {
      // Get all keys for this namespace
      const rows = this.statements.keys.all(this.options.namespace);
      const result: string[] = [];
      const now = Date.now();
      
      for (const row of rows) {
        // Skip expired keys
        if (this.isExpired(row.timestamp)) {
          // Delete expired key
          this.statements.delete.run(row.key);
          continue;
        }
        
        // Remove namespace prefix
        if (row.key.startsWith(prefix)) {
          result.push(row.key.substring(prefix.length));
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
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.initialized && this.db) {
      try {
        this.db.close();
        this.initialized = false;
      } catch (error) {
        if (this.options.debug) {
          console.error('Error closing database:', error);
        }
      }
    }
  }
  
  /**
   * Run vacuum to optimize database
   */
  async optimize(): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Run vacuum to reclaim space and optimize
      this.db.exec('VACUUM');
      
      // Run analyze to update statistics
      this.db.exec('ANALYZE');
    } catch (error) {
      if (this.options.debug) {
        console.error('Error optimizing database:', error);
      }
    }
  }
  
  /**
   * Get storage statistics
   */
  getStats(): { itemCount: number; cacheSize: number; dbSize: number } {
    this.ensureInitialized();
    
    try {
      // Count items
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM storage WHERE namespace = ?');
      const countResult = countStmt.get(this.options.namespace);
      
      // Get database size
      const sizeStmt = this.db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()');
      const sizeResult = sizeStmt.get();
      
      return {
        itemCount: countResult.count,
        cacheSize: this.cache.size,
        dbSize: sizeResult.size
      };
    } catch (error) {
      if (this.options.debug) {
        console.error('Error getting stats:', error);
      }
      return { itemCount: 0, cacheSize: 0, dbSize: 0 };
    }
  }
}
