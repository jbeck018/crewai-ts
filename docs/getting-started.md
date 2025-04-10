---
layout: default
title: Getting Started
nav_order: 1
---

# Getting Started with CrewAI TypeScript

Welcome to the TypeScript implementation of CrewAI! This guide will help you get started with installing and configuring CrewAI-TS for your AI agent projects.

## NOTE!

This project is not owned by CrewAI, but is a community-driven TypeScript implementation of CrewAI. If you want to help us improve the project, please consider contributing.

## Installation

CrewAI TypeScript can be installed via npm or yarn:

```bash
# Using npm
npm install crewai-ts

# Using yarn
yarn add crewai-ts
```

## Prerequisites

- Node.js v18.0.0 or higher
- TypeScript v4.5.0 or higher

## Basic Configuration

To start using CrewAI, you'll need to set up your environment with API keys for your chosen LLM provider:

```typescript
import { config } from 'crewai-ts';

// Configure the default LLM provider
config.setDefaults({
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    // Memory-efficient default model
    defaultModel: 'gpt-4o-mini'
  },
  // Set memory configuration defaults
  memory: {
    enabled: true,
    // Use memory optimization by default
    useSharedMemory: true,
    enableCompression: true
  }
});
```

## Your First CrewAI Project

Here's a simple example to create a crew with optimized memory usage:

```typescript
import { Agent, Crew, Task, Process } from 'crewai-ts';

// Create your first agent
const researchAgent = new Agent({
  role: 'Research Specialist',
  goal: 'Find accurate information on AI advancements',
  backstory: 'You are an expert in researching cutting-edge AI technologies.',
  // Configure for memory efficiency
  verbose: false,
  memory: true
});

// Create a task for the agent
const researchTask = new Task({
  description: 'Research the latest developments in AI generative models',
  agent: researchAgent,
  expectedOutput: 'A comprehensive overview of recent AI advancements'
});

// Create a crew to execute the task
const crew = new Crew({
  agents: [researchAgent],
  tasks: [researchTask],
  process: Process.Sequential,
  // Configure for optimal performance
  verbose: false,
  memory: {
    useSharedMemory: true,
    enableCompression: true
  }
});

// Execute the crew
async function runCrew() {
  const result = await crew.kickoff();
  console.log('Crew execution result:', result);
}

runCrew();
```

## Memory-Efficient Project Structure

For optimal performance and organization, we recommend structuring your CrewAI TypeScript project as follows:

```
my-crewai-project/
├── src/
│   ├── agents/
│   │   ├── researcher.ts
│   │   └── writer.ts
│   ├── tasks/
│   │   ├── research-task.ts
│   │   └── writing-task.ts
│   ├── crews/
│   │   └── content-crew.ts
│   ├── knowledge/
│   │   └── sources.ts
│   ├── config/
│   │   └── settings.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

This structure promotes modular development and makes it easier to manage complex projects with multiple agents and crews.

## Next Steps

Now that you have a basic understanding of how to set up and use CrewAI TypeScript, explore these topics:

- [Agent Examples](agents-examples.html) - Learn how to create different types of agents
- [Crew Examples](crews-examples.html) - Dive deeper into crew configuration
- [Memory Systems](memory-systems.html) - Understand how to optimize memory usage
- [CLI Documentation](cli.html) - Learn about the command-line interface

For more advanced functionality, check out the documentation on [Flows](flows.html) and [Knowledge System](knowledge-system.html).
