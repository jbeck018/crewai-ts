/**
 * Agent Builder Types
 * Type definitions for the Agent Builder framework with optimized type safety
 */

import { BaseTool } from '../../../tools/BaseTool.js';

/**
 * Memory item interface for entity memories
 */
export interface EntityMemoryItem {
  name: string;
  type: string;
  description: string;
  relationships: string;
}

/**
 * Memory item interface for long-term memories
 */
export interface LongTermMemoryItem {
  task: string;
  agent: string;
  quality: number;
  datetime: string;
  expectedOutput?: string;
  metadata: {
    suggestions: string[];
    quality: number;
    [key: string]: any;
  };
}

/**
 * Result of a task evaluation
 */
export interface TaskEvaluation {
  quality: number;
  suggestions: string[];
  entities: {
    name: string;
    type: string;
    description: string;
    relationships: string[];
  }[];
}

/**
 * Tool metadata for additional tool information
 */
export interface ToolMetadata {
  category?: string;
  isAsync?: boolean;
  requiresAuth?: boolean;
  [key: string]: any;
}

/**
 * Enhanced tool type with additional metadata
 */
export interface EnhancedTool extends BaseTool {
  metadata?: ToolMetadata;
}

/**
 * Mutable agent properties that can be updated
 * Used to work around readonly properties in the BaseAgent interface
 */
export interface MutableAgentProperties {
  role: string;
  goal: string;
  backstory?: string;
}

/**
 * Agent builder state interface
 */
export interface AgentBuilderState extends MutableAgentProperties {
  readonly id: string;
  readonly originalRole: string;
  readonly originalGoal: string;
  readonly originalBackstory?: string;
}
