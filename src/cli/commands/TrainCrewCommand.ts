/**
 * CLI command for training a crew for improved agent performance.
 * Optimized for memory efficiency and learning effectiveness.
 */
import path from 'path';
import fs from 'fs';
import { Command } from '../Command.js';

export class TrainCrewCommand extends Command {
  readonly name = 'train-crew';
  readonly description = 'Train the crew for improved performance';
  readonly syntax = '[options]';
  readonly examples = [
    'train-crew',
    'train-crew --iterations 10',
    'train-crew -n 5 --filename ./data/trained_agents.json'
  ];

  async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    const startTime = Date.now();

    try {
      // Dynamically import required modules only when needed (optimization)
      const { default: chalk } = await import('chalk');
      const { default: ora } = await import('ora');
      
      // Show spinner for better UX
      const spinner = ora(`Training crew for ${parsedArgs.iterations} iterations...`).start();
      
      // Resolve the output file path
      const outputPath = path.resolve(process.cwd(), parsedArgs.filename);
      const outputDir = path.dirname(outputPath);
      
      // Ensure the output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Import the training service
      const { CrewTrainingService } = await import('../../services/CrewTrainingService.js');
      
      spinner.text = 'Initializing training service...';
      const trainingService = new CrewTrainingService();
      
      // Setup progress tracking
      let currentIteration = 0;
      const progressInterval = setInterval(() => {
        spinner.text = `Training crew... ${currentIteration}/${parsedArgs.iterations} iterations`;
      }, 1000);
      
      // Train the crew with progress updates
      trainingService.onIterationComplete((iteration: number) => {
        currentIteration = iteration;
      });
      
      const trainingResults = await trainingService.train({
        iterations: parsedArgs.iterations,
        outputFile: outputPath,
        verbose: parsedArgs.verbose
      });
      
      // Clean up progress tracking
      clearInterval(progressInterval);
      
      // Operation completed successfully
      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
      spinner.succeed(`Training completed in ${executionTime}s (${parsedArgs.iterations} iterations)`);
      
      // Show training results summary
      console.log('\nTraining results:')
      console.log(`- Final model accuracy: ${trainingResults.accuracy.toFixed(2)}%`);
      console.log(`- Trained agent models: ${trainingResults.agentCount}`);
      console.log(`- Data saved to: ${outputPath}`);
      
      if (parsedArgs.verbose) {
        console.log('\nDetailed performance metrics:');
        console.log(JSON.stringify(trainingResults.metrics, null, 2));
      }
      
    } catch (error) {
      console.error('Error during crew training:', error);
      process.exit(1);
    }
  }

  /**
   * Parse command line arguments for the train-crew command
   * Optimized for handling various argument formats
   */
  protected override parseArgs(args: string[]): { 
    iterations: number;
    filename: string;
    verbose: boolean;
  } {
    // Default values
    const result = {
      iterations: 5,
      filename: 'trained_agents_data.json',
      verbose: false
    };

    // Parse options
    for (let i = 0; i < args.length; i++) {
      if ((args[i] === '-n' || args[i] === '--iterations') && i + 1 < args.length) {
        const iterations = parseInt(args[++i], 10);
        if (!isNaN(iterations) && iterations > 0) {
          result.iterations = iterations;
        }
      } else if ((args[i] === '-f' || args[i] === '--filename') && i + 1 < args.length) {
        result.filename = args[++i];
      } else if (args[i] === '--verbose') {
        result.verbose = true;
      }
    }

    return result;
  }
}
