---
layout: default
title: Support & Troubleshooting
nav_order: 5
has_children: true
---

# Support & Troubleshooting

This section provides support resources, troubleshooting guidance, and best practices for working with the CrewAI TypeScript implementation, with a focus on optimizing memory usage and performance.

## Troubleshooting Guide

Common issues and solutions for the TypeScript implementation of CrewAI:

### Memory Usage Issues

**Problem**: High memory consumption when working with large knowledge bases

**Solution**: 
- Enable `useFloat32Array: true` in embedding configurations to reduce memory by 50%
- Use chunking with appropriate `chunkSize` and `chunkOverlap` settings
- Enable compression with `enableCompression: true`
- Set appropriate `maxMemoryItems` limits

**Problem**: Memory leaks during long-running agents or crews

**Solution**:
- Implement proper cleanup with `resetMemory()` after task completion
- Use `progressiveCleanup: true` option during crew execution
- Set appropriate expiration with `shortTermExpirationMs` option
- Enable garbage collection with `enableGarbageCollection: true`

### Performance Issues

**Problem**: Slow startup times for agents with LLM operations

**Solution**:
- Use lazy loading with `createLazyLLM()` and `initializeOnFirstCall: true`
- Implement caching with `cacheResponses: true` and `cacheTokenCounts: true`
- Use `useTokenPredictor: true` to avoid tokenization overhead

**Problem**: High API usage with multiple agents

**Solution**:
- Configure `maxRPM` limits to prevent throttling
- Use shared memory with `useSharedMemory: true`
- Implement proper retry logic with exponential backoff
- Configure `concurrencyLimit` to manage parallel requests

## Best Practices

### Memory Optimization Best Practices

1. **Use Float32Array for Embeddings**: All embedders support `useFloat32Array: true` for 50% memory reduction
2. **Enable Caching**: Set `cache: true` on agents, tools, and LLM clients
3. **Configure Memory Options**: Implement memory optimizations like compression and shared memory
4. **Use Async Patterns Correctly**: Ensure proper async/await usage throughout codebase
5. **Implement Lazy Loading**: Initialize expensive resources only when needed
6. **Add Type Annotations**: Use proper type annotations for better performance and safety
7. **Configure Token Management**: Set appropriate token limits for optimal resource usage
8. **Use Streaming APIs**: Enable streaming for large responses where appropriate
9. **Implement Proper Error Handling**: Add TypeScript-specific error handling and retry logic
10. **Monitor Resource Usage**: Add telemetry to track memory and performance

### Production Deployment Tips

1. **Memory Monitoring**: Implement monitoring for Node.js memory usage and set alerts
2. **Load Testing**: Test with realistic workloads to identify memory optimization needs
3. **Tiered Architecture**: Consider separating memory-intensive operations to different services
4. **Resource Limits**: Set appropriate container memory limits in production environments
5. **Scaling Strategy**: Plan horizontal scaling based on memory profile, not just CPU usage

## Frequently Asked Questions

**Q: How much memory should I allocate for a typical CrewAI TypeScript application?**

A: Memory requirements vary based on your specific use case, but as a starting point:
- Small applications (1-3 agents, basic tasks): 512MB-1GB
- Medium applications (5-10 agents, knowledge retrieval): 2-4GB
- Large applications (10+ agents, extensive knowledge): 4-8GB or more

Enable memory optimizations like `useFloat32Array`, `enableCompression`, and `useSharedMemory` to significantly reduce these requirements.

**Q: What's the performance difference between the Python and TypeScript implementations?**

A: The TypeScript implementation includes several optimizations not available in Python:
- Memory-efficient data structures (Float32Array for embeddings)
- Lazy loading for expensive resources
- More efficient token handling and caching
- Tiered memory architecture
- Optimized garbage collection

These optimizations can result in 30-50% less memory usage and improved performance, especially for long-running applications.

**Q: Can I use local LLMs with the TypeScript implementation?**

A: Yes, the TypeScript implementation includes optimized support for local LLMs through the `OllamaLLM` integration, with additional performance options like:
- `useQuantization: true` for lower memory footprint
- `useMlock: true` to lock model in memory for faster inference
- `numGpu` and `numThread` settings for resource control
