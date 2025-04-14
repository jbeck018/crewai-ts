/**
 * CLI command for training a crew for improved agent performance.
 * Optimized for memory efficiency and learning effectiveness.
 */
import path from 'path';
import fsPromises from 'fs/promises';
import fs from 'fs'; // For sync operations
import { Command } from '../Command.js';
import ora from 'ora';

// Interface for training options with memory-optimized structure
interface TrainingServiceOptions {
  iterations: number;
  outputFile: string;
  verbose: boolean;
}

// Interface for training result with efficient type definitions
interface TrainingResult {
  metrics: {
    accuracy: number;
    agentCount: number;
    trainingTime: number;
    iterations: number;
    agentsData: Record<string, any>[];
  };
  outputPath: string;
  accuracy?: number; // For backward compatibility
  agentCount?: number; // For backward compatibility
}

// Interface for training service with memory-optimized type definitions
interface CrewTrainingServiceType {
  onIterationComplete: (callback: (iteration: number) => void) => void;
  train: (options: TrainingServiceOptions) => Promise<TrainingResult>;
}

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
      // Ensure filename is always a string with proper null/undefined handling
      // Ensure filename is a valid string with proper type checking and fallback
      const filename = typeof parsedArgs.filename === 'string' && parsedArgs.filename.trim() ? 
        parsedArgs.filename.trim() : 'trained_agents_data.json';
      const outputPath = path.resolve(process.cwd(), filename);
      const outputDir = path.dirname(outputPath);
      
      // Ensure the output directory exists with proper error handling
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Import the training service with enhanced type handling
      // The interface is defined at the top level for better code organization
      
      // Import service with proper declaration reference and memory-optimized type assertions
      
      // Enhanced dynamic import with precise type assertions for better compiler optimization
      // Using a two-step approach for maximum type safety and memory efficiency
      const trainingServiceModule = await import(
        /* webpackChunkName: "crew-training-service" */ 
        '../../services/CrewTrainingService.js'
      ).catch(error => {
        spinner.fail(`Error importing training service: ${error.message}`);
        throw new Error(`Failed to load training module: ${error.message}`);
      });
      
      // Convert module to the expected structure with safe casting
      // This approach is more memory efficient than in-line type assertions
      const moduleWithService = trainingServiceModule as unknown as { 
        CrewTrainingService: { new(): CrewTrainingServiceType } 
      };
      
      const { CrewTrainingService } = moduleWithService;
      
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
      
      // Ensure all parameters are properly typed for memory safety
      const trainingOptions: {
        iterations: number;
        outputFile: string;
        verbose: boolean;
      } = {
        iterations: parsedArgs.iterations,
        // Always use a string for the output file path with proper type safety
        outputFile: outputPath,
        verbose: !!parsedArgs.verbose // Convert to boolean for type safety
      };
      
      const trainingResults = await trainingService.train(trainingOptions);
      
      // Clean up progress tracking
      clearInterval(progressInterval);
      
      // Operation completed successfully
      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
      spinner.succeed(`Training completed in ${executionTime}s (${parsedArgs.iterations} iterations)`);
      
      // Show training results summary
      console.log('\nTraining results:')
      // Access metrics safely with null checks
      const accuracy = trainingResults.metrics?.accuracy || 0;
      const agentCount = trainingResults.metrics?.agentCount || 0;
      console.log(`- Final model accuracy: ${accuracy.toFixed(2)}%`);
      console.log(`- Trained agent models: ${agentCount}`);
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
    // Default values with proper type annotations for memory efficiency
    const result: {
      iterations: number;
      filename: string;
      verbose: boolean;
    } = {
      iterations: 5,
      filename: 'trained_agents_data.json',
      verbose: false
    };

    // Parse options
    for (let i = 0; i < args.length; i++) {
      if ((args[i] === '-n' || args[i] === '--iterations') && i + 1 < args.length) {
        // Safe access of array index with bounds check
        const nextArg = args[++i];
        // Parse with explicit type checking for memory optimization
        const iterations = typeof nextArg === 'string' ? parseInt(nextArg, 10) : NaN;
        if (!isNaN(iterations) && iterations > 0) {
          result.iterations = iterations;
        }
      } else if ((args[i] === '-f' || args[i] === '--filename') && i + 1 < args.length) {
        const index = ++i;
        // Enhanced string safety with comprehensive null/undefined checks for memory optimization
        if (index < args.length) {
          const filenameArg = args[index];
          // Null coalescing for safe string assignment with type assertion
          if (typeof filenameArg === 'string' && filenameArg.trim().length > 0) {
            result.filename = filenameArg.trim();
          }
        }
        // Default is already set in the result object initialization
      } else if (args[i] === '--verbose') {
        result.verbose = true;
      }
    }

    return result;
  }
}
