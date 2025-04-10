---
layout: default
title: CLI Documentation
parent: API Reference
nav_order: 2
---

# CrewAI CLI Documentation for TypeScript

The CrewAI TypeScript CLI provides a set of commands to interact with CrewAI-TS, allowing you to create, run, analyze, and visualize AI workflows with memory-optimized execution.

## Installation

To use the CrewAI TypeScript CLI, make sure you have CrewAI-TS installed:

```bash
bun add crewai-ts
```

## Basic Usage

The basic structure of a CrewAI-TS CLI command is:

```bash
bun crewai-ts [COMMAND] [OPTIONS] [ARGUMENTS]
```

Alternatively, you can use the CLI via npx or directly after installing globally:

```bash
# Using npx
npx crewai-ts [COMMAND]

# If installed globally
crewai-ts [COMMAND]
```

However, for best memory performance, we recommend using Bun.

## Performance Optimizations

The TypeScript implementation of the CLI includes several memory and performance optimizations:

- **Lazy Loading**: Commands are loaded dynamically to minimize initial memory footprint
- **Memory-Efficient Data Structures**: All CLI commands use optimized data structures to minimize memory usage
- **Streaming Support**: Commands that produce large outputs support streaming to reduce memory pressure
- **Incremental Loading**: Memory storage adapters use incremental loading patterns to handle large datasets efficiently
- **Specialized Optimizations**: Each command implements specific memory optimizations for its particular use case

## Available Commands

### 1. Create Flow

Creates a new Flow file structure with all the necessary components, including memory-optimized configurations.

```bash
bun crewai-ts create-flow [FLOW_NAME] [OPTIONS]
```

**Options:**
- `--path, -p <path>`: Directory to create the flow in (default: current directory)
- `--memory, -m <memory-type>`: Memory implementation to use (default: 'efficient')
- `--embedder, -e <embedder>`: Embedder configuration to use (default: 'float32')

**Memory Optimizations:**
- Uses templates with pre-configured memory optimization settings
- Creates Flow files with Float32Array for embeddings by default
- Includes configuration for tiered memory storage
- Sets up proper token management in generated code

### 2. Run Flow

Runs a Flow with memory-optimized execution settings.

```bash
bun crewai-ts run-flow [FLOW_PATH] [OPTIONS]
```

**Options:**
- `--memory <value>`: Memory limit in MB for the execution (default: 512)
- `--verbose, -v`: Enable verbose logging for debugging
- `--metrics, -m`: Collect and display memory usage metrics

**Memory Optimizations:**
- Uses lazy loading for Flow components
- Implements memory-efficient execution tracking
- Enables Float32Array optimizations automatically
- Pools similar embeddings to reduce redundancy
- Implements stream processing for large outputs

### 3. Plot Flow

Generates a visual representation of a Flow with memory usage analysis.

```bash
bun crewai-ts plot-flow [FLOW_PATH] [OPTIONS]
```

**Options:**
- `--output, -o <path>`: Path to save the visualization (default: './flow-diagram.html')
- `--analyze, -a`: Include memory usage analysis in the visualization

**Memory Optimizations:**
- Uses incremental processing for large Flow structures
- Implements efficient rendering algorithms
- Highlights memory hotspots in the visualization

### 4. Create Agent

Creates a new Agent with memory-optimized settings.

```bash
bun crewai-ts create-agent [AGENT_NAME] [OPTIONS]
```

**Options:**
- `--model, -m <model-name>`: LLM model to use (default: 'gpt-4o-mini')
- `--memory-type <type>`: Memory type to use (default: 'tiered')
- `--tools, -t <tools>`: Comma-separated list of tools to include

**Memory Optimizations:**
- Creates agents with optimized context window management
- Sets up lazy-loaded tool initialization
- Configures caching for repeated agent operations

### 5. List Commands

Lists all available commands with their memory optimization settings.

```bash
bun crewai-ts help
```

## Advanced Memory Optimization Options

CrewAI TypeScript CLI includes several advanced memory optimization flags that can be used with any command:

### Global Memory Flags

```bash
bun crewai-ts [command] --memory-options=<json-string>
```

The `--memory-options` flag accepts a JSON string with the following configurations:

```json
{
  "useFloat32Array": true,         // Use Float32Array for 50% memory reduction
  "enableCompression": true,       // Enable vector compression
  "sharedMemory": true,            // Use shared memory pool
  "gcInterval": 5000,              // Garbage collection interval in ms
  "progressiveCleanup": true,      // Enable progressive memory cleanup
  "maxMemoryUsageMB": 512          // Maximum memory usage in MB
}
```

### Examples of Memory-Optimized Commands

```bash
# Run a flow with optimized memory settings
bun crewai-ts run-flow ./flows/research-flow.ts --memory-options='{"useFloat32Array":true,"enableCompression":true}'

# Create a memory-efficient agent
bun crewai-ts create-agent ResearchAgent --memory-type=tiered --memory-options='{"sharedMemory":true}'

# Plot flow with memory analysis
bun crewai-ts plot-flow ./flows/complex-flow.ts --analyze --memory-options='{"maxMemoryUsageMB":256}'
```

## Monitoring Memory Usage

The CLI includes built-in memory monitoring capabilities:

```bash
bun crewai-ts monitor-memory [COMMAND] [ARGS...]
```

This wrapper command will execute any other CrewAI command while tracking memory usage and reporting statistics at the end of execution.





## Additional Memory Management Commands

### Reset Memories

Reset various types of memory storages with optimized management.

```bash
bun crewai-ts reset-memories [OPTIONS]
```

**Options:**
- `--long, -l`: Reset long-term memory storage
- `--short, -s`: Reset short-term memory cache
- `--embeddings, -e`: Reset embedding vectors storage
- `--all, -a`: Reset all memory systems

**Memory Optimizations:**
- Uses targeted memory clearing to minimize system impact
- Implements incremental deletion for large vector stores
- Properly handles reference management for garbage collection

### Interactive Agent Chat

Start an interactive conversation with an agent or crew, with memory-efficient streaming responses.

```bash
bun crewai-ts chat [OPTIONS]
```

**Options:**
- `--agent <name>`: Specify agent configuration file to chat with
- `--memory <type>`: Memory type to use (default: 'efficient')
- `--model <name>`: LLM model to use (default: 'gpt-4o-mini')

**Memory Optimizations:**
- Uses streaming response processing to minimize memory usage
- Implements efficient chat history management with LRU caching
- Employs incremental token handling for lengthy conversations

## Performance Monitoring Commands

### Memory Usage Analysis

Analyze memory usage patterns in flows and agents to identify optimization opportunities.

```bash
bun crewai-ts analyze-memory [FLOW_PATH] [OPTIONS]
```

**Options:**
- `--detailed, -d`: Show detailed breakdown of memory usage by component
- `--format <type>`: Output format (options: 'table', 'json', 'chart')
- `--threshold <MB>`: Only show components using more than this threshold

**Features:**
- Creates visual memory usage heat maps for flows
- Identifies memory-intensive operations
- Recommends specific optimization techniques


## Memory System Implementation Details

The CLI commands leverage the comprehensive memory system implementations that include:

### Float32Array Optimizations

All embeddings operations use `Float32Array` rather than standard JavaScript arrays, reducing memory footprint by approximately 50%. This is particularly important for operations involving large knowledge bases and embedding vectors.

### LRU Caching

The CLI implements LRU (Least Recently Used) caching throughout all memory operations to minimize redundant calculations and API calls, significantly reducing both memory usage and execution time.

### Memory-Efficient Embedders

The CLI integrates with various embedders with memory-optimized implementations:

- **OpenAI Embedder**: Efficiently batches requests and manages token limits
- **Cohere Embedder**: Implements retry logic with exponential backoff
- **HuggingFace Embedder**: Supports both API and local optimization options
- **FastEmbed**: Provides extremely memory-efficient local embeddings
- **Custom Embedder Wrapper**: Allows for specialized memory optimizations

These implementations ensure the CrewAI TypeScript CLI delivers the best possible performance while maintaining minimal memory footprint.

## Implementation Notes

All CLI commands in the TypeScript version have been implemented with a focus on memory efficiency and performance optimization. Key techniques used include:

1. **Lazy Loading**: Commands and dependencies are loaded on-demand to minimize initial memory footprint
2. **Efficient Data Structures**: Using specialized data structures for different memory requirements
3. **Streaming Support**: Implementing streaming for large outputs to manage memory pressure
4. **Resource Management**: Proper cleanup of resources to prevent memory leaks
5. **Incremental Processing**: Processing data in chunks to avoid loading everything into memory

These optimizations ensure that the CrewAI-TS CLI is both memory-efficient and performant, even when handling complex crews and large datasets.
