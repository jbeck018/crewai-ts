---
layout: default
title: API Reference
nav_order: 4
has_children: true
---

# API Reference

This section provides comprehensive reference documentation for the CrewAI TypeScript implementation, with detailed information on classes, interfaces, methods, and optimization options.

## Available Reference Documentation

### API Reference

[API Reference](api-reference.html) - Comprehensive documentation of core classes and interfaces, including:

- Agent, Crew, Task, and Flow classes with all available options
- Memory system interfaces and implementation details
- Knowledge system components and embedding options
- LLM client interfaces and optimization parameters
- Utility types and functions for memory efficiency

### CLI Reference

[CLI Documentation](cli.html) - Guide to the memory-optimized CLI commands for CrewAI TypeScript, including:

- Command overview and usage examples
- Performance optimization flags
- Memory configuration options
- Batch processing capabilities
- Resource monitoring tools

## Memory Optimization Reference

When working with the CrewAI TypeScript API, these key optimization configurations are available throughout the system:

```typescript
// Memory optimization options available in most components
interface MemoryOptimizationOptions {
  // Enable shared memory to reduce duplication across agents
  useSharedMemory?: boolean;
  
  // Enable compression for stored data
  enableCompression?: boolean;
  
  // Set maximum memory size to prevent unbounded growth
  maxMemoryItems?: number;
  
  // Use tiered storage for different access patterns
  useTieredStorage?: boolean;
  
  // Enable content deduplication
  deduplicateContent?: boolean;
  
  // Configure expiration for short-term memory items
  shortTermExpirationMs?: number;
  
  // Enable automatic garbage collection
  enableGarbageCollection?: boolean;
}
```

By configuring these options appropriately for your specific use case, you can significantly reduce memory usage and improve performance in your CrewAI TypeScript applications.
