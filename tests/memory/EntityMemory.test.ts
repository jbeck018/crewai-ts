import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
/**
 * EntityMemory class tests
 * Optimized for efficient test execution and maximum coverage
 */

import { describe, test, expect, beforeEach, afterEach, mock, beforeAll, afterAll } from '../vitest-utils.js';
import '../types';
import { EntityMemory, EntityMemoryOptions, Entity } from '../../src/memory/EntityMemory';
import { MemoryItem } from '../../src/memory/BaseMemory';

describe('EntityMemory', () => {
  // Use optimized test fixtures
  let memory: EntityMemory;
  
  // Reusable test data for performance optimization
  const testEntities = [
    { name: 'Alice', type: 'person', attributes: { age: 30, role: 'developer' } },
    { name: 'Bob', type: 'person', attributes: { age: 25, role: 'designer' } },
    { name: 'JavaScript', type: 'language', attributes: { paradigm: 'multi-paradigm', typed: false } },
    { name: 'TypeScript', type: 'language', attributes: { paradigm: 'multi-paradigm', typed: true } },
    { name: 'CrewAI', type: 'project', attributes: { purpose: 'autonomous agents', language: 'TypeScript' } }
  ];
  
  // Sample memory items with entity references
  const testMemoryItems = [
    { content: 'Alice is working on the CrewAI project using TypeScript.', metadata: { source: 'conversation' } },
    { content: 'Bob prefers JavaScript but is learning TypeScript for the CrewAI project.', metadata: { source: 'chat' } },
    { content: 'TypeScript is a statically typed superset of JavaScript.', metadata: { source: 'documentation' } }
  ];
  
  // Mock entity recognizer for testing
  const mockEntityRecognizer = mock((text: string) => {
    const entities: Array<{ name: string; type: string; confidence?: number }> = [];
    
    // Simple entity recognition logic for testing
    if (text.includes('Alice')) entities.push({ name: 'Alice', type: 'person', confidence: 0.9 });
    if (text.includes('Bob')) entities.push({ name: 'Bob', type: 'person', confidence: 0.9 });
    if (text.includes('JavaScript')) entities.push({ name: 'JavaScript', type: 'language', confidence: 0.95 });
    if (text.includes('TypeScript')) entities.push({ name: 'TypeScript', type: 'language', confidence: 0.95 });
    if (text.includes('CrewAI')) entities.push({ name: 'CrewAI', type: 'project', confidence: 0.8 });
    
    return Promise.resolve(entities);
  });
  
  // Setup - create memory instance before each test
  beforeEach(() => {
    memory = new EntityMemory({
      maxEntities: 100,
      useCache: true,
      cacheSize: 50,
      trackSources: true,
      entityRecognizer: mockEntityRecognizer
    });
  });

  // Cleanup after each test
  afterEach(() => {
    mockEntityRecognizer.mockClear();
  });

  test('should create an entity memory with default options', () => {
    const defaultMemory = new EntityMemory();
    expect(defaultMemory).toBeDefined();
  });

  test('should create an entity memory with custom options', () => {
    const options: EntityMemoryOptions = {
      maxEntities: 200,
      useCache: false,
      cacheSize: 100,
      trackSources: false,
      trackHistory: true
    };
    
    const customMemory = new EntityMemory(options);
    expect(customMemory).toBeDefined();
  });

  test('should add and retrieve entities', async () => {
    // Add an entity
    const entity = await memory.addOrUpdateEntity(
      'Alice', 
      'person', 
      { age: 30, role: 'developer' }
    );
    
    // Verify entity properties
    expect(entity).toBeDefined();
    expect(entity.id).toBeDefined();
    expect(entity.name).toBe('Alice');
    expect(entity.type).toBe('person');
    expect(entity.attributes).toEqual({ age: 30, role: 'developer' });
    expect(entity.relationships).toEqual([]);
    
    // Retrieve entity by name
    const retrievedEntities = memory.getEntitiesByName('Alice');
    expect(retrievedEntities.length).toBe(1);
    expect(retrievedEntities[0].name).toBe('Alice');
    
    // Retrieve entity by type
    const peopleEntities = memory.getEntitiesByType('person');
    expect(peopleEntities.length).toBe(1);
    expect(peopleEntities[0].name).toBe('Alice');
  });

  test('should update existing entities', async () => {
    // Add initial entity
    const entity = await memory.addOrUpdateEntity(
      'Bob', 
      'person', 
      { age: 25, role: 'designer' }
    );
    
    // Update entity
    const updatedEntity = await memory.addOrUpdateEntity(
      'Bob',
      'person',
      { age: 26, role: 'senior designer', location: 'San Francisco' }
    );
    
    // Verify update
    expect(updatedEntity.id).toBe(entity.id); // Should be the same entity
    expect(updatedEntity.attributes).toEqual({
      age: 26,
      role: 'senior designer',
      location: 'San Francisco'
    });
    
    // Confirm via retrieval
    const retrievedEntities = memory.getEntitiesByName('Bob');
    expect(retrievedEntities[0].attributes).toEqual({
      age: 26,
      role: 'senior designer',
      location: 'San Francisco'
    });
  });

  test('should add relationships between entities', async () => {
    // Add entities
    const alice = await memory.addOrUpdateEntity('Alice', 'person', { role: 'developer' });
    const bob = await memory.addOrUpdateEntity('Bob', 'person', { role: 'designer' });
    const crewAI = await memory.addOrUpdateEntity('CrewAI', 'project', { status: 'active' });
    
    // Add relationships
    const addedColleague = memory.addEntityRelationship(
      alice.id,
      'colleague_of',
      bob.id
    );
    
    const addedWorksOn = memory.addEntityRelationship(
      alice.id, 
      'works_on',
      crewAI.id,
      { role: 'lead developer' }
    );
    
    expect(addedColleague).toBe(true);
    expect(addedWorksOn).toBe(true);
    
    // Retrieve relationships
    const aliceRelationships = memory.getEntityRelationships(alice.id);
    expect(aliceRelationships.length).toBe(2);
    
    // Retrieve specific relationship
    const aliceWorkRelationships = memory.getEntityRelationships(alice.id, 'works_on');
    expect(aliceWorkRelationships.length).toBe(1);
    expect(aliceWorkRelationships[0].entity.name).toBe('CrewAI');
    expect(aliceWorkRelationships[0].metadata?.role).toBe('lead developer');
  });

  test('should extract entities from text', async () => {
    // Add a memory item with text that contains entities
    const item = await memory.add('Alice and Bob are working on the CrewAI project using TypeScript.');
    
    // Verify entity recognizer was called
    expect(mockEntityRecognizer).toHaveBeenCalled();
    
    // Retrieve entities
    const aliceEntities = memory.getEntitiesByName('Alice');
    const bobEntities = memory.getEntitiesByName('Bob');
    const crewAIEntities = memory.getEntitiesByName('CrewAI');
    const typeScriptEntities = memory.getEntitiesByName('TypeScript');
    
    expect(aliceEntities.length).toBe(1);
    expect(bobEntities.length).toBe(1);
    expect(crewAIEntities.length).toBe(1);
    expect(typeScriptEntities.length).toBe(1);
  });

  test('should search for memories by entity', async () => {
    // Add memory items
    for (const item of testMemoryItems) {
      await memory.add(item.content, item.metadata);
    }
    
    // Search for memories mentioning 'Alice'
    const aliceResults = await memory.search({ query: 'Alice' });
    
    // Search for memories mentioning 'TypeScript'
    const typeScriptResults = await memory.search({ query: 'TypeScript' });
    
    // Verify search results
    expect(aliceResults.items.length).toBeGreaterThan(0);
    expect(typeScriptResults.items.length).toBeGreaterThan(0);
    
    // Verify the content contains the entity names
    aliceResults.items.forEach(item => {
      expect(item.content.includes('Alice')).toBe(true);
    });
    
    typeScriptResults.items.forEach(item => {
      expect(item.content.includes('TypeScript')).toBe(true);
    });
  });

  test('should remove entities', async () => {
    // Add entity
    const entity = await memory.addOrUpdateEntity('TestEntity', 'test', { temp: true });
    
    // Verify entity exists
    const entitiesBefore = memory.getEntitiesByName('TestEntity');
    expect(entitiesBefore.length).toBe(1);
    
    // Convert to memory item for removal
    const memoryItem: MemoryItem = {
      id: entity.id,
      content: 'test',
      createdAt: Date.now()
    };
    
    // Remove entity
    const removed = await memory.remove(entity.id);
    expect(removed).toBe(true);
    
    // Verify entity no longer exists
    const entitiesAfter = memory.getEntitiesByName('TestEntity');
    expect(entitiesAfter.length).toBe(0);
  });

  test('should clear all entities', async () => {
    // Add multiple entities
    for (const entity of testEntities) {
      await memory.addOrUpdateEntity(entity.name, entity.type, entity.attributes);
    }
    
    // Verify entities were added
    const peopleBeforeClear = memory.getEntitiesByType('person');
    const languagesBeforeClear = memory.getEntitiesByType('language');
    
    expect(peopleBeforeClear.length).toBe(2);
    expect(languagesBeforeClear.length).toBe(2);
    
    // Clear all entities
    await memory.clear();
    
    // Verify all entities were cleared
    const peopleAfterClear = memory.getEntitiesByType('person');
    const languagesAfterClear = memory.getEntitiesByType('language');
    
    expect(peopleAfterClear.length).toBe(0);
    expect(languagesAfterClear.length).toBe(0);
  });

  test('should handle case-insensitive entity names', async () => {
    // Add entity with capitalized name
    await memory.addOrUpdateEntity('Python', 'language', { typed: false });
    
    // Retrieve with different casing
    const pythonUppercase = memory.getEntitiesByName('PYTHON');
    const pythonLowercase = memory.getEntitiesByName('python');
    const pythonMixedCase = memory.getEntitiesByName('PyThOn');
    
    // Verify retrieval works regardless of case
    expect(pythonUppercase.length).toBe(1);
    expect(pythonLowercase.length).toBe(1);
    expect(pythonMixedCase.length).toBe(1);
    
    // Verify entity properties
    expect(pythonLowercase[0].name).toBe('Python'); // Original case is preserved
    expect(pythonLowercase[0].type).toBe('language');
  });

  test('should respect entity memory capacity limit', async () => {
    // Create memory with small capacity
    const smallMemory = new EntityMemory({ maxEntities: 3 });
    
    // Add entities up to capacity
    for (let i = 0; i < 5; i++) {
      await smallMemory.addOrUpdateEntity(`Entity${i}`, 'test', { index: i });
    }
    
    // Count total entities
    let totalEntities = 0;
    for (const type of ['test']) {
      totalEntities += smallMemory.getEntitiesByType(type).length;
    }
    
    // Verify capacity limit is enforced
    expect(totalEntities).toBeLessThanOrEqual(3);
  });
});
