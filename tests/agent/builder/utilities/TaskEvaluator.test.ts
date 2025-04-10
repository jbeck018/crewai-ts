/**
 * Tests for the TaskEvaluator class
 * Focused on ensuring optimal performance and accurate evaluation of task outputs
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TaskEvaluator, ExtractedEntity, EvaluationOptions } from '../../../../src/agent/builder/utilities/TaskEvaluator.js';
import { Task } from '../../../../src/task/Task.js';

// Mock agent for testing
const mockAgent = {
  id: 'mock-agent',
  role: 'Test Agent',
  goal: 'Evaluate task outputs accurately',
  backstory: 'I was created to test the task evaluator',
  executeTask: vi.fn(),
  getDelegationTools: vi.fn(),
};

// Mock task for testing
const createMockTask = (description: string): Task => {
  return {
    id: 'mock-task',
    description,
    expected_output: 'Detailed analysis',
    agent: mockAgent,
    async_execution: false,
    context: [],
    input: {},
  } as unknown as Task;
};

describe('TaskEvaluator', () => {
  let evaluator: TaskEvaluator;
  let task: Task;
  
  // Setup clean environment before each test with optimized objects
  beforeEach(() => {
    evaluator = new TaskEvaluator(mockAgent as any);
    task = createMockTask('Analyze the data and provide insights');
    vi.clearAllMocks();
  });
  
  test('should evaluate task output with default implementations', async () => {
    // Sample task output
    const output = 'The analysis shows that Company X has increased revenue by 20% and John Smith, the CEO, has announced a new product line.';
    
    // Evaluate the output
    const evaluation = await evaluator.evaluate(task, output);
    
    // Verify basics of evaluation
    expect(evaluation).not.toBeNull();
    expect(evaluation?.quality).toBeGreaterThan(0);
    expect(evaluation?.quality).toBeLessThanOrEqual(1);
    expect(Array.isArray(evaluation?.suggestions)).toBe(true);
    expect(Array.isArray(evaluation?.entities)).toBe(true);
  });
  
  test('should extract entities from output text', async () => {
    // Sample output with recognizable entities
    const output = `The report was presented by John Smith, CEO of TechCorp. 
    He discussed the company's growth with Sarah Johnson from Investor Relations.
    The meeting took place in New York on January 15th.`;
    
    // Extract entities
    const extractEntitiesMethod = (evaluator as any).extractEntities.bind(evaluator);
    const entities = await extractEntitiesMethod(output);
    
    // Verify entity extraction
    expect(entities.length).toBeGreaterThan(0);
    
    // Check that at least some expected entities were found
    // Note: The exact entities might vary based on the implementation
    const entityNames = entities.map(e => e.name);
    const foundEntity = ['John Smith', 'Sarah Johnson', 'TechCorp', 'New York']
      .some(name => entityNames.includes(name));
      
    expect(foundEntity).toBe(true);
    
    // Verify entity structure
    entities.forEach(entity => {
      expect(entity).toHaveProperty('name');
      expect(entity).toHaveProperty('type');
      expect(entity).toHaveProperty('description');
      expect(entity).toHaveProperty('relationships');
      expect(typeof entity.name).toBe('string');
      expect(Array.isArray(entity.relationships)).toBe(true);
    });
  });
  
  test('should respect maxEntities limit', async () => {
    // Create evaluator with small maxEntities limit
    const customEvaluator = new TaskEvaluator(mockAgent as any, {
      maxEntities: 2
    });
    
    // Sample output with many potential entities
    const output = `John Smith works with Sarah Johnson, Mike Brown, Lisa Davis, 
    Robert Wilson, Emily White, David Miller, and Jennifer Lee 
    at TechCorp in New York.`;
    
    // Extract entities
    const extractEntitiesMethod = (customEvaluator as any).extractEntities.bind(customEvaluator);
    const entities = await extractEntitiesMethod(output);
    
    // Verify entity limit is respected
    expect(entities.length).toBeLessThanOrEqual(2);
  });
  
  test('should use custom entity extractor when provided', async () => {
    // Mock entity extractor
    const mockExtractor = vi.fn().mockResolvedValue([
      { name: 'Custom Entity', type: 'Test', description: 'Test entity', relationships: [] }
    ]);
    
    // Create evaluator with custom extractor
    const customEvaluator = new TaskEvaluator(mockAgent as any, {
      entityExtractor: mockExtractor
    });
    
    // Evaluate output
    const evaluation = await customEvaluator.evaluate(task, 'Sample output');
    
    // Verify custom extractor was used
    expect(mockExtractor).toHaveBeenCalledWith('Sample output');
    expect(evaluation?.entities[0].name).toBe('Custom Entity');
  });
  
  test('should extract keywords from text efficiently', () => {
    // Access private method for testing
    const extractKeywordsMethod = (evaluator as any).extractKeywords.bind(evaluator);
    
    // Sample text with keywords
    const text = 'The artificial intelligence system analyzes large datasets to identify patterns and make predictions about customer behavior in the e-commerce platform.';
    
    // Extract keywords
    const keywords = extractKeywordsMethod(text);
    
    // Verify keywords extraction
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.length).toBeLessThanOrEqual(10); // Default limit is 10
    
    // Expect relevant words to be extracted (not common words)
    const relevantWords = ['artificial', 'intelligence', 'analyzes', 'datasets', 'patterns', 'predictions', 'customer', 'behavior', 'commerce', 'platform'];
    const foundKeywords = relevantWords.some(word => keywords.includes(word));
    
    expect(foundKeywords).toBe(true);
    
    // Common words should not be included
    const commonWords = ['the', 'and', 'to', 'about', 'in'];
    const hasCommonWords = commonWords.some(word => keywords.includes(word));
    
    expect(hasCommonWords).toBe(false);
  });
});
