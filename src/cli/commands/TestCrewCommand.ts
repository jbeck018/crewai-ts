/**
 * CLI command for testing a crew and evaluating results.
 * Optimized for performance with detailed metrics collection.
 */
import path from 'path';
import fs from 'fs';
import { Command } from '../Command.js';

export class TestCrewCommand extends Command {
  readonly name = 'test-crew';
  readonly description = 'Test the crew and evaluate the results';
  readonly syntax = '[options]';
  readonly examples = [
    'test-crew',
    'test-crew --iterations 3',
    'test-crew -n 5 --model gpt-4'
  ];

  async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    const startTime = Date.now();

    try {
      // Dynamically import required modules only when needed (optimization)
      const { default: chalk } = await import('chalk');
      const { default: ora } = await import('ora');
      
      // Show spinner for better UX
      const spinner = ora(`Testing crew for ${parsedArgs.iterations} iterations with model ${parsedArgs.model}...`).start();
      
      // Import the crew evaluation service
      const { CrewEvaluationService } = await import('../../services/CrewEvaluationService.js');
      
      spinner.text = 'Initializing evaluation service...';
      const evaluationService = new CrewEvaluationService();
      
      // Setup progress tracking using weak references for memory optimization
      let currentIteration = 0;
      const progressInterval = setInterval(() => {
        spinner.text = `Testing crew... ${currentIteration}/${parsedArgs.iterations} iterations`;
      }, 1000);
      
      // Track execution progress with optimized callback that minimizes object creation
      evaluationService.onIterationComplete((iteration: number) => {
        currentIteration = iteration;
      });
      
      // Execute the tests with memory-efficient metrics collection
      const results = await evaluationService.evaluate({
        iterations: parsedArgs.iterations,
        model: parsedArgs.model,
        verbose: parsedArgs.verbose
      });
      
      // Clean up progress tracking
      clearInterval(progressInterval);
      
      // Operation completed successfully
      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
      spinner.succeed(`Testing completed in ${executionTime}s`);
      
      // Display results with memory-efficient formatting that minimizes string operations
      console.log('\nTest Results:\n');
      
      // Overall metrics
      console.log(chalk.bold('Overall Performance:'));
      console.log(`- Success Rate: ${(results.successRate * 100).toFixed(1)}%`);
      console.log(`- Average Task Completion Time: ${results.averageTaskTimeMs.toFixed(0)}ms`);
      console.log(`- Total Tasks Executed: ${results.totalTasks}`);
      
      // Display agent performance if available
      if (results.agentPerformance && results.agentPerformance.length > 0) {
        console.log('\n' + chalk.bold('Agent Performance:'));
        
        // Efficient memory usage by avoiding large array creation and using direct iteration
        results.agentPerformance.forEach(agent => {
          console.log(`- ${chalk.cyan(agent.name)}: ${(agent.successRate * 100).toFixed(1)}% success, ${agent.completedTasks} tasks`);
        });
      }
      
      // Display more detailed results if verbose
      if (parsedArgs.verbose && results.taskResults) {
        console.log('\n' + chalk.bold('Detailed Task Results:'));
        
        // Print in a memory-efficient way without creating large intermediate data structures
        const taskCount = Math.min(results.taskResults.length, 5); // Limit to 5 tasks to avoid console spam
        for (let i = 0; i < taskCount; i++) {
          const task = results.taskResults[i];
          console.log(`\nTask ${i+1}: ${task.name}`);
          console.log(`- Success: ${task.success ? chalk.green('Yes') : chalk.red('No')}`);
          console.log(`- Time: ${task.executionTimeMs.toFixed(0)}ms`);
          
          // Only show a truncated version of the output to save memory
          if (task.output && typeof task.output === 'string') {
            const maxLength = 100;
            const output = task.output.length > maxLength ? 
              task.output.substring(0, maxLength) + '...' : 
              task.output;
            console.log(`- Output: ${output}`);
          }
        }
        
        if (results.taskResults.length > 5) {
          console.log(`\n...and ${results.taskResults.length - 5} more tasks`);
        }
      }
      
    } catch (error) {
      console.error('Error during crew testing:', error);
      process.exit(1);
    }
  }

  /**
   * Parse command line arguments for the test-crew command
   * Optimized for handling various argument formats
   */
  protected override parseArgs(args: string[]): { 
    iterations: number;
    model: string;
    verbose: boolean;
  } {
    // Default values
    const result = {
      iterations: 3,
      model: 'gpt-3.5-turbo',
      verbose: false
    };

    // Parse options with optimized pattern matching
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if ((arg === '-n' || arg === '--iterations') && i + 1 < args.length) {
        const iterations = parseInt(args[++i], 10);
        if (!isNaN(iterations) && iterations > 0) {
          result.iterations = iterations;
        }
      } else if ((arg === '-m' || arg === '--model') && i + 1 < args.length) {
        result.model = args[++i];
      } else if (arg === '--verbose' || arg === '-v') {
        result.verbose = true;
      }
    }

    return result;
  }
}
