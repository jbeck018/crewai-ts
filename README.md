# CrewAI TypeScript

A modern TypeScript port of [crewAI](https://github.com/joaomdmoura/crewAI), optimized for ESM and modern Node.js environments.

## Features

- 🚀 **Pure ESM**: Built as an ESM-first package for modern JavaScript environments
- 🧰 **TypeScript**: Full type safety with well-defined interfaces
- ⚡ **Bun-ready**: Optimized for performance with Bun
- 🧩 **Modular Architecture**: Import only what you need
- 🔄 **API Compatibility**: Familiar API for crewAI users
- 🧠 **Knowledge Management**: Efficient vector storage with similarity search
- 💾 **Flexible Storage**: In-memory by default with optional persistent storage

## Installation

```bash
bun add crewai-ts
```

## Basic Usage

```typescript
import { Agent, Crew, Task } from 'crewai-ts';

// Create agents
const researcher = new Agent({
  role: 'Researcher',
  goal: 'Research and provide accurate information',
  backstory: 'You are an expert researcher with vast knowledge'
});

const writer = new Agent({
  role: 'Writer',
  goal: 'Create engaging content based on research',
  backstory: 'You are a skilled writer who can explain complex topics'
});

// Create tasks
const researchTask = new Task({
  description: 'Research the latest advancements in AI',
  agent: researcher
});

const writeTask = new Task({
  description: 'Write an article about AI advancements',
  agent: writer
});

// Create a crew
const crew = new Crew({
  agents: [researcher, writer],
  tasks: [researchTask, writeTask],
  process: 'sequential'
});

// Execute the crew workflow
const result = await crew.kickoff();
console.log(result);
```

## Knowledge Management

CrewAI-TS includes a powerful knowledge management system that enables agents to work with external information sources.

### Using Knowledge Storage

The Knowledge Storage system allows you to store, retrieve, and search through knowledge chunks based on semantic similarity.

```typescript
import { Knowledge, KnowledgeStorage } from 'crewai-ts';

// Initialize storage
const storage = new KnowledgeStorage({
  // Optional: custom collection name
  collectionName: 'my-knowledge',
  
  // Optional: embedding configuration
  embedder: {
    model: 'all-MiniLM-L6-v2',  // Default embedder model
    dimensions: 384,            // Embedding dimensions
    normalize: true             // Whether to normalize vectors
  }
});

// Add knowledge chunks
await storage.addChunks([
  {
    content: 'TypeScript is a strongly typed programming language that builds on JavaScript.',
    metadata: { source: 'docs', category: 'programming' }
  },
  {
    content: 'JavaScript is a high-level, interpreted programming language.',
    metadata: { source: 'docs', category: 'programming' }
  }
]);

// Search for relevant information
const results = await storage.search(
  ['TypeScript programming'], // queries
  5,                          // limit
  { category: 'programming' } // optional filter
);

console.log(results);
// Will return matched chunks sorted by similarity
```

### Storage Backends

**Important**: ChromaDB or persistent storage is NOT required to use the project. The default implementation uses an efficient in-memory storage that works without any external dependencies.

#### In-Memory Storage (Default)

By default, KnowledgeStorage uses an in-memory implementation that:

- Works out of the box with no configuration
- Offers fast performance for small to medium datasets
- Doesn't persist between application restarts
- Optimized for vector operations with modern JavaScript engines

#### Options for Persistent Storage

If you need persistent storage, you have several options:

1. **Local File Storage**: Save/load the knowledge data manually:

```typescript
import { KnowledgeStorage } from 'crewai-ts';
import fs from 'fs/promises';

// Save knowledge to file
async function saveKnowledge(storage) {
  const chunks = await storage.getAllChunks();
  await fs.writeFile('knowledge.json', JSON.stringify(chunks), 'utf8');
}

// Load knowledge from file
async function loadKnowledge(storage) {
  try {
    const data = await fs.readFile('knowledge.json', 'utf8');
    const chunks = JSON.parse(data);
    await storage.addChunks(chunks);
  } catch (error) {
    console.error('Failed to load knowledge:', error);
  }
}
```

2. **ChromaDB Integration**: While not required, you can integrate with ChromaDB for production:
   - Install a ChromaDB JS client
   - Extend the KnowledgeStorage class to use ChromaDB for persistence

## Knowledge with Agents

Combine knowledge management with agents for more powerful workflows:

```typescript
import { Agent, Crew, Task, Knowledge } from 'crewai-ts';

// Create knowledge source
const knowledge = new Knowledge();
await knowledge.addTexts([
  'TypeScript adds static typing to JavaScript.',
  'JavaScript is a dynamic language used for web development.'
]);

// Create an agent with knowledge
const researcher = new Agent({
  role: 'Technical Researcher',
  goal: 'Provide accurate technical information',
  backstory: 'You are a technical expert',
  knowledge: knowledge  // Attach knowledge to the agent
});

// Agent can now use knowledge in its responses
const researchTask = new Task({
  description: 'Explain the difference between TypeScript and JavaScript',
  agent: researcher
});

const crew = new Crew({
  agents: [researcher],
  tasks: [researchTask]
});

const result = await crew.kickoff();
console.log(result);
```

## Flow System

CrewAI-TS includes a powerful Flow system that allows you to create complex, event-driven workflows with optimal performance. The Flow system is designed for extensibility, type safety, and efficient execution.

### Basic Flow Usage

```typescript
import { Flow, FlowState } from 'crewai-ts/flow';
import { start, listen, router } from 'crewai-ts/flow/decorators';
import { CONTINUE, STOP } from 'crewai-ts/flow/types';

// Create a custom state for your flow
class MyFlowState extends FlowState {
  data: any = {};
  results: string[] = [];
}

// Define your flow with decorated methods
class DataProcessingFlow extends Flow<MyFlowState> {
  constructor() {
    super({ initialState: new MyFlowState() });
  }
  
  @start()
  async fetchData() {
    this.state.data = await fetchSomeExternalData();
    return CONTINUE;
  }
  
  @listen('fetchData')
  async processData() {
    // Process the data
    const processedData = transformData(this.state.data);
    this.state.results.push(processedData);
    
    // Return value determines next steps
    return { quality: processedData.quality };
  }
  
  @listen('processData')
  @router((result) => result?.quality === 'high')
  async handleHighQuality() {
    this.state.results.push('High quality handling');
    return CONTINUE;
  }
  
  @listen('processData')
  @router((result) => result?.quality === 'low')
  async handleLowQuality() {
    this.state.results.push('Low quality handling');
    return CONTINUE;
  }
  
  @listen(or_('handleHighQuality', 'handleLowQuality'))
  async complete() {
    return { success: true, results: this.state.results };
  }
}

// Execute the flow
const flow = new DataProcessingFlow();
const result = await flow.execute();
console.log(result);
```

### Flow Visualization

You can visualize your flows to understand complex execution paths:

```typescript
import { plotFlow } from 'crewai-ts/flow/visualization';

// Create a visualization of your flow
const flow = new DataProcessingFlow();
const htmlPath = await plotFlow(flow, 'data-processing-flow');
console.log(`Flow visualization saved to: ${htmlPath}`);
```

### CLI Commands

CrewAI-TS provides command-line tools for working with flows:

```bash
# Create a new flow
npx crewai create-flow MyCustomFlow --description "A flow for custom processing"

# Run a flow
npx crewai run-flow ./src/flows/MyCustomFlow.flow.ts --input '{"key":"value"}'

# Generate a flow visualization
npx crewai plot-flow ./src/flows/MyCustomFlow.flow.ts --output my-flow-viz
```

### Advanced Flow Features

- **Complex Conditions**: Use `and_()` and `or_()` decorators for complex triggering conditions
- **Custom Routing Logic**: Implement sophisticated routing with the `router` decorator
- **Error Handling**: Built-in error propagation with `*` wildcard listener for centralized error handling
- **Performance Optimizations**:
  - Method result caching for expensive operations
  - Parallel execution of independent methods
  - Efficient event propagation with minimal overhead
  - Memoized position calculations for visualizations

## Differences from Python crewAI

- Native TypeScript types and interfaces
- ESM-only package structure
- Enhanced error handling with TypeScript discriminated unions
- Modern async patterns using top-level await and async iterators
- Performance optimizations for vector operations
- In-memory knowledge storage that works without external dependencies

## Roadmap

The following features are planned for future releases:

- **ContextualMemory Component**: Intelligent orchestration layer that combines different memory types (short-term, long-term, entity, user) to build comprehensive context for agent tasks
- **UserMemory Component**: Store and retrieve memory specifically associated with end-users, enabling personalized agent interactions based on user history and preferences
- **Additional Embedding Providers**: Support for more embedding models and providers
- **Enhanced Memory Persistence**: Improved options for storing and retrieving memory across sessions
- **Performance Optimizations**: Further optimizations for large-scale memory operations

## License

MIT
