/**
 * Base Knowledge Source
 * Abstract class that all knowledge sources must extend
 */

import { KnowledgeChunk, Metadata } from '../types.js';
import { BaseKnowledgeStorage } from '../storage/BaseKnowledgeStorage.js';

/**
 * Options for knowledge source configuration
 */
export interface KnowledgeSourceOptions {
  /**
   * Custom chunking strategy
   * @default 'recursive'
   */
  chunkingStrategy?: 'recursive' | 'fixed' | 'semantic' | 'hybrid';

  /**
   * Size of chunks in characters or tokens
   * @default 512
   */
  chunkSize?: number;

  /**
   * Overlap between chunks in characters or tokens
   * @default 50
   */
  chunkOverlap?: number;

  /**
   * Additional metadata to add to all chunks
   */
  metadata?: Metadata;

  /**
   * Buffer size for stream processing (in bytes)
   * Optimized for efficient memory usage during processing
   * @default 65536 (64KB)
   */
  bufferSize?: number;

  /**
   * Maximum number of concurrent processing tasks
   * @default 4
   */
  maxConcurrency?: number;
}

/**
 * Abstract base class for all knowledge sources
 */
export abstract class BaseKnowledgeSource {
  /**
   * Reference to the storage backend
   * @protected
   */
  protected _storage: BaseKnowledgeStorage | null = null;

  /**
   * Configuration options with defaults
   * @protected
   */
  protected options: Required<KnowledgeSourceOptions>;

  /**
   * Source identifier (e.g., file path, URL)
   * @protected
   */
  protected source: string;

  /**
   * Constructor for BaseKnowledgeSource
   * @param source - Source identifier
   * @param options - Configuration options
   */
  constructor(source: string, options: KnowledgeSourceOptions = {}) {
    this.source = source;
    this.options = {
      chunkingStrategy: options.chunkingStrategy ?? 'recursive',
      chunkSize: options.chunkSize ?? 512,
      chunkOverlap: options.chunkOverlap ?? 50,
      metadata: options.metadata ?? {},
      bufferSize: options.bufferSize ?? 65536, // 64KB buffer for efficient streaming
      maxConcurrency: options.maxConcurrency ?? 4
    };
  }

  /**
   * Set the storage backend
   * @param storage - Knowledge storage instance
   */
  set storage(storage: BaseKnowledgeStorage) {
    this._storage = storage;
  }

  /**
   * Add this knowledge source to the storage backend
   * This method must be implemented by all derived classes
   */
  abstract add(): Promise<void>;

  /**
   * Create a knowledge chunk with proper metadata
   * @param content - Content text
   * @param metadata - Additional metadata
   * @returns Properly formatted knowledge chunk
   * @protected
   */
  protected createChunk(content: string, metadata: Metadata = {}): KnowledgeChunk {
    // Generate a deterministic ID from content for deduplication
    const id = this.generateChunkId(content);
    
    return {
      id,
      content,
      source: this.source,
      metadata: {
        ...this.options.metadata,
        ...metadata,
        source: this.source
      }
    };
  }

  /**
   * Generate a deterministic ID for a content chunk
   * Uses a fast hashing algorithm for efficiency
   * @param content - Content to hash
   * @returns Hash of the content
   * @protected
   */
  protected generateChunkId(content: string): string {
    // Simple but fast hashing algorithm
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${Math.abs(hash).toString(16)}-${Date.now().toString(36)}`;
  }

  /**
   * Split text into chunks based on the configured strategy
   * Implements optimized chunking algorithms for different use cases
   * @param text - Text to split into chunks
   * @returns Array of text chunks
   * @protected
   */
  protected splitIntoChunks(text: string): string[] {
    if (!text) return [];

    switch (this.options.chunkingStrategy) {
      case 'fixed':
        // Simple fixed-size chunking with overlap
        return this.fixedChunking(text);
      
      case 'semantic':
        // Semantic chunking that tries to keep related content together
        return this.semanticChunking(text);
      
      case 'hybrid':
        // Combines fixed-size with semantic boundary awareness
        return this.hybridChunking(text);
      
      case 'recursive':
      default:
        // Recursive chunking that splits by paragraphs, then sentences if needed
        return this.recursiveChunking(text);
    }
  }

  /**
   * Fixed-size chunking implementation
   * @param text - Text to chunk
   * @returns Array of chunks
   * @private
   */
  private fixedChunking(text: string): string[] {
    const chunks: string[] = [];
    const { chunkSize, chunkOverlap } = this.options;
    const step = chunkSize - chunkOverlap;
    
    for (let i = 0; i < text.length; i += step) {
      const chunk = text.slice(i, i + chunkSize);
      if (chunk.trim()) {
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }

  /**
   * Recursive chunking implementation
   * Splits by paragraphs first, then merges or splits further as needed
   * @param text - Text to chunk
   * @returns Array of chunks
   * @private
   */
  private recursiveChunking(text: string): string[] {
    const { chunkSize, chunkOverlap } = this.options;
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = "";
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;
      
      // If adding this paragraph exceeds the chunk size and we already have content
      if (currentChunk && (currentChunk.length + trimmedParagraph.length > chunkSize)) {
        // Store the current chunk and start a new one
        chunks.push(currentChunk);
        // Add overlap by keeping the last part of the previous chunk
        const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
        currentChunk = currentChunk.slice(overlapStart);
      }
      
      // Add paragraph to current chunk
      if (currentChunk) currentChunk += "\n\n";
      currentChunk += trimmedParagraph;
      
      // If a single paragraph exceeds chunk size, split it further
      if (currentChunk.length > chunkSize) {
        // Split further by sentences
        const sentenceChunks = this.splitBySentences(currentChunk);
        chunks.push(...sentenceChunks.slice(0, -1));
        currentChunk = sentenceChunks[sentenceChunks.length - 1] || "";
      }
    }
    
    // Add any remaining content
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  /**
   * Split text by sentences, respecting chunk size
   * @param text - Text to split
   * @returns Array of sentence-based chunks
   * @private
   */
  private splitBySentences(text: string): string[] {
    const { chunkSize, chunkOverlap } = this.options;
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = "";
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      // If adding this sentence exceeds the chunk size and we already have content
      if (currentChunk && (currentChunk.length + trimmedSentence.length > chunkSize)) {
        chunks.push(currentChunk);
        // Add overlap
        const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
        currentChunk = currentChunk.slice(overlapStart);
      }
      
      // Add sentence to current chunk
      if (currentChunk && !currentChunk.endsWith(" ")) currentChunk += " ";
      currentChunk += trimmedSentence;
    }
    
    // Add any remaining content
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  /**
   * Semantic chunking implementation
   * Uses semantic boundaries like headings and paragraphs
   * @param text - Text to chunk
   * @returns Array of chunks
   * @private
   */
  private semanticChunking(text: string): string[] {
    // Identify semantic boundaries (headings, section breaks)
    const headingPattern = /#{1,6}\s.+|\n[^\n]+\n[-=]+/g;
    
    // Split by headings or fallback to paragraphs
    let sections = text.split(headingPattern);
    const matches = text.match(headingPattern) || [];
    
    // Recombine headings with their content
    const semanticSections: string[] = [];
    for (let i = 0; i < sections.length; i++) {
      const heading = i > 0 ? matches[i - 1] : "";
      const content = sections[i].trim();
      if (!content) continue;
      
      semanticSections.push(`${heading}\n\n${content}`);
    }
    
    // Further split if sections are too large
    const chunks: string[] = [];
    for (const section of semanticSections) {
      if (section.length <= this.options.chunkSize) {
        chunks.push(section);
      } else {
        // Fall back to recursive chunking for large sections
        chunks.push(...this.recursiveChunking(section));
      }
    }
    
    return chunks;
  }

  /**
   * Hybrid chunking implementation
   * Combines fixed-size chunking with awareness of semantic boundaries
   * @param text - Text to chunk
   * @returns Array of chunks
   * @private
   */
  private hybridChunking(text: string): string[] {
    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    const { chunkSize, chunkOverlap } = this.options;
    const chunks: string[] = [];
    let currentChunk = "";
    let currentLength = 0;
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      const paragraphLength = trimmedParagraph.length;
      
      // Check if adding this paragraph would exceed chunk size
      if (currentLength + paragraphLength > chunkSize && currentLength > 0) {
        // Store current chunk and start a new one
        chunks.push(currentChunk);
        currentChunk = "";
        currentLength = 0;
      }
      
      // Add separator if needed
      if (currentLength > 0) {
        currentChunk += "\n\n";
        currentLength += 2;
      }
      
      // Handle paragraphs that are too large on their own
      if (paragraphLength > chunkSize) {
        // If current chunk has content, store it first
        if (currentLength > 0) {
          chunks.push(currentChunk);
          currentChunk = "";
          currentLength = 0;
        }
        
        // Split large paragraph using fixed chunking
        const subChunks = this.fixedChunking(trimmedParagraph);
        // Add all but the last sub-chunk
        chunks.push(...subChunks.slice(0, -1));
        // Keep the last sub-chunk for the next iteration
        currentChunk = subChunks[subChunks.length - 1] || "";
        currentLength = currentChunk.length;
      } else {
        // Add normal-sized paragraph
        currentChunk += trimmedParagraph;
        currentLength += paragraphLength;
      }
    }
    
    // Add any remaining content
    if (currentLength > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
}
