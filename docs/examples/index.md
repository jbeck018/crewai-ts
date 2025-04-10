---
layout: default
title: Examples & Tutorials
nav_order: 3
has_children: true
---

# Examples & Tutorials

This section provides practical, memory-optimized examples and tutorials for working with the CrewAI TypeScript implementation. Each example is designed to showcase best practices for performance and resource efficiency.

## Available Examples

### Agent Examples

[Agent Examples](agents-examples.html) - Practical examples for creating memory-efficient agents, including:

- Basic agent creation with memory optimizations
- Advanced agent configuration for optimal performance
- Lazy-loaded LLM clients to reduce initial memory footprint
- Custom memory configuration for specialized use cases
- Using the LiteAgent for lower memory usage

### Crew Examples

[Crew Examples](crews-examples.html) - Building optimized crews with best practices, including:

- Memory-efficient crew configuration
- YAML/JSON configuration approaches with caching
- Optimized process selection for different use cases
- Callbacks for proper resource management
- CrewFactory pattern for efficient instantiation

### Flow Examples

[Flow Examples](flows-examples.html) - Memory-efficient flow implementations with various optimizations, including:

- Basic flow creation with optimized state management
- Knowledge integration with Float32Array embeddings
- Crew integration with tiered memory architecture
- Event-driven memory management for efficient resource usage
- Specialized embeddings configurations for different use cases

## Performance Optimization Patterns

These examples demonstrate several key optimization patterns that you can apply to your own CrewAI TypeScript applications:

1. **Memory-Efficient Data Structures**: Using specialized arrays and optimized objects
2. **Resource Lifecycle Management**: Proper initialization and cleanup
3. **Caching Strategies**: LRU caching and response deduplication
4. **Lazy Loading Patterns**: On-demand resource initialization
5. **Batching and Chunking**: Processing data in optimal sizes
6. **Compression Techniques**: Minimizing memory footprint for stored data
7. **Event-Driven Architecture**: Minimizing overhead with reactive patterns

By studying and applying these patterns, you can create CrewAI applications that perform well even with limited resources.
