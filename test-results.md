$ vitest run
 Vitest  "cache.dir" is deprecated, use Vite's "cacheDir" instead if you want to change the cache director. Note caches will be written to "cacheDir/vitest"

 RUN  v3.1.1 /Users/jacob/projects/crewai-ts

 ❯ tests/tools/ai/DallETool.test.ts (12 tests | 5 failed) 119ms
   ✓ DallETool > Tool Creation > should create a tool with default options 1ms
   ✓ DallETool > Tool Creation > should create a tool with custom API key 0ms
   ✓ DallETool > Tool Creation > should create a tool with custom base URL 0ms
   ✓ DallETool > Tool Creation > should create a tool with custom organization 0ms
   ✓ DallETool > Tool Creation > should create a tool with caching disabled 0ms
   ✓ DallETool > Tool Execution > should generate images successfully 2ms
   × DallETool > Tool Execution > should handle API errors gracefully 8ms
     → expected [ { …(2) } ] to deeply equal []
   × DallETool > Tool Execution > should save images locally when requested 2ms
     → expected "spy" to be called with arguments: [ Array(2) ]

Received: 

  1st spy call:

  [
-   "./test-images",
+   "dalle-images",
    {
      "recursive": true,
    },
  ]


Number of calls: 1

   × DallETool > Tool Execution > should use cache for repeated requests 1ms
     → expected "spy" to not be called at all, but actually been called 1 times

Received: 

  1st spy call:

    Array [
      "https://api.openai.com/v1/images/generations",
      Object {
        "body": "{"prompt":"Generate a sunset over mountains","model":"dall-e-3","n":1,"quality":"standard","size":"1024x1024","style":"vivid","response_format":"url"}",
        "headers": Object {
          "Authorization": "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        "method": "POST",
      },
    ]


Number of calls: 1

   × DallETool > Tool Execution > should retry on transient errors 1ms
     → expected "spy" to be called 2 times, but got 1 times
   × DallETool > Tool Execution > should not retry on authentication errors 1ms
     → expected [ { …(2) } ] to deeply equal []
   ✓ DallETool > Memory Efficiency > should clear expired cache entries 102ms
 ✓ tests/llm/providers/AnthropicLLM.test.ts (13 tests | 3 skipped) 77ms
 ❯ tests/tools/ai/VisionTool.test.ts (13 tests | 6 failed) 118ms
   ✓ VisionTool > Tool Creation > should create a tool with default options 1ms
   ✓ VisionTool > Tool Creation > should create a tool with custom API key 0ms
   ✓ VisionTool > Tool Creation > should create a tool with custom base URL 0ms
   ✓ VisionTool > Tool Creation > should create a tool with custom organization 0ms
   ✓ VisionTool > Tool Creation > should create a tool with caching disabled 0ms
   × VisionTool > Tool Execution > should analyze image by URL successfully 10ms
     → expected 'This image shows a scenic mountain la…' to be 'This image shows a scenic mountain la…' // Object.is equality
   × VisionTool > Tool Execution > should handle base64 image data 1ms
     → expected '' to be 'This is a diagram showing a flowchart.' // Object.is equality
   × VisionTool > Tool Execution > should read image from file path 1ms
     → expected 'This appears to be a document with te…' to be 'This appears to be a document with te…' // Object.is equality
   × VisionTool > Tool Execution > should handle API errors gracefully 1ms
     → expected 'This image shows a scenic mountain la…' to be '' // Object.is equality
   × VisionTool > Tool Execution > should handle file read errors gracefully 1ms
     → expected 'This appears to be a document with te…' to be '' // Object.is equality
   × VisionTool > Tool Execution > should use cache for repeated requests 0ms
     → expected 'This image shows a scenic mountain la…' to be 'This image shows a scenic mountain la…' // Object.is equality
   ✓ VisionTool > Memory Efficiency > should clear expired cache entries 102ms
   ✓ VisionTool > Memory Efficiency > should handle structured response format 1ms
 ❯ tests/tools/extension/CustomToolFactory.test.ts (14 tests | 14 failed) 17ms
   × CustomToolFactory > Tool Creation > should create a custom tool with required properties 9ms
     → expected 'undefined' to be 'function' // Object.is equality
   × CustomToolFactory > Tool Execution > should execute custom tool logic correctly 1ms
     → typedTool.call is not a function
   × CustomToolFactory > Tool Execution > should validate input with schema 1ms
     → tool.call is not a function
   × CustomToolFactory > Error Handling > should use custom error handler when provided 1ms
     → tool.call is not a function
   × CustomToolFactory > Error Handling > should propagate errors when no handler is provided 0ms
     → tool.call is not a function
   × CustomToolFactory > Caching > should cache results when enabled 0ms
     → tool.call is not a function
   × CustomToolFactory > Caching > should respect cache TTL 0ms
     → tool.call is not a function
   × CustomToolFactory > Caching > should use custom key generator when provided 0ms
     → tool.call is not a function
   × CustomToolFactory > Retry Mechanism > should retry on failures when configured 1ms
     → tool.call is not a function
   × CustomToolFactory > Retry Mechanism > should respect maxRetries limit 2ms
     → tool.call is not a function
   × CustomToolFactory > Retry Mechanism > should use isRetryable function to determine if retry is needed 0ms
     → tool.call is not a function
   × CustomToolFactory > Performance Tracking > should track performance metrics when enabled 0ms
     → tool.call is not a function
   × CustomToolFactory > Performance Tracking > should track memory usage when enabled and available 1ms
     → tool.call is not a function
   × CustomToolFactory > Memory Efficiency > should efficiently handle LRU cache eviction 0ms
     → tool.call is not a function
 ❯ tests/llm/LLMIntegration.test.ts (5 tests | 1 failed) 77ms
   ✓ LLM Integration > LLM with TaskOutputFormatter > should efficiently convert LLM output to structured data 2ms
   × LLM Integration > LLM with TaskOutputFormatter > should handle streaming output with minimal memory overhead 69ms
     → expected 2.0636174218023084 to be less than 1.5
   ✓ LLM Integration > Provider-specific optimizations > should efficiently format OpenAI responses for task output 3ms
   ✓ LLM Integration > Provider-specific optimizations > should efficiently format Anthropic responses for task output 1ms
   ✓ LLM Integration > Cache optimization benchmarks > should demonstrate significant performance improvement with caching 1ms
 ❯ tests/llm/providers/OllamaLLM.test.ts (13 tests | 1 failed) 24ms
   ✓ OllamaLLM > complete > should return correct completion response 2ms
   ✓ OllamaLLM > complete > should handle system messages correctly 0ms
   ✓ OllamaLLM > complete > should use cache for identical requests 0ms
   ✓ OllamaLLM > complete > should handle errors gracefully 1ms
   ✓ OllamaLLM > complete > should handle complex message conversion correctly 1ms
   ✓ OllamaLLM > completeStreaming > should handle streaming responses correctly 5ms
   ✓ OllamaLLM > completeStreaming > should handle streaming errors properly 0ms
   ✓ OllamaLLM > countTokens > should estimate tokens with reasonable accuracy 0ms
   ✓ OllamaLLM > countTokens > should handle longer text efficiently 0ms
   ✓ OllamaLLM > performance optimizations > should track token usage across requests 0ms
   ✓ OllamaLLM > performance optimizations > should maintain accurate request count 0ms
   ✓ OllamaLLM > performance optimizations > should clear cache when requested 0ms
   × OllamaLLM > performance optimizations > should handle retries with optimized backoff 12ms
     → expected "fetch" to be called 2 times, but got 0 times
stderr | tests/flow/memory/FlowMemoryConnector.test.ts
Function conditions work differently between Python and TypeScript implementations. For maximum compatibility, use string or object conditions.
Function conditions work differently between Python and TypeScript implementations. For maximum compatibility, use string or object conditions.

 ✓ tests/llm/providers/OpenAILLM.test.ts (10 tests | 1 skipped) 74ms
 ✓ tests/agent/builder/BaseAgentBuilder.test.ts (6 tests) 4ms
 ✓ tests/memory/LongTermMemory.test.ts (14 tests) 41ms
 ❯ tests/tools/extension/SampleCustomTool.test.ts (9 tests | 8 failed) 7ms
   ✓ SampleCustomTool - Translation Tool > Tool Creation and Basic Functionality > should create a translation tool with proper structure 1ms
   × SampleCustomTool - Translation Tool > Tool Creation and Basic Functionality > should translate text to Spanish 3ms
     → Cannot read properties of undefined (reading 'call')
   × SampleCustomTool - Translation Tool > Tool Creation and Basic Functionality > should translate text to French 0ms
     → Cannot read properties of undefined (reading 'call')
   × SampleCustomTool - Translation Tool > Tool Creation and Basic Functionality > should translate text to German 0ms
     → Cannot read properties of undefined (reading 'call')
   × SampleCustomTool - Translation Tool > Tool Creation and Basic Functionality > should handle unsupported languages gracefully 0ms
     → Cannot read properties of undefined (reading 'call')
   × SampleCustomTool - Translation Tool > Performance and Optimization Features > should use cache for repeated translations 0ms
     → Cannot read properties of undefined (reading 'call')
   × SampleCustomTool - Translation Tool > Performance and Optimization Features > should track performance metrics 0ms
     → Cannot read properties of undefined (reading 'call')
   × SampleCustomTool - Translation Tool > Performance and Optimization Features > should handle network errors gracefully 0ms
     → Cannot read properties of undefined (reading 'call')
   × SampleCustomTool - Translation Tool > Performance and Optimization Features > should process complex text with memory optimizations 0ms
     → Cannot read properties of undefined (reading 'call')
 ❯ tests/memory/EntityMemory.test.ts (11 tests | 11 failed) 40ms
   × EntityMemory > should create an entity memory with default options 5ms
     → mockEntityRecognizer.mockClear is not a function
   × EntityMemory > should create an entity memory with custom options 1ms
     → mockEntityRecognizer.mockClear is not a function
   × EntityMemory > should add and retrieve entities 12ms
     → mockEntityRecognizer.mockClear is not a function
   × EntityMemory > should update existing entities 1ms
     → mockEntityRecognizer.mockClear is not a function
   × EntityMemory > should add relationships between entities 1ms
     → mockEntityRecognizer.mockClear is not a function
   × EntityMemory > should extract entities from text 2ms
     → [Function] is not a spy or a call to a spy!
     → mockEntityRecognizer.mockClear is not a function
   × EntityMemory > should search for memories by entity 1ms
     → mockEntityRecognizer.mockClear is not a function
   × EntityMemory > should remove entities 0ms
     → mockEntityRecognizer.mockClear is not a function
   × EntityMemory > should clear all entities 16ms
     → mockEntityRecognizer.mockClear is not a function
   × EntityMemory > should handle case-insensitive entity names 0ms
     → mockEntityRecognizer.mockClear is not a function
   × EntityMemory > should respect entity memory capacity limit 0ms
     → mockEntityRecognizer.mockClear is not a function
stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should query a single short string source
Initializing knowledge storage with collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should query a single short string source
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should query a single short string source
Knowledge storage reset for collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should query multiple short string sources
Initializing knowledge storage with collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should query multiple short string sources
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should query multiple short string sources
Knowledge storage reset for collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should query a longer text source
Initializing knowledge storage with collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should query a longer text source
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should query a longer text source
Knowledge storage reset for collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should respect result limit
Initializing knowledge storage with collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should respect result limit
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should respect result limit
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should respect result limit
Knowledge storage reset for collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should apply metadata filters
Initializing knowledge storage with collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should apply metadata filters
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should apply metadata filters
Knowledge storage reset for collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should handle city queries
Initializing knowledge storage with collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should handle city queries
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should handle city queries
Knowledge storage reset for collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should handle sports interest queries
Initializing knowledge storage with collection: test-knowledge

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should handle sports interest queries
Knowledge batch processing: Added 1 unique chunks out of 1 total (0 duplicates removed)

stdout | tests/knowledge/Knowledge.test.ts > Knowledge Integration > should handle sports interest queries
Knowledge storage reset for collection: test-knowledge

 ✓ tests/knowledge/Knowledge.test.ts (7 tests) 10ms
 ✓ tests/memory/ContextualMemory.test.ts (6 tests) 59ms
 ✓ tests/memory/MemoryEmbeddings.test.ts (6 tests) 5ms
 ✓ tests/agent/builder/AgentBuilder.test.ts (7 tests) 4ms
 ✓ tests/agent/LiteAgent.test.ts (9 tests) 6ms
 ✓ tests/security/SecurityConfig.test.ts (12 tests) 7ms
 ✓ tests/agent/parser/AgentParser.test.ts (20 tests) 13ms
 ✓ tests/task/TaskOutputIntegration.test.ts (2 tests) 6ms
 ❯ tests/task/Task.test.ts (8 tests | 1 failed) 115ms
   ✓ Task > should create a task with basic properties 1ms
   ✓ Task > should have default values when not provided 1ms
   ✓ Task > toString returns a descriptive string 0ms
   ✓ Task > should initially have pending status 0ms
   × Task > should execute a task and update status 6ms
     → [AsyncFunction] is not a spy or a call to a spy!
   ✓ Task > should provide context to the agent during execution 0ms
   ✓ Task > should handle caching when enabled 0ms
   ✓ Task > should retry execution on failure 106ms
 ✓ tests/memory/MemoryIntegration.test.ts (4 tests) 4ms
 ✓ tests/crew/Crew.test.ts (9 tests) 9ms
 ✓ tests/memory/MemoryManager.test.ts (9 tests) 5ms
 ✓ tests/task/StructuredTaskOutput.test.ts (10 tests) 17ms
 ✓ tests/tools/ToolUsage.test.ts (7 tests) 3ms
 ✓ tests/agent/builder/utilities/TaskEvaluator.test.ts (5 tests) 6ms
 ❯ tests/task/TaskOutputFormatter.test.ts (12 tests | 1 failed) 152ms
   ✓ TaskOutputFormatter > ZodOutputSchema > should validate correct data 1ms
   ✓ TaskOutputFormatter > ZodOutputSchema > should throw on invalid data 1ms
   ✓ TaskOutputFormatter > ZodOutputSchema > should provide safe parsing with errors 0ms
   ✓ TaskOutputFormatter > ZodOutputSchema > should handle performance efficiently for multiple validations 8ms
   ✓ TaskOutputFormatter > InterfaceOutputSchema > should pass through data without validation in runtime 0ms
   ✓ TaskOutputFormatter > InterfaceOutputSchema > should have minimal overhead compared to ZodOutputSchema 128ms
   ✓ TaskOutputFormatter > TaskOutputFormatter > should format JSON string correctly 0ms
   ✓ TaskOutputFormatter > TaskOutputFormatter > should handle plain text with interface schema 0ms
   ✓ TaskOutputFormatter > TaskOutputFormatter > should provide safe formatting with error handling 0ms
   ✓ TaskOutputFormatter > TaskOutputFormatter > should handle invalid JSON gracefully 0ms
   × TaskOutputFormatter > TaskOutputFormatter > should create formatter with convenience function 5ms
     → Cannot find module '../../src/task/TaskOutputFormatter'
Require stack:
- /Users/jacob/projects/crewai-ts/tests/task/TaskOutputFormatter.test.ts
   ✓ TaskOutputFormatter > TaskOutputFormatter > should handle complex nested schemas 7ms
 ✓ tests/tools/cache/CacheTools.test.ts (6 tests) 5ms
 ✓ tests/project/utils.test.ts (10 tests) 5ms
 ❯ tests/agent/Agent.test.ts (5 tests | 1 failed) 6ms
   ✓ Agent > should create an agent with basic properties 1ms
   ✓ Agent > should have default values when not provided 0ms
   × Agent > should execute a task 3ms
     → [Function] is not a spy or a call to a spy!
   ✓ Agent > should handle tools during task execution 0ms
   ✓ Agent > toString should return a descriptive string 0ms
 ✓ tests/security/Fingerprint.test.ts (9 tests) 3ms
 ✓ tests/tools/StructuredTool.test.ts (13 tests) 1257ms
   ✓ StructuredTool > validates output against schema  396ms
   ✓ StructuredTool > handles execution errors properly  438ms
   ✓ StructuredTool > handles function execution errors  403ms
stdout | tests/crew/CrewMemory.test.ts > Crew Memory Management > integrates with verbose logging when enabled
Resetting long memory

 ✓ tests/crew/CrewMemory.test.ts (5 tests) 17ms
 ✓ tests/tools/BaseTool.test.ts (9 tests) 1446ms
   ✓ BaseTool > should handle execution failures gracefully  349ms
   ✓ BaseTool > should implement retries on failure  421ms
   ✓ BaseTool > should respect timeout settings  659ms

 ❯ tests/cli/commands/CreateFlowCommand.test.ts [queued]
 ❯ tests/cli/commands/PlotFlowCommand.test.ts [queued]
 ❯ tests/cli/commands/RunFlowCommand.test.ts [queued]
 ❯ tests/flow/Flow.test.ts [queued]
 ❯ tests/flow/FlowVisualizer.test.ts [queued]
 ❯ tests/flow/memory/FlowMemoryConnector.test.ts [queued]
 ❯ tests/flow/orchestration/FlowOrchestrator.test.ts [queued]
 ❯ tests/knowledge/storage/KnowledgeStorage.test.ts [queued]
 ❯ tests/memory/ShortTermMemory.test.ts [queued]
 ❯ tests/project/annotations.test.ts [queued]
 ❯ tests/project/CrewBa