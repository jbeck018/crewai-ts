export class CLI {
    commands = new Map();
    aliases = new Map();
    /**
     * Create a new CLI handler
     */
    constructor() {
        this.initializeCommands();
    }
    /**
     * Register a command with the CLI
     * @param command Command to register
     * @param aliases Optional command aliases
     */
    registerCommand(command, aliases = []) {
        // Register the command by its name
        this.commands.set(command.name, command);
        // Register any aliases
        for (const alias of aliases) {
            this.aliases.set(alias, command.name);
        }
    }
    /**
     * Initialize built-in commands
     */
    initializeCommands() {
        // Import command classes dynamically to avoid circular dependencies
        const loadCommands = async () => {
            try {
                // Flow commands
                const { CreateFlowCommand } = await import('./commands/CreateFlowCommand.js');
                const { PlotFlowCommand } = await import('./commands/PlotFlowCommand.js');
                const { RunFlowCommand } = await import('./commands/RunFlowCommand.js');
                // Crew commands
                const { RunCrewCommand } = await import('./commands/RunCrewCommand.js');
                // Register commands with aliases for better UX
                this.registerCommand(new CreateFlowCommand(), ['new-flow']);
                this.registerCommand(new PlotFlowCommand(), ['visualize-flow']);
                this.registerCommand(new RunFlowCommand(), ['execute-flow']);
                this.registerCommand(new RunCrewCommand(), ['execute-crew']);
            }
            catch (error) {
                console.error('Error initializing commands:', error);
            }
        };
        // Execute async loading
        loadCommands();
    }
    /**
     * Parse and execute a command from command line arguments
     * @param args Command line arguments
     */
    async parseAndExecute(args) {
        // Remove the first two arguments (node and script name)
        const cmdArgs = args.slice(2);
        if (cmdArgs.length === 0 || cmdArgs[0] === 'help') {
            this.showHelp();
            return;
        }
        const commandName = cmdArgs[0];
        const commandArgs = cmdArgs.slice(1);
        // Check if the command exists directly or via an alias with optimized type handling
        let resolvedCommandName = commandName;
        if (commandName && this.aliases.has(commandName)) {
            const aliasTarget = this.aliases.get(commandName);
            if (aliasTarget) {
                resolvedCommandName = aliasTarget;
            }
        }
        if (resolvedCommandName && this.commands.has(resolvedCommandName)) {
            try {
                const command = this.commands.get(resolvedCommandName);
                // Ensure command is defined
                if (!command) {
                    console.error(`Command ${resolvedCommandName} not found`);
                    process.exit(1);
                }
                // Show command-specific help if requested
                if (commandArgs.length > 0 && commandArgs[0] === '--help') {
                    command.showHelp();
                    return;
                }
                // Execute the command
                await command.execute(commandArgs);
            }
            catch (error) {
                console.error(`Error executing command ${resolvedCommandName}:`, error);
                process.exit(1);
            }
        }
        else {
            console.error(`Unknown command: ${commandName}`);
            this.showHelp();
            process.exit(1);
        }
    }
    /**
     * Show the main CLI help
     */
    showHelp() {
        console.log('\nCrewAI Command Line Interface\n');
        console.log('Available commands:');
        // Group commands by category for better organization
        const categories = new Map();
        for (const command of this.commands.values()) {
            const category = this.getCommandCategory(command);
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            const commands = categories.get(category);
            if (commands) {
                commands.push(command);
            }
        }
        // Sort categories and print commands
        const sortedCategories = Array.from(categories.keys()).sort();
        for (const category of sortedCategories) {
            console.log(`\n${category}:`);
            const commands = categories.get(category);
            if (!commands)
                continue;
            for (const command of commands) {
                console.log(`  ${command.name.padEnd(15)} ${command.description}`);
            }
        }
        console.log('\nFor command-specific help, use: <command> --help\n');
    }
    /**
     * Get the category for a command (used for help organization)
     * @param command Command to categorize
     */
    getCommandCategory(command) {
        // Derived from command name by convention
        // e.g., create-flow -> Flow, run-crew -> Crew
        if (command.name.startsWith('create-')) {
            return 'Creation';
        }
        else if (command.name.startsWith('run-')) {
            return 'Execution';
        }
        else if (command.name.startsWith('plot-')) {
            return 'Visualization';
        }
        else {
            return 'General';
        }
    }
}
//# sourceMappingURL=CLI.js.map