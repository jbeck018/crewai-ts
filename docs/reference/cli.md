---
layout: default
---

# CrewAI CLI Documentation for TypeScript

The CrewAI TypeScript CLI provides a set of commands to interact with CrewAI-TS, allowing you to run, train, test crews, and manage memories efficiently.

## Installation

To use the CrewAI TypeScript CLI, make sure you have CrewAI-TS installed:

```bash
npm install crewai-ts
```

## Basic Usage

The basic structure of a CrewAI-TS CLI command is:

```bash
npx crewai-ts [COMMAND] [OPTIONS] [ARGUMENTS]
```

## Performance Optimizations

The TypeScript implementation of the CLI includes several memory and performance optimizations:

- **Lazy Loading**: Commands are loaded dynamically to minimize initial memory footprint
- **Memory-Efficient Data Structures**: All CLI commands use optimized data structures to minimize memory usage
- **Streaming Support**: Commands that produce large outputs support streaming to reduce memory pressure
- **Incremental Loading**: Memory storage adapters use incremental loading patterns to handle large datasets efficiently
- **Specialized Optimizations**: Each command implements specific memory optimizations for its particular use case

## Available Commands

### 1. Run Crew

Run a crew with optimized memory management and execution tracking.

```bash
npx crewai-ts run-crew [OPTIONS]
```

Optimizations:
- Uses lazy loading for crew components
- Implements memory-efficient task execution tracking
- Optimizes token usage with predictive batching

### 2. Train Crew

Train the crew for a specified number of iterations with performance tracking.

```bash
npx crewai-ts train-crew [OPTIONS]
```

Options:
- `-n, --iterations <number>`: Number of iterations to train the crew (default: 5)
- `-f, --filename <path>`: Path to a custom file for training data

Optimizations:
- Uses incremental performance tracking with minimal memory overhead
- Implements specialized metric collection with optimized data structures
- Employs memory-efficient agent training with proper garbage collection

### 3. Replay Task

Replay the crew execution from a specific task with optimized memory handling.

```bash
npx crewai-ts replay-task [OPTIONS]
```

Options:
- `-t, --task-id <id>`: Replay the crew from this task ID, including all subsequent tasks

Optimizations:
- Implements memory-efficient task restoration
- Uses optimized context handling to minimize memory usage
- Employs lazy loading of dependent tasks

### 4. Log Tasks Outputs

Retrieve your latest crew task outputs with memory-efficient loading.

```bash
npx crewai-ts log-tasks-outputs
```

Optimizations:
- Implements incremental loading of task outputs
- Uses streaming output to handle large result sets
- Employs compressed storage format for reduced memory footprint

### 5. Reset Memories

Reset various types of memory storages with optimized management.

```bash
npx crewai-ts reset-memories [OPTIONS]
```

Options:
- `-l, --long`: Reset LONG TERM memory
- `-s, --short`: Reset SHORT TERM memory
- `-e, --entities`: Reset ENTITIES memory
- `-k, --kickoff-outputs`: Reset LATEST KICKOFF TASK OUTPUTS
- `-a, --all`: Reset ALL memories

Optimizations:
- Implements targeted memory clearing to minimize system impact
- Uses efficient file system operations for storage cleanup
- Employs proper reference management for garbage collection

### 6. Test Crew

Test the crew and evaluate performance with detailed metrics collection.

```bash
npx crewai-ts test-crew [OPTIONS]
```

Options:
- `-n, --iterations <number>`: Number of iterations to test the crew (default: 3)
- `-m, --model <model>`: LLM Model to run the tests on the Crew

Optimizations:
- Uses specialized metrics collection with minimal memory overhead
- Implements efficient test case execution with proper resource cleanup
- Employs optimized reporting with memory-efficient data structures

### 7. Chat

Start an interactive conversation with the crew, optimized for memory efficiency and streaming responses.

```bash
npx crewai-ts chat
```

Optimizations:
- Uses streaming response handling to minimize memory usage
- Implements efficient context management with LRU caching
- Employs optimized token handling for reduced memory footprint
- Utilizes incremental history management to handle long conversations

### 8. Create Flow

Create a new flow with memory-efficient template handling.

```bash
npx crewai-ts create-flow [NAME]
```

Optimizations:
- Uses efficient template generation with minimal memory allocation
- Implements optimized file system operations for flow creation

### 9. Plot Flow

Visualize a flow with memory-efficient rendering and HTML template handling.

```bash
npx crewai-ts plot-flow
```

Optimizations:
- Uses optimized DOM processing for visualization generation
- Implements efficient CSS variable handling for reduced memory footprint
- Employs lazy loading of visualization components

### 10. Run Flow

Run a flow with optimized state management and memory efficiency.

```bash
npx crewai-ts run-flow
```

Optimizations:
- Uses incremental state updates to minimize memory usage
- Implements efficient event handling with proper resource management
- Employs optimized execution tracking with minimal overhead

## Implementation Notes

All CLI commands in the TypeScript version have been implemented with a focus on memory efficiency and performance optimization. Key techniques used include:

1. **Lazy Loading**: Commands and dependencies are loaded on-demand to minimize initial memory footprint
2. **Efficient Data Structures**: Using specialized data structures for different memory requirements
3. **Streaming Support**: Implementing streaming for large outputs to manage memory pressure
4. **Resource Management**: Proper cleanup of resources to prevent memory leaks
5. **Incremental Processing**: Processing data in chunks to avoid loading everything into memory

These optimizations ensure that the CrewAI-TS CLI is both memory-efficient and performant, even when handling complex crews and large datasets.
