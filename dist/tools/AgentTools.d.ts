/**
 * AgentTools implementation
 * Provides tools for agent-to-agent delegation
 */
import { BaseAgent } from '../agent/BaseAgent.js';
import { BaseTool } from './BaseTool.js';
/**
 * AgentTools class that creates tools for agent-to-agent delegation
 * Optimized for:
 * - Efficient tool creation with minimal overhead
 * - Preventing circular delegation with path tracking
 * - Context propagation between agents
 */
export declare class AgentTools {
    private readonly agents;
    private readonly delegationPath;
    constructor(options: {
        agents: BaseAgent[];
        delegationPath?: string[];
    });
    /**
     * Create delegation tools for the agents
     * Only creates tools for agents not in the current delegation path
     */
    tools(): BaseTool[];
}
//# sourceMappingURL=AgentTools.d.ts.map