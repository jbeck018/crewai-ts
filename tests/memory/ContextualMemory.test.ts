import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContextualMemory } from '../../src/memory/ContextualMemory.js';
import { ShortTermMemory } from '../../src/memory/ShortTermMemory.js';
import { LongTermMemory } from '../../src/memory/LongTermMemory.js';
import { EntityMemory } from '../../src/memory/EntityMemory.js';
import { Task } from '../../src/task/Task.js';
import { Agent } from '../../src/agent/Agent.js';
import { MemoryItem, MemorySearchResult } from '../../src/memory/BaseMemory.js';

// Mock implementation of UserMemory for testing
class MockUserMemory {
  private items: MemoryItem[] = [];

  async search() {
    return {
      items: this.items,
      total: this.items.length
    } as MemorySearchResult;
  }

  setItems(items: MemoryItem[]) {
    this.items = items;
  }
}

describe('ContextualMemory', () => {
  let shortTermMemory: ShortTermMemory;
  let longTermMemory: LongTermMemory;
  let entityMemory: EntityMemory;
  let userMemory: MockUserMemory;
  let contextualMemory: ContextualMemory;
  let agent: Agent;
  let task: Task;

  beforeEach(() => {
    // Initialize memory components with mocks
    shortTermMemory = new ShortTermMemory();
    longTermMemory = new LongTermMemory();
    entityMemory = new EntityMemory();
    userMemory = new MockUserMemory();

    // Mock the search methods
    vi.spyOn(shortTermMemory, 'search').mockImplementation(() => {
      return Promise.resolve({
        items: [
          {
            id: '1',
            content: 'Recent insight about task',
            createdAt: Date.now(),
            relevanceScore: 0.8
          }
        ],
        total: 1
      });
    });

    vi.spyOn(longTermMemory, 'search').mockImplementation(() => {
      return Promise.resolve({
        items: [
          {
            id: '2',
            content: 'Historical data about similar task',
            metadata: {
              suggestions: ['Try approach A', 'Consider factor B']
            },
            createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
            relevanceScore: 0.7
          }
        ],
        total: 1
      });
    });

    vi.spyOn(entityMemory, 'search').mockImplementation(() => {
      return Promise.resolve({
        items: [
          {
            id: '3',
            content: 'Entity: TypeScript\nType: Programming Language',
            createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
            relevanceScore: 0.9
          }
        ],
        total: 1
      });
    });

    userMemory.setItems([
      {
        id: '4',
        content: 'User prefers detailed explanations',
        metadata: { memory: 'User prefers detailed explanations' },
        createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
        relevanceScore: 0.85
      }
    ]);

    // Create agent and task for testing
    agent = new Agent({
      role: 'Developer',
      goal: 'Complete programming tasks',
      backstory: 'Expert TypeScript developer'
    });

    task = new Task({
      description: 'Implement a new feature in TypeScript',
      agent
    });

    // Initialize ContextualMemory
    contextualMemory = new ContextualMemory(
      {
        useCache: true,
        cacheTtlMs: 60000, // 1 minute cache TTL for testing
        maxContextLength: 1000,
        memoryProvider: 'mem0'
      },
      shortTermMemory,
      longTermMemory,
      entityMemory,
      userMemory as any
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should build context from all memory sources', async () => {
    const context = await contextualMemory.buildContextForTask(task);

    // Verify all memory sources were queried
    expect(shortTermMemory.search).toHaveBeenCalled();
    expect(longTermMemory.search).toHaveBeenCalled();
    expect(entityMemory.search).toHaveBeenCalled();

    // Verify the context contains information from all sources
    expect(context).toContain('Recent Insights');
    expect(context).toContain('Recent insight about task');
    expect(context).toContain('Historical Data');
    expect(context).toContain('Try approach A');
    expect(context).toContain('Consider factor B');
    expect(context).toContain('Entities');
    expect(context).toContain('Entity: TypeScript');
    expect(context).toContain('User memories/preferences');
    expect(context).toContain('User prefers detailed explanations');
  });

  test('should use context cache for repeated queries', async () => {
    // First call should query all memory sources
    await contextualMemory.buildContextForTask(task);

    // Reset mocks to verify they're not called on second request
    vi.clearAllMocks();
    vi.spyOn(shortTermMemory, 'search');
    vi.spyOn(longTermMemory, 'search');
    vi.spyOn(entityMemory, 'search');

    // Second call with same task should use cache
    await contextualMemory.buildContextForTask(task);

    // Verify memory sources were not queried again
    expect(shortTermMemory.search).not.toHaveBeenCalled();
    expect(longTermMemory.search).not.toHaveBeenCalled();
    expect(entityMemory.search).not.toHaveBeenCalled();
  });

  test('should optimize context length when it exceeds maximum', async () => {
    // Override search implementation to return very long content
    const longContent = 'Very '.repeat(500) + 'long content';
    vi.spyOn(shortTermMemory, 'search').mockImplementation(() => {
      return Promise.resolve({
        items: [
          {
            id: '1',
            content: longContent,
            createdAt: Date.now(),
            relevanceScore: 0.8
          }
        ],
        total: 1
      });
    });

    // Create ContextualMemory with small max length
    const smallContextMemory = new ContextualMemory(
      {
        maxContextLength: 100,
        useCache: false
      },
      shortTermMemory,
      longTermMemory,
      entityMemory
    );

    const context = await smallContextMemory.buildContextForTask(task);

    // Verify context is truncated
    expect(context.length).toBeLessThanOrEqual(100);
    // Should still contain the header
    expect(context).toContain('Recent Insights');
  });

  test('should parallelize context fetching when useAsyncFetch is true', async () => {
    // Create timing functions to verify parallel execution
    let shortTermStart = 0, shortTermEnd = 0;
    let longTermStart = 0, longTermEnd = 0;
    let entityStart = 0, entityEnd = 0;

    vi.spyOn(shortTermMemory, 'search').mockImplementation(async () => {
      shortTermStart = Date.now();
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
      shortTermEnd = Date.now();
      return { items: [], total: 0 };
    });

    vi.spyOn(longTermMemory, 'search').mockImplementation(async () => {
      longTermStart = Date.now();
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
      longTermEnd = Date.now();
      return { items: [], total: 0 };
    });

    vi.spyOn(entityMemory, 'search').mockImplementation(async () => {
      entityStart = Date.now();
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
      entityEnd = Date.now();
      return { items: [], total: 0 };
    });

    // Create ContextualMemory with parallel fetching
    const parallelMemory = new ContextualMemory(
      {
        useAsyncFetch: true
      },
      shortTermMemory,
      longTermMemory,
      entityMemory
    );

    await parallelMemory.buildContextForTask(task);

    // In parallel execution, the requests should overlap in time
    const shortTermDuration = shortTermEnd - shortTermStart;
    const longTermDuration = longTermEnd - longTermStart;
    const entityDuration = entityEnd - entityStart;

    // Total time should be approximately max(all durations), not sum(all durations)
    // Adding some tolerance for test execution variations
    const totalTime = Math.max(shortTermEnd, longTermEnd, entityEnd) - 
                      Math.min(shortTermStart, longTermStart, entityStart);
    
    expect(totalTime).toBeLessThan(shortTermDuration + longTermDuration + entityDuration - 50);

    // Verify overlap by checking start times - they should all be close
    expect(Math.abs(shortTermStart - longTermStart)).toBeLessThan(50);
    expect(Math.abs(shortTermStart - entityStart)).toBeLessThan(50);
    expect(Math.abs(longTermStart - entityStart)).toBeLessThan(50);
  });

  test('should handle empty results from memory sources', async () => {
    // Override all search implementations to return empty results
    vi.spyOn(shortTermMemory, 'search').mockImplementation(() => {
      return Promise.resolve({ items: [], total: 0 });
    });

    vi.spyOn(longTermMemory, 'search').mockImplementation(() => {
      return Promise.resolve({ items: [], total: 0 });
    });

    vi.spyOn(entityMemory, 'search').mockImplementation(() => {
      return Promise.resolve({ items: [], total: 0 });
    });

    userMemory.setItems([]);

    const context = await contextualMemory.buildContextForTask(task);

    // Verify context is empty
    expect(context).toBe('');
  });

  test('should allow custom section formatting', async () => {
    // Create ContextualMemory with custom formatter
    const customFormatter = (title: string, items: string[]) => {
      return `## ${title.toUpperCase()} ##\n* ${items.join('\n* ')}`;
    };

    const customFormattedMemory = new ContextualMemory(
      {
        sectionFormatter: customFormatter,
        memoryProvider: 'mem0'
      },
      shortTermMemory,
      longTermMemory,
      entityMemory,
      userMemory as any
    );

    const context = await customFormattedMemory.buildContextForTask(task);

    // Verify custom formatting was applied
    expect(context).toContain('## RECENT INSIGHTS ##');
    expect(context).toContain('* - Recent insight about task');
    expect(context).toContain('## HISTORICAL DATA ##');
    expect(context).toContain('* - Try approach A');
    expect(context).toContain('* - Consider factor B');
    expect(context).toContain('## ENTITIES ##');
    expect(context).toContain('## USER MEMORIES/PREFERENCES ##');
  });
});
