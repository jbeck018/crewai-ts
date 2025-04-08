/**
 * CLI command for scaffolding a new Flow.
 * Optimized for developer experience with intelligent defaults.
 */
import fs from 'fs';
import path from 'path';
import { Command } from '../Command.js';

export class CreateFlowCommand extends Command {
  readonly name = 'create-flow';
  readonly description = 'Scaffold a new Flow class file';
  readonly syntax = '<flow-name> [options]';
  readonly examples = [
    'create-flow MyWorkflow',
    'create-flow DataProcessingFlow --path ./src/flows',
    'create-flow UserOnboardingFlow --with-example'
  ];

  override async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    
    if (!parsedArgs.flowName) {
      console.error('Error: Flow name is required');
      this.showHelp();
      process.exit?.(1);
    }

    try {
      // Ensure the flow name has proper casing
      const flowName = this.formatFlowName(parsedArgs.flowName);
      
      // Prepare the output directory
      const outputDir = parsedArgs.path || './src/flows';
      const outputPath = path.resolve(process.cwd?.() || '', outputDir);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }
      
      // Generate the flow file
      const flowFilePath = path.join(outputPath, `${flowName}.ts`);
      
      // Check if file already exists to avoid overwriting
      if (fs.existsSync(flowFilePath)) {
        console.error(`Error: Flow file already exists at ${flowFilePath}`);
        process.exit?.(1);
      }
      
      // Generate the flow file content
      const template = parsedArgs.withExample ? 
        this.getExampleFlowTemplate(flowName) : 
        this.getBasicFlowTemplate(flowName);
      
      // Write the file
      fs.writeFileSync(flowFilePath, template, 'utf8');
      
      console.log(`\n✅ Successfully created new Flow class!`);
      console.log(`File: ${flowFilePath}`);
      console.log(`\nYou can now start adding methods to your Flow class.`);
      console.log(`To visualize your flow, use: plot-flow ${flowFilePath}`);
      
    } catch (error) {
      console.error('Error creating flow file:', error);
      process.exit?.(1);
    }
  }

  /**
   * Parse command line arguments for the create-flow command
   */
  protected override parseArgs(args: string[]): { flowName?: string; path?: string; withExample?: boolean } {
    if (args.length === 0) {
      return {};
    }

    const result: { flowName?: string; path?: string; withExample?: boolean } = {
      flowName: args[0]
    };

    // Parse options
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--path' && i + 1 < args.length) {
        result.path = args[++i];
      } else if (args[i] === '--with-example') {
        result.withExample = true;
      }
    }

    return result;
  }

  /**
   * Format the flow name to ensure it follows naming conventions
   */
  private formatFlowName(name: string): string {
    // Remove common suffixes if they exist
    let flowName = name;
    if (flowName.endsWith('Flow')) {
      flowName = flowName;
    } else {
      flowName = `${flowName}Flow`;
    }
    
    // Ensure PascalCase
    return flowName.charAt(0).toUpperCase() + flowName.slice(1);
  }

  /**
   * Get a basic Flow class template with optimized loading
   */
  private getBasicFlowTemplate(flowName: string): string {
    // Use the hardcoded template for now until we add proper flow template handling
    // This ensures maximum compatibility with different development environments
    return `/**
 * ${flowName} - A flow for orchestrating a sequence of operations.
 */
import { Flow, FlowState } from 'crewai-ts/flow';
import { start, listen, router, and_, or_ } from 'crewai-ts/flow/decorators';
import { CONTINUE, STOP } from 'crewai-ts/flow/types';

/**
 * State for the ${flowName}
 */
export class ${flowName}State extends FlowState {
  // Define your flow state properties here
  // For example:
  // progress: number = 0;
  // data: any = null;
  // errors: string[] = [];
}

/**
 * ${flowName} - Add your flow description here
 */
export class ${flowName} extends Flow<${flowName}State> {
  constructor() {
    // Initialize with default state
    super({
      initialState: new ${flowName}State()
    });
  }
  
  /**
   * Starting point for the flow
   */
  @start()
  async begin() {
    console.log('Flow started');
    // Add your flow implementation here
    return CONTINUE;
  }
}
`;
  }

  /**
   * Get an example Flow class template with more methods and patterns
   */
  private getExampleFlowTemplate(flowName: string): string {
    return `/**
 * \${flowName} - A detailed example flow showing various patterns.
 */
import { Flow, FlowState } from 'crewai-ts/flow';
import { start, listen, router, and_, or_ } from 'crewai-ts/flow/decorators';
import { CONTINUE, STOP } from 'crewai-ts/flow/types';

/**
 * State for the ${flowName}
 */
export class ${flowName}State extends FlowState {
  // Flow execution tracking
  progress: number = 0;
  completed: boolean = false;
  hasErrors: boolean = false;
  
  // Data storage
  inputData: any = null;
  processedData: any = null;
  results: any[] = [];
  errors: string[] = [];
  
  // Timing information
  startTime: number = 0;
  endTime: number = 0;
}

/**
 * ${flowName} - An example flow demonstrating various flow patterns
 * and techniques for effective flow composition.
 */
export class ${flowName} extends Flow<${flowName}State> {
  constructor() {
    // Initialize with default state
    super({
      initialState: new ${flowName}State()
    });
  }
  
  /**
   * Starting point for the flow
   */
  @start()
  async begin() {
    // Record start time
    this.state.startTime = Date.now();
    console.log('Flow started');
    
    // Initialize flow execution
    this.state.progress = 10;
    
    // Input validation
    return CONTINUE;
  }
  
  /**
   * Validate input data
   * This method is triggered after the flow begins
   */
  @listen('begin')
  async validateInput(previousResult: any) {
    console.log('Validating input data...');
    
    try {
      // Simulate input validation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update state
      this.state.progress = 30;
      this.state.inputData = { valid: true, data: 'example data' };
      
      console.log('Input data valid');
      return this.state.inputData;
    } catch (error) {
      // Handle validation errors
      this.state.hasErrors = true;
      this.state.errors.push('Input validation failed');
      return STOP;
    }
  }
  
  /**
   * Process the validated data
   * This method is triggered after input validation completes
   */
  @listen('validateInput')
  async processData(inputData: any) {
    console.log('Processing data...');
    
    // Simulate data processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Process the data
    this.state.processedData = {
      ...inputData,
      processed: true,
      timestamp: new Date().toISOString()
    };
    
    // Update progress
    this.state.progress = 60;
    
    console.log('Data processing complete');
    return this.state.processedData;
  }
  
  /**
   * Generate results from processed data
   * This method is triggered after data processing completes
   */
  @listen('processData')
  async generateResults(processedData: any) {
    console.log('Generating results...');
    
    // Simulate result generation
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Generate results
    this.state.results = [
      { id: 1, value: 'Result 1', source: processedData },
      { id: 2, value: 'Result 2', source: processedData }
    ];
    
    // Update progress
    this.state.progress = 90;
    
    console.log(\`Generated \${this.state.results.length} results\`);
    return this.state.results;
  }
  
  /**
   * Complete the flow
   * This method is triggered after results are generated
   */
  @listen('generateResults')
  async complete(results: any[]) {
    console.log('Completing flow...');
    
    // Record completion time
    this.state.endTime = Date.now();
    this.state.completed = true;
    this.state.progress = 100;
    
    // Calculate execution time
    const executionTime = (this.state.endTime - this.state.startTime) / 1000;
    console.log(\`Flow completed in \${executionTime.toFixed(2)} seconds\`);
    console.log(\`Generated \${results.length} results\`);
    
    // Signal flow completion
    return STOP;
  }
  
  /**
   * Error handler that listens to multiple methods
   * This demonstrates using OR condition to trigger on any error
   */
  @listen(or_('validateInput', 'processData', 'generateResults'))
  async handleError(error: any) {
    console.error('Error in flow execution:', error);
    
    // Update error state
    this.state.hasErrors = true;
    this.state.errors.push(error.message || 'Unknown error');
    
    // Record completion with error
    this.state.endTime = Date.now();
    
    console.log('Flow stopped due to error');
    return STOP;
  }
  
  /**
   * Example of a routing method that determines flow path
   * based on conditions in the state
   */
  @router('validateInput')
  async routeProcessing(inputData: any) {
    if (!inputData || !inputData.valid) {
      console.log('Input validation failed, stopping flow');
      return STOP;
    }
    
    if (inputData.priority === 'high') {
      console.log('High priority processing route');
      // Could trigger a different processing method
    } else {
      console.log('Standard processing route');
    }
    
    return CONTINUE;
  }
}
`;
  }
}
