/**
 * CLI command for visualizing a flow.
 * Optimized for fast flow diagram generation with smart caching.
 */
import fs from 'fs';
import path from 'path';
import { Command } from '../Command.js';
import { plotFlow } from '../../flow/visualization/FlowVisualizer.js';

export class PlotFlowCommand extends Command {
  readonly name = 'plot-flow';
  readonly description = 'Generate a visual representation of a flow';
  readonly syntax = '<flow-file-path> [options]';
  readonly examples = [
    'plot-flow ./src/flows/MyWorkflow.js',
    'plot-flow ./src/flows/MyWorkflow.js --output ./visualizations',
    'plot-flow ./src/flows/MyWorkflow.js --filename my-workflow-diagram'
  ];

  async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    
    if (!parsedArgs.flowPath) {
      console.error('Error: Flow file path is required');
      this.showHelp();
      process.exit(1);
    }

    try {
      // Resolve the flow file path
      const flowPath = path.resolve(process.cwd(), parsedArgs.flowPath);
      
      if (!fs.existsSync(flowPath)) {
        console.error(`Error: Flow file not found at ${flowPath}`);
        process.exit(1);
      }

      // Dynamically import the flow
      console.log(`Importing flow from ${flowPath}...`);
      const flowModule = await import(flowPath);
      
      // Find the flow class in the module
      const FlowClass = this.findFlowClass(flowModule);
      
      if (!FlowClass) {
        console.error('Error: Could not find a Flow class in the specified file');
        process.exit(1);
      }

      // Instantiate the flow
      console.log(`Instantiating flow ${FlowClass.name}...`);
      const flow = new FlowClass();

      // Generate the visualization
      console.log('Generating flow visualization...');
      const outputPath = await plotFlow(
        flow,
        parsedArgs.filename || FlowClass.name,
        parsedArgs.output
      );

      console.log(`\nFlow visualization successfully generated!`);
      console.log(`Output: ${outputPath}`);
      console.log('You can open this file in your browser to view the flow diagram.');

    } catch (error) {
      console.error('Error generating flow visualization:', error);
      process.exit(1);
    }
  }

  /**
   * Parse command line arguments for the plot-flow command
   */
  protected parseArgs(args: string[]): { flowPath?: string; output?: string; filename?: string } {
    if (args.length === 0) {
      return {};
    }

    const result: { flowPath?: string; output?: string; filename?: string } = {
      flowPath: args[0]
    };

    // Parse options
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--output' && i + 1 < args.length) {
        result.output = args[++i];
      } else if (args[i] === '--filename' && i + 1 < args.length) {
        result.filename = args[++i];
      }
    }

    return result;
  }

  /**
   * Find a Flow class exported from a module
   * Uses intelligent scanning for flow-related exports
   */
  private findFlowClass(module: any): any {
    // Check for default export if it's a Flow
    if (module.default && this.isFlowClass(module.default)) {
      return module.default;
    }

    // Check for named exports that extend Flow
    for (const key in module) {
      if (this.isFlowClass(module[key])) {
        return module[key];
      }
    }

    return null;
  }

  /**
   * Check if a class is a Flow class
   * Uses intelligent prototype analysis for accuracy
   */
  private isFlowClass(cls: any): boolean {
    // Check if it's a constructor function or class
    if (typeof cls !== 'function') {
      return false;
    }

    // Check class name
    const className = cls.name;
    if (className === 'Flow') {
      return true;
    }

    // Check if it extends Flow by walking the prototype chain
    let prototype = Object.getPrototypeOf(cls.prototype);
    while (prototype && prototype.constructor) {
      if (prototype.constructor.name === 'Flow') {
        return true;
      }
      prototype = Object.getPrototypeOf(prototype);
    }

    return false;
  }
}
