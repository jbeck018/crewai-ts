/**
 * String Knowledge Source
 * Process text strings as knowledge sources with optimized chunking
 */
import { BaseKnowledgeSource, KnowledgeSourceOptions } from './BaseKnowledgeSource.js';
import { KnowledgeChunk, Metadata } from '../types.js';
/**
 * Options specific to string knowledge sources
 */
export interface StringKnowledgeSourceOptions extends KnowledgeSourceOptions {
    /**
     * The string content to process
     */
    content: string;
    /**
     * Metadata to attach to all chunks from this source
     */
    metadata?: Metadata;
}
/**
 * Knowledge source for processing string content
 * Optimized for memory efficiency and processing performance
 */
export declare class StringKnowledgeSource extends BaseKnowledgeSource {
    /**
     * The string content to process
     * @private
     */
    private content;
    /**
     * Constructor for StringKnowledgeSource
     * @param options - Configuration options
     */
    constructor(options: StringKnowledgeSourceOptions);
    /**
     * Process and add the string content to storage
     * Implements chunking with configurable strategy for optimization
     * @override
     */
    add(): Promise<void>;
    /**
     * Create a knowledge chunk from text content
     * @param content - Text content for the chunk
     * @returns Knowledge chunk object
     * @private
     */
    protected createChunk(content: string): KnowledgeChunk;
    /**
     * Generate a deterministic ID for a chunk based on its content
     * @param content - Chunk content
     * @returns Unique ID string
     * @private
     */
    protected generateChunkId(content: string): string;
    /**
     * Chunk content based on the configured strategy
     * Implements optimized chunking algorithms
     * @param content - Content to chunk
     * @returns Array of text chunks
     * @private
     */
    protected splitIntoChunks(text: string): string[];
    /**
     * Custom chunking implementation with optimizations for string sources
     * @param content - Content to chunk
     * @returns Array of text chunks
     * @private
     */
    private chunkContent;
    /**
     * Fixed-size chunking with overlap
     * Most memory-efficient for very large documents
     * @param content - Content to chunk
     * @param chunkSize - Size of chunks
     * @param overlap - Overlap between chunks
     * @returns Array of chunks
     * @private
     */
    private fixedSizeChunking;
    /**
     * Recursive chunking that respects sentence boundaries
     * Good balance between semantic meaning and memory usage
     * @param content - Content to chunk
     * @param chunkSize - Maximum chunk size
     * @param overlap - Minimum overlap
     * @returns Array of chunks
     * @private
     */
    /**
     * Recursive chunking implementation - optimized version
     * @param text - Text to chunk
     * @returns Array of chunks
     * @private
     */
    private recursiveChunkingOptimized;
    /**
     * Semantic chunking that respects paragraph boundaries
     * Most semantic coherence but potentially less even chunks
     * @param content - Content to chunk
     * @param chunkSize - Maximum chunk size
     * @param overlap - Minimum overlap
     * @returns Array of chunks
     * @private
     */
    /**
     * Semantic chunking implementation - optimized version
     * @param text - Text to chunk
     * @returns Array of chunks
     * @private
     */
    private semanticChunkingOptimized;
    /**
     * Hybrid chunking combining semantic and fixed-size approaches
     * Best balance between semantic coherence and even chunk sizes
     * @param content - Content to chunk
     * @param chunkSize - Maximum chunk size
     * @param overlap - Minimum overlap
     * @returns Array of chunks
     * @private
     */
    /**
     * Hybrid chunking implementation - optimized version
     * @param text - Text to chunk
     * @returns Array of chunks
     * @private
     */
    private hybridChunkingOptimized;
}
//# sourceMappingURL=StringKnowledgeSource.d.ts.map