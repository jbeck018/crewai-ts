/**
 * JSON Knowledge Source
 * Process structured JSON data as knowledge sources with optimized path-based access
 */

import { BaseKnowledgeSource, KnowledgeSourceOptions } from './BaseKnowledgeSource.js';
import { KnowledgeChunk, Metadata } from '../types.js';

/**
 * Schema configuration for JSON path extraction
 * Defines how to transform a specific path in the JSON structure
 */
export interface JSONPathSchema {
  /**
   * JSON path to extract (using dot notation or array indices)
   */
  path: string;
  
  /**
   * Optional name for the extracted content
   */
  name?: string;
  
  /**
   * How to format the extracted value
   * - 'raw': Keep as is (for primitives)
   * - 'string': Convert to string
   * - 'structured': Format as key-value pairs
   * - 'template': Use a template string with {path} placeholders
   * @default 'structured'
   */
  format?: 'raw' | 'string' | 'structured' | 'template';
  
  /**
   * Template string for 'template' format
   * Use {path} placeholders to reference other paths
   */
  template?: string;
  
  /**
   * Only apply this schema if a condition is met
   */
  condition?: {
    /**
     * Path to check
     */
    path: string;
    
    /**
     * Operator for condition
     */
    operator: 'equals' | 'contains' | 'exists' | 'gt' | 'lt';
    
    /**
     * Value to compare against
     */
    value?: any;
  };
  
  /**
   * Additional metadata to add to chunks created from this path
   */
  metadata?: Metadata;
}

/**
 * Options specific to JSON knowledge sources
 */
export interface JSONKnowledgeSourceOptions extends KnowledgeSourceOptions {
  /**
   * JSON data to process
   * Can be a JSON object or a stringified JSON
   */
  data: Record<string, any> | string;
  
  /**
   * Schema configuration for path extraction
   * If not provided, all paths will be processed
   */
  schema?: JSONPathSchema[];
  
  /**
   * Additional metadata to attach to all chunks
   */
  metadata?: Metadata;
  
  /**
   * Whether to flatten arrays
   * @default true
   */
  flattenArrays?: boolean;
  
  /**
   * Maximum depth for nested objects
   * @default 5
   */
  maxDepth?: number;
  
  /**
   * Maximum array items to process
   * @default 100
   */
  maxArrayItems?: number;
  
  /**
   * Skip null or undefined values
   * @default true
   */
  skipNulls?: boolean;
  
  /**
   * Use dot notation for paths
   * @default true
   */
  useDotNotation?: boolean;
  
  /**
   * Include path in chunk content
   * @default true
   */
  includePath?: boolean;
}

/**
 * Knowledge source for processing structured JSON data
 * Optimized for efficient path-based access and semantic chunking
 */
export class JSONKnowledgeSource extends BaseKnowledgeSource {
  /**
   * JSON data to process
   * @private
   */
  private jsonData: Record<string, any>;
  
  /**
   * Configured JSON options with defaults
   * @private
   */
  private jsonOptions: Required<Omit<JSONKnowledgeSourceOptions, keyof KnowledgeSourceOptions | 'data'>>;
  
  /**
   * Schema configuration for path extraction
   * @private
   */
  private schema: JSONPathSchema[];
  
  /**
   * Constructor for JSONKnowledgeSource
   * @param options - Configuration options
   */
  constructor(options: JSONKnowledgeSourceOptions) {
    super('json', {
      ...options,
      metadata: options.metadata || {}
    });
    
    // Parse JSON data if it's a string
    if (typeof options.data === 'string') {
      try {
        this.jsonData = JSON.parse(options.data);
      } catch (error) {
        throw new Error('Invalid JSON data string');
      }
    } else {
      this.jsonData = options.data;
    }
    
    // Set default options with optimizations
    this.jsonOptions = {
      schema: options.schema || [],
      flattenArrays: options.flattenArrays !== false,
      maxDepth: options.maxDepth ?? 5,
      maxArrayItems: options.maxArrayItems ?? 100,
      skipNulls: options.skipNulls !== false,
      useDotNotation: options.useDotNotation !== false,
      includePath: options.includePath !== false
    };
    
    // Initialize schema
    this.schema = this.jsonOptions.schema;
  }
  
  /**
   * Process and add JSON data to storage
   * Implements path-based extraction and optimized chunking
   * @override
   */
  override async add(): Promise<void> {
    if (!this._storage) {
      throw new Error('Storage not set for JSONKnowledgeSource');
    }
    
    // Skip if data is empty
    if (!this.jsonData || Object.keys(this.jsonData).length === 0) {
      return;
    }
    
    // Process JSON data based on schema or by traversing all paths
    let chunks: KnowledgeChunk[] = [];
    
    if (this.schema.length > 0) {
      // Use schema-based extraction
      chunks = this.processWithSchema();
    } else {
      // Use automatic traversal
      chunks = this.processAllPaths();
    }
    
    // Add chunks to storage in optimized batches
    if (chunks.length > 0) {
      await this._storage.addChunks(chunks);
    }
  }
  
  /**
   * Create a knowledge chunk from JSON content
   * @param content - Content for the chunk
   * @param additionalMetadata - Additional metadata or JSON path
   * @returns Knowledge chunk object
   * @private
   */
  protected override createChunk(content: string, additionalMetadata?: Metadata | string): KnowledgeChunk {
    // Handle string parameter (path) for backward compatibility
    const path = typeof additionalMetadata === 'string' ? additionalMetadata : undefined;
    const metadataObj = typeof additionalMetadata === 'object' ? additionalMetadata : {};
    
    return {
      id: this.generateChunkId(content),
      content: content.trim(),
      source: 'json',
      metadata: {
        source: 'json',
        path: path || '',
        ...this.options.metadata,
        ...metadataObj
      }
    };
  }
  
  /**
   * Process JSON data using schema configuration
   * @returns Array of knowledge chunks
   * @private
   */
  private processWithSchema(): KnowledgeChunk[] {
    const chunks: KnowledgeChunk[] = [];
    
    // Process each schema path
    for (const schemaItem of this.schema) {
      // Check if condition is met
      if (schemaItem.condition && !this.evaluateCondition(schemaItem.condition)) {
        continue;
      }
      
      // Extract value at path
      const value = this.getValueAtPath(this.jsonData, schemaItem.path);
      
      // Skip if value is null/undefined and skipNulls is true
      if ((value === null || value === undefined) && this.jsonOptions.skipNulls) {
        continue;
      }
      
      // Format value based on schema
      const content = this.formatValue(value, schemaItem);
      
      // Skip empty content
      if (!content.trim()) {
        continue;
      }
      
      // Create chunk with path-specific metadata
      chunks.push({
        id: this.generateChunkId(content),
        content,
        source: 'json',
        metadata: {
          source: 'json',
          path: schemaItem.path,
          name: schemaItem.name || schemaItem.path,
          ...this.options.metadata,
          ...schemaItem.metadata
        }
      });
    }
    
    return chunks;
  }
  
  /**
   * Process all paths in the JSON data
   * @returns Array of knowledge chunks
   * @private
   */
  private processAllPaths(): KnowledgeChunk[] {
    const chunks: KnowledgeChunk[] = [];
    const paths = this.extractAllPaths(this.jsonData);
    
    // Create chunks for each path
    for (const path of paths) {
      const value = this.getValueAtPath(this.jsonData, path);
      
      // Skip null/undefined if configured
      if ((value === null || value === undefined) && this.jsonOptions.skipNulls) {
        continue;
      }
      
      // Format content
      let content = this.jsonOptions.includePath
        ? `${path}: ${this.stringifyValue(value)}`
        : this.stringifyValue(value);
      
      // Skip empty content
      if (!content.trim()) {
        continue;
      }
      
      // Create chunk
      chunks.push(this.createChunk(content, path));
    }
    
    return chunks;
  }
  
  /**
   * Extract all paths from JSON data
   * @param data - JSON data
   * @param basePath - Base path for recursion
   * @param depth - Current depth
   * @returns Array of paths
   * @private
   */
  private extractAllPaths(data: any, basePath = '', depth = 0): string[] {
    const paths: string[] = [];
    
    // Return if max depth reached or data is not an object
    if (depth >= this.jsonOptions.maxDepth || typeof data !== 'object' || data === null) {
      return basePath ? [basePath] : [];
    }
    
    // Process object or array
    if (Array.isArray(data)) {
      // Process array
      const limitedArray = data.slice(0, this.jsonOptions.maxArrayItems);
      
      if (this.jsonOptions.flattenArrays) {
        // Flatten arrays (treat as a single value)
        paths.push(basePath);
      } else {
        // Process each array item
        for (let i = 0; i < limitedArray.length; i++) {
          const itemPath = basePath ? `${basePath}[${i}]` : `[${i}]`;
          const itemPaths = this.extractAllPaths(limitedArray[i], itemPath, depth + 1);
          paths.push(...itemPaths);
        }
      }
    } else {
      // Process object
      for (const [key, value] of Object.entries(data)) {
        const newPath = basePath
          ? this.jsonOptions.useDotNotation ? `${basePath}.${key}` : `${basePath}["${key}"]`
          : key;
        
        if (typeof value === 'object' && value !== null) {
          // Recurse into nested objects
          const nestedPaths = this.extractAllPaths(value, newPath, depth + 1);
          paths.push(...nestedPaths);
        } else {
          // Leaf node
          paths.push(newPath);
        }
      }
    }
    
    return paths;
  }
  
  /**
   * Get value at specified JSON path
   * @param data - JSON data
   * @param path - Path to retrieve
   * @returns Value at path
   * @private
   */
  private getValueAtPath(data: any, path: string): any {
    if (!path) return data;
    
    const pathParts = this.parsePath(path);
    let current = data;
    
    for (const part of pathParts) {
      // Handle array index
      if (part.startsWith('[') && part.endsWith(']')) {
        const index = parseInt(part.slice(1, -1), 10);
        if (Array.isArray(current) && !isNaN(index) && index >= 0 && index < current.length) {
          current = current[index];
        } else {
          return undefined; // Invalid array access
        }
      } else {
        // Handle object property
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return undefined; // Property not found
        }
      }
    }
    
    return current;
  }
  
  /**
   * Parse a JSON path into path parts
   * @param path - Path string
   * @returns Array of path parts
   * @private
   */
  private parsePath(path: string): string[] {
    // Handle both dot notation and bracket notation
    if (!path) return [];
    
    // Split by dots but preserve dots within brackets
    const parts: string[] = [];
    let currentPart = '';
    let inBrackets = false;
    
    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      
      if (char === '[') {
        inBrackets = true;
        
        // If we have accumulated a part before bracket, add it
        if (currentPart) {
          parts.push(currentPart);
          currentPart = '';
        }
        
        currentPart += char;
      } else if (char === ']') {
        inBrackets = false;
        currentPart += char;
        
        // Complete bracket notation part
        parts.push(currentPart);
        currentPart = '';
      } else if (char === '.' && !inBrackets) {
        // End of a part with dot separator (not in brackets)
        if (currentPart) {
          parts.push(currentPart);
          currentPart = '';
        }
      } else {
        currentPart += char;
      }
    }
    
    // Add the last part if any
    if (currentPart) {
      parts.push(currentPart);
    }
    
    return parts;
  }
  
  /**
   * Format value based on schema configuration
   * @param value - Value to format
   * @param schema - Schema configuration
   * @returns Formatted content string
   * @private
   */
  private formatValue(value: any, schema: JSONPathSchema): string {
    const format = schema.format || 'structured';
    const name = schema.name || schema.path;
    
    switch (format) {
      case 'raw':
        // Return value as is for primitives, or JSON string for objects
        return typeof value === 'object' && value !== null
          ? JSON.stringify(value)
          : String(value);
      
      case 'string':
        // Convert to string
        return String(value);
      
      case 'template':
        // Use template with placeholders
        if (schema.template) {
          return this.formatTemplate(schema.template);
        }
        // Fallback to structured format
        return `${name}: ${this.stringifyValue(value)}`;
      
      case 'structured':
      default:
        // Format as key-value pair
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            // Format array
            const items = value.slice(0, this.jsonOptions.maxArrayItems)
              .map(item => this.stringifyValue(item));
            return `${name}:\n${items.map(item => `- ${item}`).join('\n')}`;
          } else {
            // Format object
            const entries = Object.entries(value)
              .map(([k, v]) => `${k}: ${this.stringifyValue(v)}`);
            return `${name}:\n${entries.map(entry => `  ${entry}`).join('\n')}`;
          }
        } else {
          // Format primitive
          return `${name}: ${this.stringifyValue(value)}`;
        }
    }
  }
  
  /**
   * Evaluate a condition on the JSON data
   * @param condition - Condition to evaluate
   * @returns True if condition is met
   * @private
   */
  private evaluateCondition(condition: JSONPathSchema['condition']): boolean {
    if (!condition) return true;
    
    const { path, operator, value } = condition;
    const dataValue = this.getValueAtPath(this.jsonData, path);
    
    switch (operator) {
      case 'exists':
        return dataValue !== undefined && dataValue !== null;
      
      case 'equals':
        return dataValue === value;
      
      case 'contains':
        if (typeof dataValue === 'string') {
          return dataValue.includes(String(value));
        } else if (Array.isArray(dataValue)) {
          return dataValue.includes(value);
        }
        return false;
      
      case 'gt':
        return typeof dataValue === 'number' && dataValue > Number(value);
      
      case 'lt':
        return typeof dataValue === 'number' && dataValue < Number(value);
      
      default:
        return false;
    }
  }
  
  /**
   * Format a template string with path placeholders
   * @param template - Template string
   * @returns Formatted string
   * @private
   */
  private formatTemplate(template: string): string {
    // Replace {path} placeholders with values
    return template.replace(/\{([^\}]+)\}/g, (match, path) => {
      const value = this.getValueAtPath(this.jsonData, path);
      return this.stringifyValue(value);
    });
  }
  
  /**
   * Convert a value to string representation
   * @param value - Value to stringify
   * @returns String representation
   * @private
   */
  private stringifyValue(value: any): string {
    if (value === undefined || value === null) {
      return '';
    }
    
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        // Format array
        const limitedArray = value.slice(0, this.jsonOptions.maxArrayItems);
        if (limitedArray.length < value.length) {
          return JSON.stringify(limitedArray) + ` (+ ${value.length - limitedArray.length} more items)`;
        }
        return JSON.stringify(limitedArray);
      } else {
        // Format object
        return JSON.stringify(value);
      }
    }
    
    return String(value);
  }
}
