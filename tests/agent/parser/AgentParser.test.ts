/**
 * Tests for the CrewAgentParser
 * Based on the Python implementation tests with TypeScript optimizations
 * Optimized for memory efficiency and thorough test coverage
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { CrewAgentParser, AgentAction, AgentFinish, OutputParserException } from '../../../src/agent/parser/index.js';

describe('CrewAgentParser', () => {
  // Basic parser instance for reuse
  let parser: CrewAgentParser;

  beforeEach(() => {
    parser = new CrewAgentParser();
  });

  describe('Basic functionality', () => {
    test('should parse a valid action correctly', () => {
      const text = "Thought: I need to search for information\nAction: search\nAction Input: What is the weather in San Francisco?";
      
      const result = parser.parse(text) as AgentAction;
      
      expect(result).toBeDefined();
      expect(result.tool).toBe('search');
      expect(result.toolInput).toBe('What is the weather in San Francisco?');
      expect(result.thought).toBe('I need to search for information');
    });
    
    test('should parse a valid final answer correctly', () => {
      const text = "Thought: I know the answer now\nFinal Answer: The weather in San Francisco is foggy";
      
      const result = parser.parse(text) as AgentFinish;
      
      expect(result).toBeDefined();
      expect(result.output).toBe('The weather in San Francisco is foggy');
      expect(result.thought).toBe('I know the answer now');
    });
  });
  
  describe('Advanced parsing features', () => {
    test('should handle whitespace variations in action format', () => {
      const text = "Thought: Let's search\nAction:   search   \nAction Input:   query with spaces   ";
      
      const result = parser.parse(text) as AgentAction;
      
      expect(result.tool).toBe('search');
      expect(result.toolInput).toBe('query with spaces');
    });
    
    test('should handle special characters in action input', () => {
      const text = "Thought: Let's find the temperature\nAction: search\nAction Input: what's the temperature in SF?";
      
      const result = parser.parse(text) as AgentAction;
      
      expect(result.toolInput).toBe("what's the temperature in SF?");
    });
    
    test('should handle asterisks in action names', () => {
      const text = "Thought: Need to use the calculator\nAction: **calculate**\nAction Input: 2 + 2";
      
      const result = parser.parse(text) as AgentAction;
      
      expect(result.tool).toBe('calculate');
    });
    
    test('should handle quotes in action input', () => {
      const text = 'Thought: Let\'s search\nAction: search\nAction Input: "query with quotes"';
      
      const result = parser.parse(text) as AgentAction;
      
      expect(result.toolInput).toBe('query with quotes');
    });
    
    test('should handle JSON in action input', () => {
      const text = 'Thought: Let\'s search\nAction: search_json\nAction Input: {"query": "test", "filter": {"category": "books"}}';
      
      const result = parser.parse(text) as AgentAction;
      
      expect(result.toolInput).toBe('{"query":"test","filter":{"category":"books"}}');
    });
    
    test('should repair malformed JSON in action input', () => {
      const text = 'Thought: Let\'s search\nAction: search_json\nAction Input: {"query": "test", "filter": {"category": "books"}';
      
      const result = parser.parse(text) as AgentAction;
      
      // The parser should add the missing closing brace
      expect(result.toolInput).toContain('"category":"books"');
      expect(result.toolInput.endsWith('}')).toBe(true);
      expect(result.toolInput.endsWith('}}')).toBe(true);
    });
  });
  
  describe('Error handling', () => {
    test('should throw exception for missing action after thought', () => {
      const text = "Thought: I need to search for something";
      
      expect(() => parser.parse(text)).toThrow(OutputParserException);
    });
    
    test('should throw exception for missing action input', () => {
      const text = "Thought: I need to search\nAction: search";
      
      expect(() => parser.parse(text)).toThrow(OutputParserException);
    });
    
    test('should throw exception when both action and final answer are present', () => {
      const text = "Thought: I need to search\nAction: search\nAction Input: query\nFinal Answer: result";
      
      expect(() => parser.parse(text)).toThrow(OutputParserException);
    });
  });
  
  describe('Markdown handling', () => {
    test('should handle code blocks in final answer', () => {
      const text = "Thought: Let me provide code\nFinal Answer: Here is some code:\n```javascript\nconst x = 1;\n```";
      
      const result = parser.parse(text) as AgentFinish;
      
      // The code block should be cleaned up in the output
      expect(result.output).toContain('Here is some code:');
      expect(result.output).toContain('const x = 1;');
      expect(result.output).not.toContain('```javascript');
    });
    
    test('should handle backticks in thought', () => {
      const text = "Thought: Let me consider `code`\nAction: search\nAction Input: query";
      
      const result = parser.parse(text) as AgentAction;
      
      expect(result.thought).toBe("Let me consider `code`");
    });
    
    test('should handle backticks in final answer', () => {
      const text = "Thought: Let me consider\nFinal Answer: The answer is `code`";
      
      const result = parser.parse(text) as AgentFinish;
      
      expect(result.output).toBe("The answer is `code`");
    });
  });
  
  describe('Edge cases', () => {
    test('should handle newlines in action input', () => {
      const text = "Thought: Let's search\nAction: search\nAction Input: query\nwith multiple\nlines";
      
      const result = parser.parse(text) as AgentAction;
      
      expect(result.toolInput).toContain('query');
      expect(result.toolInput).toContain('with multiple');
      expect(result.toolInput).toContain('lines');
    });
    
    test('should handle action with numbered suffix', () => {
      const text = "Thought: Let's search\nAction1: search\nAction1 Input: query";
      
      const result = parser.parse(text) as AgentAction;
      
      expect(result.tool).toBe('search');
      expect(result.toolInput).toBe('query');
    });
    
    test('should handle empty thought', () => {
      const text = "Thought: \nAction: search\nAction Input: query";
      
      const result = parser.parse(text) as AgentAction;
      
      expect(result.thought).toBe('');
      expect(result.tool).toBe('search');
    });
    
    test('should handle inferred thought without explicit label', () => {
      const text = "I need to search for information\nAction: search\nAction Input: query";
      
      const result = parser.parse(text) as AgentAction;
      
      expect(result.thought).toContain('I need to search for information');
      expect(result.tool).toBe('search');
    });
    
    test('should handle empty final answer', () => {
      const text = "Thought: I'm not sure\nFinal Answer: ";
      
      const result = parser.parse(text) as AgentFinish;
      
      expect(result.output).toBe('');
      expect(result.thought).toBe("I'm not sure");
    });
  });
  
  describe('Static parsing method', () => {
    test('should work with static parse method', () => {
      const text = "Thought: Let's search\nAction: search\nAction Input: query";
      
      const result = CrewAgentParser.parseText(text) as AgentAction;
      
      expect(result.tool).toBe('search');
      expect(result.toolInput).toBe('query');
    });
  });
});
