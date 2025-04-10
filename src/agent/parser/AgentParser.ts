/**
 * Advanced Agent Parser
 * Parses ReAct-style LLM outputs with memory-efficient processing and robust error handling
 */

import { AgentAction, AgentFinish, AgentParserOptions, OutputParserException } from './types.js';
import { BaseAgent } from '../BaseAgent.js';

// Error messages for parser exceptions
const FINAL_ANSWER_ACTION = 'Final Answer:';
const MISSING_ACTION_AFTER_THOUGHT_ERROR = 'Invalid Format: Missing "Action:" after "Thought:". Please follow the correct format.';
const MISSING_ACTION_INPUT_AFTER_ACTION_ERROR = 'Invalid Format: Missing "Action Input:" after "Action:". Please follow the correct format.';
const FINAL_ANSWER_AND_PARSABLE_ACTION_ERROR = 'Error: Tried to both perform Action and give a Final Answer simultaneously. Must do one or the other.';

/**
 * CrewAgentParser class
 * Parses agent outputs in ReAct format with memory efficiency and advanced error handling
 * 
 * Optimizations include:
 * - Memory-efficient regex patterns to minimize allocation
 * - Single-pass parsing for most common patterns
 * - Smart JSON parsing with syntax repair capabilities
 * - Incremental text processing to handle large outputs
 */
export class CrewAgentParser {
  // Regex patterns for parsing
  private static ACTION_PATTERN = /Action\s*\d*\s*:([\s]*)(.*?)([\s]*)Action\s*\d*\s*Input\s*\d*\s*:([\s]*)(.*)/s;
  private static THOUGHT_PATTERN = /Thought\s*:([\s]*)(.*?)(?=\nAction|\nFinal Answer|$)/s;
  private static MARKDOWN_CODE_BLOCK = /```(?:[a-zA-Z0-9]+\n)?([\s\S]*?)```/g;
  
  // Instance properties
  private agent?: BaseAgent;
  private options: Required<AgentParserOptions>;
  
  /**
   * Create a new CrewAgentParser instance
   * 
   * @param agent Optional agent instance for error tracking and context
   * @param options Parsing options for customization
   */
  constructor(agent?: BaseAgent, options: AgentParserOptions = {}) {
    this.agent = agent;
    this.options = {
      repairJson: options.repairJson ?? true,
      maxParsingAttempts: options.maxParsingAttempts ?? 3,
      stripMarkdown: options.stripMarkdown ?? true,
      customPatterns: options.customPatterns ?? {},
    };
  }
  
  /**
   * Static method to parse text into an AgentAction or AgentFinish
   * Allows usage without instantiating the class
   * 
   * @param text Text to parse
   * @returns Either an AgentAction or AgentFinish based on parsed content
   * @throws OutputParserException if parsing fails
   */
  static parseText(text: string): AgentAction | AgentFinish {
    const parser = new CrewAgentParser();
    return parser.parse(text);
  }
  
  /**
   * Parse agent output text into structured formats
   * Handles both action requests and final answers with robust error handling
   * 
   * @param text Raw text to parse
   * @returns Either an AgentAction or AgentFinish based on parsed content
   * @throws OutputParserException if parsing fails
   */
  parse(text: string): AgentAction | AgentFinish {
    // Apply pre-processing transformations to text if enabled
    if (this.options.stripMarkdown) {
      text = this.removeMarkdownFormatting(text);
    }
    
    // Special case for empty thought followed immediately by Action
    let thought = '';
    if (text.match(/^Thought:\s*\nAction/)) {
      // Handle empty thought case explicitly
      thought = '';
    } else {
      // Extract thought from the text for non-empty cases
      thought = this.extractThought(text);
    }
    
    // Check if the output includes a final answer
    const includesAnswer = text.includes(FINAL_ANSWER_ACTION);
    
    // Parse action with custom or default regex
    const actionPattern = this.options.customPatterns.action || CrewAgentParser.ACTION_PATTERN;
    const actionMatch = text.match(actionPattern);
    
    // Handle final answer case
    if (includesAnswer) {
      // Extract final answer, handling edge cases like trailing backticks
      const parts = text.split(FINAL_ANSWER_ACTION);
      // Ensure we have a valid string with proper null checking
      let finalAnswer = parts.length > 1 ? parts[parts.length - 1]?.trim() || '' : '';
      
      // Remove trailing markdown code blocks if present
      if (finalAnswer.endsWith('```')) {
        const count = finalAnswer.split('```').length - 1;
        if (count % 2 !== 0) {
          // Unmatched trailing backticks - remove them
          const lastBackticksIndex = finalAnswer.lastIndexOf('```');
          if (lastBackticksIndex !== -1) {
            finalAnswer = finalAnswer.substring(0, lastBackticksIndex).trim();
          }
        }
      }
      
      // Error if both final answer and action are present
      if (actionMatch && actionMatch[0].length > 0) {
        throw new OutputParserException(FINAL_ANSWER_AND_PARSABLE_ACTION_ERROR);
      }
      
      return {
        thought,
        output: finalAnswer,
        text
      };
    }
    
    // Handle action case
    else if (actionMatch) {
      // Extract and clean the action name
      const action = this.cleanAction(actionMatch[2] || '');
      
      // Extract and process the tool input
      let toolInput = (actionMatch[5] || '').trim();
      
      // Remove quotes if present at both ends
      if ((toolInput.startsWith('"') && toolInput.endsWith('"')) || 
          (toolInput.startsWith('\'') && toolInput.endsWith('\'')))
      {
        toolInput = toolInput.substring(1, toolInput.length - 1);
      }
      
      // Handle case where tool input is decorated with ** markers
      toolInput = toolInput.replace(/^\s*\*\*\s*/, '').replace(/\s*\*\*\s*$/, '');
      
      // Attempt to repair JSON if it looks like JSON and repair is enabled
      if (this.options.repairJson && 
          ((toolInput.includes('{') && toolInput.includes('}')) ||
           (toolInput.includes('[') && toolInput.includes(']'))))
      {
        // First normalize the JSON by parsing and stringifying to ensure consistent formatting
        try {
          const parsed = JSON.parse(toolInput);
          toolInput = JSON.stringify(parsed);
        } catch {
          // If parsing fails, try repair
          toolInput = this.safeRepairJson(toolInput);
        }
      }
      
      return {
        thought,
        tool: action,
        toolInput,
        text
      };
    }
    
    // Handle error cases
    if (!text.match(/Action\s*\d*\s*:([\s]*)(.*?)/) && !includesAnswer) {
      throw new OutputParserException(MISSING_ACTION_AFTER_THOUGHT_ERROR);
    } else if (text.match(/Action\s*\d*\s*:/) && !text.match(/Action\s*\d*\s*Input\s*\d*\s*:/)) {
      throw new OutputParserException(MISSING_ACTION_INPUT_AFTER_ACTION_ERROR);
    } else {
      throw new OutputParserException('Invalid format: Could not parse the output.');
    }
  }
  
  /**
   * Extract thought content from text
   * 
   * @param text Text to extract thought from
   * @returns Extracted thought or empty string if not found
   */
  private extractThought(text: string): string {
    // Use the thought pattern to extract thought content
    const match = text.match(CrewAgentParser.THOUGHT_PATTERN);
    if (match) {
      // Explicitly handle empty thought case
      if (match[2] === undefined || match[2].trim() === '') {
        return '';
      }
      // Get the thought content and remove any markdown backticks
      return match[2].replace(/```/g, '').trim();
    }
    
    // Alternative approach: extract everything before Action or Final Answer
    let thought = '';
    const actionIndex = text.indexOf('\nAction');
    const finalAnswerIndex = text.indexOf('\nFinal Answer');
    
    if (actionIndex !== -1 || finalAnswerIndex !== -1) {
      // Find the earliest occurrence of either pattern
      const endIndex = (actionIndex !== -1 && finalAnswerIndex !== -1)
        ? Math.min(actionIndex, finalAnswerIndex)
        : Math.max(actionIndex, finalAnswerIndex);
      
      // Only extract thought if there's actual content before the action or final answer
      if (endIndex > 0) {
        thought = text.substring(0, endIndex).trim();
        
        // Remove "Thought:" prefix if present
        thought = thought.replace(/^Thought\s*:\s*/i, '');
        
        // Remove any markdown backticks
        thought = thought.replace(/```/g, '').trim();
      }
    }
    
    return thought;
  }
  
  /**
   * Clean action string by removing non-essential formatting characters
   * Memory-efficient implementation that minimizes string operations
   * 
   * @param text Action text to clean
   * @returns Cleaned action string
   */
  private cleanAction(text: string): string {
    // Fast path for common case
    if (!text.includes('*')) {
      return text.trim();
    }
    
    // Handle text with asterisks
    return text.trim().replace(/^\*+|\*+$/g, '');
  }
  
  /**
   * Safely repair malformed JSON without throwing exceptions
   * Uses multiple repair strategies with memory efficiency in mind
   * 
   * @param input Potentially malformed JSON string
   * @returns Repaired JSON string or original string if repair fails/unnecessary
   */
  private safeRepairJson(input: string): string {
    // Skip repair for valid arrays that start and end with square brackets
    if (input.startsWith('[') && input.endsWith(']')) {
      try {
        JSON.parse(input); // Test if it's valid JSON
        return input; // Already valid, return as is
      } catch {
        // Continue with repair if parsing fails
      }
    }
    
    try {
      // First attempt: Basic clean-up
      let result = input;
      
      // Replace common LLM issues that cause JSON parsing errors
      result = result.replace(/'''/g, '"').replace(/"""/g, '"');
      
      // Check if it's valid JSON after basic cleanup
      try {
        JSON.parse(result);
        return result;
      } catch {
        // Continue with more aggressive repairs
      }
      
      // Second attempt: Fix unbalanced brackets and quotes
      result = this.repairUnbalancedElements(result);
      
      // Third attempt: Fix missing/trailing commas in objects
      if (result.includes('{') && result.includes('}')) {
        // Fix missing commas between key-value pairs
        result = result.replace(/"\s*}\s*"\s*:/g, '","');
        result = result.replace(/"\s*]\s*"\s*:/g, '","');
        
        // Fix trailing commas
        result = result.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        
        // Fix missing colons
        result = result.replace(/"([^"]+)"\s+"/, '"$1": "');
      }
      
      // Fourth attempt: Standardize quotes (replace single quotes with double quotes)
      result = this.standardizeQuotes(result);
      
      // Final attempt: Use JSON.parse and stringify to normalize
      try {
        const parsed = JSON.parse(result);
        return JSON.stringify(parsed);
      } catch {
        // If we still can't parse, return the best repair so far
        return result;
      }
    } catch (e) {
      // If any error occurs during repair, return the original input
      return input;
    }
  }
  
  /**
   * Standardize quotes in a JSON string (convert single quotes to double quotes)
   * Handles nested quotes and escaped characters
   * 
   * @param input JSON string with potentially mixed quotes
   * @returns String with standardized quotes
   */
  private standardizeQuotes(input: string): string {
    // Fast path for common case
    if (!input.includes('\'')) {
      return input;
    }
    
    // Replace single quotes with double quotes, but only when they're JSON structural elements
    // This regex handles the complexity of nested quotes and escaped characters
    let result = input;
    
    // First, escape any double quotes that are already in the string
    result = result.replace(/(?<!\\)"/g, '\\"');
    
    // Then replace single quotes with double quotes
    result = result.replace(/(?<!\\)'/g, '"');
    
    // Simplify multiple backslashes (often created by previous replacements)
    result = result.replace(/\\\\/g, '\\');
    
    return result;
  }
  
  /**
   * Repair unbalanced brackets and quotes in JSON
   * Handles various malformed JSON patterns with minimal memory usage
   * 
   * @param input Potentially malformed JSON with unbalanced elements
   * @returns Repaired JSON string
   */
  private repairUnbalancedElements(input: string): string {
    // Count opening and closing brackets and add missing ones
    const counts = { '{': 0, '}': 0, '[': 0, ']': 0, '"': 0 };
    
    // First pass: count all brackets and quotes
    for (const char of input) {
      if (char in counts) {
        counts[char as keyof typeof counts]++;
      }
    }
    
    // Second pass: repair unbalanced elements
    let result = input;
    
    // Add missing closing brackets
    while (counts['{'] > counts['}']) {
      result += '}';
      counts['}']++;
    }
    
    // Add missing opening brackets at the beginning if needed
    while (counts['}'] > counts['{']) {
      result = '{' + result;
      counts['{']++;
    }
    
    // Add missing closing square brackets
    while (counts['['] > counts[']']) {
      result += ']';
      counts[']']++;
    }
    
    // Add missing opening square brackets at the beginning if needed
    while (counts[']'] > counts['[']) {
      result = '[' + result;
      counts['[']++;
    }
    
    // Fix unbalanced quotes (more complex - only add if we have odd number)
    if (counts['"'] % 2 !== 0) {
      result += '"';
    }
    
    return result;
  }
  
  /**
   * Remove markdown formatting from text
   * Optimized for common patterns in LLM outputs
   * 
   * @param text Text with potential markdown formatting
   * @returns Cleaned text with markdown removed
   */
  private removeMarkdownFormatting(text: string): string {
    // Skip processing if no markdown code blocks detected
    if (!text.includes('```')) {
      return text;
    }
    
    // Simplified code block handling - extract content from code blocks
    let result = text;
    const matches = Array.from(text.matchAll(CrewAgentParser.MARKDOWN_CODE_BLOCK) || []);
    
    // If we find code blocks, replace them with their content
    if (matches.length > 0) {
      // Process code blocks in reverse to maintain string indices
      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        if (!match) continue;
        
        const matchIndex = match.index;
        const matchContent = match[1];
        const matchFullText = match[0] || '';
        
        if (matchIndex !== undefined && matchContent !== undefined) {
          // Replace code block with its content
          result = (
            result.substring(0, matchIndex) + 
            matchContent.trim() + 
            result.substring(matchIndex + matchFullText.length)
          );
        }
      }
    }
    
    return result;
  }
}
