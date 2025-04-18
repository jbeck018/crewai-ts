/**
 * Main CLI handler with optimized command registration and execution.
 */
import { Command } from './Command.js';

export class CLI {
  private commands: Map<string, Command> = new Map();
  private aliases: Map<string, string> = new Map();
  
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
  registerCommand(command: Command, aliases: string[] = []): void {
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
  private initializeCommands(): void {
    // Import command classes dynamically to avoid circular dependencies
    const loadCommands = async () => {
      try {
        // Flow commands
        const { CreateFlowCommand } = await import('./commands/CreateFlowCommand.js');
        const { PlotFlowCommand } = await import('./commands/PlotFlowCommand.js');
        const { RunFlowCommand } = await import('./commands/RunFlowCommand.js');
        
        // Crew commands
        const { RunCrewCommand } = await import('./commands/RunCrewCommand.js');
        const { TrainCrewCommand } = await import('./commands/TrainCrewCommand.js');
        const { TestCrewCommand } = await import('./commands/TestCrewCommand.js');
        
        // Task and memory commands
        const { ReplayTaskCommand } = await import('./commands/ReplayTaskCommand.js');
        const { LogTasksOutputsCommand } = await import('./commands/LogTasksOutputsCommand.js');
        const { ResetMemoriesCommand } = await import('./commands/ResetMemoriesCommand.js');
        
        // Interactive commands
        const { ChatCommand } = await import('./commands/ChatCommand.js');
        
        // Register commands with aliases for better UX
        // Flow commands
        this.registerCommand(new CreateFlowCommand(), ['new-flow']);
        this.registerCommand(new PlotFlowCommand(), ['visualize-flow']);
        this.registerCommand(new RunFlowCommand(), ['execute-flow']);
        
        // Crew commands
        this.registerCommand(new RunCrewCommand(), ['execute-crew']);
        this.registerCommand(new TrainCrewCommand(), ['train']);
        this.registerCommand(new TestCrewCommand(), ['test', 'evaluate']);
        
        // Task and memory commands
        this.registerCommand(new ReplayTaskCommand(), ['replay']);
        this.registerCommand(new LogTasksOutputsCommand(), ['log-outputs']);
        this.registerCommand(new ResetMemoriesCommand(), ['reset']);
        
        // Interactive commands
        this.registerCommand(new ChatCommand(), []);
      } catch (error) {
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
  async parseAndExecute(args: string[]): Promise<void> {
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
      } catch (error) {
        console.error(`Error executing command ${resolvedCommandName}:`, error);
        process.exit(1);
      }
    } else {
      console.error(`Unknown command: ${commandName}`);
      this.showHelp();
      process.exit(1);
    }
  }
  
  /**
   * Show the main CLI help
   */
  showHelp(): void {
    console.log('\nCrewAI Command Line Interface\n');
    console.log('Available commands:');
    
    // Group commands by category for better organization
    const categories = new Map<string, Command[]>();
    
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
      if (!commands) continue;
      
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
  private getCommandCategory(command: Command): string {
    // Derived from command name by convention
    // e.g., create-flow -> Flow, run-crew -> Crew
    if (command.name.startsWith('create-')) {
      return 'Creation';
    } else if (command.name.startsWith('run-')) {
      return 'Execution';
    } else if (command.name.startsWith('plot-')) {
      return 'Visualization';
    } else {
      return 'General';
    }
  }
}
