# ContextualMemory

The `ContextualMemory` component is an intelligent memory orchestration layer that combines different memory types (short-term, long-term, entity, user) to build comprehensive context for agent tasks.

## Performance Optimizations

This implementation includes several critical optimizations to ensure efficient and effective memory retrieval:

1. **Parallel Memory Retrieval**: Uses Promise.all to fetch from different memory sources simultaneously, significantly reducing context building time
2. **Intelligent Caching**: Caches frequently accessed contexts with TTL to prevent redundant retrievals
3. **Context Prioritization**: Prioritizes memory sources by relevance and importance to ensure the most valuable information is included
4. **Deduplication**: Ensures we don't present duplicate information from different memory sources
5. **Progressive Loading**: Loads high-relevance items first, with lower-relevance items added as space permits
6. **Context Length Management**: Intelligently truncates content to fit within context windows while preserving the most critical information
7. **Optimized Section Formatting**: Creates well-structured, readable context for agent consumption

## Usage

```typescript
import { ContextualMemory, ShortTermMemory, LongTermMemory, EntityMemory } from 'crewai-ts';
import { Agent, Task } from 'crewai-ts';

// Initialize memory components
const shortTermMemory = new ShortTermMemory();
const longTermMemory = new LongTermMemory();
const entityMemory = new EntityMemory();

// Create contextual memory with optimization options
const contextualMemory = new ContextualMemory(
  {
    useCache: true,               // Enable context caching
    cacheTtlMs: 5 * 60 * 1000,    // 5-minute cache TTL
    maxContextLength: 10000,      // Maximum context length
    useAsyncFetch: true,          // Enable parallel memory retrieval
    defaultSearchLimit: 5,         // Limit search results per memory type
    defaultRelevanceThreshold: 0.35, // Minimum relevance score
    
    // Optional custom formatter for context sections
    sectionFormatter: (title, items) => {
      return `## ${title} ##\n* ${items.join('\n* ')}`;
    }
  },
  shortTermMemory,
  longTermMemory,
  entityMemory
);

// Create agent and task
const agent = new Agent({
  role: 'Developer',
  goal: 'Complete programming tasks',
  backstory: 'Expert developer with years of experience'
});

const task = new Task({
  description: 'Implement a new feature',
  agent
});

// Build rich context for the task
const context = await contextualMemory.buildContextForTask(task);

// The context will contain relevant information from all memory sources
console.log(context);
```

## Optimization Details

### Parallel Memory Retrieval

The default behavior uses `Promise.all` to fetch from all memory sources simultaneously, dramatically reducing context building time compared to sequential fetching:

```typescript
// Parallel fetching (optimized)
const results = await Promise.all([
  this.fetchShortTermContext(query),
  this.fetchLongTermContext(query),
  this.fetchEntityContext(query),
  this.fetchUserContext(query)
]);
```

### Caching

Built contexts are cached using a TTL-based approach to avoid redundant processing for similar queries:

```typescript
// Check cache before building context
if (this.useCache) {
  const cachedContext = this.getCachedContext(query);
  if (cachedContext) {
    return cachedContext;
  }
}

// Cache the result after building
if (this.useCache) {
  this.cacheContext(query, combinedContext);
}
```

### Context Prioritization

When context exceeds the maximum length, content is intelligently prioritized:

```typescript
// Priority order: User > Recent > Entities > Historical
const priorityOrder = [
  'User memories/preferences:',
  'Recent Insights:',
  'Entities:',
  'Historical Data:'
];

// Sort sections by priority
sections.sort((a, b) => {
  const aIndex = priorityOrder.findIndex(prefix => a.startsWith(prefix));
  const bIndex = priorityOrder.findIndex(prefix => b.startsWith(prefix));
  
  // Sort based on priority order
  // ... [implementation details]
});
```

## Advanced Usage

### Custom Section Formatting

Customize how context sections are formatted:

```typescript
const contextualMemory = new ContextualMemory(
  {
    sectionFormatter: (title, items) => {
      return `### ${title.toUpperCase()} ###\n${items.map(item => `- ${item}`).join('\n')}`;
    }
  },
  // ... other parameters
);
```

### Sequential Fetching

For debugging or when parallel processing causes issues, sequential fetching can be enabled:

```typescript
const contextualMemory = new ContextualMemory(
  {
    useAsyncFetch: false  // Disable parallel fetching
  },
  // ... other parameters
);
```
