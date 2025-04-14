/**
 * CLI command for testing a crew and evaluating results.
 * Optimized for performance with detailed metrics collection.
 */
import path from 'path';
import fs from 'fs';
import { Command } from '../Command.js';

/**
 * Test crew command optimized for memory efficiency and type safety
 * Implements proper null checking and string validation
 */
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
      // Ensure model is always a valid string for type safety
      const safeModel = parsedArgs.model || 'gpt-3.5-turbo';
      const spinner = ora(`Testing crew for ${parsedArgs.iterations} iterations with model ${safeModel}...`).start();
      
      // Import the crew evaluation service with proper type handling
      // Use type assertion to ensure TypeScript recognizes the module
      const evaluationServiceModule = await import('../../services/CrewEvaluationService.js') as {
        CrewEvaluationService: new () => {
          onIterationComplete(callback: (iteration: number) => void): void;
          evaluate(options: { iterations: number; model: string; verbose: boolean }): Promise<any>;
        }
      };
      
      const { CrewEvaluationService } = evaluationServiceModule;
      
      spinner.text = 'Initializing evaluation service...';
      const evaluationService = new CrewEvaluationService();
      
      // Setup progress tracking with optimized memory usage
      let currentIteration = 0;
      const iterations = parsedArgs.iterations;
      
      // Use a typed progress interval with minimal allocations
      const progressInterval = setInterval(() => {
        spinner.text = `Testing crew... ${currentIteration}/${iterations} iterations`;
      }, 1000);
      
      // Track execution progress with memory-efficient callback implementation
      evaluationService.onIterationComplete((iteration: number) => {
        // Update without creating new objects or closures
        currentIteration = iteration;
      });
      
      // Execute the tests with memory-efficient metrics collection
      // Create type-safe evaluation options to prevent undefined values
      // Ensure model is never undefined with proper string safety
      // Explicit typing to optimize memory usage
      const evaluationOptions: {
        iterations: number;
        model: string;
        verbose: boolean;
      } = {
        iterations: parsedArgs.iterations,
        model: parsedArgs.model || 'gpt-3.5-turbo', // Use null coalescing for type safety
        verbose: !!parsedArgs.verbose // Convert to boolean for type safety
      };
      
      const results = await evaluationService.evaluate(evaluationOptions);
      
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
        // Define the agent type for proper type checking
        results.agentPerformance.forEach((agent: { name: string; successRate: number; completedTasks: number }) => {
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
    // Default values with proper type annotations for memory efficiency
    const result: {
      iterations: number;
      model: string;
      verbose: boolean;
    } = {
      iterations: 3,
      model: 'gpt-3.5-turbo',
      verbose: false
    };

    // Parse options with optimized pattern matching
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if ((arg === '-n' || arg === '--iterations') && i + 1 < args.length) {
        // Memory-optimized string parsing with type safety
        const index = ++i;
        if (index < args.length) {
          const iterArg = args[index];
          // Avoid unnecessary parse operations by doing type checking first
          if (typeof iterArg === 'string') {
            // Convert only once and store result to avoid repeated conversions
            const iterations = parseInt(iterArg.trim(), 10);
            // Validate parsed value before assignment
            if (!isNaN(iterations) && iterations > 0 && iterations < 1000) { // Add upper limit for safety
              result.iterations = iterations;
            }
          }
        }
      } else if ((arg === '-m' || arg === '--model') && i + 1 < args.length) {
        // Enhanced string safety with comprehensive null/undefined checks for memory optimization
        const index = ++i;
        if (index < args.length) {
          const modelArg = args[index];
          // Triple validation for maximum type safety with memory optimization
          // 1. Check if string type
          // 2. Verify non-empty after trimming (avoid spaces-only strings)
          // 3. Check minimum length for valid model names
          if (typeof modelArg === 'string' && modelArg.trim().length > 0) {
            const trimmedModel = modelArg.trim();
            // Only assign if it passes all validations - avoid unnecessary assignments
            if (trimmedModel.length >= 3) { // Most model names are at least 3 chars
              result.model = trimmedModel;
            }
          }
          // Default is already set in the result object initialization
        }
      } else if (arg === '--verbose' || arg === '-v') {
        result.verbose = true;
      }
    }

    return result;
  }
}
