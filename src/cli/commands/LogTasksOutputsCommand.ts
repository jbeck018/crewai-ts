/**
 * CLI command for retrieving latest crew.kickoff() task outputs.
 * Optimized for memory efficiency with on-demand loading.
 */
import { Command } from '../Command.js';

// Define proper types for memory optimization
interface TaskOutput {
  taskId: string;
  expectedOutput?: string;
  result?: unknown;
  [key: string]: unknown;
}

export class LogTasksOutputsCommand extends Command {
  readonly name = 'log-tasks-outputs';
  readonly description = 'Retrieve your latest crew.kickoff() task outputs';
  readonly syntax = '';
  readonly examples = [
    'log-tasks-outputs'
  ];

  async execute(args: string[]): Promise<void> {
    try {
      // Dynamically import required modules only when needed (optimization)
      const { default: chalk } = await import('chalk');
      
      // Import memory storage to load task outputs
      const { KickoffTaskOutputsStorage } = await import('../../memory/storage/KickoffTaskOutputsStorage.js');
      
      // Load the task outputs with memory-efficient approach
      const storage = new KickoffTaskOutputsStorage();
      const tasks = await storage.loadAll() as TaskOutput[];
      
      if (!tasks || tasks.length === 0) {
        console.log(chalk.yellow('No task outputs found. Only crew kickoff task outputs are logged.'));
        return;
      }
      
      console.log(chalk.bold('\nLatest Crew Kickoff Task Outputs:\n'));
      
      // Use memory-efficient iteration with null-safety
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i] as TaskOutput | undefined;
        
        // Skip undefined tasks for memory safety
        if (!task) continue;
        
        // Use optional chaining and nullish coalescing for type safety
        const taskId = task.taskId || `Task-${i}`;
        const description = task.expectedOutput ?? 'No description available';
        
        console.log(chalk.cyan(`Task ${i + 1}: ${taskId}`));
        console.log(`Description: ${description}`);
        console.log(chalk.dim('------'));
      }
      
    } catch (error) {
      console.error('Error retrieving task outputs:', error);
      process.exit(1);
    }
  }

  /**
   * Parse command line arguments for the log-tasks-outputs command
   * No arguments required for this command
   */
  protected override parseArgs(args: string[]): Record<string, any> {
    // This command doesn't need any arguments
    return {};
  }
}
