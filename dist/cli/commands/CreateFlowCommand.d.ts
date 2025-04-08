import { Command } from '../Command.js';
export declare class CreateFlowCommand extends Command {
    readonly name = "create-flow";
    readonly description = "Scaffold a new Flow class file";
    readonly syntax = "<flow-name> [options]";
    readonly examples: string[];
    execute(args: string[]): Promise<void>;
    /**
     * Parse command line arguments for the create-flow command
     */
    protected parseArgs(args: string[]): {
        flowName?: string;
        path?: string;
        withExample?: boolean;
    };
    /**
     * Format the flow name to ensure it follows naming conventions
     */
    private formatFlowName;
    /**
     * Get a basic Flow class template with optimized loading
     */
    private getBasicFlowTemplate;
    /**
     * Get an example Flow class template with more methods and patterns
     */
    private getExampleFlowTemplate;
}
//# sourceMappingURL=CreateFlowCommand.d.ts.map