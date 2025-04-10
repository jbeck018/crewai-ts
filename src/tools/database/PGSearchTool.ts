/**
 * PostgreSQL Search Tool
 * Provides optimized database search capabilities for agents
 * with connection pooling and memory-efficient result handling
 */

import { z } from 'zod';
import { createStructuredTool } from '../StructuredTool.js';
import { Pool, PoolClient, QueryResult } from 'pg';

// LRU cache implementation for connection pools
class ConnectionPoolCache {
  private pools: Map<string, Pool> = new Map();
  private maxPools: number;
  private accessOrder: string[] = [];

  constructor(maxPools = 5) {
    this.maxPools = maxPools;
  }

  /**
   * Get or create a connection pool for the given connection string
   */
  getPool(connectionString: string): Pool {
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
            console.error('Error closing PostgreSQL pool:', err.message);
          });
          this.pools.delete(oldestKey);
        }
      }
    }

    // Create new pool
    const pool = new Pool({
      connectionString,
      // Optimization: set reasonable limits to prevent resource exhaustion
      max: 10, // Maximum 10 clients in pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection cannot be established
    });

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
  }
}

// Global connection pool cache (singleton)
const connectionCache = new ConnectionPoolCache();

// Input schema for PostgreSQL search operations
const pgSearchSchema = z.object({
  connectionString: z.string().min(1, "Connection string cannot be empty"),
  query: z.string().min(1, "Query cannot be empty"),
  params: z.array(z.any()).default([]),
  rowLimit: z.number().int().positive().default(100).optional(),
  timeout: z.number().int().positive().default(30000).optional(), // 30 seconds default
});

// Type inference from zod schema
type PGSearchInput = z.infer<typeof pgSearchSchema>;

/**
 * Result of a PostgreSQL search operation
 */
export interface PGSearchResult {
  rows: Record<string, any>[];
  rowCount: number | null;
  fields: Array<{
    name: string;
    dataTypeID: number;
    tableID: number;
  }> | null;
  command: string;
  duration: number; // milliseconds
  error?: string;
}

/**
 * Options for configuring the PGSearchTool
 */
export interface PGSearchToolOptions {
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
}

/**
 * Creates an optimized PostgreSQL search tool
 */
export function createPGSearchTool(options: PGSearchToolOptions = {}) {
  // Set up reasonable defaults
  const parseJson = options.parseJson ?? true;
  const maxRows = options.maxRows ?? 1000;
  const queryTimeout = options.queryTimeout ?? 30000;
  
  return createStructuredTool({
    name: "pg_search",
    description: "Execute SQL queries against PostgreSQL databases to retrieve information. Specify connection string, query, and optional parameters.",
    inputSchema: pgSearchSchema as z.ZodType<{
      connectionString: string;
      query: string;
      params: any[];
      rowLimit?: number;
      timeout?: number;
    }>,
    cacheResults: options.cacheResults,
    func: async (input: PGSearchInput): Promise<PGSearchResult> => {
      // Use either provided connection string or default
      const connectionString = input.connectionString || options.defaultConnectionString;
      
      if (!connectionString) {
        throw new Error("No connection string provided");
      }
      
      // Get connection pool from cache
      const pool = connectionCache.getPool(connectionString);
      
      // Apply row limit for memory optimization
      const effectiveRowLimit = Math.min(input.rowLimit || maxRows, maxRows);
      
      // Track execution time
      const startTime = Date.now();
      
      let client: PoolClient | null = null;
      
      try {
        // Get client from pool
        client = await pool.connect();
        
        // Execute query with timeout
        const result: QueryResult = await Promise.race([
          client.query(input.query, input.params),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Query execution timed out after ${input.timeout || queryTimeout}ms`));
            }, input.timeout || queryTimeout);
          })
        ]);
        
        // Calculate execution duration
        const duration = Date.now() - startTime;
        
        // Process rows (limit if needed)
        const rows = result.rows.slice(0, effectiveRowLimit);
        
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
          rowCount: result.rowCount,
          fields: result.fields?.map((f: any) => ({
            name: f.name,
            dataTypeID: f.dataTypeID,
            tableID: f.tableID
          })) || null,
          command: result.command,
          duration
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          rows: [],
          rowCount: 0,
          fields: null,
          command: 'ERROR',
          duration: Date.now() - startTime,
          error: errorMessage
        };
      } finally {
        // Release client back to pool
        if (client) {
          client.release();
        }
      }
    }
  });
}

/**
 * Cleanup PostgreSQL connections
 * Call this when shutting down your application
 */
export async function cleanupPGConnections(): Promise<void> {
  await connectionCache.closeAll();
}
