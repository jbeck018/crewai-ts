/**
 * Tests for the MemoryManager implementation
 * Optimized for comprehensive coverage with minimal overhead
 */

import { expect, test, describe, beforeEach, vi, afterEach } from 'vitest';
import { MemoryManager, MemoryType } from '../../src/memory/MemoryManager.js';
import { BaseMemory, MemoryItem } from '../../src/memory/BaseMemory.js';

// Create a mock memory implementation for testing
class MockMemory implements BaseMemory {
  private items: Map<string, MemoryItem> = new Map();
  public resetCalled = false;
  public throwOnReset = false;
  
  async add(content: string, metadata?: Record<string, any>): Promise<MemoryItem> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const item: MemoryItem = {
      id,
      content,
      metadata,
      createdAt: Date.now(),
    };
    this.items.set(id, item);
    return item;
  }
  
  async search(): Promise<{ items: MemoryItem[], total: number }> {
    return {
      items: Array.from(this.items.values()),
      total: this.items.size
    };
  }
  
  async get(id: string): Promise<MemoryItem | null> {
    return this.items.get(id) || null;
  }
  
  async update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null> {
    const item = this.items.get(id);
    if (!item) return null;
    
    const updated = { ...item, ...updates };
    this.items.set(id, updated);
    return updated;
  }
  
  async remove(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
  
  async clear(): Promise<void> {
    this.items.clear();
  }
  
  async reset(): Promise<void> {
    if (this.throwOnReset) {
      throw new Error('Reset failed');
    }
    this.resetCalled = true;
    await this.clear();
  }
}

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  const mockMemories: Record<string, MockMemory> = {};
  
  // Initialize fresh memory manager and mocks for each test
  beforeEach(() => {
    memoryManager = new MemoryManager();
    
    // Create mock memories for each type
    const memoryTypes: Exclude<MemoryType, 'all'>[] = ['short', 'long', 'entity', 'contextual'];
    
    for (const type of memoryTypes) {
      mockMemories[type] = new MockMemory();
      memoryManager.registerMemory(type, mockMemories[type]);
    }
  });
  
  // Clear mocks after each test
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  test('registers and retrieves memories', () => {
    const shortMemory = memoryManager.getMemory('short');
    const longMemory = memoryManager.getMemory('long');
    
    expect(shortMemory).toBe(mockMemories.short);
    expect(longMemory).toBe(mockMemories.long);
  });
  
  test('configures individual memory types', () => {
    memoryManager.configure('short', { maxItems: 500, autoPrune: false });
    
    const shortConfig = memoryManager.getConfig('short');
    const longConfig = memoryManager.getConfig('long');
    
    expect(shortConfig.maxItems).toBe(500);
    expect(shortConfig.autoPrune).toBe(false);
    
    // Other memory types should not be affected
    expect(longConfig.maxItems).not.toBe(500);
    expect(longConfig.autoPrune).toBe(true);
  });
  
  test('configures all memory types at once', () => {
    memoryManager.configure('all', { minRelevance: 0.8, cacheTtl: 1000 });
    
    // All memory types should have the new configuration
    const shortConfig = memoryManager.getConfig('short');
    const longConfig = memoryManager.getConfig('long');
    const entityConfig = memoryManager.getConfig('entity');
    
    expect(shortConfig.minRelevance).toBe(0.8);
    expect(shortConfig.cacheTtl).toBe(1000);
    expect(longConfig.minRelevance).toBe(0.8);
    expect(longConfig.cacheTtl).toBe(1000);
    expect(entityConfig.minRelevance).toBe(0.8);
    expect(entityConfig.cacheTtl).toBe(1000);
  });
  
  test('resets a specific memory type', async () => {
    const result = await memoryManager.resetMemory('short');
    
    expect(result.success).toBe(true);
    expect(mockMemories.short.resetCalled).toBe(true);
    expect(mockMemories.long.resetCalled).toBe(false);
    expect(mockMemories.entity.resetCalled).toBe(false);
  });
  
  test('resets all memory types', async () => {
    const result = await memoryManager.resetMemory('all');
    
    expect(result.success).toBe(true);
    expect(mockMemories.short.resetCalled).toBe(true);
    expect(mockMemories.long.resetCalled).toBe(true);
    expect(mockMemories.entity.resetCalled).toBe(true);
    expect(mockMemories.contextual.resetCalled).toBe(true);
  });
  
  test('handles errors when resetting memory', async () => {
    // Make one memory type fail on reset
    mockMemories.long.throwOnReset = true;
    
    const result = await memoryManager.resetMemory('all');
    
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.long).toBe('Reset failed');
    
    // Other memories should still be reset
    expect(mockMemories.short.resetCalled).toBe(true);
    expect(mockMemories.entity.resetCalled).toBe(true);
  });
  
  test('handles non-existent memory type', async () => {
    // Unregister a memory type
    memoryManager = new MemoryManager();
    memoryManager.registerMemory('short', mockMemories.short);
    
    const result = await memoryManager.resetMemory('long');
    
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.long).toContain('not registered');
  });
  
  test('creates standard memory instances', () => {
    // Mock the memory constructors
    const spy = vi.spyOn(memoryManager, 'registerMemory');
    
    // Create standard memories
    memoryManager.createStandardMemories();
    
    // Should create all enabled memory types
    expect(spy).toBeCalledTimes(4); // short, long, entity, contextual
  });
  
  test('respects enabled flag when creating memories', () => {
    // Disable some memory types
    memoryManager.configure('short', { enabled: false });
    memoryManager.configure('entity', { enabled: false });
    
    // Mock the memory constructors
    const spy = vi.spyOn(memoryManager, 'registerMemory');
    
    // Create standard memories
    memoryManager.createStandardMemories();
    
    // Should only create enabled memory types
    expect(spy).toBeCalledTimes(2); // long, contextual
    expect(spy).not.toBeCalledWith('short', expect.anything());
    expect(spy).not.toBeCalledWith('entity', expect.anything());
  });
});
