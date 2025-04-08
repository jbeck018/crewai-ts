import { Command } from '../Command.js';
export declare class RunCrewCommand extends Command {
    readonly name = "run-crew";
    readonly description = "Execute a Crew with optimized workflow";
    readonly syntax = "<crew-file-path> [--input <input-json>] [options]";
    readonly examples: string[];
    execute(args: string[]): Promise<void>;
    /**
     * Execute crew with spinner progress indication
     * Uses optimized error handling and progress reporting
     */
    private executeWithSpinner;
    /**
     * Parse command line arguments for the run-crew command
     * Optimized for handling various argument formats
     */
    protected parseArgs(args: string[]): {
        crewPath?: string;
        input?: string;
        verbose?: boolean;
        output?: string;
    };
    /**
     * Find a Crew class exported from a module
     * Uses intelligent scanning for crew-related exports with caching
     */
    private findCrewClass;
    /**
     * Check if a class is a Crew class
     * Uses intelligent prototype analysis for accuracy and caching for performance
     */
    private isCrewClass;
    /**
     * Setup progress tracking for the crew
     * Optimized for UX and minimal performance impact
     */
    private setupProgressTracking;
}
//# sourceMappingURL=RunCrewCommand.d.ts.map