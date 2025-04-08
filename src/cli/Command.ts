/**
 * Base command class for CLI commands.
 * Optimized for extensibility and type safety.
 */
export abstract class Command {
  /**
   * Name of the command (used in CLI)
   */
  abstract readonly name: string;

  /**
   * Description of the command (shown in help)
   */
  abstract readonly description: string;

  /**
   * Command arguments format
   */
  abstract readonly syntax: string;

  /**
   * Examples of how to use the command
   */
  abstract readonly examples: string[];

  /**
   * Execute the command with the given arguments
   * @param args Command line arguments
   */
  abstract execute(args: string[]): Promise<void>;

  /**
   * Parse and validate command arguments
   * @param args Command line arguments
   */
  protected parseArgs(args: string[]): Record<string, any> {
    // Base implementation can be overridden by specific commands
    return {};
  }

  /**
   * Format and show command help
   */
  showHelp(): void {
    console.log(`\n${this.name} - ${this.description}\n`);
    console.log(`Syntax: ${this.name} ${this.syntax}\n`);
    
    if (this.examples.length > 0) {
      console.log('Examples:');
      this.examples.forEach(example => console.log(`  ${example}`));
      console.log('');
    }
  }
}
