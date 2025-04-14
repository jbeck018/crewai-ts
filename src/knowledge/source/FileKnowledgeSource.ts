/**
 * File Knowledge Source
 * Process local files as knowledge sources with optimized streaming
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { BaseKnowledgeSource, KnowledgeSourceOptions } from './BaseKnowledgeSource.js';
import { KnowledgeChunk, Metadata } from '../types.js';

/**
 * Options specific to file knowledge sources
 */
// Define a more specific type for the filePath property
type FilePathType = string;

export interface FileKnowledgeSourceOptions extends KnowledgeSourceOptions {
  /**
   * Path to the file(s) to load
   * Can be a single file path or array of file paths
   */
  filePath: string | string[];

  /**
   * File encoding to use
   * @default 'utf-8'
   */
  encoding?: BufferEncoding;

  /**
   * Automatically detect file type based on extension
   * and apply appropriate pre-processing
   * @default true
   */
  autoDetectType?: boolean;

  /**
   * Additional metadata to attach to all chunks
   */
  metadata?: Metadata;

  /**
   * Process recursively if directory is provided
   * @default false
   */
  recursive?: boolean;

  /**
   * File extensions to include (if directory is provided)
   * @default ['.txt', '.md', '.html', '.pdf', '.csv', '.json']
   */
  includedExtensions?: string[];

  /**
   * Maximum file size in bytes to process
   * @default 10485760 (10MB)
   */
  maxFileSize?: number;
}

/**
 * Knowledge source for processing file content
 * Optimized for memory efficiency with streaming and incremental processing
 */
export class FileKnowledgeSource extends BaseKnowledgeSource {
  /**
   * File paths to process
   * @private
   */
  private filePaths: string[];

  /**
   * Configured file options with defaults
   * @private
   */
  private fileOptions: {
    // Explicitly define all fields with their proper types
    filePath: string;
    encoding: BufferEncoding;
    autoDetectType: boolean;
    recursive: boolean;
    includedExtensions: string[];
    maxFileSize: number;
    metadata?: Metadata;
  };

  /**
   * Constructor for FileKnowledgeSource
   * @param options - Configuration options
   */
  constructor(options: FileKnowledgeSourceOptions) {
    // Use a default source string that properly identifies the knowledge source
    // Initialize with a default value for type safety
    let sourceId: string = 'file-source';
    
    if (typeof options.filePath === 'string') {
      // Directly assign string value
      sourceId = options.filePath;
    } else if (Array.isArray(options.filePath) && options.filePath.length > 0) {
      // Ensure we have a valid string from the array
      const firstPath = options.filePath[0];
      sourceId = firstPath || 'file-source';
    } else {
      // Default fallback for all other cases
      sourceId = 'multiple-files';
    }
    
    super(sourceId, {
      ...options,
      metadata: options.metadata || {}
    });

    // Convert single file path to array for consistent processing
    if (Array.isArray(options.filePath)) {
      this.filePaths = options.filePath.filter(Boolean); // Filter out any falsy values
    } else if (typeof options.filePath === 'string') {
      this.filePaths = [options.filePath];
    } else {
      // Default to empty array but throw error for invalid input
      this.filePaths = [];
      throw new Error('Invalid filePath: must be a string or array of strings');
    }
    
    // Ensure we always have at least an empty array
    if (!this.filePaths.length) {
      this.filePaths = [];
    }

    // Set default options with proper type safety
    // Create a definite non-undefined string value for filePath
    const defaultFilePath = this.filePaths.length > 0 ? this.filePaths[0] : 'empty-path';
    
    // Type assertion to ensure TypeScript knows this is a string
    this.fileOptions = {
      filePath: defaultFilePath as string, // Ensure we always have a valid string
      encoding: (options.encoding !== undefined) ? options.encoding : 'utf-8',
      autoDetectType: options.autoDetectType !== false,
      recursive: options.recursive || false,
      includedExtensions: Array.isArray(options.includedExtensions) ? options.includedExtensions : ['.txt', '.md', '.html', '.pdf', '.csv', '.json'],
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024 // 10MB default
    };
  }

  /**
   * Process and add all file content to storage
   * Implements streaming and chunking for memory efficiency
   * @override
   */
  override async add(): Promise<void> {
    if (!this._storage) {
      throw new Error('Storage not set for FileKnowledgeSource');
    }

    // Expand file paths if recursive option is enabled
    const expandedPaths = await this.expandFilePaths();
    if (expandedPaths.length === 0) {
      throw new Error('No valid files found');
    }

    // Process files with concurrency control
    const concurrentBatches: Promise<void>[] = [];
    const { maxConcurrency } = this.options;

    // Process files in batches based on concurrency limit
    for (let i = 0; i < expandedPaths.length; i += maxConcurrency) {
      const batch = expandedPaths.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(filePath => this.processFile(filePath));
      
      // Process each batch concurrently
      await Promise.all(batchPromises);
    }
  }

  /**
   * Create a knowledge chunk from file content with file-specific metadata
   * @param content - File content for the chunk
   * @param additionalMetadata - Additional metadata or file path
   * @returns Knowledge chunk object
   * @private
   */
  protected override createChunk(content: string, additionalMetadata?: Metadata | string): KnowledgeChunk {
    // Handle string parameter (filePath) for backward compatibility
    const filePath = typeof additionalMetadata === 'string' ? additionalMetadata : undefined;
    const metadataObj = typeof additionalMetadata === 'object' ? additionalMetadata : {};
    
    // Extract file information for metadata
    const source = filePath || this.source;
    const filename = path.basename(source);
    const extension = path.extname(source).toLowerCase();
    
    return {
      id: this.generateChunkId(content),
      content: content.trim(),
      source,
      metadata: {
        source,
        filename,
        extension,
        ...this.options.metadata,
        ...metadataObj
      }
    };
  }

  /**
   * Process a single file
   * Uses streaming for memory efficiency with large files
   * @param filePath - Path to the file
   * @private
   */
  private async processFile(filePath: string): Promise<void> {
    try {
      // Check file stats for size limits and validity
      const stats = await fs.stat(filePath);
      
      // Skip if too large
      if (stats.size > this.fileOptions.maxFileSize) {
        console.warn(`Skipping file exceeding size limit: ${filePath} (${stats.size} bytes)`);
        return;
      }

      // Skip if not a file
      if (!stats.isFile()) {
        console.warn(`Not a file: ${filePath}`);
        return;
      }

      // Process based on file type
      const extension = path.extname(filePath).toLowerCase();

      if (this.fileOptions.autoDetectType) {
        switch (extension) {
          case '.pdf':
            await this.processPdfFile(filePath);
            break;
          case '.html':
          case '.htm':
            await this.processHtmlFile(filePath);
            break;
          case '.csv':
            await this.processCsvFile(filePath);
            break;
          case '.json':
            await this.processJsonFile(filePath);
            break;
          default: 
            // Plain text processing for other types
            await this.processTextFile(filePath);
        }
      } else {
        // Default to plain text processing if auto-detection is disabled
        await this.processTextFile(filePath);
      }
      
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Expands file paths to include files from directories if recursive option is enabled
   * @returns Expanded list of file paths
   * @private
   */
  private async expandFilePaths(): Promise<string[]> {
    const expandedPaths: string[] = [];
    
    for (const filePath of this.filePaths) {
      try {
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          // Single file
          expandedPaths.push(filePath);
        } else if (stats.isDirectory() && this.fileOptions.recursive) {
          // Directory with recursive option
          const dirFiles = await this.getFilesFromDirectory(filePath);
          expandedPaths.push(...dirFiles);
        }
      } catch (error) {
        console.warn(`Error accessing path ${filePath}:`, error);
      }
    }
    
    return expandedPaths;
  }

  /**
   * Gets all files from a directory recursively
   * @param dirPath - Directory path
   * @returns List of file paths
   * @private
   */
  private async getFilesFromDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    // Read directory contents
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    // Process each entry
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && this.fileOptions.recursive) {
        // Recursively process subdirectories
        const subDirFiles = await this.getFilesFromDirectory(entryPath);
        files.push(...subDirFiles);
      } else if (entry.isFile()) {
        // Check file extension
        const extension = path.extname(entry.name).toLowerCase();
        if (this.fileOptions.includedExtensions.includes(extension)) {
          files.push(entryPath);
        }
      }
    }
    
    return files;
  }

  /**
   * Process a plain text file with streaming
   * @param filePath - Path to the text file
   * @private
   */
  private async processTextFile(filePath: string): Promise<void> {
    if (!this._storage) return;

    // Use streaming to avoid loading entire file in memory
    let content = '';
    const readStream = createReadStream(filePath, { 
      encoding: this.fileOptions.encoding,
      highWaterMark: this.options.bufferSize // Use optimized buffer size
    });

    // Process stream chunks
    for await (const chunk of readStream) {
      content += chunk;
      
      // Process in chunks to avoid memory pressure with large files
      if (content.length >= this.options.chunkSize * 2) {
        const textChunks = this.splitIntoChunks(content);
        
        // Keep potential partial chunk for next iteration
        const lastPartialChunk = textChunks.pop() || '';
        
        // Create and store complete chunks
        const knowledgeChunks = textChunks.map(text => 
          this.createChunk(text, filePath));
        
        await this._storage.addChunks(knowledgeChunks);
        
        // Reset with partial chunk
        content = lastPartialChunk;
      }
    }

    // Process any remaining content
    if (content.trim()) {
      const textChunks = this.splitIntoChunks(content);
      const knowledgeChunks = textChunks.map(text => 
        this.createChunk(text, filePath));
      
      await this._storage.addChunks(knowledgeChunks);
    }
  }

  /**
   * Process a PDF file
   * @param filePath - Path to the PDF file
   * @private
   */
  private async processPdfFile(filePath: string): Promise<void> {
    // For PDF files, we'd use a PDF parsing library
    // Since this is a placeholder, we'll just use basic text extraction
    // In a real implementation, use a library like pdf-parse or pdfjs
    
    console.warn('PDF processing requires additional libraries');
    // Fallback to text processing
    await this.processTextFile(filePath);
  }

  /**
   * Process an HTML file
   * @param filePath - Path to the HTML file
   * @private
   */
  private async processHtmlFile(filePath: string): Promise<void> {
    if (!this._storage) return;

    // Read HTML file
    const content = await fs.readFile(filePath, { encoding: this.fileOptions.encoding });
    
    // Extract text content (simplified version)
    // In a real implementation, use a library like jsdom or cheerio for better HTML parsing
    const textContent = this.extractTextFromHtml(content);
    
    // Process the extracted text
    const textChunks = this.splitIntoChunks(textContent);
    const knowledgeChunks = textChunks.map(text => 
      this.createChunk(text, filePath));
    
    await this._storage.addChunks(knowledgeChunks);
  }

  /**
   * Process a CSV file
   * @param filePath - Path to the CSV file
   * @private
   */
  private async processCsvFile(filePath: string): Promise<void> {
    if (!this._storage) return;

    // Read CSV file
    const content = await fs.readFile(filePath, { encoding: this.fileOptions.encoding });
    
    // Simple CSV parsing (just for demonstration)
    // In a real implementation, use a library like csv-parser for better CSV handling
    const lines = content.split('\n');
    const header = lines[0]?.split(',').map(h => h.trim()) || [];
    
    const chunks: KnowledgeChunk[] = [];
    
    // Process each line (row) as a separate chunk
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      
      // Create structured content
      const values = line.split(',').map(v => v.trim());
      let structuredContent = '';
      
      // Combine header and values
      for (let j = 0; j < header.length; j++) {
        if (j < values.length) {
          structuredContent += `${header[j]}: ${values[j]}\n`;
        }
      }
      
      chunks.push(this.createChunk(structuredContent, filePath));
    }
    
    await this._storage.addChunks(chunks);
  }

  /**
   * Process a JSON file
   * @param filePath - Path to the JSON file
   * @private
   */
  private async processJsonFile(filePath: string): Promise<void> {
    if (!this._storage) return;

    // Read JSON file
    const content = await fs.readFile(filePath, { encoding: this.fileOptions.encoding });
    
    try {
      // Parse JSON
      const jsonData = JSON.parse(content);
      
      // Process JSON data
      const chunks = this.processJsonData(jsonData, filePath);
      await this._storage.addChunks(chunks);
      
    } catch (error) {
      console.error(`Error parsing JSON file ${filePath}:`, error);
      // Fallback to text processing
      await this.processTextFile(filePath);
    }
  }

  /**
   * Process JSON data recursively
   * @param data - JSON data
   * @param filePath - Source file path
   * @param path - Current JSON path
   * @returns Array of knowledge chunks
   * @private
   */
  private processJsonData(data: any, filePath: string, path = ''): KnowledgeChunk[] {
    const chunks: KnowledgeChunk[] = [];
    
    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        // Process array items
        data.forEach((item, index) => {
          const itemPath = path ? `${path}[${index}]` : `[${index}]`;
          const itemChunks = this.processJsonData(item, filePath, itemPath);
          chunks.push(...itemChunks);
        });
      } else {
        // Process object properties
        for (const [key, value] of Object.entries(data)) {
          const propPath = path ? `${path}.${key}` : key;
          
          if (typeof value === 'object' && value !== null) {
            // Recursively process nested objects
            const nestedChunks = this.processJsonData(value, filePath, propPath);
            chunks.push(...nestedChunks);
          } else if (value !== undefined) {
            // Add leaf node values as chunks
            const content = `${propPath}: ${String(value)}`;
            chunks.push(this.createChunk(content, filePath));
          }
        }
      }
    } else if (data !== undefined) {
      // Handle primitive values
      const content = path ? `${path}: ${String(data)}` : String(data);
      chunks.push(this.createChunk(content, filePath));
    }
    
    return chunks;
  }

  /**
   * Extract text content from HTML
   * Simplified version for demonstration
   * @param htmlContent - HTML content
   * @returns Extracted text
   * @private
   */
  private extractTextFromHtml(htmlContent: string): string {
    // Remove HTML tags (simplified approach)
    let text = htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ');
    
    return text.trim();
  }
}
