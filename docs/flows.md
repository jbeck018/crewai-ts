# Flows in CrewAI TypeScript

## Introduction

CrewAI Flows in TypeScript is a powerful system designed to streamline the creation and management of AI workflows. Flows allow developers to combine and coordinate coding tasks and Crews efficiently, providing a robust framework for building sophisticated AI automations with performance optimizations specific to TypeScript and Node.js environments.

Flows enable you to create structured, event-driven workflows with these key benefits:

1. **Simplified Workflow Creation**: Easily chain together multiple Crews and tasks to create complex AI workflows.

2. **State Management**: Built-in state management with both structured and unstructured options for maximum flexibility.

3. **Event-Driven Architecture**: Built on an event-driven model with optimized event propagation for responsive workflows.

4. **Flexible Control Flow**: Implement conditional logic, loops, and branching with performance-optimized logical operators.

5. **TypeScript Optimizations**: Leverages TypeScript's static typing for enhanced reliability and developer experience.

## Getting Started

Let's create a simple Flow that generates a random city and then retrieves a fun fact about it:

```typescript
import { Flow, start, listen } from 'crewai-ts/flow';

// Example using OpenAI API with the fetch API
const completionRequest = async (model: string, prompt: string): Promise<string> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  });
  
  const data = await response.json();
  return data.choices[0].message.content;
};

class ExampleFlow extends Flow {
  private model = "gpt-4o-mini";

  @start()
  async generateCity() {
    console.log("Starting flow");
    // Each flow state automatically gets a unique ID
    console.log(`Flow State ID: ${this.state.id}`);

    const prompt = "Return the name of a random city in the world.";
    const randomCity = await completionRequest(this.model, prompt);
    
    // Store the city in our state
    this.state.city = randomCity;
    console.log(`Random City: ${randomCity}`);

    return randomCity;
  }

  @listen("generateCity")
  async generateFunFact(randomCity: string) {
    const prompt = `Tell me a fun fact about ${randomCity}`;
    const funFact = await completionRequest(this.model, prompt);
    
    // Store the fun fact in our state
    this.state.funFact = funFact;
    return funFact;
  }
}

// Create and run the flow
const flow = new ExampleFlow();
const result = await flow.execute();

console.log(`Generated fun fact: ${result}`);
```

In this example, we've created a Flow with two methods:

1. `generateCity` - Marked with `@start()` to indicate it should run when the flow begins
2. `generateFunFact` - Marked with `@listen("generateCity")` to run after `generateCity` completes

Each Flow instance automatically receives a unique identifier in its state, helping track flow executions. The state stores additional data (like the city and fun fact) that persists throughout execution.

### Performance Optimizations

- Uses optimized cache management with WeakMap for memory efficiency
- Implements parallel execution of start methods with Promise.all
- Includes intelligent TTL-based caching of method results

## Flow Decorators

### @start()

The `@start()` decorator marks a method as a starting point of a Flow. When a Flow is executed, all methods with `@start()` run in parallel. This approach maximizes throughput for workflows with multiple independent starting points.

```typescript
import { Flow, start } from 'crewai-ts/flow';

class MyFlow extends Flow {
  @start() 
  async firstTask() {
    // This method runs when the flow starts
    return "Task completed";
  }
  
  @start() 
  async secondTask() {
    // This method also runs when the flow starts (in parallel)
    return "Another task completed";
  }
}
```

### @listen()

The `@listen()` decorator marks a method to execute when a specific event occurs. It supports three patterns, each with performance optimizations:

#### 1. Listen to a Method by Name

```typescript
@listen("generateCity")
async generateFunFact(cityName: string) {
  // This runs after generateCity completes
  // The return value of generateCity is passed as an argument
}
```

#### 2. Listen to a Method Directly

```typescript
@listen(generateCity)
async generateFunFact(cityName: string) {
  // This runs after generateCity completes
  // More efficient than string references due to direct method binding
}
```

#### 3. Listen with Complex Conditions

```typescript
@listen(or_(generateCity, searchWeather))
async processResults(result: any) {
  // This runs after either generateCity OR searchWeather completes
  // Uses optimized condition evaluation with Set-based deduplication
}
```

## Flow Output and State Management

The TypeScript implementation provides both structured and unstructured state management options, with optimizations for each approach.

### Retrieving Flow Output

When you run a Flow, the final output is determined by the last method that completes. The `execute()` method returns this output:

```typescript
import { Flow, start, listen } from 'crewai-ts/flow';

class OutputExampleFlow extends Flow {
  @start()
  async firstMethod() {
    return "Output from firstMethod";
  }

  @listen("firstMethod")
  async secondMethod(firstOutput: string) {
    return `Second method received: ${firstOutput}`;
  }
}

const flow = new OutputExampleFlow();
const finalOutput = await flow.execute();

console.log("---- Final Output ----");
console.log(finalOutput);
// Output: "Second method received: Output from firstMethod"
```

### Unstructured State Management

In unstructured state management, state is stored in the `state` property of the Flow class. This offers flexibility for dynamic attributes without a predefined schema.

```typescript
import { Flow, start, listen } from 'crewai-ts/flow';

class UnstructuredStateFlow extends Flow {
  @start()
  async firstMethod() {
    // The state automatically includes an 'id' field
    console.log(`State ID: ${this.state.id}`);
    this.state.counter = 0;
    this.state.message = "Hello from unstructured flow";
  }

  @listen("firstMethod")
  async secondMethod() {
    this.state.counter += 1;
    this.state.message += " - updated";
  }

  @listen("secondMethod")
  async thirdMethod() {
    this.state.counter += 1;
    this.state.message += " - updated again";
    console.log(`State after thirdMethod: ${JSON.stringify(this.state)}`);
  }
}

const flow = new UnstructuredStateFlow();
await flow.execute();
```

### Structured State Management

Structured state management uses TypeScript interfaces or classes to define the shape of the state, providing type safety and better developer experience.

```typescript
import { Flow, start, listen } from 'crewai-ts/flow';

// Define the state structure
interface ExampleState extends FlowState {
  counter: number;
  message: string;
}

class StructuredStateFlow extends Flow<ExampleState> {
  // Initialize with structured state
  constructor() {
    super({
      initialState: {
        counter: 0,
        message: ""
      }
    });
  }

  @start()
  async firstMethod() {
    // Access the auto-generated ID if needed
    console.log(`State ID: ${this.state.id}`);
    this.state.message = "Hello from structured flow";
  }

  @listen("firstMethod")
  async secondMethod() {
    this.state.counter += 1;
    this.state.message += " - updated";
  }

  @listen("secondMethod")
  async thirdMethod() {
    this.state.counter += 1;
    this.state.message += " - updated again";
    console.log(`State after thirdMethod:`, this.state);
  }
}

const flow = new StructuredStateFlow();
await flow.execute();
```

#### Benefits of Structured State

- **Type Safety**: TypeScript's static typing catches errors at compile time
- **IDE Integration**: Provides autocomplete and documentation in your editor
- **Self-Documenting**: Makes the flow's requirements explicit

## Flow Persistence

The TypeScript implementation includes a robust persistence system with optimized memory handling and error recovery. The `FlowMemoryConnector` class provides state persistence capabilities:

```typescript
import { Flow, start, listen, FlowMemoryConnector } from 'crewai-ts/flow';

// Create a persistence provider
const persistence = new FlowMemoryConnector({
  statePersistenceDebounceMs: 100,  // Optimize write frequency
  inMemoryCache: true,              // Enable multi-level caching
  inMemoryCacheTTL: 5 * 60 * 1000   // Cache TTL: 5 minutes
});

class PersistentFlow extends Flow {
  constructor() {
    super({
      persistence: persistence,
      initialState: { counter: 0 }
    });
  }

  @start()
  async initializeFlow() {
    this.state.counter = 1;
    console.log("Initialized flow. State ID:", this.state.id);
  }

  @listen("initializeFlow")
  async nextStep() {
    // The state is automatically reloaded if needed
    this.state.counter += 1;
    console.log("Flow state is persisted. Counter:", this.state.counter);
  }
}

// Execute the flow
const flow = new PersistentFlow();
const result = await flow.execute();

// Later, you can restore the flow using the state ID
const restoredFlow = new PersistentFlow();
await restoredFlow.execute({ stateId: flow.state.id });
```

### Performance Optimizations

The persistence system includes several optimizations:

1. **Multi-level Caching**: Uses both in-memory and persistent storage for optimal performance
2. **Query Caching**: Reduces database queries with intelligent caching
3. **Debounced Writes**: Batches state updates to reduce I/O operations
4. **Automatic Error Recovery**: Includes built-in retry logic and fallback mechanisms

## Flow Control

### Conditional Logic: `or_`

The `or_` function creates a condition that triggers when any of the specified methods complete:

```typescript
import { Flow, start, listen, or_ } from 'crewai-ts/flow';

class OrExampleFlow extends Flow {
  @start()
  async startMethod() {
    return "Hello from the start method";
  }

  @listen("startMethod")
  async secondMethod() {
    return "Hello from the second method";
  }

  @listen(or_("startMethod", "secondMethod"))
  async logger(result: string) {
    console.log(`Logger: ${result}`);
  }
}

const flow = new OrExampleFlow();
await flow.execute();
// Logger: Hello from the start method
// Logger: Hello from the second method
```

### Conditional Logic: `and_`

The `and_` function creates a condition that triggers only when all specified methods complete:

```typescript
import { Flow, start, listen, and_ } from 'crewai-ts/flow';

class AndExampleFlow extends Flow {
  @start()
  async startMethod() {
    this.state.greeting = "Hello from the start method";
  }

  @listen("startMethod")
  async secondMethod() {
    this.state.joke = "What do computers eat? Microchips.";
  }

  @listen(and_("startMethod", "secondMethod"))
  async logger() {
    console.log("---- Logger ----");
    console.log(this.state);
  }
}

const flow = new AndExampleFlow();
await flow.execute();
// ---- Logger ----
// { greeting: 'Hello from the start method', joke: 'What do computers eat? Microchips.' }
```

### Router

The `@router()` decorator defines conditional routing logic based on a method's output:

```typescript
import { Flow, start, listen, router } from 'crewai-ts/flow';

interface RouterState extends FlowState {
  successFlag: boolean;
}

class RouterFlow extends Flow<RouterState> {
  constructor() {
    super({
      initialState: {
        successFlag: false
      }
    });
  }

  @start()
  async startMethod() {
    console.log("Starting the structured flow");
    // Generate a random boolean
    const randomBoolean = Math.random() > 0.5;
    this.state.successFlag = randomBoolean;
  }

  @router("startMethod")
  async routingMethod() {
    if (this.state.successFlag) {
      return "success";
    } else {
      return "failed";
    }
  }

  @listen("success")
  async successHandler() {
    console.log("Success path executed");
  }

  @listen("failed")
  async failureHandler() {
    console.log("Failure path executed");
  }
}

const flow = new RouterFlow();
await flow.execute();
```

## Integrating with Agents

CrewAI Flows can be integrated with Agents to create powerful AI workflows. Here's an example of using an Agent within a Flow:

```typescript
import { Flow, start, listen } from 'crewai-ts/flow';
import { Agent } from 'crewai-ts';
import { z } from 'zod';

// Define a structured output schema using Zod
const MarketAnalysisSchema = z.object({
  keyTrends: z.array(z.string()).describe("List of identified market trends"),
  marketSize: z.string().describe("Estimated market size"),
  competitors: z.array(z.string()).describe("Major competitors in the space")
});

// Define our flow state interface
interface MarketResearchState extends FlowState {
  product: string;
  analysis: z.infer<typeof MarketAnalysisSchema> | null;
}

class MarketResearchFlow extends Flow<MarketResearchState> {
  constructor() {
    super({
      initialState: {
        product: "",
        analysis: null
      }
    });
  }

  @start()
  async initializeResearch() {
    console.log(`Starting market research for ${this.state.product}`);
  }

  @listen("initializeResearch")
  async analyzeMarket() {
    // Create an agent for market research
    const analyst = new Agent({
      role: "Market Research Analyst",
      goal: `Analyze the market for ${this.state.product}`,
      backstory: "You are an experienced market analyst with expertise in " +
                "identifying market trends and opportunities.",
      llm: { model: "gpt-4o" },
      verbose: true,
      outputParser: { schema: MarketAnalysisSchema }
    });

    // Define the research query
    const query = `
    Research the market for ${this.state.product}. Include:
    1. Key market trends
    2. Market size
    3. Major competitors
    
    Format your response according to the specified structure.
    `;

    // Execute the analysis
    const result = await analyst.execute(query);
    this.state.analysis = result.parsed;
    return result.parsed;
  }

  @listen("analyzeMarket")
  async presentResults() {
    const analysis = this.state.analysis;
    if (!analysis) {
      console.log("No analysis results available");
      return;
    }

    console.log("\nMarket Analysis Results");
    console.log("=====================");

    console.log("\nKey Market Trends:");
    for (const trend of analysis.keyTrends) {
      console.log(`- ${trend}`);
    }

    console.log(`\nMarket Size: ${analysis.marketSize}`);

    console.log("\nMajor Competitors:");
    for (const competitor of analysis.competitors) {
      console.log(`- ${competitor}`);
    }
  }
}

// Usage example
const flow = new MarketResearchFlow();
const result = await flow.execute({ product: "AI-powered chatbots" });
```

## Advanced Features and Optimizations

### Memory System Integration

The Flow system includes optimized memory components (ContextualMemory and VectorStoreMemory) for efficient data storage and retrieval:

```typescript
import { 
  Flow, 
  start, 
  listen, 
  FlowMemoryConnector,
  ContextualMemory,
  VectorStoreMemory 
} from 'crewai-ts/flow';

// Create a memory connector with performance optimizations
const memory = new FlowMemoryConnector({
  inMemoryCache: true,
  optimizeForTestEnvironment: process.env.NODE_ENV === 'test'
});

// Create a flow that uses the memory system
class MemoryEnabledFlow extends Flow {
  private contextualMemory: ContextualMemory;
  private vectorMemory: VectorStoreMemory;

  constructor() {
    super({ persistence: memory });
    
    // Initialize optimized memory systems
    this.contextualMemory = new ContextualMemory({
      cacheTTL: 10 * 60 * 1000, // 10 minutes cache TTL
      autoCacheCleanup: true
    });
    
    this.vectorMemory = new VectorStoreMemory({
      cacheTTL: 30 * 60 * 1000 // 30 minutes cache TTL
    });
  }

  @start()
  async storeInformation() {
    // Store information with metadata
    await this.contextualMemory.add(
      "fact-1", 
      "Tokyo is the most populous city in the world",
      { category: "geography", importance: "high" }
    );
    
    // Store vector embeddings for similarity search
    await this.vectorMemory.add(
      "city-tokyo",
      [0.1, 0.2, 0.3, 0.4], // Vector embedding
      "Tokyo, Japan",
      { population: "37.4 million", continent: "Asia" }
    );
    
    return "Information stored";
  }

  @listen("storeInformation")
  async retrieveInformation() {
    // Search by metadata (efficient indexed search)
    const geographyFacts = await this.contextualMemory.searchByMetadata(
      { category: "geography" }, 
      5 // Limit to 5 results
    );
    console.log("Geography facts:", geographyFacts);
    
    // Perform similarity search (optimized cosine similarity)
    const similarCities = await this.vectorMemory.similaritySearch(
      [0.15, 0.25, 0.35, 0.45], // Query vector
      3, // Limit to 3 results
      0.7 // Minimum similarity threshold
    );
    console.log("Similar cities:", similarCities);
    
    // Get performance metrics
    const memoryMetrics = this.contextualMemory.getMetrics();
    console.log("Memory performance:", memoryMetrics);
    
    return "Information retrieved";
  }
}

const flow = new MemoryEnabledFlow();
await flow.execute();
```

### Performance Metrics and Monitoring

The Flow system includes built-in performance monitoring capabilities:

```typescript
import { Flow, start, listen, FlowMemoryConnector } from 'crewai-ts/flow';

class MonitoredFlow extends Flow {
  private memory: FlowMemoryConnector;
  
  constructor() {
    super();
    this.memory = new FlowMemoryConnector();
  }
  
  @start()
  async runOperations() {
    // Perform some operations
    for (let i = 0; i < 10; i++) {
      await this.memory.persistFlowState(this, 'updated');
    }
    
    // Get performance metrics
    const metrics = this.memory.getPerformanceMetrics();
    console.log("Performance Metrics:");
    console.log(`- Cache Hits: ${metrics.cacheHits}`);
    console.log(`- Cache Misses: ${metrics.cacheMisses}`);
    console.log(`- Average Query Time: ${metrics.averageQueryTimeMs.toFixed(2)}ms`);
    console.log(`- Total Queries: ${metrics.totalQueries}`);
    
    return metrics;
  }
}

const flow = new MonitoredFlow();
await flow.execute();
```

## Visualizing Flows

CrewAI TypeScript provides a way to visualize your flows to better understand their structure and execution paths:

```typescript
import { Flow, start, listen, plotFlow } from 'crewai-ts/flow';

class VisualizableFlow extends Flow {
  @start()
  async firstStep() {
    return "Step 1 completed";
  }
  
  @listen("firstStep")
  async secondStep() {
    return "Step 2 completed";
  }
  
  @listen("secondStep")
  async finalStep() {
    return "Flow completed";
  }
}

// Generate an HTML visualization of the flow
const flow = new VisualizableFlow();
plotFlow(flow, "my_flow_visualization");
// This creates my_flow_visualization.html that you can open in a browser
```

The visualization shows:

- All flow methods and their connections
- Start methods highlighted in green
- Listener relationships with directed arrows
- Router methods with their potential paths

## Command Line Interface

The CrewAI TypeScript package includes a command-line interface (CLI) for working with flows:

```bash
# Create a new flow project
npx crewai-ts create flow my-flow-project

# Run a flow
npx crewai-ts flow run

# Generate a flow visualization
npx crewai-ts flow plot
```

## Python Compatibility

The TypeScript implementation is fully compatible with the Python crewAI API, with aliases provided for Python-style method names:

```typescript
// Python-style decorators (PascalCase)
import { Flow, Start, Listen, Router, AND, OR } from 'crewai-ts/flow';

class PythonCompatibleFlow extends Flow {
  @Start()  // Equivalent to @start()
  async beginFlow() {
    return "Flow started";
  }
  
  @Listen("beginFlow")  // Equivalent to @listen("beginFlow")
  async processData() {
    return "Data processed";
  }
  
  @Router("processData")  // Equivalent to @router("processData")
  async routeResult() {
    return Math.random() > 0.5 ? "success" : "failure";
  }
  
  @Listen(OR("success", "failure"))  // Equivalent to or_("success", "failure")
  async logResult(result: string) {
    console.log(`Result: ${result}`);
  }
}
```

This dual API style allows developers familiar with the Python implementation to easily transition to TypeScript while maintaining code readability.
