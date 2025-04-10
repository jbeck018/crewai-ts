---
layout: default
nav_order: 1
title: Home
---

# CrewAI TypeScript Documentation

Welcome to the official documentation for CrewAI TypeScript, the TypeScript implementation of [CrewAI](https://github.com/joaomdmoura/crewAI). This documentation provides comprehensive information about using CrewAI in TypeScript projects, with a focus on memory optimization and performance.

## Memory-Optimized Design

The CrewAI TypeScript implementation features numerous optimization techniques not available in the Python version:

- **Memory-Efficient Data Structures**: Using Float32Array for embeddings reduces memory by 50%
- **Lazy Loading**: Resources are initialized only when needed to minimize initial footprint
- **LRU Caching**: Efficient caching mechanisms to reduce duplicate operations
- **Tiered Memory Architecture**: Hot/warm/cold storage patterns for different access patterns
- **Smart Batching**: Optimal request handling for better performance
- **Incremental Processing**: Process data in chunks for minimal memory footprint

## Documentation Sections

### [Getting Started](getting-started.html)

Quickly get up and running with CrewAI TypeScript, including installation, basic configuration, and your first agent project.

### [Core Concepts](concepts/)

- [Flows](concepts/flows.html) - Learn about the powerful Flow system for creating AI workflows
- [Memory Systems](concepts/memory-systems.html) - Comprehensive guide to the memory system components and optimizations
- [Memory Optimizations](memory-optimizations.html) - Detailed guide on memory system optimizations
- [Flow Performance Guide](concepts/flow-performance-guide.html) - Advanced techniques for optimizing Flow performance
- [Knowledge System](concepts/knowledge-system.html) - Optimized knowledge retrieval and integration
- [LLM Integrations](concepts/llm-integrations.html) - TypeScript-specific optimizations for LLM interactions

### [Examples & Tutorials](examples/)

- [Agent Examples](examples/agents-examples.html) - Practical examples for creating memory-efficient agents
- [Crew Examples](examples/crews-examples.html) - Building optimized crews with best practices
- [Flow Examples](examples/flows-examples.html) - Memory-efficient flow implementations with various optimizations

### [API Reference](reference/)

- [API Reference](reference/api-reference.html) - Comprehensive documentation of core classes and interfaces
- [CLI Documentation](reference/cli.html) - Guide to the memory-optimized CLI commands for CrewAI TypeScript

### [Support & Troubleshooting](support/)

Troubleshooting guides, performance best practices, and answers to frequently asked questions.

## Contributing

Contributions to improve this documentation are welcome! Please submit a pull request or open an issue on the [GitHub repository](https://github.com/joaomdmoura/crewai-ts).
