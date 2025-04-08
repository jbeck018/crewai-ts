/**
 * String Knowledge Source
 * Process text strings as knowledge sources with optimized chunking
 */
import { BaseKnowledgeSource } from './BaseKnowledgeSource.js';
/**
 * Knowledge source for processing string content
 * Optimized for memory efficiency and processing performance
 */
export class StringKnowledgeSource extends BaseKnowledgeSource {
    /**
     * The string content to process
     * @private
     */
    content;
    /**
     * Constructor for StringKnowledgeSource
     * @param options - Configuration options
     */
    constructor(options) {
        super('string', {
            ...options,
            metadata: options.metadata || {}
        });
        this.content = options.content || '';
    }
    /**
     * Process and add the string content to storage
     * Implements chunking with configurable strategy for optimization
     * @override
     */
    async add() {
        if (!this._storage) {
            throw new Error('Storage not set for StringKnowledgeSource');
        }
        // Skip processing if content is empty
        if (!this.content.trim()) {
            return;
        }
        // Process the content based on the chunking strategy
        const chunks = [];
        // For short content, skip chunking for better performance
        if (this.content.length <= this.options.chunkSize) {
            chunks.push(this.createChunk(this.content));
        }
        else {
            // Apply chunking strategy for longer content
            const textChunks = this.chunkContent(this.content);
            // Create knowledge chunks with optimized batch allocation
            chunks.push(...textChunks.map(text => this.createChunk(text)));
        }
        // Batch add chunks to storage for better performance
        await this._storage.addChunks(chunks);
    }
    /**
     * Create a knowledge chunk from text content
     * @param content - Text content for the chunk
     * @returns Knowledge chunk object
     * @private
     */
    createChunk(content) {
        return {
            id: this.generateChunkId(content),
            content: content.trim(),
            source: 'string',
            metadata: {
                source: 'string',
                ...this.options.metadata
            }
        };
    }
    /**
     * Generate a deterministic ID for a chunk based on its content
     * @param content - Chunk content
     * @returns Unique ID string
     * @private
     */
    generateChunkId(content) {
        // Simple but fast hashing algorithm
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `str_${Math.abs(hash).toString(16)}`;
    }
    /**
     * Chunk content based on the configured strategy
     * Implements optimized chunking algorithms
     * @param content - Content to chunk
     * @returns Array of text chunks
     * @private
     */
    splitIntoChunks(text) {
        // Use our specialized chunkContent method for better performance
        return this.chunkContent(text);
    }
    /**
     * Custom chunking implementation with optimizations for string sources
     * @param content - Content to chunk
     * @returns Array of text chunks
     * @private
     */
    chunkContent(content) {
        const chunks = [];
        const { chunkSize, chunkOverlap, chunkingStrategy } = this.options;
        // Different chunking strategies optimized for different use cases
        switch (chunkingStrategy) {
            case 'fixed':
                // Fixed-size chunking with overlap
                return this.fixedSizeChunking(content, chunkSize, chunkOverlap);
            case 'recursive':
                // Recursive chunking that respects sentence boundaries
                return this.recursiveChunkingOptimized(content);
            case 'semantic':
                // Semantic chunking that respects paragraph boundaries
                return this.semanticChunkingOptimized(content);
            case 'hybrid':
                // Hybrid approach combining semantic and fixed-size
                return this.hybridChunkingOptimized(content);
            default:
                // Default to recursive chunking as a balanced approach
                return this.recursiveChunkingOptimized(content);
        }
    }
    /**
     * Fixed-size chunking with overlap
     * Most memory-efficient for very large documents
     * @param content - Content to chunk
     * @param chunkSize - Size of chunks
     * @param overlap - Overlap between chunks
     * @returns Array of chunks
     * @private
     */
    fixedSizeChunking(content, chunkSize, overlap) {
        const chunks = [];
        const stride = chunkSize - overlap;
        // Use efficient stride-based processing
        for (let i = 0; i < content.length; i += stride) {
            const chunk = content.substring(i, i + chunkSize);
            if (chunk.trim().length > 0) {
                chunks.push(chunk);
            }
        }
        return chunks;
    }
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
    recursiveChunkingOptimized(text) {
        const { chunkSize, chunkOverlap: overlap } = this.options;
        const content = text;
        // Split by paragraphs first for better semantic coherence
        const paragraphs = content.split(/\n\s*\n/);
        const chunks = [];
        let currentChunk = '';
        for (const paragraph of paragraphs) {
            // If paragraph is too long, break it into sentences
            if (paragraph.length > chunkSize) {
                // Add any existing chunk content
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }
                // Break down by sentences using regex optimized for performance
                const sentences = paragraph.split(/(?<=[.!?])\s+/);
                for (const sentence of sentences) {
                    // For very long sentences, use fixed-size chunking
                    if (sentence.length > chunkSize) {
                        chunks.push(...this.fixedSizeChunking(sentence, chunkSize, overlap));
                        continue;
                    }
                    // Add sentence to current chunk if it fits
                    if ((currentChunk + ' ' + sentence).length <= chunkSize) {
                        currentChunk = currentChunk
                            ? `${currentChunk} ${sentence}`
                            : sentence;
                    }
                    else {
                        // Store current chunk and start a new one
                        if (currentChunk)
                            chunks.push(currentChunk);
                        currentChunk = sentence;
                    }
                }
            }
            else {
                // For regular paragraphs, check if they fit in the current chunk
                if ((currentChunk + '\n\n' + paragraph).length <= chunkSize) {
                    currentChunk = currentChunk
                        ? `${currentChunk}\n\n${paragraph}`
                        : paragraph;
                }
                else {
                    // Store current chunk and start a new one with the paragraph
                    if (currentChunk)
                        chunks.push(currentChunk);
                    currentChunk = paragraph;
                }
            }
        }
        // Add the last chunk if not empty
        if (currentChunk)
            chunks.push(currentChunk);
        return chunks;
    }
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
    semanticChunkingOptimized(text) {
        const { chunkSize, chunkOverlap: overlap } = this.options;
        const content = text;
        // Split by semantic elements like paragraphs, headings, and lists
        const semanticBlocks = content.split(/\n\s*\n|(?<=^#+\s.*$)\n|(?<=^[\*\-\+]\s.*$)\n/m);
        const chunks = [];
        let currentChunk = '';
        for (const block of semanticBlocks) {
            // Skip empty blocks
            if (!block.trim())
                continue;
            // If block fits, add to current chunk
            if ((currentChunk + '\n\n' + block).length <= chunkSize) {
                currentChunk = currentChunk
                    ? `${currentChunk}\n\n${block}`
                    : block;
            }
            else {
                // If block doesn't fit but is too large, recursively chunk it
                if (block.length > chunkSize) {
                    // Store current chunk if not empty
                    if (currentChunk) {
                        chunks.push(currentChunk);
                        currentChunk = '';
                    }
                    // Recursively process large blocks
                    chunks.push(...this.recursiveChunkingOptimized(block));
                }
                else {
                    // Store current chunk and start new one with this block
                    if (currentChunk)
                        chunks.push(currentChunk);
                    currentChunk = block;
                }
            }
        }
        // Add the last chunk if not empty
        if (currentChunk)
            chunks.push(currentChunk);
        return chunks;
    }
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
    hybridChunkingOptimized(text) {
        const { chunkSize, chunkOverlap: overlap } = this.options;
        const content = text;
        // First pass: split by semantic boundaries
        const semanticChunks = this.semanticChunkingOptimized(content);
        const chunks = [];
        // Second pass: apply fixed size chunking to any oversized semantic chunks
        for (const chunk of semanticChunks) {
            if (chunk.length <= chunkSize) {
                chunks.push(chunk);
            }
            else {
                // Apply fixed-size chunking with larger overlap for better coherence
                chunks.push(...this.fixedSizeChunking(chunk, chunkSize, Math.floor(overlap * 1.5)));
            }
        }
        return chunks;
    }
}
//# sourceMappingURL=StringKnowledgeSource.js.map