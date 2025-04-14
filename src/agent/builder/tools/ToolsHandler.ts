/**
 * Tools Handler
 * Manages agent tools with efficient access patterns and caching capabilities
 * Optimized for memory efficiency and performance
 */

import { BaseTool } from '../../../tools/BaseTool.js';
import { CacheHandler } from '../cache/CacheHandler.js';

/**
 * Tool category enum for organizing tools
 */
export enum ToolCategory {
  GENERAL = 'general',
  DELEGATION = 'delegation',
  KNOWLEDGE = 'knowledge',
  CUSTOM = 'custom'
}

/**
 * Tool metadata for additional tool information
 */
export interface ToolMetadata {
  category?: ToolCategory;
  isAsync?: boolean;
  requiresAuth?: boolean;
  [key: string]: any;
}

/**
 * Enhanced tool type with additional metadata
 */
export interface EnhancedTool extends BaseTool {
  metadata?: ToolMetadata;
}

/**
 * Cache key generator function type
 */
export type CacheKeyGenerator = (tool: BaseTool, args: unknown[]) => string;

/**
 * Tool execution parameters type with memory-optimized structure
 */
export type ToolParameters = Record<string, unknown>;

/**
 * Tools Handler for managing agent tools with efficient access patterns
 * and optional caching capabilities
 * 
 * Optimized with:
 * - Fast tool lookup with Map
 * - Category-based filtering
 * - Tool result caching
 * - Memory efficient tool storage
 */
export class ToolsHandler {
  private tools: Map<string, EnhancedTool> = new Map();
  private cache?: CacheHandler;
  private defaultKeyGenerator: CacheKeyGenerator;
  
  /**
   * Create a new ToolsHandler
   * Optimized for memory efficiency and type safety
   */
  constructor() {
    // Default cache key generator function with improved memory handling
    // Uses explicit typing for parameters and optimizes string handling
    this.defaultKeyGenerator = (tool: BaseTool, args: unknown[]): string => {
      try {
        // Type validation to ensure proper serialization
        if (!tool || typeof tool.name !== 'string') {
          return `unknown-tool:${Date.now()}`;
        }

        // Memory-optimized argument handling - filter undefined/null values
        const filteredArgs = args.filter(arg => arg !== undefined && arg !== null);
        
        // Use compact string representation with hash to minimize memory usage
        const argsStr = JSON.stringify(filteredArgs);
        // Use substring to limit key size for large argument objects
        return `${tool.name}:${argsStr.substring(0, 100)}`;
      } catch (error) {
        // Fallback with error-safe implementation
        const toolName = tool && typeof tool.name === 'string' ? tool.name : 'unknown';
        return `${toolName}:${Date.now()}`;
      }
    };
  }
  
  /**
   * Set the cache handler for tool results
   * @param cache Cache handler instance
   */
  setCache(cache: CacheHandler): void {
    this.cache = cache;
  }
  
  /**
   * Add a tool to the handler
   * @param tool Tool to add
   * @param metadata Optional metadata for the tool
   */
  addTool(tool: BaseTool, metadata?: ToolMetadata): void {
    const enhancedTool: EnhancedTool = { ...tool };
    
    if (metadata) {
      enhancedTool.metadata = metadata;
    }
    
    this.tools.set(tool.name, enhancedTool);
  }
  
  /**
   * Add multiple tools to the handler
   * @param tools Array of tools to add
   * @param metadata Optional metadata to apply to all tools
   */
  addTools(tools: BaseTool[], metadata?: ToolMetadata): void {
    for (const tool of tools) {
      this.addTool(tool, metadata);
    }
  }
  
  /**
   * Get a tool by name
   * @param name Name of the tool
   * @returns The tool or undefined if not found
   */
  getTool(name: string): EnhancedTool | undefined {
    return this.tools.get(name);
  }
  
  /**
   * Get all tools
   * @returns Array of all tools
   */
  getAllTools(): EnhancedTool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Get tools by category
   * @param category Category to filter by
   * @returns Array of tools in the category
   */
  getToolsByCategory(category: ToolCategory): EnhancedTool[] {
    // Memory-optimized filtering with explicit null/undefined checking for improved type safety
    return this.getAllTools().filter(tool => {
      // First check if metadata exists to avoid unnecessary property access
      if (!tool.metadata) return false;
      // Then safely compare the category values
      return tool.metadata.category === category;
    });
  }
  
  /**
   * Remove a tool by name
   * @param name Name of the tool to remove
   * @returns True if the tool was removed, false otherwise
   */
  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }
  
  /**
   * Remove all tools
   */
  clearTools(): void {
    this.tools.clear();
  }
  
  /**
   * Check if a tool exists
   * @param name Name of the tool
   * @returns True if the tool exists, false otherwise
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
  
  /**
   * Execute a tool with caching if enabled
   * @param name Name of the tool to execute
   * @param args Arguments to pass to the tool
   * @param keyGenerator Optional custom cache key generator
   * @returns The result of the tool execution
   */
  async executeTool<T = unknown>(name: string, args: unknown[], keyGenerator?: CacheKeyGenerator): Promise<T> {
    // Validate name is non-empty string with proper type safety
    if (typeof name !== 'string' || !name.trim()) {
      throw new TypeError('Tool name must be a non-empty string');
    }

    const tool = this.getTool(name);
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    // Ensure args is an array for type safety and memory optimization
    // This implementation is more robust with undefined/null handling
    const safeArgs = Array.isArray(args) ? args : (args ? [args] : []);
    
    // If caching is enabled, try to get from cache or compute with memory optimization
    if (this.cache) {
      // Use provided key generator or default, with proper null handling
      const keygen = keyGenerator || this.defaultKeyGenerator;
      // Generate cache key with proper type handling
      const cacheKey = keygen(tool, safeArgs);
      
      // Use generic type parameter for better type safety
      return this.cache.getOrCompute<T>(cacheKey, async () => {
        // Extract the first argument with proper type safety
        const firstArg = safeArgs.length > 0 ? safeArgs[0] : undefined;
        // Cast the result to the expected type for memory-efficient handling
        return await tool.execute(firstArg) as T;
      });
    }
    
    // If no cache, execute the tool with memory-optimized parameter handling
    const firstArg = safeArgs.length > 0 ? safeArgs[0] : undefined;
    return await tool.execute(firstArg) as T;
  }
  
  /**
   * Create a categorized string representation of tools for agent prompts
   * @returns Formatted string of tools grouped by category
   */
  formatToolsForPrompt(): string {
    if (this.tools.size === 0) {
      return 'No tools available.';
    }
    
    // Group tools by category
    const toolsByCategory: Record<string, EnhancedTool[]> = {};
    
    for (const tool of this.getAllTools()) {
      const category = tool.metadata?.category || ToolCategory.GENERAL;
      if (!toolsByCategory[category]) {
        toolsByCategory[category] = [];
      }
      toolsByCategory[category].push(tool);
    }
    
    // Format each category
    const formattedCategories: string[] = [];
    
    for (const [category, categoryTools] of Object.entries(toolsByCategory)) {
      formattedCategories.push(
        `${category.toUpperCase()} TOOLS:\n` +
        categoryTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')
      );
    }
    
    return formattedCategories.join('\n\n');
  }
}
