/**
 * MySQL Search Tool
 * Provides optimized database search capabilities for agents
 * with connection pooling and memory-efficient result handling
 */

import { z } from 'zod';
import { createStructuredTool } from '../StructuredTool.js';
import * as mysql from 'mysql2/promise';

// LRU cache implementation for connection pools
class MySQLConnectionCache {
  private pools: Map<string, mysql.Pool> = new Map();
  private maxPools: number;
  private accessOrder: string[] = [];
  private configCache: Map<string, mysql.PoolOptions> = new Map();

  constructor(maxPools = 5) {
    this.maxPools = maxPools;
  }

  /**
   * Parse a connection string into MySQL connection options
   * @param connectionString - MySQL connection string
   * @returns MySQL connection options
   */
  private parseConnectionString(connectionString: string): mysql.PoolOptions {
    try {
      // Check if we already parsed this connection string
      if (this.configCache.has(connectionString)) {
        return this.configCache.get(connectionString)!;
      }

      // Parse new connection string (handle both formats)
      const config: mysql.PoolOptions = {};
      
      // Handle URL format: mysql://user:pass@host:port/dbname
      if (connectionString.startsWith('mysql://')) {
        const url = new URL(connectionString);
        config.host = url.hostname;
        config.port = url.port ? parseInt(url.port, 10) : 3306;
        config.user = url.username;
        config.password = url.password;
        config.database = url.pathname.substring(1); // Remove leading slash
        
        // Parse query parameters (e.g., ?connectionLimit=10)
        url.searchParams.forEach((value, key) => {
          if (key === 'connectionLimit' || key === 'queueLimit') {
            (config as any)[key] = parseInt(value, 10);
          } else {
            (config as any)[key] = value;
          }
        });
      } 
      // Handle key=value format
      else {
        // Split by semicolons or spaces
        const parts = connectionString.split(/[;\s]+/);
        for (const part of parts) {
          const [key, value] = part.split('=', 2);
          if (!key || !value) continue;
          
          // Convert key to lowercase for consistency
          const keyLower = key.toLowerCase();
          
          // Parse numeric values
          if (keyLower === 'port' || keyLower === 'connectionlimit' || keyLower === 'queuelimit') {
            (config as any)[keyLower] = parseInt(value, 10);
          } else {
            (config as any)[keyLower] = value;
          }
        }
      }

      // Set reasonable defaults if not specified
      config.connectionLimit = config.connectionLimit || 10;
      config.queueLimit = config.queueLimit || 0;
      config.waitForConnections = true;
      config.connectTimeout = 10000; // 10 seconds

      // Cache the parsed config
      this.configCache.set(connectionString, config);
      
      return config;
    } catch (error) {
      throw new Error(`Invalid MySQL connection string: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get or create a connection pool for the given connection string
   */
  getPool(connectionString: string): mysql.Pool {
    // Check if pool exists
    if (this.pools.has(connectionString)) {
      // Update access order (move to end = most recently used)
      this.accessOrder = this.accessOrder.filter(key => key !== connectionString);
      this.accessOrder.push(connectionString);
      return this.pools.get(connectionString)!;
    }

    // Ensure we don't exceed max pools (remove least recently used)
    if (this.pools.size >= this.maxPools && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        const oldPool = this.pools.get(oldestKey);
        if (oldPool) {
          oldPool.end().catch((err: Error) => {
            console.error('Error closing MySQL pool:', err.message);
          });
          this.pools.delete(oldestKey);
        }
      }
    }

    // Parse connection string to get configuration
    const config = this.parseConnectionString(connectionString);

    // Create new pool with performance optimizations
    const pool = mysql.createPool(config);

    // Store pool and update access order
    this.pools.set(connectionString, pool);
    this.accessOrder.push(connectionString);

    return pool;
  }

  /**
   * Close all connection pools
   */
  async closeAll(): Promise<void> {
    const closingPromises: Promise<void>[] = [];
    for (const pool of this.pools.values()) {
      closingPromises.push(pool.end());
    }
    await Promise.all(closingPromises);
    this.pools.clear();
    this.accessOrder = [];
    this.configCache.clear();
  }
}

// Global connection pool cache (singleton)
const mysqlConnectionCache = new MySQLConnectionCache();

// Input schema for MySQL search operations
const mysqlSearchSchema = z.object({
  connectionString: z.string().min(1, "Connection string cannot be empty"),
  query: z.string().min(1, "Query cannot be empty"),
  params: z.array(z.any()).default([]),
  rowLimit: z.number().int().positive().default(100).optional(),
  timeout: z.number().int().positive().default(30000).optional(), // 30 seconds default
  nested: z.boolean().default(false).optional() // Whether to return results in nested format
});

// Type inference from zod schema
type MySQLSearchInput = z.infer<typeof mysqlSearchSchema>;

/**
 * Result of a MySQL search operation
 */
export interface MySQLSearchResult {
  // Results data
  rows: Record<string, any>[];
  rowCount: number;
  fields: Array<{
    name: string;
    type: number;
    table: string;
  }> | null;
  // Performance metrics
  duration: number; // milliseconds
  // Error information if applicable
  error?: string;
}

/**
 * Options for configuring the MySQLSearchTool
 */
export interface MySQLSearchToolOptions {
  /**
   * Default connection string to use if not provided in the input
   */
  defaultConnectionString?: string;
  
  /**
   * Whether to automatically parse JSON columns
   * @default true
   */
  parseJson?: boolean;
  
  /**
   * Maximum number of rows to return
   * @default 1000
   */
  maxRows?: number;
  
  /**
   * Whether to cache query results
   * @default false
   */
  cacheResults?: boolean;
  
  /**
   * Cache expiration time in milliseconds
   * @default 60000 (1 minute)
   */
  cacheExpiration?: number;
  
  /**
   * Maximum query execution time in milliseconds
   * @default 30000 (30 seconds)
   */
  queryTimeout?: number;
  
  /**
   * Max connection pools to maintain
   * @default 5
   */
  maxConnectionPools?: number;
}

/**
 * Creates an optimized MySQL search tool
 */
export function createMySQLSearchTool(options: MySQLSearchToolOptions = {}) {
  // Set up reasonable defaults
  const parseJson = options.parseJson ?? true;
  const maxRows = options.maxRows ?? 1000;
  const queryTimeout = options.queryTimeout ?? 30000;
  
  return createStructuredTool({
    name: "mysql_search",
    description: "Execute SQL queries against MySQL databases to retrieve information. Specify connection string, query, and optional parameters.",
    inputSchema: mysqlSearchSchema as z.ZodType<{
      connectionString: string;
      query: string;
      params: any[];
      rowLimit?: number;
      timeout?: number;
      nested?: boolean;
    }>,
    cacheResults: options.cacheResults,
    func: async (input: MySQLSearchInput): Promise<MySQLSearchResult> => {
      // Use either provided connection string or default
      const connectionString = input.connectionString || options.defaultConnectionString;
      
      if (!connectionString) {
        throw new Error("No connection string provided");
      }
      
      // Get connection pool from cache
      const pool = mysqlConnectionCache.getPool(connectionString);
      
      // Apply row limit for memory optimization
      const effectiveRowLimit = Math.min(input.rowLimit || maxRows, maxRows);
      
      // Track execution time
      const startTime = Date.now();
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Query execution timed out after ${input.timeout || queryTimeout}ms`));
        }, input.timeout || queryTimeout);
      });
      
      try {
        // Execute query with timeout
        const queryPromise = pool.query({
          sql: input.query,
          values: input.params,
          // Optimize memory usage for large datasets
          nestTables: input.nested
        });
        
        // Race between query and timeout
        const [results] = await Promise.race([
          queryPromise,
          timeoutPromise
        ]) as [mysql.RowDataPacket[], mysql.FieldPacket[]];
        
        // Calculate execution duration
        const duration = Date.now() - startTime;
        
        // Get result fields (column information)
        const fieldInfo = (await queryPromise)[1];
        
        // Process rows (limit if needed)
        const rows = Array.isArray(results) 
          ? results.slice(0, effectiveRowLimit) 
          : effectiveRowLimit === 1 ? [results] : []; // Handle special case of object result

        // Process JSON columns if enabled
        if (parseJson && rows.length > 0) {
          for (const row of rows) {
            for (const key in row) {
              // Try to parse JSON strings
              if (typeof row[key] === 'string' && (
                  row[key].startsWith('{') && row[key].endsWith('}') ||
                  row[key].startsWith('[') && row[key].endsWith(']')
                )) {
                try {
                  row[key] = JSON.parse(row[key]);
                } catch {
                  // Keep as string if parsing fails
                }
              }
            }
          }
        }
        
        // Return optimized result structure
        return {
          rows,
          rowCount: rows.length,
          fields: fieldInfo?.map((f: any) => ({
            name: f.name,
            type: f.type,
            table: f.table
          })) || null,
          duration
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          rows: [],
          rowCount: 0,
          fields: null,
          duration: Date.now() - startTime,
          error: errorMessage
        };
      }
    }
  });
}

/**
 * Cleanup MySQL connections
 * Call this when shutting down your application
 */
export async function cleanupMySQLConnections(): Promise<void> {
  await mysqlConnectionCache.closeAll();
}
