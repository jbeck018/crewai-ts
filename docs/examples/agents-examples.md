---
layout: default
---

# Creating Optimized Agents in CrewAI TypeScript

This guide provides practical examples for creating memory-efficient agents in CrewAI TypeScript.

## Agent Fundamentals

In CrewAI, an `Agent` is an autonomous unit that can perform specific tasks, make decisions, use tools, collaborate with other agents, and maintain memory of interactions.

## Agent Attributes

| Attribute | Type | Description | Optimization |
| :-------- | :--- | :---------- | :---------- |
| **role** | `string` | Defines the agent's function and expertise | Use concise role descriptions to reduce prompt tokens |
| **goal** | `string` | The individual objective for the agent | Be specific but brief to optimize for token efficiency |
| **backstory** | `string` | Provides context and personality | Apply memory-efficient templating |
| **llm** *(optional)* | `string \| LLM` | Language model powering the agent | Use lazy loading for LLM clients |
| **tools** *(optional)* | `Tool[]` | Capabilities available to the agent | Use tool factories for memory efficiency |
| **maxIterations** *(optional)* | `number` | Maximum iterations for the agent | Default: 20 |
| **maxRPM** *(optional)* | `number` | Maximum requests per minute | Prevents rate limits |
| **memory** *(optional)* | `boolean` | Whether the agent should maintain memory | Default: true; disable for memory efficiency when not needed |
| **verbose** *(optional)* | `boolean` | Enable detailed execution logs | Default: false; only enable during development |
| **allowDelegation** *(optional)* | `boolean` | Allow delegation to other agents | Default: false |
| **cache** *(optional)* | `boolean` | Enable caching for tool usage | Default: true; optimizes repeated tool calls |
| **systemTemplate** *(optional)* | `string` | Custom system prompt template | Use minimal templates for token efficiency |

## Creating Agents in TypeScript

Unlike Python, the TypeScript implementation leverages interfaces and factory patterns for improved type safety and memory efficiency.

### Basic Agent Creation

```typescript
import { Agent, Tool } from 'crewai-ts';
import { OpenAIEmbeddings } from 'crewai-ts/embeddings';

// Create a basic agent with memory optimizations
const researcherAgent = new Agent({
  role: 'Senior Research Analyst',
  goal: 'Discover the latest developments in AI and present findings',
  backstory: 'You are an experienced research analyst with expertise in AI technology trends.',
  // Use minimal verbosity for optimal performance
  verbose: false,
  // Enable memory with optimized storage patterns
  memory: true
});
```

### Agent with Tools

```typescript
import { Agent, Tool } from 'crewai-ts';
import { WebSearchTool, FileReadTool } from 'crewai-ts/tools';

// Create tool instances with memory-efficient configurations
const searchTool = new WebSearchTool({
  // Use optimized cache settings to reduce duplicate requests
  cacheExpiration: 3600,
  // Limit result count to reduce memory usage
  maxResults: 5
});

const fileTool = new FileReadTool({
  // Use streaming file reading for memory efficiency
  useStreaming: true
});

// Create agent with tools
const analystAgent = new Agent({
  role: 'Data Analyst',
  goal: 'Analyze research findings and produce insights',
  backstory: 'You are a skilled data analyst specializing in extracting insights from research data.',
  // Add tools with memory-efficient configurations
  tools: [searchTool, fileTool],
  // Use a model optimized for your specific use case
  llm: 'gpt-4-turbo',
  // Enable caching for more efficient tool usage
  cache: true
});
```

### Configuration File Approach

CrewAI TypeScript supports YAML or JSON configuration for declarative agent definitions, similar to the Python version but with additional optimizations:

```typescript
import { Agent, AgentConfig } from 'crewai-ts';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';

// Load agent configurations with lazy loading
function loadAgentConfig(path: string): AgentConfig {
  // Using synchronous file loading for simplicity, but you could use async loading for better performance
  const fileContent = readFileSync(path, 'utf8');
  return load(fileContent) as AgentConfig;
}

// Agent factory with configuration caching
const agentFactory = {
  configCache: new Map<string, AgentConfig>(),
  
  getAgent(configName: string): Agent {
    // Check cache first to avoid redundant parsing
    if (!this.configCache.has(configName)) {
      const config = loadAgentConfig(`config/agents/${configName}.yaml`);
      this.configCache.set(configName, config);
    }
    
    return new Agent(this.configCache.get(configName)!);
  }
};

// Create agents using the factory
const researcher = agentFactory.getAgent('researcher');
const analyst = agentFactory.getAgent('analyst');
```

### Example YAML Configuration

```yaml
# config/agents/researcher.yaml
role: "AI Research Specialist"
goal: "Discover and analyze the latest developments in artificial intelligence"
backstory: >
  You are a renowned research specialist in the field of AI,
  known for your ability to uncover emerging trends and technologies.
  Your analytical skills are unmatched, and you have a talent for
  explaining complex concepts in accessible terms.
llm: "gpt-4o"
verbose: false
allowDelegation: false
cache: true
maxIterations: 15
```

## Memory-Optimized Agent Implementation

The TypeScript implementation includes several memory optimizations not available in the Python version:

### Lazy-Loaded LLM Clients

```typescript
import { Agent, createLazyLLM } from 'crewai-ts';

// Create a lazy-loaded LLM that only initializes when first used
const lazyLLM = createLazyLLM({
  provider: 'openai',
  model: 'gpt-4-turbo',
  // Only initialize the client when first called
  initializeOnFirstCall: true,
  // Use token prediction to optimize batch sizes
  useTokenPrediction: true
});

const efficientAgent = new Agent({
  role: 'Efficient Researcher',
  goal: 'Find information while minimizing resource usage',
  backstory: 'You are optimized for performance and resource efficiency.',
  llm: lazyLLM
});
```

### Using the LiteAgent for Lower Memory Footprint

```typescript
import { LiteAgent } from 'crewai-ts';

// LiteAgent is a memory-optimized version with reduced capabilities but significantly lower resource usage
const lightweightAgent = new LiteAgent({
  role: 'Quick Researcher',
  goal: 'Find basic information efficiently',
  // LiteAgent has a simplified memory model for reduced overhead
  useMinimalMemory: true,
  // Uses a more efficient prompt structure
  useCompactPrompts: true
});
```

### Memory-Efficient Agent with Custom Memory Configuration

```typescript
import { Agent } from 'crewai-ts';
import { MemoryConfig } from 'crewai-ts/memory';

// Create custom memory configuration with optimizations
const optimizedMemoryConfig: MemoryConfig = {
  // Use tiered memory architecture
  shortTerm: {
    // Expire short-term memory items after 30 minutes to free resources
    expirationMs: 30 * 60 * 1000,
    // Limit short-term memory size
    maxItems: 100
  },
  longTerm: {
    // Use compressed storage for long-term items
    useCompression: true,
    // Store in chunks for better memory management
    chunkSize: 1024
  },
  // Use memory deduplication to reduce storage requirements
  deduplicateEntries: true,
  // Enable garbage collection for unused memory items
  enableGarbageCollection: true
};

const memorySavvyAgent = new Agent({
  role: 'Memory-Optimized Researcher',
  goal: 'Work efficiently with minimal resource usage',
  backstory: 'You specialize in performing complex tasks with minimal resource consumption.',
  memory: true,
  memoryConfig: optimizedMemoryConfig
});
```

## Performance Best Practices

1. **Use Lazy Loading**: Initialize agents only when needed to reduce initial memory footprint
2. **Optimize Role and Goal Text**: Keep role and goal text concise to reduce token usage
3. **Configure Memory Appropriately**: Only enable memory features that are needed for your task
4. **Limit Tool Count**: Provide only the tools necessary for the agent's tasks
5. **Use Caching**: Enable caching for repeated tool calls to reduce API usage
6. **Consider LiteAgent**: For simple tasks, use LiteAgent to reduce memory usage
7. **Monitor Resource Usage**: Track memory and token usage to identify optimization opportunities

By following these practices and using the optimized TypeScript implementations, you can create efficient CrewAI agents that perform well even with complex tasks while minimizing resource consumption.
