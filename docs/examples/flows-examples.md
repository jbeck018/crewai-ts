---
layout: default
---

# Creating Optimized Flows in CrewAI TypeScript

This guide provides practical examples for building memory-efficient and performant flows in CrewAI TypeScript, with a focus on the optimizations implemented in the TypeScript version.

## Introduction to Flows

CrewAI Flows is a powerful feature designed to streamline the creation and management of AI workflows. Flows allow you to combine and coordinate tasks and Crews efficiently, with the TypeScript implementation offering significant memory and performance optimizations over the Python version.

## Key Advantages of TypeScript Flows

1. **Memory-Efficient State Management**: Optimized state handling with specialized data structures and incremental updates
2. **Event-Driven Architecture**: Responsive workflows with minimal overhead
3. **Flexible Control Flow**: Conditional logic and branching with optimized execution paths
4. **TypeScript Type Safety**: Enhanced reliability with compile-time type checking
5. **Performance Optimizations**: Specialized data structures and lazy loading for improved resource usage

## Basic Flow Example

```typescript
import { Flow, listen, start } from 'crewai-ts/flow';
import { OpenAIChat } from 'crewai-ts/llm';

class ExampleFlow extends Flow {
  // Use lazy loading for LLM client to reduce initial memory footprint
  private llm = new OpenAIChat({
    model: 'gpt-4o-mini',
    // Enable tokenization caching to reduce overhead
    cacheTokenCounts: true
  });

  // Starting point of the flow
  @start()
  async generateCity() {
    console.log("Starting flow");
    // Each flow state gets a unique ID
    console.log(`Flow State ID: ${this.state['id']}`);

    // Memory-efficient completion call with optimal parameters
    const response = await this.llm.complete({
      messages: [
        {
          role: "user",
          content: "Return the name of a random city in the world."
        }
      ],
      // Minimize token usage with appropriate constraints
      maxTokens: 20,
      temperature: 0.7
    });

    const randomCity = response.content;
    // Store the city in our state - only store what's needed
    this.state["city"] = randomCity;
    console.log(`Random City: ${randomCity}`);

    return randomCity;
  }

  // Listen for the result of generateCity
  @listen(function(this: ExampleFlow) { return this.generateCity; })
  async generateFunFact(randomCity: string) {
    // Memory-efficient completion call
    const response = await this.llm.complete({
      messages: [
        {
          role: "user",
          content: `Tell me a fun fact about ${randomCity}`
        }
      ],
      // Prevent unnecessary token usage
      maxTokens: 100
    });

    const funFact = response.content;
    // Store fun fact in state
    this.state["funFact"] = funFact;
    return funFact;
  }
}

// Initialize flow with memory-efficient options
const flow = new ExampleFlow({
  // Use memory-efficient state management
  stateOptions: {
    // Use incremental state updates to minimize memory usage
    useIncrementalUpdates: true,
    // Only persist necessary state fields
    persistentFields: ['city', 'funFact']
  }
});

// Execute the flow
const result = await flow.kickoff();
console.log(`Generated fun fact: ${result}`);
```

## Flow with Optimized Knowledge Integration

This example demonstrates how to use memory-optimized knowledge embeddings in flows:

```typescript
import { Flow, listen, start } from 'crewai-ts/flow';
import { OpenAIEmbeddings } from 'crewai-ts/embeddings';
import { StringKnowledgeSource } from 'crewai-ts/knowledge';
import { OpenAIChat } from 'crewai-ts/llm';

class KnowledgeFlow extends Flow {
  private llm = new OpenAIChat({ model: 'gpt-4o' });
  
  // Create optimized embeddings with memory-efficient configuration
  private embeddings = new OpenAIEmbeddings({
    // Use caching to reduce duplicate embedding calls
    cache: true,
    // Use Float32Array for memory-efficient vector storage
    useFloat32Array: true,
    // Implement smart batching for efficient API usage
    batchSize: 20
  });
  
  // Knowledge sources with memory optimizations
  private knowledgeSources = [
    new StringKnowledgeSource({
      content: 'Tokyo is the capital of Japan and the world\'s most populous metropolitan area.',
      metadata: { topic: 'geography', region: 'asia' },
      // Enable optimized chunking for better memory usage
      useOptimizedChunking: true
    }),
    new StringKnowledgeSource({
      content: 'Paris is the capital of France, known for the Eiffel Tower and Louvre Museum.',
      metadata: { topic: 'geography', region: 'europe' },
      useOptimizedChunking: true
    })
  ];

  @start()
  async searchKnowledge() {
    const query = this.state.query || 'Tell me about Tokyo';
    console.log(`Searching knowledge for: ${query}`);
    
    // Perform memory-efficient knowledge search
    const results = await this.embeddings.search({
      query,
      sources: this.knowledgeSources,
      // Limit results to reduce memory usage
      limit: 3,
      // Use metadata filtering for more targeted results
      filter: { topic: 'geography' }
    });
    
    // Store only necessary information in state
    this.state.searchResults = results.map(result => ({
      content: result.content,
      score: result.score,
      // Exclude heavy metadata from state to reduce memory footprint
      source: result.source.id
    }));
    
    return results;
  }

  @listen(function(this: KnowledgeFlow) { return this.searchKnowledge; })
  async generateResponse(results: any[]) {
    // Format search results for the LLM in a memory-efficient way
    const contextText = results
      .map(r => r.content)
      .join('\n\n');
    
    // Generate a response based on search results
    const response = await this.llm.complete({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Use the following information to answer questions.'
        },
        {
          role: 'user',
          content: `Based on this information:\n${contextText}\n\nProvide a concise summary.`
        }
      ],
      // Optimize token usage
      maxTokens: 150
    });
    
    this.state.response = response.content;
    return response.content;
  }
}

// Create and execute flow with memory optimizations
const flow = new KnowledgeFlow({
  // Initialize with query
  initialState: { query: 'Tell me about Tokyo' },
  // Configure memory-efficient event handling
  eventHandling: {
    // Process events in batches to reduce overhead
    batchEvents: true,
    // Prioritize critical path execution
    useCriticalPathOptimization: true
  }
});

const result = await flow.kickoff();
console.log(`Generated response: ${result}`);
```

## Flow with Crew Integration and Memory Optimization

```typescript
import { Flow, listen, start } from 'crewai-ts/flow';
import { Crew, Agent, Task, Process } from 'crewai-ts';
import { MemoryManager, MemoryType } from 'crewai-ts/memory';

class ResearchFlow extends Flow {
  // Memory manager with optimized configuration
  private memoryManager = MemoryManager.getInstance({
    // Use tiered storage for efficient memory management
    useTieredStorage: true,
    // Enable content deduplication
    deduplicateContent: true,
    // Configure memory expiration
    shortTermExpirationMs: 30 * 60 * 1000 // 30 minutes
  });

  @start()
  async setupCrew() {
    const topic = this.state.topic || 'AI Advancements';
    console.log(`Setting up research crew for: ${topic}`);
    
    // Create memory-efficient agents
    const researcherAgent = new Agent({
      role: 'Research Specialist',
      goal: `Find the latest information about ${topic}`,
      verbose: false,
      // Use minimal memory configuration
      memory: true,
      cache: true
    });
    
    const writerAgent = new Agent({
      role: 'Technical Writer',
      goal: `Create a comprehensive summary about ${topic}`,
      verbose: false,
      memory: true,
      cache: true
    });
    
    // Create optimized tasks
    const researchTask = new Task({
      description: `Research the latest developments in ${topic}`,
      agent: researcherAgent,
      // Set expected output format for better type handling
      expectedOutput: 'JSON research findings with key points'
    });
    
    const writingTask = new Task({
      description: `Create a comprehensive report about ${topic} based on research findings`,
      agent: writerAgent,
      // Use context from research task
      contextFrom: [researchTask]
    });
    
    // Create memory-optimized crew
    const crew = new Crew({
      agents: [researcherAgent, writerAgent],
      tasks: [researchTask, writingTask],
      process: Process.Sequential,
      verbose: false,
      // Enable memory with optimization settings
      memory: true,
      // Configure memory for efficiency
      memoryConfig: {
        // Share memory between agents where possible
        useSharedMemory: true,
        // Enable memory compression
        enableCompression: true
      }
    });
    
    // Store crew in state (reference only, not full clone)
    this.state.crew = { id: crew.id };
    
    return crew;
  }

  @listen(function(this: ResearchFlow) { return this.setupCrew; })
  async executeCrew(crew: Crew) {
    console.log('Executing research crew...');
    
    // Execute crew with memory-efficient options
    const result = await crew.kickoff({
      // Pass only necessary input data
      inputs: { topic: this.state.topic },
      // Configure execution for memory efficiency
      options: {
        // Use progressive cleanup to free resources as tasks complete
        progressiveCleanup: true,
        // Only track essential metrics
        minimizeMetricsCollection: true
      }
    });
    
    // Store minimal result in state
    this.state.result = {
      summary: result,
      completed: true,
      timestamp: Date.now()
    };
    
    // Store result in long-term memory for future reference
    await this.memoryManager.store(MemoryType.LONG_TERM, {
      content: result,
      metadata: {
        topic: this.state.topic,
        flowId: this.state.id,
        type: 'research_result'
      }
    });
    
    return result;
  }
}

// Create and execute flow
const flow = new ResearchFlow({
  // Initialize with topic
  initialState: { topic: 'Quantum Computing' },
  // Use memory-efficient state persistence
  persistence: {
    // Use incremental state updates
    useIncrementalUpdates: true,
    // Automatically clean up completed flows
    cleanupCompletedFlows: true,
    // Batch persistence operations
    batchWrites: true
  }
});

const result = await flow.kickoff();
console.log(`Research complete: ${result}`);
```

## Advanced Memory Optimizations for Flows

### Event-Driven Memory Management

```typescript
import { Flow, listen, start, onStateChange } from 'crewai-ts/flow';

class OptimizedFlow extends Flow {
  @start()
  async beginProcess() {
    this.state.startTime = Date.now();
    console.log('Starting optimized flow');
    
    // Initialize with minimal state
    return { initialized: true };
  }
  
  // Listen for state changes and perform memory cleanup
  @onStateChange(['largeDataField'])
  async handleLargeDataChange() {
    // When large data is added to state, perform optimization
    if (this.state.largeDataField && this.state.largeDataField.length > 10000) {
      console.log('Optimizing large data...');
      
      // Compress large data to reduce memory footprint
      this.state.largeDataField = await this.compressData(this.state.largeDataField);
      
      // Set cleanup flag for garbage collection hints
      this.state.pendingCleanup = false;
    }
  }
  
  // Helper method for data compression
  private async compressData(data: string): Promise<string> {
    // Implementation would use efficient compression algorithm
    // For example, using a streaming compression approach
    return `compressed:${data.substring(0, 100)}...`;
  }
  
  @listen(function(this: OptimizedFlow) { return this.beginProcess; })
  async processData(initResult: any) {
    // Simulate processing with memory-efficient approach
    this.state.largeDataField = 'A'.repeat(20000); // Simulated large data
    
    // Mark for pending cleanup to trigger the state change handler
    this.state.pendingCleanup = true;
    
    // Return minimized result
    return {
      processed: true,
      dataSize: this.state.largeDataField.length,
      timestamp: Date.now() - this.state.startTime
    };
  }
}
```

### Using Specialized Memory-Efficient Embeddings

The TypeScript implementation includes highly optimized embeddings for knowledge retrieval:

```typescript
import { Flow, listen, start } from 'crewai-ts/flow';
import { OpenAIEmbeddings, CohereEmbeddings, HuggingFaceEmbeddings, FastEmbeddings } from 'crewai-ts/embeddings';

class EmbeddingOptimizedFlow extends Flow {
  // Choose the most efficient embedder for your use case
  private selectEmbedder(type: string) {
    // Common memory optimizations applied to all embedders
    const commonOptions = {
      cache: true,
      useFloat32Array: true, // More memory-efficient than Float64Array
      batchSize: 20
    };
    
    switch (type) {
      case 'openai':
        return new OpenAIEmbeddings({
          ...commonOptions,
          // OpenAI-specific optimizations
          dimensions: 1536, // Explicitly set dimensions to optimize memory allocation
          model: 'text-embedding-3-small' // More efficient model
        });
        
      case 'cohere':
        return new CohereEmbeddings({
          ...commonOptions,
          // Cohere-specific optimizations
          model: 'embed-english-light-v2.0' // More efficient model
        });
        
      case 'huggingface':
        return new HuggingFaceEmbeddings({
          ...commonOptions,
          // HuggingFace-specific optimizations
          useQuantization: true, // Reduce memory footprint with quantized models
          useLocal: true // Use local model when possible to reduce API calls
        });
        
      case 'fast':
        return new FastEmbeddings({
          ...commonOptions,
          // FastEmbed-specific optimizations
          dimensions: 384, // Smaller, more efficient embeddings
          normalizeVectors: true // Normalize vectors for better performance
        });
        
      default:
        return new OpenAIEmbeddings(commonOptions);
    }
  }
  
  @start()
  async embedText() {
    const embeddingType = this.state.embeddingType || 'openai';
    const embedder = this.selectEmbedder(embeddingType);
    
    const text = this.state.text || 'Sample text for embedding';
    console.log(`Embedding text using ${embeddingType} embedder`);
    
    // Create memory-efficient embeddings
    const embedding = await embedder.embedText(text);
    
    // Store minimal information in state
    this.state.embeddingInfo = {
      type: embeddingType,
      dimensions: embedding.length,
      timestamp: Date.now()
    };
    
    // Only store the embedding if needed for future steps
    if (this.state.preserveEmbedding) {
      this.state.embedding = embedding;
    }
    
    return embedding;
  }
}
```

## Performance Best Practices

1. **Minimize State Size**: Only store essential data in flow state
2. **Use Incremental Updates**: Update state incrementally rather than replacing entire objects
3. **Implement Memory Cleanup**: Release resources when they're no longer needed
4. **Optimize Embeddings**: Use appropriate embedding models and efficient data structures
5. **Batch Operations**: Group similar operations to reduce overhead
6. **Use Tiered Storage**: Implement hot/warm/cold storage patterns for different data access patterns
7. **Enable Content Deduplication**: Use content hashing to avoid storing duplicate information
8. **Monitor Resource Usage**: Track memory and token usage to identify bottlenecks

By applying these practices and leveraging the optimized TypeScript implementation, you can create high-performance flows that efficiently manage resources while delivering powerful AI workflows.
