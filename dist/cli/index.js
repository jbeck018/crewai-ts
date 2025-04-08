/**
 * Main CLI entry point with optimized command registration and loading.
 */
import { CLI } from './CLI.js';
import { CreateFlowCommand } from './commands/CreateFlowCommand.js';
import { PlotFlowCommand } from './commands/PlotFlowCommand.js';
import { RunFlowCommand } from './commands/RunFlowCommand.js';
/**
 * Initialize the CLI with all available commands
 */
export async function initializeCLI() {
    const cli = new CLI();
    // Register core commands
    cli.registerCommand(new CreateFlowCommand(), ['new-flow']);
    cli.registerCommand(new PlotFlowCommand(), ['visualize-flow']);
    cli.registerCommand(new RunFlowCommand(), ['execute-flow']);
    // Load any dynamically registered commands from plugins
    await loadPluginCommands(cli);
    return cli;
}
/**
 * Load plugin commands with lazy loading for performance
 */
async function loadPluginCommands(cli) {
    // This will be expanded in the future to support plugins
    // For now, it's a placeholder for extensibility
    // Example of how plugin loading would work:
    // try {
    //   const pluginCommands = await import('./plugins/commands.js');
    //   pluginCommands.register(cli);
    // } catch (error) {
    //   // Plugin loading is optional, so just log errors
    //   console.debug('No plugin commands found');
    // }
}
/**
 * Run the CLI with the provided arguments
 */
export async function runCLI(args = process.argv) {
    try {
        const cli = await initializeCLI();
        await cli.parseAndExecute(args);
    }
    catch (error) {
        console.error('CLI error:', error);
        process.exit(1);
    }
}
// Allow direct execution of the CLI
if (require.main === module) {
    runCLI().catch(error => {
        console.error('Unhandled CLI error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map