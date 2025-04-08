import { Command } from '../Command.js';
export declare class PlotFlowCommand extends Command {
    readonly name = "plot-flow";
    readonly description = "Generate a visual representation of a flow";
    readonly syntax = "<flow-file-path> [options]";
    readonly examples: string[];
    execute(args: string[]): Promise<void>;
    /**
     * Parse command line arguments for the plot-flow command
     */
    protected parseArgs(args: string[]): {
        flowPath?: string;
        output?: string;
        filename?: string;
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
}
//# sourceMappingURL=PlotFlowCommand.d.ts.map