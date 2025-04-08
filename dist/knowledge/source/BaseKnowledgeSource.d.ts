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
export declare abstract class BaseKnowledgeSource {
    /**
     * Reference to the storage backend
     * @protected
     */
    protected _storage: BaseKnowledgeStorage | null;
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
    constructor(source: string, options?: KnowledgeSourceOptions);
    /**
     * Set the storage backend
     * @param storage - Knowledge storage instance
     */
    set storage(storage: BaseKnowledgeStorage);
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
    protected createChunk(content: string, metadata?: Metadata): KnowledgeChunk;
    /**
     * Generate a deterministic ID for a content chunk
     * Uses a fast hashing algorithm for efficiency
     * @param content - Content to hash
     * @returns Hash of the content
     * @protected
     */
    protected generateChunkId(content: string): string;
    /**
     * Split text into chunks based on the configured strategy
     * Implements optimized chunking algorithms for different use cases
     * @param text - Text to split into chunks
     * @returns Array of text chunks
     * @protected
     */
    protected splitIntoChunks(text: string): string[];
    /**
     * Fixed-size chunking implementation
     * @param text - Text to chunk
     * @returns Array of chunks
     * @private
     */
    private fixedChunking;
    /**
     * Recursive chunking implementation
     * Splits by paragraphs first, then merges or splits further as needed
     * @param text - Text to chunk
     * @returns Array of chunks
     * @private
     */
    private recursiveChunking;
    /**
     * Split text by sentences, respecting chunk size
     * @param text - Text to split
     * @returns Array of sentence-based chunks
     * @private
     */
    private splitBySentences;
    /**
     * Semantic chunking implementation
     * Uses semantic boundaries like headings and paragraphs
     * @param text - Text to chunk
     * @returns Array of chunks
     * @private
     */
    private semanticChunking;
    /**
     * Hybrid chunking implementation
     * Combines fixed-size chunking with awareness of semantic boundaries
     * @param text - Text to chunk
     * @returns Array of chunks
     * @private
     */
    private hybridChunking;
}
//# sourceMappingURL=BaseKnowledgeSource.d.ts.map