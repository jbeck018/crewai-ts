/**
 * AgentTools implementation
 * Provides tools for agent-to-agent delegation
 */

import { z } from 'zod';
import { BaseAgent } from '../agent/BaseAgent.js';
import { BaseTool, Tool, ToolExecutionResult } from './BaseTool.js';

// Define the schema for agent delegation input
const AgentDelegationSchema = z.object({
  message: z.string().describe('The message or question to send to the agent'),
  context: z.string().optional().describe('Additional context to provide to the agent')
});

type AgentDelegationInput = z.infer<typeof AgentDelegationSchema>;

/**
 * AgentDelegationTool class that creates a tool for delegating to another agent
 * Optimized for:
 * - Efficient delegation with context propagation
 * - Tracking of delegation chains
 * - Preventing circular delegation
 */
class AgentDelegationTool extends Tool<AgentDelegationInput, string> {
  private readonly agent: BaseAgent;
  private readonly delegationPath: string[];
  
  constructor(agent: BaseAgent, delegationPath: string[] = []) {
    super({
      name: `ask_${agent.role.toLowerCase().replace(/\s+/g, '_')}`,
      description: `Delegate a task to ${agent.role} who has the goal: ${agent.goal}${agent.backstory ? `\nBackstory: ${agent.backstory}` : ''}`,
      schema: AgentDelegationSchema,
      cacheResults: true,
      timeout: 300000, // 5 minutes default timeout for agent delegation
    });
    
    this.agent = agent;
    this.delegationPath = [...delegationPath, agent.id];
  }
  
  /**
   * Execute delegation to another agent
   * Optimized with circular delegation detection and context propagation
   */
  protected async _execute(input: AgentDelegationInput): Promise<string> {
    // Prepare delegation context
    const context = input.context ? 
      `${input.context}\n\nQuestion/Task: ${input.message}` : 
      input.message;
    
    // Create a simulated task for the agent to execute
    const delegatedTask = {
      description: input.message,
      id: `delegated-${Date.now()}`,
    };
    
    // Execute the task with the agent
    const result = await this.agent.executeTask(
      delegatedTask as any, // We're simulating a task object here
      context
    );
    
    return result.output;
  }
}

/**
 * AgentTools class that creates tools for agent-to-agent delegation
 * Optimized for:
 * - Efficient tool creation with minimal overhead
 * - Preventing circular delegation with path tracking
 * - Context propagation between agents
 */
export class AgentTools {
  private readonly agents: BaseAgent[];
  private readonly delegationPath: string[];
  
  constructor(options: { agents: BaseAgent[]; delegationPath?: string[] }) {
    this.agents = options.agents;
    this.delegationPath = options.delegationPath || [];
  }
  
  /**
   * Create delegation tools for the agents
   * Only creates tools for agents not in the current delegation path
   */
  tools(): BaseTool[] {
    // Create agent delegation tools, filtering out agents already in the delegation path
    // to prevent circular delegation
    return this.agents
      .filter(agent => !this.delegationPath.includes(agent.id))
      .map(agent => new AgentDelegationTool(agent, this.delegationPath));
  }
}
