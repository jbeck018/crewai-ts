/**
 * ContextualMemory implementation
 * Combines different memory types to build comprehensive context for agent tasks
 * 
 * Optimized for:
 * - Parallel memory retrieval for faster context building
 * - Intelligent context aggregation with deduplication
 * - Relevance-based context prioritization
 * - Efficient caching of frequently accessed contexts
 */

import { Task } from '../task/Task.js';
import { BaseMemory, MemorySearchParams } from './BaseMemory.js';
import { EntityMemory } from './EntityMemory.js';
import { LongTermMemory } from './LongTermMemory.js';
import { ShortTermMemory } from './ShortTermMemory.js';

/**
 * Options for configuring ContextualMemory behavior
 */
export interface ContextualMemoryOptions {
  /**
   * Whether to use caching for context building
   * @default true
   */
  useCache?: boolean;

  /**
   * Cache TTL in milliseconds
   * @default 5 minutes
   */
  cacheTtlMs?: number;

  /**
   * Maximum context length in characters
   * @default 10000
   */
  maxContextLength?: number;

  /**
   * Whether to use asynchronous context fetch
   * @default true
   */
  useAsyncFetch?: boolean;

  /**
   * Separator for different context sections
   * @default '\n\n'
   */
  sectionSeparator?: string;

  /**
   * Default limit for memory search operations
   * @default 5
   */
  defaultSearchLimit?: number;

  /**
   * Default relevance threshold for memory search
   * @default 0.35
   */
  defaultRelevanceThreshold?: number;

  /**
   * Optional function to format context sections
   */
  sectionFormatter?: (title: string, content: string[]) => string;

  /**
   * User memory provider name
   * @default undefined
   */
  memoryProvider?: string;
}

/**
 * Cache entry with TTL tracking
 */
interface CacheEntry {
  content: string;
  timestamp: number;
}

/**
 * ContextualMemory class for building comprehensive context from different memory types
 * 
 * Optimized for:
 * - Parallel retrieval from different memory sources
 * - Deduplication of similar information
 * - Relevance-based prioritization
 * - Efficient caching
 */
export class ContextualMemory {
  private stm: ShortTermMemory;
  private ltm: LongTermMemory;
  private em: EntityMemory;
  private um?: BaseMemory;
  private memoryProvider?: string;
  
  private useCache: boolean;
  private cacheTtlMs: number;
  private maxContextLength: number;
  private useAsyncFetch: boolean;
  private sectionSeparator: string;
  private defaultSearchLimit: number;
  private defaultRelevanceThreshold: number;
  private sectionFormatter?: (title: string, content: string[]) => string;
  
  // Cache for built contexts to avoid redundant processing
  private contextCache = new Map<string, CacheEntry>();
  
  constructor(
    options: ContextualMemoryOptions = {},
    stm: ShortTermMemory,
    ltm: LongTermMemory,
    em: EntityMemory,
    um?: BaseMemory
  ) {
    this.stm = stm;
    this.ltm = ltm;
    this.em = em;
    this.um = um;
    
    this.useCache = options.useCache ?? true;
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000; // 5 minutes by default
    this.maxContextLength = options.maxContextLength ?? 10000;
    this.useAsyncFetch = options.useAsyncFetch ?? true;
    this.sectionSeparator = options.sectionSeparator ?? '\n\n';
    this.defaultSearchLimit = options.defaultSearchLimit ?? 5;
    this.defaultRelevanceThreshold = options.defaultRelevanceThreshold ?? 0.35;
    this.sectionFormatter = options.sectionFormatter;
    this.memoryProvider = options.memoryProvider;
  }
  
  /**
   * Builds comprehensive context for a task by aggregating information
   * from different memory sources
   * 
   * @param task The task to build context for
   * @param additionalContext Optional additional context to include
   * @returns Formatted context string optimized for agent consumption
   */
  async buildContextForTask(task: Task, additionalContext?: string): Promise<string> {
    const query = `${task.description} ${additionalContext || ''}`.trim();
    
    if (!query) {
      return '';
    }
    
    // Check cache if enabled
    if (this.useCache) {
      const cachedContext = this.getCachedContext(query);
      if (cachedContext) {
        return cachedContext;
      }
    }
    
    // Build context sections with optimized parallel fetching
    let contextSections: string[] = [];
    
    if (this.useAsyncFetch) {
      // Parallel fetching of context from different sources
      const results = await Promise.all([
        this.fetchShortTermContext(query),
        this.fetchLongTermContext(task.description),
        this.fetchEntityContext(query),
        this.um && this.memoryProvider === 'mem0' ? this.fetchUserContext(query) : Promise.resolve('')
      ]);
      
      contextSections = results.filter(section => section.length > 0);
    } else {
      // Sequential fetching for debugging or when parallel processing causes issues
      const stmContext = await this.fetchShortTermContext(query);
      if (stmContext) contextSections.push(stmContext);
      
      const ltmContext = await this.fetchLongTermContext(task.description);
      if (ltmContext) contextSections.push(ltmContext);
      
      const emContext = await this.fetchEntityContext(query);
      if (emContext) contextSections.push(emContext);
      
      if (this.um && this.memoryProvider === 'mem0') {
        const umContext = await this.fetchUserContext(query);
        if (umContext) contextSections.push(umContext);
      }
    }
    
    // Ensure we're within max context length
    const combinedContext = this.optimizeContextLength(contextSections.join(this.sectionSeparator));
    
    // Cache the result if enabled
    if (this.useCache) {
      this.cacheContext(query, combinedContext);
    }
    
    return combinedContext;
  }
  
  /**
   * Fetches recent insights from short-term memory related to the query
   * 
   * @param query The search query
   * @returns Formatted short-term memory context
   */
  private async fetchShortTermContext(query: string): Promise<string> {
    const searchParams: MemorySearchParams = {
      query,
      limit: this.defaultSearchLimit,
      minRelevance: this.defaultRelevanceThreshold
    };
    
    const results = await this.stm.search(searchParams);
    
    if (results.items.length === 0) {
      return '';
    }
    
    const formattedResults = results.items.map(item => {
      const content = this.memoryProvider === 'mem0' ? item.metadata?.memory || item.content : item.content;
      return `- ${content}`;
    }).join('\n');
    
    if (this.sectionFormatter) {
      return this.sectionFormatter('Recent Insights', formattedResults.split('\n'));
    }
    
    return `Recent Insights:\n${formattedResults}`;
  }
  
  /**
   * Fetches historical data from long-term memory that is relevant to the task
   * 
   * @param query The search query
   * @returns Formatted long-term memory context
   */
  private async fetchLongTermContext(query: string): Promise<string> {
    const searchParams: MemorySearchParams = {
      query,
      limit: 2, // Limiting to most relevant historical items
      minRelevance: this.defaultRelevanceThreshold
    };
    
    const results = await this.ltm.search(searchParams);
    
    if (results.items.length === 0) {
      return '';
    }
    
    // Extract unique suggestions from metadata
    const suggestions = new Set<string>();
    for (const item of results.items) {
      if (item.metadata?.suggestions && Array.isArray(item.metadata.suggestions)) {
        for (const suggestion of item.metadata.suggestions) {
          suggestions.add(suggestion);
        }
      }
    }
    
    if (suggestions.size === 0) {
      return '';
    }
    
    const formattedResults = Array.from(suggestions).map(suggestion => `- ${suggestion}`).join('\n');
    
    if (this.sectionFormatter) {
      return this.sectionFormatter('Historical Data', formattedResults.split('\n'));
    }
    
    return `Historical Data:\n${formattedResults}`;
  }
  
  /**
   * Fetches relevant entity information from entity memory related to the query
   * 
   * @param query The search query
   * @returns Formatted entity memory context
   */
  private async fetchEntityContext(query: string): Promise<string> {
    const searchParams: MemorySearchParams = {
      query,
      limit: this.defaultSearchLimit,
      minRelevance: this.defaultRelevanceThreshold
    };
    
    const results = await this.em.search(searchParams);
    
    if (results.items.length === 0) {
      return '';
    }
    
    const formattedResults = results.items.map(item => {
      const content = this.memoryProvider === 'mem0' ? item.metadata?.memory || item.content : item.content;
      return `- ${content}`;
    }).join('\n');
    
    if (this.sectionFormatter) {
      return this.sectionFormatter('Entities', formattedResults.split('\n'));
    }
    
    return `Entities:\n${formattedResults}`;
  }
  
  /**
   * Fetches relevant user information from user memory related to the query
   * 
   * @param query The search query
   * @returns Formatted user memory context
   */
  private async fetchUserContext(query: string): Promise<string> {
    if (!this.um) {
      return '';
    }
    
    const searchParams: MemorySearchParams = {
      query,
      limit: this.defaultSearchLimit,
      minRelevance: this.defaultRelevanceThreshold
    };
    
    const results = await this.um.search(searchParams);
    
    if (results.items.length === 0) {
      return '';
    }
    
    const formattedResults = results.items.map(item => {
      return `- ${item.metadata?.memory || item.content}`;
    }).join('\n');
    
    if (this.sectionFormatter) {
      return this.sectionFormatter('User memories/preferences', formattedResults.split('\n'));
    }
    
    return `User memories/preferences:\n${formattedResults}`;
  }
  
  /**
   * Ensures context length doesn't exceed maximum length by prioritizing
   * the most relevant information
   * 
   * @param context The full context string
   * @returns Optimized context within length limits
   */
  private optimizeContextLength(context: string): string {
    if (context.length <= this.maxContextLength) {
      return context;
    }
    
    // If context is too long, prioritize different sections
    const sections = context.split(this.sectionSeparator);
    let optimizedContext = '';
    
    // Priority order: User Memories > Recent Insights > Entities > Historical Data
    const priorityOrder = [
      'User memories/preferences:',
      'Recent Insights:',
      'Entities:',
      'Historical Data:'
    ];
    
    // Sort sections by priority
    sections.sort((a, b) => {
      const aIndex = priorityOrder.findIndex(prefix => a.startsWith(prefix));
      const bIndex = priorityOrder.findIndex(prefix => b.startsWith(prefix));
      
      // If both sections are in priority list, sort by priority
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If only one is in priority list, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // Otherwise, keep original order
      return 0;
    });
    
    // Add sections until we hit the length limit
    for (const section of sections) {
      if ((optimizedContext + section + this.sectionSeparator).length <= this.maxContextLength) {
        if (optimizedContext) {
          optimizedContext += this.sectionSeparator;
        }
        optimizedContext += section;
      } else {
        // If we can't fit the entire section, try to include the header and some items
        const lines = section.split('\n');
        if (lines.length > 0) {
          // Always include the header (we know it exists because lines.length > 0)
          const header = lines[0] || ''; // Fallback for type safety
          const remainingLength = this.maxContextLength - (optimizedContext.length + header.length + this.sectionSeparator.length);
          
          if (remainingLength > 0) {
            // Add as many items as we can fit
            // Initialize with header which we know exists
            let partialSection: string = header;
            for (let i = 1; i < lines.length; i++) {
              // We know lines[i] exists because we're iterating within bounds
              // But we add a fallback for type safety
              const lineContent = lines[i] || '';
              if ((partialSection.length + '\n'.length + lineContent.length) <= remainingLength) {
                partialSection += '\n' + lineContent;
              } else {
                break;
              }
            }
            
            if (optimizedContext) {
              optimizedContext += this.sectionSeparator;
            }
            optimizedContext += partialSection;
          }
        }
        
        // Stop adding sections as we've reached the limit
        break;
      }
    }
    
    return optimizedContext;
  }
  
  /**
   * Gets cached context if available and not expired
   * 
   * @param query The query to get cached context for
   * @returns Cached context or undefined if not found or expired
   */
  private getCachedContext(query: string): string | undefined {
    if (!this.useCache) {
      return undefined;
    }
    
    const cacheKey = this.generateCacheKey(query);
    const cachedEntry = this.contextCache.get(cacheKey);
    
    if (!cachedEntry) {
      return undefined;
    }
    
    const now = Date.now();
    if (now - cachedEntry.timestamp > this.cacheTtlMs) {
      // Cache entry expired, remove it
      this.contextCache.delete(cacheKey);
      return undefined;
    }
    
    return cachedEntry.content;
  }
  
  /**
   * Caches built context for future reuse
   * 
   * @param query The query the context was built for
   * @param context The built context to cache
   */
  private cacheContext(query: string, context: string): void {
    if (!this.useCache) {
      return;
    }
    
    const cacheKey = this.generateCacheKey(query);
    this.contextCache.set(cacheKey, {
      content: context,
      timestamp: Date.now()
    });
    
    // Keep cache size reasonable by removing oldest entries if needed
    this.pruneCache();
  }
  
  /**
   * Generates a cache key for a query
   * 
   * @param query The query to generate a key for
   * @returns Cache key
   */
  private generateCacheKey(query: string): string {
    // Simple hashing function for cache keys
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `context_${hash}`;
  }
  
  /**
   * Removes oldest cache entries if the cache is too large
   */
  private pruneCache(): void {
    const maxCacheSize = 100; // Maximum number of cached contexts
    
    if (this.contextCache.size <= maxCacheSize) {
      return;
    }
    
    const entries = Array.from(this.contextCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    // Remove oldest entries until we're under the limit
    const entriesToRemove = entries.slice(0, this.contextCache.size - maxCacheSize);
    for (const [key] of entriesToRemove) {
      this.contextCache.delete(key);
    }
  }
}
