/**
 * WebSearchTool implementation
 * Provides search capabilities for agents to gather information from the web
 * Optimized for performance and error handling
 */

import { z } from 'zod';
import { createStructuredTool, StructuredToolOptions } from '../StructuredTool.js';

// Input schema for web search
const searchInputSchema = z.object({
  query: z.string().min(1, "Search query cannot be empty"),
  numResults: z.number().int().positive().default(5).optional(),
  includeUrls: z.boolean().default(true).optional(),
  includeDomains: z.array(z.string()).optional(),
  excludeDomains: z.array(z.string()).optional(),
});

// Type inference from zod schema
type SearchInput = z.infer<typeof searchInputSchema>;

// Search result interface
export interface SearchResult {
  title: string;
  snippet: string;
  url?: string;
  position?: number;
}

/**
 * Options for configuring the WebSearchTool
 */
export interface WebSearchToolOptions {
  apiKey?: string;
  searchEngine?: 'google' | 'bing' | 'duckduckgo' | 'custom';
  customSearchFunction?: (input: SearchInput) => Promise<SearchResult[]>;
  cacheResults?: boolean;
  cacheExpiration?: number; // Time in milliseconds
  timeoutMs?: number;
  maxRetries?: number;
  userAgent?: string;
}

/**
 * LRU Cache implementation for search results
 */
class LRUCache<K, V> {
  private cache = new Map<K, { value: V, timestamp: number }>(); 
  private readonly maxSize: number;
  private readonly expiration: number; // Time in milliseconds

  constructor(maxSize = 100, expiration = 3600000) { // Default 1-hour expiration
    this.maxSize = maxSize;
    this.expiration = expiration;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    
    // Check if item has expired
    if (Date.now() - item.timestamp > this.expiration) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Refresh item position in cache (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: K, value: V): void {
    // If cache is at capacity, remove least recently used item
    if (this.cache.size >= this.maxSize) {
      const lruKey = this.cache.keys().next().value;
      this.cache.delete(lruKey);
    }
    
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Default search implementation with fallback strategy
 * This is a placeholder that would be replaced with actual API calls
 */
async function defaultSearch(input: SearchInput): Promise<SearchResult[]> {
  // This would be implemented with actual search API calls
  // For now just return a fallback result
  return [{
    title: "Search API not configured",
    snippet: "Please configure a search API or provide a custom search function",
    position: 1
  }];
}

/**
 * Creates a web search tool with the specified configuration
 */
export function createWebSearchTool(options: WebSearchToolOptions = {}) {
  // Configure search function
  const searchFunction = options.customSearchFunction || defaultSearch;
  
  // Set up caching if enabled
  const resultCache = options.cacheResults ? 
    new LRUCache<string, SearchResult[]>(100, options.cacheExpiration) : 
    undefined;
  
  // Tool implementation
  const toolOptions: StructuredToolOptions<SearchInput, SearchResult[]> = {
    name: "web_search",
    description: "Search the web for information on a specific topic or query",
    inputSchema: searchInputSchema,
    cacheResults: !!options.cacheResults,
    timeout: options.timeoutMs,
    maxRetries: options.maxRetries,
    func: async (input: SearchInput, runOptions): Promise<SearchResult[]> => {
      // Use custom cache implementation if provided
      if (resultCache) {
        const cacheKey = JSON.stringify(input);
        const cachedResult = resultCache.get(cacheKey);
        if (cachedResult) return cachedResult;
        
        const results = await searchFunction(input);
        resultCache.set(cacheKey, results);
        return results;
      }
      
      // Without custom cache, rely on the tool's built-in caching
      return await searchFunction(input);
    }
  };
  
  return createStructuredTool(toolOptions);
}
