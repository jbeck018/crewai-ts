/**
 * Base command class for CLI commands.
 * Optimized for extensibility and type safety.
 */
export class Command {
    /**
     * Parse and validate command arguments
     * @param args Command line arguments
     */
    parseArgs(args) {
        // Base implementation can be overridden by specific commands
        return {};
    }
    /**
     * Format and show command help
     */
    showHelp() {
        console.log(`\n${this.name} - ${this.description}\n`);
        console.log(`Syntax: ${this.name} ${this.syntax}\n`);
        if (this.examples.length > 0) {
            console.log('Examples:');
            this.examples.forEach(example => console.log(`  ${example}`));
            console.log('');
        }
    }
}
//# sourceMappingURL=Command.js.map