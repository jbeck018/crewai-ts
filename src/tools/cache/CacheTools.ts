/**
 * CacheTools implementation
 * Provides tools for interacting with the caching system
 * Optimized for performance with minimal memory overhead
 */

import { z } from 'zod';
import { createStructuredTool } from '../StructuredTool.js';

// Schema for cache retrieval
const CacheRetrievalSchema = z.object({
  key: z.string().describe('The cache key to retrieve'),
  namespace: z.string().optional().describe('Optional namespace for the cache')
});

// Schema for cache storage
const CacheStorageSchema = z.object({
  key: z.string().describe('The key to store the value under'),
  value: z.any().describe('The value to cache'),
  namespace: z.string().optional().describe('Optional namespace for the cache'),
  ttl: z.number().optional().describe('Time to live in seconds')
});

// Schema for cache invalidation
const CacheInvalidationSchema = z.object({
  key: z.string().describe('The cache key to invalidate'),
  namespace: z.string().optional().describe('Optional namespace for the cache')
});

/**
 * Simple in-memory cache implementation with namespacing and TTL support
 * Optimized for fast reads and writes with efficient memory usage
 */
class MemoryCache {
  private cache: Map<string, Map<string, { value: any; expires?: number }>> = new Map();
  
  /**
   * Get a value from the cache
   */
  get(key: string, namespace = 'default'): any | undefined {
    const namespaceCache = this.cache.get(namespace);
    if (!namespaceCache) return undefined;
    
    const entry = namespaceCache.get(key);
    if (!entry) return undefined;
    
    // Check if expired
    if (entry.expires && entry.expires < Date.now()) {
      namespaceCache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }
  
  /**
   * Set a value in the cache
   */
  set(key: string, value: any, namespace = 'default', ttl?: number): void {
    // Create namespace if it doesn't exist
    if (!this.cache.has(namespace)) {
      this.cache.set(namespace, new Map());
    }
    
    const namespaceCache = this.cache.get(namespace)!;
    
    // Calculate expiration time if TTL is provided
    const expires = ttl ? Date.now() + (ttl * 1000) : undefined;
    
    // Store value
    namespaceCache.set(key, { value, expires });
  }
  
  /**
   * Delete a value from the cache
   */
  delete(key: string, namespace = 'default'): boolean {
    const namespaceCache = this.cache.get(namespace);
    if (!namespaceCache) return false;
    
    return namespaceCache.delete(key);
  }
  
  /**
   * Clear a namespace or the entire cache
   */
  clear(namespace?: string): void {
    if (namespace) {
      this.cache.delete(namespace);
    } else {
      this.cache.clear();
    }
  }
}

// Create singleton cache instance
const memoryCache = new MemoryCache();

/**
 * Create a set of cache manipulation tools
 * Optimized with structured validation and efficient cache operations
 */
export function createCacheTools() {
  return [
    // Cache Get Tool
    createStructuredTool({
      name: 'cache_get',
      description: 'Retrieve a value from the cache by key',
      inputSchema: CacheRetrievalSchema,
      func: async ({ key, namespace = 'default' }) => {
        return memoryCache.get(key, namespace);
      },
      cacheResults: false, // Don't cache cache operations
    }),
    
    // Cache Set Tool
    createStructuredTool({
      name: 'cache_set',
      description: 'Store a value in the cache',
      inputSchema: CacheStorageSchema,
      func: async ({ key, value, namespace = 'default', ttl }) => {
        memoryCache.set(key, value, namespace, ttl);
        return { success: true, key, namespace };
      },
      cacheResults: false,
    }),
    
    // Cache Delete Tool
    createStructuredTool({
      name: 'cache_delete',
      description: 'Remove a value from the cache',
      inputSchema: CacheInvalidationSchema,
      func: async ({ key, namespace = 'default' }) => {
        const deleted = memoryCache.delete(key, namespace);
        return { success: deleted, key, namespace };
      },
      cacheResults: false,
    }),
  ];
}
