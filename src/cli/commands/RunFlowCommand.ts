/**
 * CLI command for executing a Flow.
 * Optimized for performance and detailed execution tracking.
 */
import fs from 'fs';
import path from 'path';
import { Command } from '../Command.js';

export class RunFlowCommand extends Command {
  readonly name = 'run-flow';
  readonly description = 'Execute a Flow';
  readonly syntax = '<flow-file-path> [--input <input-json>] [options]';
  readonly examples = [
    'run-flow ./src/flows/MyWorkflow.js',
    'run-flow ./src/flows/MyWorkflow.js --input \'{\'key\':\'value\'}\' ',
    'run-flow ./src/flows/MyWorkflow.js --verbose'
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

      // Parse input JSON if provided
      let inputData = {};
      if (parsedArgs.input) {
        try {
          inputData = JSON.parse(parsedArgs.input);
        } catch (error) {
          console.error('Error parsing input JSON:', error);
          process.exit(1);
        }
      }

      // Set verbose mode for detailed execution tracking
      if (parsedArgs.verbose) {
        process.env.DEBUG_FLOW = 'true';
      }

      // Instantiate the flow
      console.log(`Instantiating flow ${FlowClass.name}...`);
      const flow = new FlowClass();

      // Set up execution tracking if verbose
      if (parsedArgs.verbose) {
        this.setupVerboseTracking(flow);
      }

      // Execute the flow with input data
      console.log(`Executing flow with${Object.keys(inputData).length > 0 ? ' provided' : ' default'} inputs...\n`);
      const startTime = Date.now();
      
      const result = await flow.execute(inputData);
      
      const endTime = Date.now();
      const executionTime = (endTime - startTime) / 1000;

      // Print results
      console.log(`\n✅ Flow execution completed in ${executionTime.toFixed(2)} seconds`);
      console.log('Result:', JSON.stringify(result, null, 2));

    } catch (error) {
      console.error('Error executing flow:', error);
      process.exit(1);
    }
  }

  /**
   * Parse command line arguments for the run-flow command
   */
  protected parseArgs(args: string[]): { flowPath?: string; input?: string; verbose?: boolean } {
    if (args.length === 0) {
      return {};
    }

    const result: { flowPath?: string; input?: string; verbose?: boolean } = {
      flowPath: args[0]
    };

    // Parse options
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--input' && i + 1 < args.length) {
        result.input = args[++i];
      } else if (args[i] === '--verbose') {
        result.verbose = true;
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
  
  /**
   * Set up verbose execution tracking for flow events
   * Optimized for detailed execution monitoring with minimal overhead
   */
  private setupVerboseTracking(flow: any): void {
    // Subscribe to flow events for verbose tracking
    flow.events.on('flow_started', (event: any) => {
      console.log(`🚀 Flow started with state ID: ${event.stateId}`);
    });
    
    flow.events.on('method_execution_started', (event: any) => {
      console.log(`▶️ Executing method: ${event.methodName}`);
    });
    
    flow.events.on('method_execution_finished', (event: any) => {
      console.log(`✅ Method ${event.methodName} completed`);
      // For verbose output, show the result
      console.log(`  Result: ${JSON.stringify(event.result)}`);
    });
    
    flow.events.on('method_execution_failed', (event: any) => {
      console.error(`❌ Method ${event.methodName} failed:`, event.error);
    });
    
    flow.events.on('flow_finished', (event: any) => {
      console.log(`🏁 Flow finished with state ID: ${event.stateId}`);
    });
  }
}
