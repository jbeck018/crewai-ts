import { Command } from '../Command.js';
export declare class RunFlowCommand extends Command {
    readonly name = "run-flow";
    readonly description = "Execute a Flow";
    readonly syntax = "<flow-file-path> [--input <input-json>] [options]";
    readonly examples: string[];
    execute(args: string[]): Promise<void>;
    /**
     * Parse command line arguments for the run-flow command
     */
    protected parseArgs(args: string[]): {
        flowPath?: string;
        input?: string;
        verbose?: boolean;
    };
    /**
     * Find a Flow class exported from a module
     * Uses intelligent scanning for flow-related exports
     */
    private findFlowClass;
    /**
     * Check if a class is a Flow class
     * Uses intelligent prototype analysis for accuracy
     */
    private isFlowClass;
    /**
     * Set up verbose execution tracking for flow events
     * Optimized for detailed execution monitoring with minimal overhead
     */
    private setupVerboseTracking;
}
//# sourceMappingURL=RunFlowCommand.d.ts.map