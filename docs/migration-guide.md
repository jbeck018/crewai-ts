---
layout: default
title: Python to TypeScript Migration
nav_order: 7
---

# Migrating from Python to TypeScript

This guide provides a comprehensive roadmap for transitioning from the Python implementation of CrewAI to the TypeScript version. It highlights key differences, memory optimizations, and best practices for a smooth migration.

## Key Differences Overview

| Aspect | Python Implementation | TypeScript Implementation |
| ------ | -------------------- | ------------------------- |
| **Type System** | Dynamic typing, type hints | Static typing with interfaces |
| **Memory Management** | Standard Python memory | Optimized data structures, tiered storage |
| **Performance** | Good baseline performance | Enhanced with specialized optimizations |
| **Knowledge System** | Basic embeddings | Memory-efficient embeddings with Float32Array |
| **Task Execution** | Process-based execution | Event-driven architecture |
| **Configuration** | YAML-based configuration | TypeScript interfaces with validation |
| **Tooling** | Python toolchain | Node.js/TypeScript ecosystem |

## Framework Architecture Changes

### Python Structure

```python
# Python approach
from crewai import Agent, Crew, Task, Process

# Create an agent
agent = Agent(
    role="Research Analyst",
    goal="Find the latest information",
    backstory="You are an expert researcher",
    verbose=True
)

# Create a task
task = Task(
    description="Research the latest developments",
    agent=agent,
    expected_output="Comprehensive research report"
)

# Create a crew
crew = Crew(
    agents=[agent],
    tasks=[task],
    process=Process.sequential,
    verbose=True
)

# Execute the crew
result = crew.kickoff()
```

### TypeScript Structure

```typescript
import { Agent, Crew, Task, Process } from 'crewai-ts';

// Create an agent with memory optimizations
const agent = new Agent({
  role: "Research Analyst",
  goal: "Find the latest information",
  backstory: "You are an expert researcher",
  verbose: false,  // Default false in TypeScript for performance
  memory: true,    // Explicitly enable memory
  cache: true      // Enable caching for performance
});

// Create a task with type-safe configuration
const task = new Task({
  description: "Research the latest developments",
  agent: agent,
  expectedOutput: "Comprehensive research report"
});

// Create a crew with memory optimizations
const crew = new Crew({
  agents: [agent],
  tasks: [task],
  process: Process.Sequential,  // Note: enum values are PascalCase in TypeScript
  verbose: false,
  memory: {
    useSharedMemory: true,      // TypeScript-specific optimization
    enableCompression: true      // TypeScript-specific optimization
  }
});

// Execute the crew with async/await pattern
const result = await crew.kickoff();
```

## Component-by-Component Migration Guide

### 1. Agents

#### Python

```python
from crewai import Agent

agent = Agent(
    role="Data Scientist",
    goal="Analyze data and provide insights",
    backstory="You are a data scientist with expertise in machine learning",
    tools=[tool1, tool2],
    llm=ChatOpenAI(model="gpt-4"),
    verbose=True
)
```

#### TypeScript (Memory-Optimized)

```typescript
import { Agent } from 'crewai-ts';
import { OpenAIChat } from 'crewai-ts/llm';

// Create a memory-efficient LLM client
const llm = new OpenAIChat({
  model: 'gpt-4',
  // Memory optimizations
  cacheResponses: true,
  cacheTokenCounts: true
});

const agent = new Agent({
  role: 'Data Scientist',
  goal: 'Analyze data and provide insights',
  backstory: 'You are a data scientist with expertise in machine learning',
  tools: [tool1, tool2],
  llm: llm,
  verbose: false,  // Default false in TypeScript for performance
  // Memory optimizations
  memory: true,
  cache: true
});
```

### 2. Tasks

#### Python

```python
from crewai import Task

task = Task(
    description="Analyze the provided dataset and identify trends",
    agent=agent,
    expected_output="Comprehensive analysis report with visualizations",
    context=["The dataset contains customer transaction data"]
)
```

#### TypeScript (Memory-Optimized)

```typescript
import { Task } from 'crewai-ts';

const task = new Task({
  description: 'Analyze the provided dataset and identify trends',
  agent: agent,
  expectedOutput: 'Comprehensive analysis report with visualizations',
  // Context is array of strings in TypeScript
  context: ['The dataset contains customer transaction data'],
  // TypeScript-specific options for optimization
  asyncExecution: false,  // Set to true for non-blocking execution
  cacheOutput: true       // Cache task output for performance
});
```

### 3. Crews

#### Python

```python
from crewai import Crew, Process

crew = Crew(
    agents=[agent1, agent2],
    tasks=[task1, task2],
    process=Process.sequential,
    verbose=True,
    manager_llm=ChatOpenAI(model="gpt-4")
)

result = crew.kickoff(inputs={"dataset_url": "https://example.com/data.csv"})
```

#### TypeScript (Memory-Optimized)

```typescript
import { Crew, Process } from 'crewai-ts';
import { OpenAIChat } from 'crewai-ts/llm';

// Create a memory-efficient manager LLM
const managerLLM = new OpenAIChat({
  model: 'gpt-4',
  cacheResponses: true
});

const crew = new Crew({
  agents: [agent1, agent2],
  tasks: [task1, task2],
  process: Process.Sequential, // Note: PascalCase in TypeScript
  verbose: false,
  managerLLM: managerLLM,
  // Memory optimization options
  memory: {
    useSharedMemory: true,
    enableCompression: true,
    maxMemoryItems: 1000
  },
  cache: true
});

// Async execution in TypeScript
const result = await crew.kickoff({
  inputs: { dataset_url: 'https://example.com/data.csv' },
  // TypeScript-specific execution options
  options: {
    progressiveCleanup: true,
    minimizeMetricsCollection: true
  }
});
```

### 4. Flows

#### Python

```python
from crewai.flow.flow import Flow, listen, start

class ExampleFlow(Flow):
    model = "gpt-4o-mini"

    @start()
    def generate_city(self):
        print("Starting flow")
        print(f"Flow State ID: {self.state['id']}")

        response = completion(
            model=self.model,
            messages=[{
                "role": "user",
                "content": "Return the name of a random city.",
            }],
        )

        random_city = response["choices"][0]["message"]["content"]
        self.state["city"] = random_city
        return random_city

    @listen(generate_city)
    def generate_fun_fact(self, random_city):
        response = completion(
            model=self.model,
            messages=[{
                "role": "user",
                "content": f"Tell me a fun fact about {random_city}",
            }],
        )

        fun_fact = response["choices"][0]["message"]["content"]
        self.state["fun_fact"] = fun_fact
        return fun_fact

flow = ExampleFlow()
result = flow.kickoff()
```

#### TypeScript (Memory-Optimized)

```typescript
import { Flow, listen, start } from 'crewai-ts/flow';
import { OpenAIChat } from 'crewai-ts/llm';

class ExampleFlow extends Flow {
  // Use lazy-loaded LLM for memory efficiency
  private llm = new OpenAIChat({
    model: 'gpt-4o-mini',
    // Enable memory optimizations
    cacheTokenCounts: true,
    cacheResponses: true
  });

  @start()
  async generateCity() {
    console.log("Starting flow");
    console.log(`Flow State ID: ${this.state['id']}`);

    // Memory-efficient completion call
    const response = await this.llm.complete({
      messages: [
        {
          role: "user",
          content: "Return the name of a random city in the world."
        }
      ],
      // Optimize token usage
      maxTokens: 20,
      temperature: 0.7
    });

    const randomCity = response.content;
    // Store in state using minimal memory
    this.state["city"] = randomCity;
    return randomCity;
  }

  // TypeScript requires explicit parameter type
  @listen(function(this: ExampleFlow) { return this.generateCity; })
  async generateFunFact(randomCity: string) {
    // Memory-efficient completion
    const response = await this.llm.complete({
      messages: [
        {
          role: "user",
          content: `Tell me a fun fact about ${randomCity}`
        }
      ],
      maxTokens: 100
    });

    const funFact = response.content;
    this.state["funFact"] = funFact;
    return funFact;
  }
}

// Create flow with memory optimizations
const flow = new ExampleFlow({
  // Use memory-efficient state options
  stateOptions: {
    useIncrementalUpdates: true,
    persistentFields: ['city', 'funFact']
  }
});

// Execute flow asynchronously
const result = await flow.kickoff();
```

### 5. Knowledge System

#### Python

```python
from crewai.tools.knowledge import TextKnowledgeSource
from crewai.utilities import embed_with_openai

# Create knowledge sources
source1 = TextKnowledgeSource(
    text="Paris is the capital of France.",
    metadata={"topic": "geography"}
)

# Search for information
results = embed_with_openai(
    query="Tell me about Paris",
    sources=[source1],
    limit=3
)
```

#### TypeScript (Memory-Optimized)

```typescript
import { OpenAIEmbeddings } from 'crewai-ts/embeddings';
import { StringKnowledgeSource } from 'crewai-ts/knowledge';

// Create knowledge sources with memory optimizations
const source1 = new StringKnowledgeSource({
  content: 'Paris is the capital of France.',
  metadata: { topic: 'geography' },
  // Memory optimizations
  useOptimizedChunking: true
});

// Create memory-efficient embeddings
const embeddings = new OpenAIEmbeddings({
  // Memory optimizations
  cache: true,
  useFloat32Array: true,  // 50% memory reduction
  batchSize: 20
});

// Perform memory-efficient search
async function searchKnowledge() {
  const results = await embeddings.search({
    query: 'Tell me about Paris',
    sources: [source1],
    limit: 3,
    // Memory-efficient filtering
    filter: { topic: 'geography' }
  });
  
  return results;
}
```

## YAML Configuration Migration

### Python (YAML Configuration)

```yaml
# agents.yaml in Python
agent_one:
  role: "Research Analyst"
  goal: "Find accurate information"
  backstory: "You are an expert researcher"
  verbose: true
```

### TypeScript (YAML Configuration)

```yaml
# agents.yaml in TypeScript
agent_one:
  role: "Research Analyst"
  goal: "Find accurate information"
  backstory: "You are an expert researcher"
  verbose: false
  # TypeScript-specific memory optimizations
  memory: true
  cache: true
  memoryConfig:
    useSharedMemory: true
    enableCompression: true
```

## CLI Migration

### Python CLI

```bash
# Python CLI
crewai run --agents ./config/agents.yaml --tasks ./config/tasks.yaml
```

### TypeScript CLI

```bash
# TypeScript CLI with memory optimizations
crewai-ts run --agents ./config/agents.yaml --tasks ./config/tasks.yaml --memory-mode optimized
```

## Common Gotchas and Solutions

| Issue | Solution |
| ----- | -------- |
| **Type Errors** | Use proper TypeScript interfaces and types provided by CrewAI |
| **Async Processing** | Use async/await pattern consistently; TypeScript requires async handling |
| **Memory Management** | Enable TypeScript-specific memory optimizations like `useSharedMemory` |
| **Decorator Syntax** | Use TypeScript decorator syntax with proper `this` binding in Flow classes |
| **Configuration Files** | Add TypeScript-specific fields to YAML/JSON configuration files |
| **Process Enum Values** | Use PascalCase for Process values (`Sequential` not `sequential`) |
| **Tool Implementation** | Implement tools with proper TypeScript interfaces and error handling |

## Performance Migration Checklist

For optimal performance when migrating from Python to TypeScript:

1. **Use Float32Array for Embeddings**: Enable `useFloat32Array: true` in all embedding configurations
2. **Enable Caching**: Set `cache: true` on agents, tools, and LLM clients
3. **Configure Memory Options**: Implement memory optimizations like compression and shared memory
4. **Use Async Patterns Correctly**: Ensure proper async/await usage throughout codebase
5. **Implement Lazy Loading**: Initialize expensive resources only when needed
6. **Add Type Annotations**: Use proper type annotations for better performance and safety
7. **Configure Token Management**: Set appropriate token limits for optimal resource usage
8. **Use Streaming APIs**: Enable streaming for large responses where appropriate
9. **Implement Proper Error Handling**: Add TypeScript-specific error handling and retry logic
10. **Monitor Resource Usage**: Add telemetry to track memory and performance

By following this migration guide, you can transition from the Python implementation to the TypeScript version of CrewAI while taking advantage of all the memory optimizations and performance enhancements available in the TypeScript implementation.
