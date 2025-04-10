# Flow System API Guide

## Overview

The Flow System is a powerful event-driven execution framework that enables complex workflow orchestration with performance optimizations. Designed for extensibility and type safety, it provides a declarative approach to defining execution paths through method decorators.

## Core Components

### Flow

The `Flow` class is the central component that manages the execution lifecycle, event propagation, and state management.

```typescript
import { Flow, FlowState } from 'crewai-ts/flow';

// Create a custom state for your specific flow
class MyFlowState extends FlowState {
  // Add your custom state properties
  results: string[] = [];
  metrics: Record<string, number> = {};
}

// Define your flow class
class ProcessingFlow extends Flow<MyFlowState> {
  constructor() {
    super({
      initialState: new MyFlowState(),
      // Optional performance configurations
      cacheResults: true,    // Enable caching of method results
      cacheTTL: 60 * 1000,   // Cache time-to-live in milliseconds
      debug: false           // Enable debug logging
    });
  }
  
  // Flow methods defined with decorators...
}
```

### FlowState

The `FlowState` class represents the shared state that flows throughout the execution. Extend this class to add custom properties relevant to your specific flow.

```typescript
class AnalyticsFlowState extends FlowState {
  // Built-in properties
  id: string = uuid();               // Unique identifier
  startTime: Date = new Date();      // When flow execution started
  endTime: Date | null = null;       // When flow execution completed
  error: Error | null = null;        // Error if execution failed
  
  // Custom properties for this flow
  dataPoints: number[] = [];
  aggregatedResults: Map<string, any> = new Map();
  processingStats: {
    startTime: number;
    endTime: number;
    duration: number;
  }[] = [];
}
```

## Decorators

The Flow System provides several decorators to define execution paths and conditions.

### @start()

Marks a method as a starting point for flow execution.

```typescript
import { start } from 'crewai-ts/flow/decorators';

class DataFlow extends Flow<DataFlowState> {
  @start()
  async initialize() {
    // This will execute when the flow starts
    return CONTINUE; // Special constant that indicates execution should continue
  }
  
  // Multiple start methods will execute in parallel
  @start()
  async loadConfig() {
    // This will also execute when the flow starts
    return { config: 'loaded' };
  }
}
```

### @listen(trigger)

Marks a method to be executed when a specific trigger method completes.

```typescript
import { listen } from 'crewai-ts/flow/decorators';

class DataFlow extends Flow<DataFlowState> {
  // Listen to a specific method
  @listen('initialize')
  async processData() {
    // This will execute after 'initialize' completes
    return { data: 'processed' };
  }
  
  // Listen to any error (wildcard pattern)
  @listen('*')
  async handleError(input: any, error: Error) {
    // This will execute if any method throws an error
    this.state.error = error;
    console.error('Error in flow:', error);
    return { handled: true, error: error.message };
  }
}
```

### @router(condition)

Adds conditional routing to a method, only executing it when the condition is true.

```typescript
import { router } from 'crewai-ts/flow/decorators';

class DataFlow extends Flow<DataFlowState> {
  @listen('processData')
  @router((result) => result?.data?.quality === 'high')
  async handleHighQualityData(data: any) {
    // Only executes for high quality data
    return { processed: true, quality: 'high' };
  }
  
  @listen('processData')
  @router((result) => result?.data?.quality === 'low')
  async handleLowQualityData(data: any) {
    // Only executes for low quality data
    return { processed: true, quality: 'low' };
  }
}
```

### Complex Conditions

Use `and_()` and `or_()` for combining multiple triggers with logical operations.

```typescript
import { and_, or_ } from 'crewai-ts/flow/decorators';

class DataFlow extends Flow<DataFlowState> {
  // Executes when BOTH methods complete
  @listen(and_('fetchUserData', 'fetchSystemConfig'))
  async processCombinedData(results: any) {
    const userData = results.fetchUserData;
    const systemConfig = results.fetchSystemConfig;
    // Process both results together
    return { combined: true };
  }
  
  // Executes when EITHER method completes
  @listen(or_('normalProcess', 'fallbackProcess'))
  async finalize(result: any) {
    // Handle results from either process
    return { finalized: true };
  }
}
```

## Flow Execution

### Basic Execution

```typescript
// Create a flow instance
const flow = new DataProcessingFlow();

// Execute with optional input data
const result = await flow.execute({ initialData: 'value' });
console.log('Flow execution result:', result);

// Access final state
console.log('Execution metrics:', flow.state.metrics);
```

### Execution Control

Use `CONTINUE` and `STOP` constants to control flow execution.

```typescript
import { CONTINUE, STOP } from 'crewai-ts/flow/types';

class ControlFlow extends Flow<MyFlowState> {
  @start()
  async checkPreconditions() {
    const isValid = await validateInput();
    if (!isValid) {
      // This will stop the flow execution
      return STOP;
    }
    // Continue execution
    return CONTINUE;
  }
}
```

## Event Handling

The flow emits events that can be subscribed to for monitoring and debugging.

```typescript
const flow = new AnalyticsFlow();

// Subscribe to flow events
flow.events.on('flow_started', () => {
  console.log('Flow execution started');
});

flow.events.on('method_execution_started', (event) => {
  console.log(`Starting method: ${event.methodName}`);
});

flow.events.on('method_execution_finished', (event) => {
  console.log(`Finished method: ${event.methodName} in ${event.duration}ms`);
});

flow.events.on('flow_finished', (event) => {
  console.log(`Flow completed in ${event.duration}ms with result:`, event.result);
});

// Execute the flow
await flow.execute();
```

## Flow Visualization

### Generating Flow Diagrams

```typescript
import { plotFlow } from 'crewai-ts/flow/visualization';

// Create a flow instance
const flow = new DataProcessingFlow();

// Generate a visualization
const htmlPath = await plotFlow(
  flow,                            // Flow instance
  'data-processing-flow',          // Output filename
  './visualizations'               // Output directory
);

console.log(`Flow visualization saved to: ${htmlPath}`);
```

### Customizing Visualizations

```typescript
import { FlowVisualizer } from 'crewai-ts/flow/visualization';

// Create a custom visualizer
const visualizer = new FlowVisualizer(flow, {
  outputDir: './custom-path',
  template: './my-custom-template.html' // Optional custom template
});

// Generate with custom settings
const htmlPath = await visualizer.generateVisualization('custom-name');
```

## CLI Commands

The Flow System provides CLI commands for working with flows.

### Creating a New Flow

```bash
# Basic flow creation
npx crewai create-flow MyProcessingFlow

# With description
npx crewai create-flow DataAnalysisFlow --description "Flow for analyzing data streams"

# With custom directory
npx crewai create-flow ReportingFlow --directory "./src/reporting/flows"

# With example methods
npx crewai create-flow ExampleFlow --withExample
```

### Running a Flow

```bash
# Run a flow
npx crewai run-flow ./src/flows/MyCustomFlow.flow.ts

# With input data (as JSON)
npx crewai run-flow ./src/flows/MyCustomFlow.flow.ts --input '{"key":"value"}'

# Enable debug mode
DEBUG_FLOW=true npx crewai run-flow ./src/flows/MyCustomFlow.flow.ts
```

### Visualizing a Flow

```bash
# Generate visualization
npx crewai plot-flow ./src/flows/MyCustomFlow.flow.ts

# Custom output name
npx crewai plot-flow ./src/flows/MyCustomFlow.flow.ts --output custom-name

# Custom output directory
npx crewai plot-flow ./src/flows/MyCustomFlow.flow.ts --outDir ./visualizations

# Use cache if available
npx crewai plot-flow ./src/flows/MyCustomFlow.flow.ts --useCache

# Force refresh cache
npx crewai plot-flow ./src/flows/MyCustomFlow.flow.ts --forceRefresh
```

## Performance Optimizations

The Flow System includes several performance optimizations:

### Method Result Caching

```typescript
class OptimizedFlow extends Flow<MyFlowState> {
  constructor() {
    super({
      initialState: new MyFlowState(),
      cacheResults: true,        // Enable method result caching
      cacheTTL: 5 * 60 * 1000    // Cache TTL: 5 minutes
    });
  }
  
  @start()
  async expensiveOperation() {
    // This result will be cached
    const result = await computeExpensiveResult();
    return result;
  }
}
```

### Parallel Execution

Methods that don't depend on each other execute in parallel automatically.

```typescript
class ParallelFlow extends Flow<MyFlowState> {
  @start()
  async operation1() {
    // Executes in parallel with operation2
    return { part: 1 };
  }
  
  @start()
  async operation2() {
    // Executes in parallel with operation1
    return { part: 2 };
  }
  
  @listen(and_('operation1', 'operation2'))
  async combineResults(results: any) {
    // Executes after both operations complete
    return { combined: [results.operation1, results.operation2] };
  }
}
```

### Visualization Optimizations

- Uses WeakMap caching for node positions
- Memoizes calculation results
- Lazy-loads visualization libraries
- Batches network operations
- Uses efficient DOM manipulation

## Advanced Patterns

### Error Handling and Recovery

```typescript
class ResilientFlow extends Flow<MyFlowState> {
  @start()
  async riskyOperation() {
    try {
      const result = await performRiskyTask();
      return result;
    } catch (error) {
      // Flow will automatically propagate this error
      // to any methods listening for '*'
      throw error;
    }
  }
  
  @listen('*')
  async recoverFromError(input: any, error: Error) {
    console.error('Error in flow:', error);
    
    // Attempt recovery
    const fallbackResult = await performFallbackTask();
    
    // Continue execution with fallback result
    return fallbackResult;
  }
}
```

### Dynamic Method Execution

```typescript
class DynamicFlow extends Flow<MyFlowState> {
  @start()
  async determineExecutionPath() {
    // Dynamically decide which methods to trigger
    const analysisType = await determineAnalysisType();
    
    // Return a flag that will be used by routers
    return { analysisType };
  }
  
  @listen('determineExecutionPath')
  @router((result) => result?.analysisType === 'simple')
  async simpleAnalysis() {
    // Execute for simple analysis
    return { result: 'simple analysis complete' };
  }
  
  @listen('determineExecutionPath')
  @router((result) => result?.analysisType === 'complex')
  async complexAnalysis() {
    // Execute for complex analysis
    return { result: 'complex analysis complete' };
  }
}
```

### Integration with Agents and Crews

```typescript
import { Agent, Crew } from 'crewai-ts';

class AgentFlow extends Flow<MyFlowState> {
  constructor() {
    super({ initialState: new MyFlowState() });
  }
  
  @start()
  async initializeAgents() {
    // Create agents
    const analyst = new Agent({
      role: 'Data Analyst',
      goal: 'Analyze data efficiently',
      backstory: 'Expert in data analysis'
    });
    
    const reporter = new Agent({
      role: 'Reporter',
      goal: 'Create clear reports',
      backstory: 'Professional report writer'
    });
    
    // Store agents in state
    this.state.agents = { analyst, reporter };
    
    return CONTINUE;
  }
  
  @listen('initializeAgents')
  async createCrew() {
    // Create crew with agents
    const crew = new Crew({
      agents: Object.values(this.state.agents),
      tasks: [],
      process: 'sequential'
    });
    
    this.state.crew = crew;
    return CONTINUE;
  }
  
  @listen('createCrew')
  async executeCrew() {
    // Run the crew
    const result = await this.state.crew.kickoff();
    
    return { crewResult: result };
  }
}
```

## Best Practices

### Flow Structure

1. **Single Responsibility**: Each flow should have a clear, focused purpose.
2. **Clear Method Names**: Use descriptive method names that reflect their purpose in the flow.
3. **State Management**: Keep state properties organized and well-typed.
4. **Error Handling**: Always implement proper error handling with the `*` listener.

### Performance

1. **Minimize Dependencies**: Use `and_()` and `or_()` judiciously to avoid unnecessarily complex execution paths.
2. **Cache Expensive Operations**: Enable caching for methods with expensive computations.
3. **Batch Processing**: Process data in batches where possible to reduce memory pressure.
4. **Async Operations**: Use `Promise.all` for independent asynchronous operations within methods.

### Testing

1. **Isolated Tests**: Test flows in isolation, mocking external dependencies.
2. **State Verification**: Verify both the return values and state modifications.
3. **Event Testing**: Test that events are emitted correctly during execution.
4. **Edge Cases**: Test error conditions and recovery paths.

## Debugging

### Enabling Debug Mode

```typescript
// Enable debug in flow constructor
const flow = new MyFlow({
  initialState: new MyFlowState(),
  debug: true
});

// Or via environment variable when using CLI
DEBUG_FLOW=true npx crewai run-flow ./my-flow.flow.ts
```

### Inspecting Flow State

```typescript
await flow.execute();

// Inspect final state
console.log(JSON.stringify(flow.state, null, 2));

// Track execution time
console.log(`Execution time: ${flow.state.endTime! - flow.state.startTime}ms`);
```

### Event Debugging

```typescript
// Log all events for debugging
flow.events.on('*', (eventName, eventData) => {
  console.log(`[${eventName}]`, eventData);
});
```
