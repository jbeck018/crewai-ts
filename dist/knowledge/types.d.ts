/**
 * Knowledge Management System Type Definitions
 * Provides type-safe interfaces for knowledge storage and retrieval
 */
/**
 * Generic metadata type for knowledge chunks
 */
export type Metadata = Record<string, any>;
/**
 * Represents an individual knowledge chunk with associated metadata
 */
export interface KnowledgeChunk {
    /**
     * Unique identifier for the chunk
     */
    id: string;
    /**
     * The actual content/text of the knowledge chunk
     */
    content: string;
    /**
     * Vector embedding of the content for similarity search
     * Using Float32Array for optimized vector operations
     */
    embedding?: Float32Array | number[];
    /**
     * Source information (e.g., filename, URL)
     */
    source: string;
    /**
     * Additional metadata for filtering and organization
     */
    metadata: Metadata;
}
/**
 * Search result with relevance score
 */
export interface KnowledgeSearchResult {
    /**
     * Unique identifier for the chunk
     */
    id: string;
    /**
     * The content/text of the knowledge chunk
     */
    context: string;
    /**
     * Metadata associated with the chunk
     */
    metadata: Metadata;
    /**
     * Similarity score (0-1, higher is more similar)
     */
    score: number;
}
/**
 * Configuration options for the embedder
 */
export interface EmbedderConfig {
    /**
     * Model name to use for embeddings
     * @default 'all-MiniLM-L6-v2'
     */
    model?: string;
    /**
     * Dimension of embeddings
     * @default 384
     */
    dimensions?: number;
    /**
     * Whether to normalize embeddings
     * @default true
     */
    normalize?: boolean;
    /**
     * Custom embedding function provider
     */
    provider?: 'openai' | 'cohere' | 'huggingface' | 'fastembed' | 'custom';
    /**
     * Custom embedding function
     */
    embeddingFunction?: (text: string) => Promise<number[]>;
}
/**
 * Search filter options
 */
export interface KnowledgeFilter {
    /**
     * Filter by metadata fields
     */
    [key: string]: any;
}
/**
 * Options for knowledge storage
 */
export interface KnowledgeStorageOptions {
    /**
     * Name of the collection
     * @default 'knowledge'
     */
    collectionName?: string;
    /**
     * Embedding configuration
     */
    embedder?: EmbedderConfig;
    /**
     * Path to persistent storage
     */
    persistPath?: string;
    /**
     * Whether to use memory-mapped storage for large collections
     * This improves performance for large knowledge bases
     * @default false
     */
    useMemoryMappedStorage?: boolean;
    /**
     * Maximum cache size in bytes
     * @default 100MB
     */
    maxCacheSize?: number;
    /**
     * Cache TTL in milliseconds
     * @default 1 hour
     */
    cacheTTL?: number;
}
//# sourceMappingURL=types.d.ts.map