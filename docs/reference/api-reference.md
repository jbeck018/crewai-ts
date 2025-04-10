---
layout: default
title: API Reference
nav_order: 6
---

# API Reference

This comprehensive API reference outlines the core classes, interfaces, and methods available in the CrewAI TypeScript implementation, with a focus on the memory and performance optimizations.

## Core Components

### Agent

```typescript
class Agent {
  constructor(config: AgentConfig);
  
  // Core methods
  executeTask(task: Task): Promise<string>;
  
  // Memory management methods
  resetMemory(): void;
  getMemory(): AgentMemory;
  updateMemory(observation: string): Promise<void>;
  
  // Tool handling
  getTools(): Tool[];
  addTool(tool: Tool): void;
  removeTool(toolName: string): void;
  
  // Optimization methods
  trimContext(options?: TrimOptions): void;
}

interface AgentConfig {
  role: string;
  goal: string;
  backstory?: string;
  llm?: string | LLM;
  tools?: Tool[];
  maxIterations?: number;
  maxRPM?: number;
  memory?: boolean | MemoryOptions;
  verbose?: boolean;
  allowDelegation?: boolean;
  cache?: boolean;
  systemTemplate?: string;
}

interface TrimOptions {
  keepLatestItems?: number;
  preserveSystemPrompt?: boolean;
  maxTokens?: number;
}
```

### Crew

```typescript
class Crew {
  constructor(config: CrewConfig);
  
  // Core methods
  kickoff(options?: KickoffOptions): Promise<string>;
  
  // Agent and task management
  addAgent(agent: Agent): void;
  addTask(task: Task): void;
  getAgents(): Agent[];
  getTasks(): Task[];
  
  // Memory management
  getMemory(): CrewMemory;
  resetMemory(): void;
}

interface CrewConfig {
  agents: Agent[];
  tasks: Task[];
  process?: Process;
  verbose?: boolean;
  managerLLM?: string | LLM;
  functionCallingLLM?: string | LLM;
  maxRPM?: number;
  language?: string;
  memory?: boolean | MemoryOptions;
  cache?: boolean | CacheOptions;
  fullOutput?: boolean;
  taskCallback?: TaskCallback;
  stepCallback?: StepCallback;
}

enum Process {
  Sequential = 'sequential',
  Hierarchical = 'hierarchical'
}
```

### Task

```typescript
class Task {
  constructor(config: TaskConfig);
  
  // Core methods
  execute(inputs?: Record<string, any>): Promise<string>;
  
  // Context management
  getContext(): string;
  addContext(context: string): void;
  clearContext(): void;
}

interface TaskConfig {
  description: string;
  agent: Agent;
  expectedOutput?: string;
  contextFrom?: Task[];
  asyncExecution?: boolean;
  cacheOutput?: boolean;
}
```

### Flow

```typescript
class Flow {
  constructor(config?: FlowConfig);
  
  // Core methods
  kickoff(initialState?: Record<string, any>): Promise<any>;
  
  // State management
  get state(): Record<string, any>;
  set state(value: Record<string, any>);
}

interface FlowConfig {
  initialState?: Record<string, any>;
  stateOptions?: StateOptions;
  persistence?: PersistenceOptions;
  eventHandling?: EventHandlingOptions;
}

interface StateOptions {
  useIncrementalUpdates?: boolean;
  persistentFields?: string[];
  enableCompression?: boolean;
}
```

## Memory System

### MemoryManager

```typescript
class MemoryManager {
  static getInstance(config?: MemoryManagerConfig): MemoryManager;
  
  // Memory operations
  store(type: MemoryType, data: MemoryData): Promise<string>;
  retrieve(type: MemoryType, query: string, options?: RetrievalOptions): Promise<MemoryItem[]>;
  clear(type?: MemoryType): Promise<void>;
}

enum MemoryType {
  SHORT_TERM = 'short_term',
  LONG_TERM = 'long_term',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic'
}

interface MemoryManagerConfig {
  useTieredStorage?: boolean;
  deduplicateContent?: boolean;
  shortTermExpirationMs?: number;
  enableGarbageCollection?: boolean;
  useCompression?: boolean;
}
```

## Knowledge System

### Embeddings

```typescript
// Base Embeddings Interface
interface Embeddings {
  embedText(text: string): Promise<number[]>;
  embedDocuments(documents: string[]): Promise<number[][]>;
  search(options: SearchOptions): Promise<SearchResult[]>;
}

// OpenAI Embeddings
class OpenAIEmbeddings implements Embeddings {
  constructor(config?: OpenAIEmbeddingsConfig);
  embedText(text: string): Promise<number[]>;
  embedDocuments(documents: string[]): Promise<number[][]>;
  search(options: SearchOptions): Promise<SearchResult[]>;
}

// Cohere Embeddings
class CohereEmbeddings implements Embeddings {
  constructor(config?: CohereEmbeddingsConfig);
  embedText(text: string): Promise<number[]>;
  embedDocuments(documents: string[]): Promise<number[][]>;
  search(options: SearchOptions): Promise<SearchResult[]>;
}

// HuggingFace Embeddings
class HuggingFaceEmbeddings implements Embeddings {
  constructor(config?: HuggingFaceEmbeddingsConfig);
  embedText(text: string): Promise<number[]>;
  embedDocuments(documents: string[]): Promise<number[][]>;
  search(options: SearchOptions): Promise<SearchResult[]>;
}

// Fast Embeddings
class FastEmbeddings implements Embeddings {
  constructor(config?: FastEmbeddingsConfig);
  embedText(text: string): Promise<number[]>;
  embedDocuments(documents: string[]): Promise<number[][]>;
  search(options: SearchOptions): Promise<SearchResult[]>;
}
```

### Knowledge Sources

```typescript
interface KnowledgeSource {
  id: string;
  getChunks(): Promise<Chunk[]>;
  getMetadata(): Record<string, any>;
}

class StringKnowledgeSource implements KnowledgeSource {
  constructor(config: StringKnowledgeSourceConfig);
  getChunks(): Promise<Chunk[]>;
  getMetadata(): Record<string, any>;
}

class FileKnowledgeSource implements KnowledgeSource {
  constructor(config: FileKnowledgeSourceConfig);
  getChunks(): Promise<Chunk[]>;
  getMetadata(): Record<string, any>;
}

class URLKnowledgeSource implements KnowledgeSource {
  constructor(config: URLKnowledgeSourceConfig);
  getChunks(): Promise<Chunk[]>;
  getMetadata(): Record<string, any>;
}
```

## Tools

```typescript
interface Tool {
  name: string;
  description: string;
  execute(args: Record<string, any>): Promise<string>;
}

class WebSearchTool implements Tool {
  constructor(config?: WebSearchToolConfig);
  execute(args: Record<string, any>): Promise<string>;
}

class FileReadTool implements Tool {
  constructor(config?: FileReadToolConfig);
  execute(args: Record<string, any>): Promise<string>;
}

class FileWriteTool implements Tool {
  constructor(config?: FileWriteToolConfig);
  execute(args: Record<string, any>): Promise<string>;
}
```

## LLM Providers

```typescript
interface LLM {
  complete(options: CompletionOptions): Promise<CompletionResponse>;
}

class OpenAIChat implements LLM {
  constructor(config?: OpenAIChatConfig);
  complete(options: CompletionOptions): Promise<CompletionResponse>;
}

class AnthropicLLM implements LLM {
  constructor(config?: AnthropicConfig);
  complete(options: CompletionOptions): Promise<CompletionResponse>;
}

class OllamaLLM implements LLM {
  constructor(config?: OllamaConfig);
  complete(options: CompletionOptions): Promise<CompletionResponse>;
}

// Lazy-loaded LLM factory
function createLazyLLM(config: LazyLLMConfig): LLM;
```

## Utility Types and Functions

```typescript
// Configuration
const config = {
  setDefaults(defaults: ConfigDefaults): void;
  getDefaults(): ConfigDefaults;
};

// Memory utilities
function optimizeMemoryUsage(data: any): any;
function compressMemoryData(data: string): Promise<string>;
function decompressMemoryData(compressedData: string): Promise<string>;

// Vector operations
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number;
function normalizeVector(vec: number[]): number[];
```

For complete and detailed documentation on each class, interface, and method, refer to the specific sections in the documentation or check the source code with TSDoc comments.
