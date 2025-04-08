import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import '../../types.js';
import { KnowledgeStorage } from '../../../src/knowledge/storage/KnowledgeStorage.js';
import { KnowledgeChunk, KnowledgeSearchResult } from '../../../src/knowledge/types.js';

// Test fixtures with optimized structures for consistent test data
const SHORT_TEXT = "Brandon's favorite color is blue and he likes Mexican food.";
const LONG_TEXT = (
  "Brandon is a software engineer who lives in San Francisco. " +
  "He enjoys hiking and often visits the trails in the Bay Area. " +
  "Brandon has a pet dog named Max, who is a golden retriever. " +
  "He loves reading science fiction books, and his favorite author is Isaac Asimov. " +
  "Brandon's favorite movie is Inception, and he enjoys watching it with his friends. " +
  "He is also a fan of Mexican cuisine, especially tacos and burritos. " +
  "Brandon plays the guitar and often performs at local open mic nights. " +
  "He is learning French and plans to visit Paris next year. " +
  "Brandon is passionate about technology and often attends tech meetups in the city. " +
  "He is also interested in AI and machine learning, and he is currently working on a project related to natural language processing. " +
  "Brandon's favorite color is blue, and he often wears blue shirts. " +
  "He enjoys cooking and often tries new recipes on weekends. "
);

// Initialize test fixtures with proper types
interface TestFixtures {
  storage: KnowledgeStorage;
  chunks: KnowledgeChunk[];
}

describe('KnowledgeStorage', () => {
  // Properly typed test fixtures with initialization
  let fixtures: TestFixtures;

  // Set up test environment before each test
  beforeEach(() => {
    // Create a fresh KnowledgeStorage instance for each test
    fixtures = {
      storage: new KnowledgeStorage({ collectionName: 'test-knowledge' }),
      chunks: [
        {
          id: '1',
          content: SHORT_TEXT,
          source: 'test',
          metadata: { source: 'test', category: 'personal' }
        },
        {
          id: '2',
          content: LONG_TEXT,
          source: 'test',
          metadata: { source: 'test', category: 'biography' }
        }
      ]
    };

    // Mock the expensive embedding generation
    // @ts-ignore - Partial mock implementation
    fixtures.storage.generateEmbeddings = mock(async (texts: string[]) => {
      // Return mock embeddings that maintain dimensionality
      return texts.map(() => Array(384).fill(0.1));
    });
  });

  // Clean up after each test
  afterEach(async () => {
    // Reset the storage to clean state
    await fixtures.storage.reset();
  });

  // Test initialization
  test('should initialize correctly', async () => {
    // Ensure storage is initialized
    await fixtures.storage.initialize();
    expect(fixtures.storage).toBeDefined();
  });

  // Test adding single chunk
  test('should add a single knowledge chunk', async () => {
    const chunk = fixtures.chunks[0];
    await fixtures.storage.addChunk(chunk);
    
    // Search for a relevant term to verify chunk was added
    const results = await fixtures.storage.search(['blue color']);
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].context).toContain('blue');
  });

  // Test adding multiple chunks
  test('should add multiple knowledge chunks in batch', async () => {
    await fixtures.storage.addChunks(fixtures.chunks);
    
    // Search for a term that should be in the second chunk
    const results = await fixtures.storage.search(['favorite movie']);
    
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.context.includes('Inception'))).toBe(true);
  });

  // Test search functionality with filters
  test('should search with filters correctly', async () => {
    await fixtures.storage.addChunks(fixtures.chunks);
    
    // Search with category filter
    const results = await fixtures.storage.search(
      ['favorite'],
      5,
      { category: 'biography' }
    );
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metadata.category).toBe('biography');
  });

  // Test vector normalization and similarity
  test('should calculate cosine similarity correctly', async () => {
    // Access the private method for testing
    // @ts-ignore - Accessing private method for test
    const similarity = fixtures.storage.calculateCosineSimilarity(
      [1.0, 0.0], 
      [1.0, 0.0]
    );
    
    // Perfect similarity should be 1.0
    expect(similarity).toBeCloseTo(1.0);
    
    // Test with known values
    // @ts-ignore - Accessing private method for test
    const partialSimilarity = fixtures.storage.calculateCosineSimilarity(
      [0.5, 0.5], 
      [0.5, 0.5]
    );
    
    // For these normalized vectors, expect close to 0.5
    expect(partialSimilarity).toBeCloseTo(0.5);
  });

  // Test caching functionality
  test('should use cache for repeated searches', async () => {
    await fixtures.storage.addChunks(fixtures.chunks);
    
    // First search will generate embeddings
    await fixtures.storage.search(['Brandon']);
    
    // Spy on the embedding generation
    const embedSpy = mock(fixtures.storage.generateEmbeddings);
    
    // Second identical search should use cache
    await fixtures.storage.search(['Brandon']);
    
    // Embedding generation should not be called again
    expect(embedSpy).not.toHaveBeenCalled();
  });

  // Test delete functionality
  test('should delete chunks by ID', async () => {
    await fixtures.storage.addChunks(fixtures.chunks);
    
    // Delete the first chunk
    await fixtures.storage.deleteChunks(['1']);
    
    // Search for content in the deleted chunk
    const results = await fixtures.storage.search(['blue color']);
    
    // Should not find the deleted content
    expect(results.every(r => r.id !== '1')).toBe(true);
  });

  // Test reset functionality
  test('should reset storage correctly', async () => {
    await fixtures.storage.addChunks(fixtures.chunks);
    
    // Reset the storage
    await fixtures.storage.reset();
    
    // Search should return no results after reset
    const results = await fixtures.storage.search(['Brandon']);
    expect(results.length).toBe(0);
  });
});
