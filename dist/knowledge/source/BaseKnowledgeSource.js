/**
 * Base Knowledge Source
 * Abstract class that all knowledge sources must extend
 */
/**
 * Abstract base class for all knowledge sources
 */
export class BaseKnowledgeSource {
    /**
     * Reference to the storage backend
     * @protected
     */
    _storage = null;
    /**
     * Configuration options with defaults
     * @protected
     */
    options;
    /**
     * Source identifier (e.g., file path, URL)
     * @protected
     */
    source;
    /**
     * Constructor for BaseKnowledgeSource
     * @param source - Source identifier
     * @param options - Configuration options
     */
    constructor(source, options = {}) {
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
    set storage(storage) {
        this._storage = storage;
    }
    /**
     * Create a knowledge chunk with proper metadata
     * @param content - Content text
     * @param metadata - Additional metadata
     * @returns Properly formatted knowledge chunk
     * @protected
     */
    createChunk(content, metadata = {}) {
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
    generateChunkId(content) {
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
    splitIntoChunks(text) {
        if (!text)
            return [];
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
    fixedChunking(text) {
        const chunks = [];
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
    recursiveChunking(text) {
        const { chunkSize, chunkOverlap } = this.options;
        const paragraphs = text.split(/\n\s*\n/);
        const chunks = [];
        let currentChunk = "";
        for (const paragraph of paragraphs) {
            const trimmedParagraph = paragraph.trim();
            if (!trimmedParagraph)
                continue;
            // If adding this paragraph exceeds the chunk size and we already have content
            if (currentChunk && (currentChunk.length + trimmedParagraph.length > chunkSize)) {
                // Store the current chunk and start a new one
                chunks.push(currentChunk);
                // Add overlap by keeping the last part of the previous chunk
                const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
                currentChunk = currentChunk.slice(overlapStart);
            }
            // Add paragraph to current chunk
            if (currentChunk)
                currentChunk += "\n\n";
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
    splitBySentences(text) {
        const { chunkSize, chunkOverlap } = this.options;
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        const chunks = [];
        let currentChunk = "";
        for (const sentence of sentences) {
            const trimmedSentence = sentence.trim();
            if (!trimmedSentence)
                continue;
            // If adding this sentence exceeds the chunk size and we already have content
            if (currentChunk && (currentChunk.length + trimmedSentence.length > chunkSize)) {
                chunks.push(currentChunk);
                // Add overlap
                const overlapStart = Math.max(0, currentChunk.length - chunkOverlap);
                currentChunk = currentChunk.slice(overlapStart);
            }
            // Add sentence to current chunk
            if (currentChunk && !currentChunk.endsWith(" "))
                currentChunk += " ";
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
    semanticChunking(text) {
        // Identify semantic boundaries (headings, section breaks)
        const headingPattern = /#{1,6}\s.+|\n[^\n]+\n[-=]+/g;
        // Split by headings or fallback to paragraphs
        let sections = text.split(headingPattern);
        const matches = text.match(headingPattern) || [];
        // Recombine headings with their content
        const semanticSections = [];
        for (let i = 0; i < sections.length; i++) {
            // Get heading with proper null safety - optimized for performance
            // Only access matches array if index is valid to avoid unnecessary null checks
            const heading = (i > 0 && i - 1 < matches.length) ? matches[i - 1] || "" : "";
            // Use optional chaining for potential undefined sections with fallback
            const content = sections[i]?.trim() || "";
            if (!content)
                continue; // Skip empty sections for better performance
            semanticSections.push(`${heading}\n\n${content}`);
        }
        // Further split if sections are too large
        const chunks = [];
        for (const section of semanticSections) {
            if (section.length <= this.options.chunkSize) {
                chunks.push(section);
            }
            else {
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
    hybridChunking(text) {
        // Split by paragraphs first
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
        const { chunkSize, chunkOverlap } = this.options;
        const chunks = [];
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
            }
            else {
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
//# sourceMappingURL=BaseKnowledgeSource.js.map