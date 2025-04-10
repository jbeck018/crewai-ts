---
layout: default
---

# Memory Systems in CrewAI TypeScript

The CrewAI TypeScript framework features a sophisticated memory system designed to enhance agent capabilities while maintaining optimal performance. This document outlines the various memory components and the optimizations implemented specifically for the TypeScript version.

## Memory System Components

| Component | Description | Optimizations |
| :-------- | :---------- | :------------ |
| **Short-Term Memory** | Temporarily stores recent interactions and context for the current session | Implements LRU eviction policies, time-based expiration, and specialized data structures for minimal memory footprint |
| **Long-Term Memory** | Preserves insights and learnings from past executions | Utilizes incremental loading patterns, tiered hot/warm/cold storage, and efficient serialization for reduced memory usage |
| **Entity Memory** | Captures and organizes information about entities encountered during tasks | Uses optimized indexing with memory-efficient data structures and implements deduplication for shared entity attributes |
| **Contextual Memory** | Maintains interaction context by combining other memory types | Implements lazy loading of component memories and uses specialized context managers to reduce memory pressure |
| **Kickoff Task Outputs Storage** | Stores outputs from crew kickoff tasks for replay and analysis | Employs compression techniques, incremental loading, and optimized file I/O for minimal memory impact |

## Memory Optimizations in TypeScript

### 1. Data Structure Optimizations

- **Specialized Data Structures**: Using memory-efficient data structures tailored to each memory type
- **Weak References**: Implementing weak references for large memory items to allow garbage collection
- **LRU Caching**: Employing Least Recently Used eviction policies to maintain optimal memory size
- **Map and Set Usage**: Leveraging TypeScript's Map and Set structures for efficient lookups and storage

### 2. Loading Pattern Optimizations

- **Lazy Loading**: Initializing memory components only when needed
- **Incremental Loading**: Processing large datasets in chunks to avoid loading everything into memory
- **Tiered Access Patterns**: Implementing hot/warm/cold storage tiers for efficient access based on usage frequency

### 3. Storage Optimizations

- **Efficient Serialization**: Using optimized serialization formats for reduced file sizes
- **Content Deduplication**: Implementing content hashing and reference sharing to avoid storing duplicates
- **Compression**: Applying compression for stored memory items exceeding size thresholds
- **Streaming I/O**: Using streams for reading and writing to avoid loading entire files into memory

### 4. Access Pattern Optimizations

- **Predictive Loading**: Preloading likely-needed memory items based on context
- **Batched Operations**: Combining multiple memory operations into batches for reduced overhead
- **Indexed Retrieval**: Using optimized indexing for faster lookups with minimal memory impact
- **Query Optimization**: Implementing specialized query patterns for different memory access scenarios

## Memory Manager Service

The TypeScript implementation includes a centralized `MemoryManager` service that coordinates operations across different memory types. This manager implements several key optimizations:

1. **Centralized Configuration**: Single point for memory configuration to ensure consistent settings
2. **Resource Sharing**: Shared resources across memory types to reduce duplication
3. **Coordinated Garbage Collection**: Intelligent cleanup of unused memory references
4. **Memory Usage Monitoring**: Tracking memory consumption to avoid excessive resource usage
5. **Performance Metrics**: Collecting metrics on memory operations for optimization opportunities

## Memory Storage Implementations

The TypeScript version implements the following memory storage adapters, each with specific optimizations:

### KickoffTaskOutputsStorage

Optimized for storing and retrieving task outputs with:
- Efficient indexing for quick task lookup
- Compression for large output texts
- Incremental loading for handling large sets of outputs

### LongTermMemoryStorage

Designed for persistent memory across sessions with:
- Content deduplication using cryptographic hashing
- Tiered storage with hot cache for frequently accessed items
- Efficient file I/O with minimal serialization overhead

### ShortTermMemoryStorage

Implemented for temporary, session-bound memory with:
- Time-based and size-based eviction policies
- Optimized in-memory representations for quick access
- Efficient garbage collection integration

### EntityMemoryStorage

Specialized for tracking and managing entities with:
- Attribute-based indexing for efficient lookups
- Relationship tracking with minimal reference overhead
- Memory-efficient storage of entity properties

## Usage Examples

### Basic Memory Usage

```typescript
import { MemoryManager, MemoryType } from 'crewai-ts';

// Get the memory manager instance - lazy loaded for memory efficiency
const memoryManager = MemoryManager.getInstance();

// Store information in short-term memory
await memoryManager.store(MemoryType.SHORT_TERM, {
  content: 'Important information',
  metadata: { category: 'example' }
});

// Retrieve information using RAG
const results = await memoryManager.retrieve(MemoryType.SHORT_TERM, {
  query: 'information',
  limit: 5
});
```

### Using Entity Memory

```typescript
import { MemoryManager, MemoryType } from 'crewai-ts';

const memoryManager = MemoryManager.getInstance();

// Store entity information
await memoryManager.storeEntity({
  name: 'John Doe',
  type: 'person',
  attributes: {
    role: 'Developer',
    expertise: ['TypeScript', 'AI']
  }
});

// Retrieve entities by type
const people = await memoryManager.retrieveEntities({
  type: 'person'
});
```

## Performance Considerations

When working with the memory system in CrewAI TypeScript, consider these performance tips:

1. **Use Appropriate Memory Types**: Choose the right memory type for your use case to optimize for either speed or persistence
2. **Batch Operations**: Combine multiple memory operations into batches when possible
3. **Implement Memory Cleanup**: Explicitly reset unused memories to free resources
4. **Size Limitations**: Set appropriate size limits for your memory components based on your application's requirements
5. **Monitor Memory Usage**: Keep track of memory consumption, especially for long-running applications

## Conclusion

The memory system in CrewAI TypeScript has been carefully optimized for performance while maintaining the full functionality of the Python implementation. These optimizations ensure that your crews can efficiently leverage the power of memory while minimizing resource consumption.
