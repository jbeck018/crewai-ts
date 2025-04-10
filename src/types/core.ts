/**
 * Core type definitions for crewAI entities
 * Optimized for memory-efficient type checking
 */

/**
 * Agent interface representing an AI agent in the system
 */
export interface Agent {
  id: string;
  name: string;
  role: string;
  goal?: string;
  backstory?: string;
  verbose?: boolean;
  allowDelegation?: boolean;
  metrics?: AgentMetrics;
  executeTask: (task: Task) => Promise<string>;
  getResponse: (message: string, options?: ResponseOptions) => Promise<string>;
  getResponseAsStream: (message: string, context?: string, tokenCallback?: (token: string) => void) => Promise<string>;
}

/**
 * Task interface representing a unit of work in the system
 */
export interface Task {
  id: string;
  description?: string;
  expectedOutput?: string;
  output?: string;
  agent?: Agent;
  completed?: boolean;
  metrics?: TaskMetrics;
}

/**
 * Crew interface representing a collection of agents
 */
export interface Crew {
  id: string;
  name?: string;
  description?: string;
  agents: Agent[];
  executionGraph: {
    tasks: Task[];
  };
  kickoff: () => Promise<string>;
}

/**
 * Agent metrics interface
 */
export interface AgentMetrics {
  executionTime?: number;
  tokenUsage?: TokenUsage;
  completionRate?: number;
}

/**
 * Task metrics interface
 */
export interface TaskMetrics {
  duration?: number;
  tokenUsage?: TokenUsage;
}

/**
 * Token usage interface
 */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cost?: number;
}

/**
 * Response options interface
 */
export interface ResponseOptions {
  additionalContext?: string;
  maxTokens?: number;
  temperature?: number;
}
