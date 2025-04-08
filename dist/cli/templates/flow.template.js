/**
 * Flow template for the CLI's create-flow command
 * Performance-optimized with proper TypeScript types
 */
// Exported as a string to avoid TypeScript validation issues with template variables
export const flowTemplate = `/**
 * {{FlowName}} - A Flow for orchestrating tasks
 * Created with CrewAI CLI
 */
import { Flow, FlowState } from 'crewai-ts/flow';
import { start, listen, router, or_, and_ } from 'crewai-ts/flow/decorators';
import { CONTINUE, STOP } from 'crewai-ts/flow/types';

/**
 * State definition for {{FlowName}}
 */
export class {{FlowName}}State extends FlowState {
  // Define your flow state properties here
  progress: number = 0;
  startTime: number = 0;
  endTime: number = 0;
  completed: boolean = false;
  results: any = null;
  errors: string[] = [];
}

/**
 * {{FlowDescription}}
 */
export class {{FlowName}} extends Flow<{{FlowName}}State> {
  constructor(options: any = {}) {
    super({
      initialState: new {{FlowName}}State(),
      // Add any custom flow options here
    });
  }
  
  /**
   * Flow entry point - begins execution
   */
  @start()
  async begin() {
    console.log('Starting {{FlowName}} flow');
    this.state.startTime = Date.now();
    this.state.progress = 10;
    
    // Your flow initialization logic here
    
    return CONTINUE;
  }
  
  /**
   * Process the main flow logic
   * Triggered when 'begin' completes successfully
   */
  @listen('begin')
  async process() {
    console.log('Processing {{FlowName}} flow');
    this.state.progress = 50;
    
    try {
      // Your main flow logic here
      
      // Example: set results to flow state
      this.state.results = { success: true, data: 'Processing complete' };
      this.state.progress = 90;
      
      return this.state.results;
    } catch (error) {
      this.state.errors.push(\`Processing error: \${error.message}\`);
      return STOP;
    }
  }
  
  /**
   * Complete the flow and provide results
   * Triggered when 'process' completes successfully
   */
  @listen('process')
  async complete(processResult: any) {
    console.log('Completing {{FlowName}} flow');
    
    // Record completion metrics
    this.state.endTime = Date.now();
    this.state.completed = true;
    this.state.progress = 100;
    
    const executionTime = (this.state.endTime - this.state.startTime) / 1000;
    console.log(\`Flow completed in \${executionTime.toFixed(2)} seconds\`);
    
    return processResult;
  }
  
  /**
   * Handle any errors that occur during flow execution
   */
  @listen(or_('begin', 'process'))
  async handleError() {
    console.error('Error in {{FlowName}} flow:', this.state.errors);
    
    // Always mark as complete even on error
    this.state.endTime = Date.now();
    this.state.progress = 100;
    
    return { success: false, errors: this.state.errors };
  }
}`;
//# sourceMappingURL=flow.template.js.map