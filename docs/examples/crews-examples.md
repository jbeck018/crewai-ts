---
layout: default
---

# Building Memory-Efficient Crews in CrewAI TypeScript

This guide provides practical examples for creating memory-optimized crews in CrewAI TypeScript, with a focus on performance and efficient resource usage.

## What is a Crew?

A crew in CrewAI represents a collaborative group of agents working together to achieve a set of tasks. Each crew defines the strategy for task execution, agent collaboration, and the overall workflow.

## Crew Attributes

| Attribute | Type | Description | Optimization |
| :-------- | :--- | :---------- | :---------- |
| **agents** | `Agent[]` | List of agents in the crew | Use minimal number of agents needed for the task |
| **tasks** | `Task[]` | List of tasks assigned to the crew | Structure tasks efficiently to minimize redundant work |
| **process** *(optional)* | `Process` | Process flow (sequential, hierarchical) | Default: `Process.Sequential` |
| **verbose** *(optional)* | `boolean` | Enable detailed logging | Default: false; enable only for debugging |
| **managerLLM** *(optional)* | `string \| LLM` | LLM for manager in hierarchical process | Use lazy loading for memory efficiency |
| **functionCallingLLM** *(optional)* | `string \| LLM` | LLM for function calling | Specify only when needed to save resources |
| **maxRPM** *(optional)* | `number` | Maximum requests per minute | Controls API usage rate to prevent throttling |
| **language** *(optional)* | `string` | Language for the crew | Default: 'english' |
| **memory** *(optional)* | `boolean \| MemoryOptions` | Enable memory storage | Configure based on specific memory requirements |
| **cache** *(optional)* | `boolean \| CacheOptions` | Cache for tool execution results | Default: true; optimizes repeated operations |
| **fullOutput** *(optional)* | `boolean` | Return full output with all task outputs | Default: false; set to true only when needed |

## Creating Crews in TypeScript

The TypeScript implementation provides memory-efficient patterns for creating and managing crews.

### Basic Crew Creation

```typescript
import { Crew, Agent, Task, Process } from 'crewai-ts';

// Create agents (see agents-examples.md for details)
const researcherAgent = new Agent({
  role: 'Research Specialist',
  goal: 'Find accurate and relevant information',
  verbose: false
});

const writerAgent = new Agent({
  role: 'Content Writer',
  goal: 'Create engaging content based on research',
  verbose: false
});

// Create tasks with optimized descriptions
const researchTask = new Task({
  description: 'Research latest AI developments focusing on LLMs',
  agent: researcherAgent,
  // Set expected output for better type safety and memory management
  expectedOutput: 'Comprehensive research findings on LLM advancements'
});

const writingTask = new Task({
  description: 'Create a technical blog post based on research findings',
  agent: writerAgent,
  // Use context from previous task with memory-efficient reference passing
  contextFrom: [researchTask]
});

// Create a memory-efficient crew
const contentCrew = new Crew({
  agents: [researcherAgent, writerAgent],
  tasks: [researchTask, writingTask],
  // Use sequential process for predictable memory usage patterns
  process: Process.Sequential,
  // Only enable verbose logging during development
  verbose: false,
  // Configure memory with optimization settings
  memory: {
    // Use minimal shared memory to reduce duplication
    useSharedMemory: true,
    // Enable memory compression for large datasets
    enableCompression: true,
    // Set memory limits to prevent unbounded growth
    maxMemoryItems: 1000
  },
  // Enable caching for repeated operations
  cache: true
});

// Execute the crew with optimized resource utilization
const result = await contentCrew.kickoff();
console.log(result);
```

### Using Configuration Files

CrewAI TypeScript supports YAML or JSON configuration for declarative crew definitions, similar to the Python version but with memory optimizations:

```typescript
import { Crew, Agent, Task, loadConfig } from 'crewai-ts';
import * as fs from 'fs';

// Memory-efficient configuration loading with lazy evaluation
const loadCrewConfig = () => {
  // Implement lazy loading to only parse when needed
  const configCache = new Map();
  
  return (configPath: string) => {
    if (!configCache.has(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      configCache.set(configPath, config);
    }
    return configCache.get(configPath);
  };
};

const getConfig = loadCrewConfig();

// Creating a crew from configuration
const createCrewFromConfig = async (configPath: string) => {
  const config = getConfig(configPath);
  
  // Create agents from config
  const agents = await Promise.all(
    config.agents.map(agentConfig => new Agent(agentConfig))
  );
  
  // Create tasks with agent references
  const tasks = config.tasks.map(taskConfig => {
    const agent = agents.find(a => a.role === taskConfig.agentRole);
    return new Task({
      ...taskConfig,
      agent
    });
  });
  
  // Create the crew with memory-efficient configuration
  return new Crew({
    agents,
    tasks,
    process: config.process || Process.Sequential,
    verbose: config.verbose || false,
    // Apply memory optimizations from config or use defaults
    memory: config.memory || {
      useSharedMemory: true,
      enableCompression: true
    },
    cache: config.cache !== undefined ? config.cache : true
  });
};

// Usage
const crew = await createCrewFromConfig('config/crews/content_crew.json');
const result = await crew.kickoff();
```

### Example Configuration File

```json
// config/crews/content_crew.json
{
  "name": "Content Creation Crew",
  "description": "A crew specialized in creating technical content",
  "agents": [
    {
      "role": "Research Specialist",
      "goal": "Find accurate and relevant information",
      "backstory": "You are an expert at finding and analyzing information.",
      "verbose": false
    },
    {
      "role": "Content Writer",
      "goal": "Create engaging content based on research",
      "backstory": "You are skilled at transforming complex information into engaging content.",
      "verbose": false
    }
  ],
  "tasks": [
    {
      "description": "Research latest AI developments focusing on LLMs",
      "agentRole": "Research Specialist",
      "expectedOutput": "Comprehensive research findings on LLM advancements"
    },
    {
      "description": "Create a technical blog post based on research findings",
      "agentRole": "Content Writer",
      "expectedOutput": "Engaging technical blog post about LLM advancements"
    }
  ],
  "process": "sequential",
  "verbose": false,
  "memory": {
    "useSharedMemory": true,
    "enableCompression": true,
    "maxMemoryItems": 1000
  },
  "cache": true
}
```

## Advanced Crew Optimizations

### Memory-Efficient Process Selection

```typescript
import { Crew, Process } from 'crewai-ts';

// Different process types have different memory characteristics
const crew = new Crew({
  // ... agents and tasks configuration
  
  // Sequential: Lower memory footprint, predictable execution
  process: Process.Sequential, 
  
  // Hierarchical: Needs more memory for manager, but can be more efficient for complex task networks
  // process: Process.Hierarchical,
  // managerLLM: 'gpt-4-turbo', // Only needed for hierarchical process
  
  // Memory optimization through event-based state tracking
  trackStateChanges: true,
  // Only keep the minimum state required
  minimizeStateSize: true,
  // Implement automatic garbage collection for completed task contexts
  cleanupCompletedTaskContexts: true
});
```

### Implementing Callbacks for Memory Management

```typescript
import { Crew, TaskCallback, StepCallback } from 'crewai-ts';

// Implement callbacks for memory management and logging
const taskCallback: TaskCallback = (task, result) => {
  // Log completion for tracking
  console.log(`Task ${task.id} completed`);
  
  // Perform memory cleanup after task is done
  // This allows releasing resources that won't be needed anymore
  if (task.cleanupCallback) {
    task.cleanupCallback();
  }
  
  return result;
};

const stepCallback: StepCallback = (agent, step) => {
  // Track token usage for optimization
  const tokenUsage = step.tokenUsage || { total: 0, prompt: 0, completion: 0 };
  console.log(`Step token usage: ${tokenUsage.total}`);
  
  // Implement progressive cleanup for agent context that's no longer needed
  if (step.contextSize > 10000) {
    // If context is getting large, trim older, less relevant parts
    agent.trimContext({
      keepLatestItems: 20,
      preserveSystemPrompt: true
    });
  }
  
  return step;
};

const crew = new Crew({
  // ... other configuration
  taskCallback,
  stepCallback,
  // Enable memory-efficient telemetry
  enableTelemetry: true,
  telemetryConfig: {
    // Sample only a percentage of events to reduce overhead
    samplingRate: 0.1,
    // Batch telemetry data to reduce API calls
    batchSize: 10,
    // Use memory-efficient event serialization
    useCompactEventFormat: true
  }
});
```

### Using CrewFactory for Optimized Instantiation

```typescript
import { CrewFactory, Process } from 'crewai-ts';

// Create a factory with shared configuration for memory efficiency
const crewFactory = new CrewFactory({
  // Default configuration for all crews
  defaultConfig: {
    process: Process.Sequential,
    verbose: false,
    // Memory-efficient defaults
    memory: {
      useSharedMemory: true,
      enableCompression: true
    },
    cache: true
  },
  // Reuse agents across crews to reduce duplication
  sharedAgents: new Map(),
  // Enable memory-efficient telemetry
  telemetryConfig: {
    samplingRate: 0.1,
    batchSize: 10
  }
});

// Create crews with specific configurations
const researchCrew = await crewFactory.createCrew({
  name: 'Research Crew',
  // Override default config as needed
  process: Process.Hierarchical,
  // Load agents and tasks from config
  configPath: 'config/crews/research_crew.json'
});

const analysisCrew = await crewFactory.createCrew({
  name: 'Analysis Crew',
  // Reuse agents from the previous crew where possible
  reuseAgents: true,
  // Load configuration
  configPath: 'config/crews/analysis_crew.json'
});
```

## Memory Performance Best Practices

1. **Minimize Agent Count**: Use only the necessary number of agents
2. **Optimize Task Descriptions**: Keep task descriptions concise to reduce token usage
3. **Use Sequential Process When Possible**: Sequential processes generally use less memory than hierarchical
4. **Implement Memory Limits**: Set maximum memory sizes to prevent unbounded growth
5. **Use Shared Memory**: Enable shared memory to reduce duplication across agents
6. **Enable Caching**: Use caching to avoid redundant computations
7. **Implement Cleanup Callbacks**: Release resources when they're no longer needed
8. **Monitor Performance**: Track memory usage and token counts to identify optimization opportunities

By following these practices and using the memory-optimized TypeScript implementations, you can create efficient CrewAI crews that perform well while minimizing resource consumption.
