---
layout: default
title: LLM Integrations
nav_order: 5
has_children: true
---

# LLM Integrations

The CrewAI TypeScript implementation supports multiple optimized LLM integrations, providing memory efficiency and performance enhancements over the Python version.

## Overview

The TypeScript LLM integrations feature:

1. **Lazy Loading** - LLM clients initialize only when first used
2. **Memory-Efficient Caching** - Token and response caching
3. **Smart Request Batching** - Optimal request handling for performance
4. **Token Management** - Efficient token usage monitoring and control
5. **Stream Processing** - Memory-efficient streaming for large responses
6. **Type Safety** - Full TypeScript type definitions for all integrations

## Supported LLM Providers

### OpenAI

```typescript
import { OpenAIChat } from 'crewai-ts/llm';

// Create a basic OpenAI client
const basicOpenAI = new OpenAIChat({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY
});

// Create a memory-optimized OpenAI client
const optimizedOpenAI = new OpenAIChat({
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  // Memory optimization options
  cacheResponses: true,           // Cache responses to reduce duplicate API calls
  cacheTokenCounts: true,         // Cache token counts to reduce tokenization overhead
  useTokenPredictor: true,        // Predict token counts for faster operation
  useResponseCompression: true,   // Compress response data in memory
  // Performance optimization options
  timeout: 60000,                 // 60-second timeout
  maxRetries: 3,                  // Automatic retries with exponential backoff
  concurrencyLimit: 5,            // Limit concurrent requests
  // Advanced options
  contextWindow: 128000,          // Explicitly set context window size
  useJsonMode: true,              // Enable JSON mode for structured output
  chunkSize: 4000,                // Chunk large requests for better reliability
  streamingChunkSize: 1000        // Process stream in manageable chunks
});

// Complete a request with memory optimizations
async function completeWithOpenAI() {
  const response = await optimizedOpenAI.complete({
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant.'
      },
      {
        role: 'user',
        content: 'What are the key features of TypeScript?'
      }
    ],
    // Memory-efficient parameters
    maxTokens: 500,            // Limit response size
    temperature: 0.7,          // Balance creativity and determinism
    // Optimize token usage
    stopSequences: ['\n\n'],   // Stop on double newline
    // Request options
    requestId: 'typescript-features-query', // For deduplication
    enableCache: true,         // Use cache for this request
    enableStreaming: false     // Disable streaming for this request
  });
  
  return response.content;
}
```

### Anthropic

```typescript
import { AnthropicLLM } from 'crewai-ts/llm';

// Create a memory-optimized Anthropic client
const anthropic = new AnthropicLLM({
  model: 'claude-3-opus-20240229',
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Memory optimization options
  cacheResponses: true,
  cacheTokenCounts: true,
  useTokenPredictor: true,
  // Performance optimization options
  timeout: 60000,
  maxRetries: 3,
  concurrencyLimit: 5,
  // Advanced options
  useResponseStreaming: true
});

// Complete a request with memory optimizations
async function completeWithAnthropic() {
  const response = await anthropic.complete({
    messages: [
      {
        role: 'user',
        content: 'Explain how memory optimization works in TypeScript.'
      }
    ],
    // Memory-efficient parameters
    maxTokens: 500,
    temperature: 0.7,
    // Optimize token usage
    topK: 40,
    topP: 0.9,
    // Request options
    requestId: 'memory-optimization-query',
    enableCache: true
  });
  
  return response.content;
}
```

### Ollama

```typescript
import { OllamaLLM } from 'crewai-ts/llm';

// Create a memory-optimized Ollama client for local LLM execution
const ollama = new OllamaLLM({
  model: 'llama3:8b',
  baseUrl: 'http://localhost:11434',
  // Memory optimization options
  cacheResponses: true,
  useResponseCompression: true,
  // Local model optimizations
  useQuantization: true,      // Use quantized models for lower memory footprint
  useMlock: true,             // Lock model in memory for faster inference
  numGpu: 1,                  // Use GPU acceleration
  numThread: 4,               // Limit thread count for predictable resource usage
  // Advanced options
  useResponseStreaming: true,  // Stream responses for memory efficiency
  useBatchInference: false     // Disable batch inference to reduce memory spikes
});

// Complete a request with memory optimizations
async function completeWithOllama() {
  const response = await ollama.complete({
    messages: [
      {
        role: 'user',
        content: 'How can I optimize memory usage in a Node.js application?'
      }
    ],
    // Memory-efficient parameters
    maxTokens: 500,
    temperature: 0.7,
    // Local model parameters
    stopSequences: ['</response>'],
    // Request options
    requestId: 'memory-optimization-node',
    enableCache: true
  });
  
  return response.content;
}
```

## Creating Lazy-Loaded LLM Clients

The TypeScript implementation includes specialized tools for creating lazy-loaded LLM clients to reduce initial memory footprint:

```typescript
import { createLazyLLM } from 'crewai-ts/llm';

// Create a lazy-loaded LLM that only initializes when first used
const lazyOpenAI = createLazyLLM({
  provider: 'openai',
  model: 'gpt-4-turbo',
  // Only initialize when first called
  initializeOnFirstCall: true,
  // Initialize options
  options: {
    apiKey: process.env.OPENAI_API_KEY,
    cacheResponses: true,
    cacheTokenCounts: true
  }
});

// Create a lazy-loaded Anthropic client
const lazyAnthropic = createLazyLLM({
  provider: 'anthropic',
  model: 'claude-3-haiku-20240307',
  initializeOnFirstCall: true,
  options: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    cacheResponses: true
  }
});

// Create a lazy-loaded Ollama client
const lazyOllama = createLazyLLM({
  provider: 'ollama',
  model: 'llama3:8b',
  initializeOnFirstCall: true,
  options: {
    baseUrl: 'http://localhost:11434',
    useQuantization: true
  }
});

// Use the lazy-loaded LLM - client initializes only when this is called
async function uselazyLLM() {
  const response = await lazyOpenAI.complete({
    messages: [
      { role: 'user', content: 'What is the capital of France?' }
    ],
    maxTokens: 50
  });
  
  return response.content;
}
```

## Creating a Custom LLM Integration

The TypeScript implementation makes it easy to create custom LLM integrations with memory optimizations:

```typescript
import { BaseLLM, CompletionOptions, CompletionResponse } from 'crewai-ts/llm';

class CustomLLM extends BaseLLM {
  private apiKey: string;
  private cache: Map<string, CompletionResponse>;
  
  constructor(options: {
    apiKey: string;
    useCache?: boolean;
  }) {
    super();
    this.apiKey = options.apiKey;
    
    // Initialize memory-efficient cache
    if (options.useCache) {
      this.cache = new Map();
      // Set up cache expiration to prevent unbounded growth
      setInterval(() => this.cleanCache(), 30 * 60 * 1000); // Clean every 30 minutes
    }
  }
  
  async complete(options: CompletionOptions): Promise<CompletionResponse> {
    // Generate cache key from request parameters
    const cacheKey = this.generateCacheKey(options);
    
    // Check cache first if enabled
    if (this.cache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    try {
      // Implement custom LLM API call with memory-efficient handling
      const response = await this.callCustomLLMAPI(options);
      
      // Cache result if cache is enabled
      if (this.cache) {
        this.cache.set(cacheKey, response);
      }
      
      return response;
    } catch (error) {
      // Implement retry logic for resilience
      if (this.shouldRetry(error)) {
        return this.retryComplete(options);
      }
      throw error;
    }
  }
  
  private async callCustomLLMAPI(options: CompletionOptions): Promise<CompletionResponse> {
    // Implement custom API call logic here
    // This is just a placeholder implementation
    return {
      content: 'Response from custom LLM',
      tokenUsage: {
        total: 10,
        prompt: 5,
        completion: 5
      }
    };
  }
  
  private generateCacheKey(options: CompletionOptions): string {
    // Create a deterministic cache key from options
    // This is a simple implementation - consider a more efficient approach for production
    return JSON.stringify({
      messages: options.messages,
      maxTokens: options.maxTokens,
      temperature: options.temperature
    });
  }
  
  private cleanCache(): void {
    // Prevent unbounded cache growth by implementing cache cleanup
    if (this.cache && this.cache.size > 1000) {
      // Simple approach: clear half the cache when it gets too large
      // For production, consider a proper LRU implementation
      const entries = Array.from(this.cache.entries());
      const toRemove = entries.slice(0, entries.length / 2);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }
  
  private shouldRetry(error: any): boolean {
    // Determine if we should retry based on error type
    return error.status === 429 || error.status >= 500;
  }
  
  private async retryComplete(options: CompletionOptions, attempt = 1): Promise<CompletionResponse> {
    // Implement exponential backoff
    const delay = 1000 * Math.pow(2, attempt - 1);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      return await this.callCustomLLMAPI(options);
    } catch (error) {
      if (attempt < 3 && this.shouldRetry(error)) {
        return this.retryComplete(options, attempt + 1);
      }
      throw error;
    }
  }
}

// Usage example
const customLLM = new CustomLLM({
  apiKey: 'your-api-key',
  useCache: true
});

async function completeWithCustomLLM() {
  const response = await customLLM.complete({
    messages: [
      { role: 'user', content: 'What is the capital of France?' }
    ],
    maxTokens: 50
  });
  
  return response.content;
}
```

## Performance Best Practices

For optimal LLM integration performance with minimal memory usage:

1. **Use Lazy Loading**: Initialize LLM clients only when needed
2. **Enable Response Caching**: Cache responses to avoid duplicate API calls
3. **Use Token Prediction**: Estimate token counts to reduce tokenization overhead
4. **Set Appropriate Timeouts**: Configure timeouts to prevent hanging requests
5. **Implement Retry Logic**: Use exponential backoff for resilient operations
6. **Limit Concurrent Requests**: Control the number of simultaneous API calls
7. **Use Streaming for Large Responses**: Process large responses as streams
8. **Implement Response Compression**: Compress response data in memory
9. **Monitor Token Usage**: Track token consumption to optimize prompts
10. **Use LocalBatch for Bulk Operations**: Process multiple requests efficiently

By implementing these optimization techniques, you can create highly efficient LLM integrations that minimize memory usage and maximize performance in your CrewAI TypeScript applications.
