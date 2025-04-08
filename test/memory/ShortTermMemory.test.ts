/**
 * ShortTermMemory class tests
 * Optimized for efficient test execution and maximum coverage
 */

import { describe, test, expect, beforeEach, afterEach, mock, beforeAll, afterAll } from 'bun:test';
import '../types';
import { ShortTermMemory, ShortTermMemoryOptions } from '../../src/memory/ShortTermMemory';
import { MemoryItem } from '../../src/memory/BaseMemory';

describe('ShortTermMemory', () => {
  // Use optimized test fixtures
  let memory: ShortTermMemory;
  // Precomputed test items for better performance
  const testItems: Array<{content: string, metadata?: Record<string, any>}> = [
    { content: 'Memory item 1', metadata: { category: 'test', priority: 'high' } },
    { content: 'Memory item 2', metadata: { category: 'test', priority: 'medium' } },
    { content: 'Memory item 3', metadata: { category: 'sample', priority: 'low' } },
    // Longer item for testing relevance scoring with specific terms
    { content: 'This is a comprehensive document about artificial intelligence and machine learning techniques', metadata: { category: 'ai', priority: 'high' } },
    { content: 'Another memory about neural networks and deep learning models', metadata: { category: 'ai', priority: 'medium' } }
  ];
  // Cache added items to avoid repeated lookup operations
  const addedItems: MemoryItem[] = [];
  
  beforeAll(() => {
    // Shared setup code for all tests in this suite
    // This is run once before all tests
  });
  
  afterAll(() => {
    // Shared cleanup code for all tests in this suite
    // This is run once after all tests
  });

  beforeEach(async () => {
    // Create a fresh memory instance for each test
    memory = new ShortTermMemory({
      capacity: 10,
      useLRU: true
    });
    
    // Reset added items cache
    addedItems.length = 0;
  });

  afterEach(() => {
    // Clean up after each test
    memory.dispose();
    memory = null as any;
  });

  test('should create a memory with default options', () => {
    const defaultMemory = new ShortTermMemory();
    expect(defaultMemory).toBeDefined();
    // Clean up
    defaultMemory.dispose();
  });

  test('should create a memory with custom options', () => {
    const options: ShortTermMemoryOptions = {
      capacity: 50,
      useLRU: false,
      maxAgeMs: 60000, // 1 minute
      pruneIntervalMs: 10000 // 10 seconds
    };
    
    const customMemory = new ShortTermMemory(options);
    expect(customMemory).toBeDefined();
    // Clean up
    customMemory.dispose();
  });

  test('should add items to memory and return them', async () => {
    // Add an item
    const item = await memory.add('Test memory content', { tag: 'test' });
    addedItems.push(item);
    
    // Verify item properties
    expect(item.id).toBeDefined();
    expect(item.content).toBe('Test memory content');
    expect(item.metadata).toEqual({ tag: 'test' });
    expect(typeof item.createdAt).toBe('number');
    expect(typeof item.lastAccessedAt).toBe('number');
    
    // Verify memory size
    expect(memory.size).toBe(1);
  });

  test('should get an item by id', async () => {
    // Add an item to retrieve later
    const item = await memory.add('Retrievable memory');
    addedItems.push(item);
    
    // Get the item by id
    const retrieved = await memory.get(item.id);
    
    // Verify retrieved item
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(item.id);
    expect(retrieved?.content).toBe('Retrievable memory');
  });

  test('should update an existing item', async () => {
    // Add an item to update later
    const item = await memory.add('Original content', { version: 1 });
    addedItems.push(item);
    
    // Update the item
    const updatedItem = await memory.update(item.id, {
      content: 'Updated content',
      metadata: { version: 2 }
    });
    
    // Verify updated item
    expect(updatedItem).toBeDefined();
    expect(updatedItem?.id).toBe(item.id);
    expect(updatedItem?.content).toBe('Updated content');
    expect(updatedItem?.metadata).toEqual({ version: 2 });
    // In fast test execution, timestamps might be identical, so we check it's at least the same or greater
    expect(updatedItem?.lastAccessedAt).toBeGreaterThanOrEqual(item.lastAccessedAt || 0);
    
    // Verify retrieval returns updated item
    const retrieved = await memory.get(item.id);
    expect(retrieved?.content).toBe('Updated content');
  });

  test('should remove an item', async () => {
    // Add an item to remove later
    const item = await memory.add('Item to remove');
    addedItems.push(item);
    
    // Confirm it exists
    expect(await memory.get(item.id)).toBeDefined();
    
    // Remove the item
    const result = await memory.remove(item.id);
    
    // Verify removal
    expect(result).toBe(true);
    expect(await memory.get(item.id)).toBeNull();
    expect(memory.size).toBe(0);
  });

  test('should clear all items', async () => {
    // Add multiple items
    for (const item of testItems.slice(0, 3)) {
      addedItems.push(await memory.add(item.content, item.metadata));
    }
    
    // Verify items were added
    expect(memory.size).toBe(3);
    
    // Clear all items
    await memory.clear();
    
    // Verify all items were cleared
    expect(memory.size).toBe(0);
  });

  test('should reset memory', async () => {
    // Add items
    for (const item of testItems.slice(0, 2)) {
      addedItems.push(await memory.add(item.content, item.metadata));
    }
    
    // Reset memory
    await memory.reset();
    
    // Verify memory was reset
    expect(memory.size).toBe(0);
  });

  test('should search for items by query', async () => {
    // Add test items optimized for search testing
    for (const item of testItems) {
      addedItems.push(await memory.add(item.content, item.metadata));
    }
    
    // Search for items containing 'Memory'
    const result = await memory.search({ query: 'Memory' });
    
    // Verify search results
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.some(item => item.content.includes('Memory'))).toBe(true);
  });

  test('should search for items by metadata', async () => {
    // Add test items with varied metadata
    for (const item of testItems) {
      addedItems.push(await memory.add(item.content, item.metadata));
    }
    
    // Search for items with specific metadata
    const result = await memory.search({ 
      metadata: { category: 'ai' } 
    });
    
    // Verify search results
    expect(result.items.length).toBeGreaterThan(0);
    result.items.forEach(item => {
      expect(item.metadata?.category).toBe('ai');
    });
  });

  test('should search with combined query and metadata', async () => {
    // Add test items
    for (const item of testItems) {
      addedItems.push(await memory.add(item.content, item.metadata));
    }
    
    // Search for items with query and metadata
    const result = await memory.search({ 
      query: 'neural',
      metadata: { category: 'ai' } 
    });
    
    // Verify search results match both criteria
    expect(result.items.length).toBeGreaterThan(0);
    result.items.forEach(item => {
      expect(item.content.toLowerCase()).toContain('neural');
      expect(item.metadata?.category).toBe('ai');
    });
  });

  test('should apply pagination with limit and offset', async () => {
    // Add a larger number of items for pagination testing
    for (let i = 0; i < 10; i++) {
      addedItems.push(await memory.add(`Pagination test item ${i}`));
    }
    
    // Get first page (limit 3)
    const page1 = await memory.search({ limit: 3, offset: 0 });
    
    // Get second page (limit 3, offset 3)
    const page2 = await memory.search({ limit: 3, offset: 3 });
    
    // Verify pagination
    expect(page1.items.length).toBe(3);
    expect(page2.items.length).toBe(3);
    // Make sure we're getting different items
    const page1Ids = page1.items.map(item => item.id);
    const page2Ids = page2.items.map(item => item.id);
    page2Ids.forEach(id => {
      expect(page1Ids.includes(id)).toBe(false);
    });
  });

  test('should respect capacity limit with LRU eviction', async () => {
    // Create memory with small capacity for testing eviction
    const smallMemory = new ShortTermMemory({ capacity: 3, useLRU: true });
    
    // Add items up to capacity
    const item1 = await smallMemory.add('Item 1');
    const item2 = await smallMemory.add('Item 2');
    const item3 = await smallMemory.add('Item 3');
    
    // Access item1 to make it most recently used
    await smallMemory.get(item1.id);
    
    // Add item beyond capacity, should evict item2 (least recently used)
    const item4 = await smallMemory.add('Item 4');
    
    // Verify LRU eviction
    expect(smallMemory.size).toBe(3);
    expect(await smallMemory.get(item1.id)).toBeDefined(); // Should still exist (most recently used)
    expect(await smallMemory.get(item2.id)).toBeNull(); // Should be evicted (least recently used)
    expect(await smallMemory.get(item3.id)).toBeDefined(); // Should still exist
    expect(await smallMemory.get(item4.id)).toBeDefined(); // Should exist (newly added)
    
    // Clean up
    smallMemory.dispose();
  });

  test('should prune old memories', async () => {
    // Create memory with short max age for testing pruning
    const shortAgeMemory = new ShortTermMemory({ 
      maxAgeMs: 50, // Very short age (50ms)
      capacity: 10
    });
    
    // Add an item
    const item = await shortAgeMemory.add('Soon to be pruned');
    
    // Simulate passage of time (longer than maxAgeMs)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Manually trigger pruning
    (shortAgeMemory as any).pruneOldMemories();
    
    // Verify item was pruned
    expect(await shortAgeMemory.get(item.id)).toBeNull();
    expect(shortAgeMemory.size).toBe(0);
    
    // Clean up
    shortAgeMemory.dispose();
  });
});
