/**
 * CLI command for replaying a crew execution from a specific task.
 * Optimized for performance and debugging.
 */
import { Command } from '../Command.js';

export class ReplayTaskCommand extends Command {
  readonly name = 'replay-task';
  readonly description = 'Replay the crew execution from a specific task ID';
  readonly syntax = '<task-id> [options]';
  readonly examples = [
    'replay-task task_123456',
    'replay-task task_123456 --verbose'
  ];

  async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    
    if (!parsedArgs.taskId) {
      console.error('Error: Task ID is required');
      this.showHelp();
      process.exit(1);
    }

    try {
      // Dynamically import required modules only when needed (optimization)
      const { default: chalk } = await import('chalk');
      const { default: ora } = await import('ora');
      
      // Show spinner for better UX
      const spinner = ora('Preparing task replay...').start();
      
      // Import memory storage to load the task
      const { KickoffTaskOutputsStorage } = await import('../../memory/storage/KickoffTaskOutputsStorage.js');
      
      // Load the task outputs
      spinner.text = 'Loading task data...';
      const storage = new KickoffTaskOutputsStorage();
      const task = await storage.getTaskById(parsedArgs.taskId);
      
      if (!task) {
        spinner.fail(`Task with ID ${parsedArgs.taskId} not found`);
        process.exit(1);
      }
      
      // Load the crew module for replay
      spinner.text = 'Loading crew module...';
      
      // This assumes task has crewPath property - implement as per your task structure
      const { TaskReplayService } = await import('../../services/TaskReplayService.js');
      const replayService = new TaskReplayService();
      
      // Track execution progress
      let progressInterval: NodeJS.Timeout;
      if (!parsedArgs.verbose) {
        progressInterval = setInterval(() => {
          spinner.text = `Replaying from task ${parsedArgs.taskId}...`;
        }, 1000);
      } else {
        spinner.stop();
        console.log(chalk.blue(`🔄 Replaying from task ${chalk.bold(parsedArgs.taskId)}...`));
      }
      
      // Execute the replay
      const results = await replayService.replayFromTask(parsedArgs.taskId, {
        verbose: parsedArgs.verbose
      });
      
      // Clean up progress tracking
      if (!parsedArgs.verbose && progressInterval) {
        clearInterval(progressInterval);
      }
      
      // Show results
      if (!parsedArgs.verbose) {
        spinner.succeed(`Replay from task ${parsedArgs.taskId} completed`);
      } else {
        console.log(chalk.green(`\n✅ Replay completed`));
      }
      
      console.log('\nResults:', JSON.stringify(results, null, 2));
      
    } catch (error) {
      console.error('Error during task replay:', error);
      process.exit(1);
    }
  }

  /**
   * Parse command line arguments for the replay-task command
   * Optimized for handling various argument formats
   */
  protected override parseArgs(args: string[]): { 
    taskId?: string;
    verbose?: boolean;
  } {
    if (args.length === 0) {
      return {};
    }

    const result: {
      taskId?: string;
      verbose?: boolean;
    } = {
      taskId: args[0]
    };

    // Parse options
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--verbose') {
        result.verbose = true;
      }
    }

    return result;
  }
}
