/**
 * Main CLI handler with optimized command registration and execution.
 */
import { Command } from './Command.js';
export declare class CLI {
    private commands;
    private aliases;
    /**
     * Create a new CLI handler
     */
    constructor();
    /**
     * Register a command with the CLI
     * @param command Command to register
     * @param aliases Optional command aliases
     */
    registerCommand(command: Command, aliases?: string[]): void;
    /**
     * Initialize built-in commands
     */
    private initializeCommands;
    /**
     * Parse and execute a command from command line arguments
     * @param args Command line arguments
     */
    parseAndExecute(args: string[]): Promise<void>;
    /**
     * Show the main CLI help
     */
    showHelp(): void;
    /**
     * Get the category for a command (used for help organization)
     * @param command Command to categorize
     */
    private getCommandCategory;
}
//# sourceMappingURL=CLI.d.ts.map