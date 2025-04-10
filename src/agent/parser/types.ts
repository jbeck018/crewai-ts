/**
 * Agent Parser Types
 * Defines types used in the agent parser with complete type safety
 */

/**
 * Represents an agent's action parsed from output
 * Optimized with well-defined properties and comprehensive types
 */
export interface AgentAction {
  /** Agent's thought process leading to this action */
  thought: string;
  /** Name of the tool or action being invoked */
  tool: string;
  /** Input provided to the tool - properly typed and memory efficient */
  toolInput: string;
  /** Original raw text that was parsed */
  text: string;
  /** Result from executing the action (filled in after execution) */
  result?: string;
}

/**
 * Represents an agent's final answer parsed from output
 * Optimized with well-defined properties and comprehensive types
 */
export interface AgentFinish {
  /** Agent's thought process leading to the final answer */
  thought: string;
  /** The final output or answer */
  output: string;
  /** Original raw text that was parsed */
  text: string;
}

/**
 * Represents a parsing error in the agent output
 * Includes detailed information for debugging and error recovery
 */
export class OutputParserException extends Error {
  /** Specific error message for diagnosis */
  error: string;
  
  /**
   * Creates a new OutputParserException
   * @param error Detailed error message
   */
  constructor(error: string) {
    super(error);
    this.error = error;
    this.name = 'OutputParserException';
    
    // Preserves stack trace in modern V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OutputParserException);
    }
  }
}

/**
 * Options for the agent parser
 * Allows customization of parsing behavior with memory efficiency in mind
 */
export interface AgentParserOptions {
  /** 
   * Whether to attempt automatic repair of malformed JSON in tool inputs 
   * @default true
   */
  repairJson?: boolean;
  
  /**
   * Maximum number of parsing attempts before giving up
   * @default 3
   */
  maxParsingAttempts?: number;
  
  /**
   * Whether to strip markdown formatting from parsed content
   * @default true
   */
  stripMarkdown?: boolean;
  
  /**
   * Custom regex patterns for action matching
   * Allows for fine-tuned parsing of different output formats
   */
  customPatterns?: {
    action?: RegExp;
    actionInput?: RegExp;
    finalAnswer?: RegExp;
  };
}
