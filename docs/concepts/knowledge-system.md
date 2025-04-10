---
layout: default
title: Knowledge System
nav_order: 4
has_children: true
---

# Knowledge System

The CrewAI TypeScript implementation features a high-performance knowledge system designed for memory efficiency and scalability. This documentation covers the key components of the knowledge system and how to optimize its usage.

## Overview

The knowledge system enables agents to leverage external information sources during their reasoning process. It includes:

1. **Knowledge Sources** - Different ways to provide information to agents
2. **Embeddings** - Memory-efficient vector representations of text
3. **Retrieval** - Fast, optimized similarity search
4. **Integration** - Seamless incorporation into agent workflows

## Knowledge Sources

The TypeScript implementation provides several optimized knowledge source implementations:

### StringKnowledgeSource

Stores and chunks text strings directly in memory with optimized storage patterns:

```typescript
import { StringKnowledgeSource } from 'crewai-ts/knowledge';

// Create a basic string knowledge source
const basicKnowledgeSource = new StringKnowledgeSource({
  content: 'This is some important information that agents should know about.',
  metadata: { topic: 'general', importance: 'high' }
});

// Create an optimized string knowledge source with chunking options
const optimizedKnowledgeSource = new StringKnowledgeSource({
  content: 'This is a longer piece of content that will be automatically chunked...',
  metadata: { source: 'documentation', topic: 'knowledge system' },
  // Memory optimization options
  useOptimizedChunking: true, // Enables smart chunking algorithms
  chunkSize: 250,            // Smaller chunks for more precise retrieval
  chunkOverlap: 50,          // Overlap to preserve context between chunks
  preserveNewlines: false    // Disable to reduce storage size
});
```

### FileKnowledgeSource

Reads and processes content from files with memory-efficient streaming:

```typescript
import { FileKnowledgeSource } from 'crewai-ts/knowledge';

// Create a basic file knowledge source
const basicFileSource = new FileKnowledgeSource({
  filePath: './data/important_document.txt',
  metadata: { source: 'file', topic: 'research' }
});

// Create a memory-optimized file knowledge source
const optimizedFileSource = new FileKnowledgeSource({
  filePath: './data/large_dataset.pdf',
  metadata: { source: 'file', topic: 'large dataset' },
  // Performance optimization options
  useStreaming: true,         // Read file in chunks to minimize memory usage
  cacheChunks: true,          // Store chunks in memory after first read
  compressionLevel: 'medium',  // Compress chunks to reduce memory footprint
  // PDF-specific options (for PDF files)
  pdfOptions: {
    pagesPerChunk: 1,          // Process one page at a time
    extractImages: false,      // Skip image extraction to save memory
    ocrEnabled: false          // Disable OCR to improve performance
  }
});
```

### URLKnowledgeSource

Retrieves and processes content from web URLs with memory-efficient approaches:

```typescript
import { URLKnowledgeSource } from 'crewai-ts/knowledge';

// Create a basic URL knowledge source
const basicUrlSource = new URLKnowledgeSource({
  url: 'https://example.com/article',
  metadata: { source: 'web', topic: 'article' }
});

// Create an optimized URL knowledge source
const optimizedUrlSource = new URLKnowledgeSource({
  url: 'https://example.com/large-documentation',
  metadata: { source: 'web', topic: 'documentation' },
  // Memory efficiency options
  useStreaming: true,             // Stream response to reduce memory usage
  stripHtml: true,                // Remove HTML to reduce storage size
  skipImages: true,               // Skip image content
  cacheExpiration: 3600,          // Cache for 1 hour to reduce duplicate requests
  maxSize: 1024 * 1024,           // Limit maximum size to 1MB
  timeout: 10000,                 // 10-second timeout for better reliability
  retryOptions: {                 // Optimize retry behavior
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true
  }
});
```

## Embeddings

The TypeScript implementation provides several memory-optimized embedding providers:

### OpenAI Embeddings

```typescript
import { OpenAIEmbeddings } from 'crewai-ts/embeddings';

// Create basic OpenAI embeddings
const basicEmbeddings = new OpenAIEmbeddings();

// Create optimized OpenAI embeddings
const optimizedEmbeddings = new OpenAIEmbeddings({
  // Memory efficiency options
  cache: true,                 // Cache embeddings to avoid duplicate calls
  useFloat32Array: true,       // More memory-efficient than Float64Array
  dimensions: 1536,            // Explicitly set dimensions to optimize memory allocation
  model: 'text-embedding-3-small', // More efficient model
  batchSize: 20,               // Optimal batch size for performance
  // Performance optimization
  concurrentRequests: 3,       // Limit concurrent requests
  retryOptions: {              // Optimize retry behavior
    maxRetries: 3,
    retryDelay: 1000
  }
});
```

### Cohere Embeddings

```typescript
import { CohereEmbeddings } from 'crewai-ts/embeddings';

// Create optimized Cohere embeddings
const cohereEmbeddings = new CohereEmbeddings({
  // Memory efficiency options
  cache: true,
  useFloat32Array: true,
  model: 'embed-english-light-v2.0', // Lighter model for efficiency
  batchSize: 15,
  // Performance optimization
  concurrentRequests: 2
});
```

### HuggingFace Embeddings

```typescript
import { HuggingFaceEmbeddings } from 'crewai-ts/embeddings';

// Create HuggingFace embeddings with API
const huggingFaceApiEmbeddings = new HuggingFaceEmbeddings({
  // Use API for embeddings
  useLocal: false,
  modelName: 'sentence-transformers/all-MiniLM-L6-v2',
  cache: true,
  useFloat32Array: true
});

// Create HuggingFace embeddings with local models (more memory-efficient for production)
const huggingFaceLocalEmbeddings = new HuggingFaceEmbeddings({
  // Use local models for embeddings
  useLocal: true,
  modelPath: './models/all-MiniLM-L6-v2',
  cache: true,
  useFloat32Array: true,
  // Local optimizations
  useQuantization: true,     // Reduce memory footprint with quantized models
  maxConcurrency: 2          // Limit concurrent processes
});
```

### FastEmbeddings

```typescript
import { FastEmbeddings } from 'crewai-ts/embeddings';

// Create FastEmbeddings for high-performance, memory-efficient embeddings
const fastEmbeddings = new FastEmbeddings({
  cache: true,
  useFloat32Array: true,
  dimensions: 384,          // Smaller, more efficient embeddings
  normalizeVectors: true,   // Normalize vectors for better performance
  batchSize: 50             // FastEmbed supports larger batch sizes efficiently
});
```

### CustomEmbedder Wrapper

```typescript
import { CustomEmbedder } from 'crewai-ts/embeddings';

// Create a wrapper around any custom embedding function
const customEmbeddings = new CustomEmbedder({
  // Provide custom embedding functions
  embedTextFunction: async (text: string) => {
    // Your custom embedding logic here
    return new Float32Array(384); // Return as typed array for memory efficiency
  },
  embedDocumentsFunction: async (docs: string[]) => {
    // Batch embedding logic here
    return docs.map(() => new Float32Array(384));
  },
  // Optional configuration
  dimensions: 384,
  cache: true
});
```

## Performing Knowledge Retrieval

The following examples demonstrate memory-efficient knowledge retrieval:

### Basic Knowledge Search

```typescript
import { OpenAIEmbeddings } from 'crewai-ts/embeddings';
import { StringKnowledgeSource } from 'crewai-ts/knowledge';

async function performKnowledgeSearch() {
  // Create knowledge sources
  const source1 = new StringKnowledgeSource({
    content: 'Tokyo is the capital of Japan and the world\'s most populous metropolitan area.',
    metadata: { topic: 'geography', region: 'asia' }
  });
  
  const source2 = new StringKnowledgeSource({
    content: 'Paris is the capital of France, known for the Eiffel Tower and Louvre Museum.',
    metadata: { topic: 'geography', region: 'europe' }
  });
  
  // Create embeddings with memory optimizations
  const embeddings = new OpenAIEmbeddings({
    cache: true,
    useFloat32Array: true
  });
  
  // Perform memory-efficient search
  const results = await embeddings.search({
    query: 'Tell me about Tokyo',
    sources: [source1, source2],
    limit: 3,                      // Limit results to reduce memory usage
    filter: { topic: 'geography' } // Use metadata filtering for more targeted results
  });
  
  // Process results
  return results.map(result => ({
    content: result.content,
    score: result.score,
    source: result.source.id
  }));
}
```

### Advanced Multi-Source Search

```typescript
import { OpenAIEmbeddings } from 'crewai-ts/embeddings';
import { StringKnowledgeSource, FileKnowledgeSource, URLKnowledgeSource } from 'crewai-ts/knowledge';

async function performAdvancedSearch() {
  // Create diverse knowledge sources with memory optimizations
  const textSource = new StringKnowledgeSource({
    content: 'Important information about AI advancements...',
    metadata: { topic: 'ai', type: 'text' },
    useOptimizedChunking: true
  });
  
  const fileSource = new FileKnowledgeSource({
    filePath: './data/research_paper.pdf',
    metadata: { topic: 'ai', type: 'paper' },
    useStreaming: true
  });
  
  const webSource = new URLKnowledgeSource({
    url: 'https://example.com/ai-article',
    metadata: { topic: 'ai', type: 'web' },
    useStreaming: true,
    stripHtml: true
  });
  
  // Create memory-efficient embeddings
  const embeddings = new OpenAIEmbeddings({
    cache: true,
    useFloat32Array: true,
    batchSize: 20
  });
  
  // Search across all sources with memory efficiency
  const results = await embeddings.search({
    query: 'Latest transformer architecture improvements',
    sources: [textSource, fileSource, webSource],
    limit: 5,
    // Advanced filtering
    filter: {
      topic: 'ai',
      // Multiple types allowed
      type: ['text', 'paper', 'web']
    },
    // Memory-efficient scoring
    minScore: 0.75, // Only return high-confidence matches
    // Optimize result handling
    includeMetadata: true,
    // Memory-efficient result format
    useCompactFormat: true
  });
  
  return results;
}
```

## Knowledge Integration with Agents

This example demonstrates how to integrate knowledge sources with agents:

```typescript
import { Agent, Tool } from 'crewai-ts';
import { OpenAIEmbeddings } from 'crewai-ts/embeddings';
import { FileKnowledgeSource } from 'crewai-ts/knowledge';

async function createAgentWithKnowledge() {
  // Create knowledge source with memory optimizations
  const knowledgeSource = new FileKnowledgeSource({
    filePath: './data/company_data.pdf',
    metadata: { type: 'company_info' },
    useStreaming: true
  });
  
  // Create memory-efficient embeddings
  const embeddings = new OpenAIEmbeddings({
    cache: true,
    useFloat32Array: true
  });
  
  // Create a knowledge retrieval tool
  const knowledgeSearchTool = {
    name: 'search_company_data',
    description: 'Search company information to answer questions',
    execute: async ({ query }: { query: string }) => {
      // Perform memory-efficient search
      const results = await embeddings.search({
        query,
        sources: [knowledgeSource],
        limit: 3
      });
      
      // Return formatted results
      return results
        .map(r => `[Score: ${r.score.toFixed(2)}] ${r.content}`)
        .join('\n\n');
    }
  };
  
  // Create an agent with the knowledge tool
  const agent = new Agent({
    role: 'Company Data Specialist',
    goal: 'Provide accurate information about the company',
    tools: [knowledgeSearchTool],
    // Memory optimizations
    verbose: false,
    memory: true,
    cache: true
  });
  
  return agent;
}
```

## Performance Best Practices

For optimal knowledge system performance and memory efficiency:

1. **Use Float32Array**: All embedders support `useFloat32Array: true` for 50% memory reduction
2. **Enable Caching**: Set `cache: true` to avoid redundant embedding operations
3. **Optimize Batch Sizes**: Find the right balance with the `batchSize` parameter
4. **Use Streaming**: Enable `useStreaming: true` for file and URL sources
5. **Filter Results**: Use metadata filtering to reduce processing overhead
6. **Limit Result Count**: Set appropriate `limit` values to reduce memory usage
7. **Choose Smaller Models**: Select more efficient embedding models when possible
8. **Implement Retry Logic**: Configure proper retry behavior for resilience
9. **Use Quantization**: Enable `useQuantization: true` for local models
10. **Monitor Vector Usage**: Track embedding operations to identify optimization opportunities

By following these practices, you can create highly efficient knowledge retrieval systems that minimize memory usage while maximizing performance.
