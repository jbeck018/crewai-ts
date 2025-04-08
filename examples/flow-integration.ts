/**
 * Flow system integration example with optimized performance.
 * 
 * This example demonstrates how to use the Flow system with Agents and Crews.
 */
import { Agent, Crew, Task } from '../src/index.js';
import { Flow, FlowState } from '../src/flow/index.js';
import { start, listen, router, and_ } from '../src/flow/decorators.js';
import { CONTINUE, STOP } from '../src/flow/types.js';
import { plotFlow } from '../src/flow/visualization/FlowVisualizer.js';

/**
 * Custom state for the integration flow
 * Includes optimized data structures for performance
 */
class ResearchFlowState extends FlowState {
  // Store agents with specific roles for quick access
  agents: Map<string, Agent> = new Map();
  
  // Store tasks with optimized indexing
  tasks: Map<string, Task> = new Map();
  
  // Store crew instance
  crew?: Crew;
  
  // Store results with efficient access patterns
  results: {
    research: any;
    writing: any;
    final: any;
  } = {
    research: null,
    writing: null,
    final: null
  };
  
  // Performance metrics
  metrics: {
    startTime: number;
    endTime?: number;
    duration?: number;
    methodDurations: Map<string, number>;
  } = {
    startTime: Date.now(),
    methodDurations: new Map()
  };
}

/**
 * Research flow that orchestrates agents for an optimized research and report process
 * Uses the Flow system for execution control and visualization
 */
class ResearchFlow extends Flow<ResearchFlowState> {
  constructor() {
    super({
      initialState: new ResearchFlowState(),
      // Performance optimizations
      cacheResults: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      debug: process.env.DEBUG_FLOW === 'true'
    });
  }
  
  /**
   * Initialize agents with optimized creation
   */
  @start()
  async createAgents() {
    console.log('Creating optimized agents...');
    const startTime = performance.now();
    
    // Create agents in parallel with optimized configurations
    const [researcher, writer, reviewer] = await Promise.all([
      this.createResearcher(),
      this.createWriter(),
      this.createReviewer()
    ]);
    
    // Store in state with role-based indexing for quick access
    this.state.agents.set('researcher', researcher);
    this.state.agents.set('writer', writer);
    this.state.agents.set('reviewer', reviewer);
    
    // Track performance metrics
    const duration = performance.now() - startTime;
    this.state.metrics.methodDurations.set('createAgents', duration);
    console.log(`Agents created in ${duration.toFixed(2)}ms`);
    
    return CONTINUE;
  }
  
  /**
   * Create optimized tasks for each agent
   */
  @listen('createAgents')
  async createTasks() {
    console.log('Creating optimized tasks...');
    const startTime = performance.now();
    
    // Get agents from state
    const researcher = this.state.agents.get('researcher')!;
    const writer = this.state.agents.get('writer')!;
    const reviewer = this.state.agents.get('reviewer')!;
    
    // Create tasks with performance-optimized configurations
    const researchTask = new Task({
      description: 'Research the latest advancements in AI flow systems',
      agent: researcher,
      // Add performance hints for task execution
      metadata: {
        priority: 'high',
        expectedDuration: '5m',
        cacheable: true
      }
    });
    
    const writingTask = new Task({
      description: 'Write a comprehensive report on AI flow systems',
      agent: writer,
      // Add dependency information for optimization
      dependsOn: [researchTask],
      metadata: {
        priority: 'medium',
        expectedDuration: '10m',
        cacheable: false
      }
    });
    
    const reviewTask = new Task({
      description: 'Review and improve the AI flow systems report',
      agent: reviewer,
      dependsOn: [writingTask],
      metadata: {
        priority: 'low',
        expectedDuration: '3m',
        cacheable: false
      }
    });
    
    // Store tasks with name-based indexing
    this.state.tasks.set('research', researchTask);
    this.state.tasks.set('writing', writingTask);
    this.state.tasks.set('review', reviewTask);
    
    // Track performance metrics
    const duration = performance.now() - startTime;
    this.state.metrics.methodDurations.set('createTasks', duration);
    console.log(`Tasks created in ${duration.toFixed(2)}ms`);
    
    return CONTINUE;
  }
  
  /**
   * Create a crew with the optimized agents and tasks
   */
  @listen('createTasks')
  async createCrew() {
    console.log('Creating optimized crew...');
    const startTime = performance.now();
    
    // Get all tasks in correct execution order
    const tasks = [
      this.state.tasks.get('research')!,
      this.state.tasks.get('writing')!,
      this.state.tasks.get('review')!
    ];
    
    // Create crew with performance configuration
    this.state.crew = new Crew({
      agents: Array.from(this.state.agents.values()),
      tasks,
      process: 'sequential', // Optimize for data dependencies
      verbose: true,
      // Add performance configuration
      config: {
        maxConcurrency: 2, // Limit concurrent tasks for optimal resource usage
        resultCaching: true, // Enable result caching
        timeoutMinutes: 30 // Set reasonable timeout
      }
    });
    
    // Track performance metrics
    const duration = performance.now() - startTime;
    this.state.metrics.methodDurations.set('createCrew', duration);
    console.log(`Crew created in ${duration.toFixed(2)}ms`);
    
    return CONTINUE;
  }
  
  /**
   * Execute the research task with performance monitoring
   */
  @listen('createCrew')
  async executeResearch() {
    console.log('Executing research task...');
    const startTime = performance.now();
    
    // Execute research task independently
    const researchTask = this.state.tasks.get('research')!;
    const result = await researchTask.execute();
    
    // Store result
    this.state.results.research = result;
    
    // Track performance metrics
    const duration = performance.now() - startTime;
    this.state.metrics.methodDurations.set('executeResearch', duration);
    console.log(`Research completed in ${duration.toFixed(2)}ms`);
    
    return { research: result };
  }
  
  /**
   * Execute the writing task with performance monitoring
   */
  @listen('executeResearch')
  async executeWriting() {
    console.log('Executing writing task...');
    const startTime = performance.now();
    
    // Execute writing task with research results
    const writingTask = this.state.tasks.get('writing')!;
    const result = await writingTask.execute({
      researchResults: this.state.results.research
    });
    
    // Store result with optimized structure
    this.state.results.writing = result;
    
    // Track performance metrics
    const duration = performance.now() - startTime;
    this.state.metrics.methodDurations.set('executeWriting', duration);
    console.log(`Writing completed in ${duration.toFixed(2)}ms`);
    
    return { writing: result };
  }
  
  /**
   * Execute the review task with quality check routing
   */
  @listen('executeWriting')
  async executeReview() {
    console.log('Executing review task...');
    const startTime = performance.now();
    
    // Execute review task with writing results
    const reviewTask = this.state.tasks.get('review')!;
    const result = await reviewTask.execute({
      report: this.state.results.writing
    });
    
    // Store result
    this.state.results.final = result;
    
    // Track performance metrics
    const duration = performance.now() - startTime;
    this.state.metrics.methodDurations.set('executeReview', duration);
    console.log(`Review completed in ${duration.toFixed(2)}ms`);
    
    // Return quality score for routing
    return { 
      review: result,
      qualityScore: this.calculateQualityScore(result)
    };
  }
  
  /**
   * Handle high quality reports (score >= 8)
   */
  @listen('executeReview')
  @router((result) => result?.qualityScore >= 8)
  async handleHighQualityReport() {
    console.log('Processing high quality report...');
    const report = this.state.results.final;
    
    // Additional processing for high quality reports
    return { 
      status: 'completed', 
      quality: 'high',
      report
    };
  }
  
  /**
   * Handle medium quality reports (score 4-7)
   */
  @listen('executeReview')
  @router((result) => result?.qualityScore >= 4 && result?.qualityScore < 8)
  async handleMediumQualityReport() {
    console.log('Processing medium quality report...');
    const report = this.state.results.final;
    
    // Additional processing for medium quality reports
    return { 
      status: 'completed', 
      quality: 'medium',
      report
    };
  }
  
  /**
   * Handle low quality reports (score < 4)
   */
  @listen('executeReview')
  @router((result) => result?.qualityScore < 4)
  async handleLowQualityReport() {
    console.log('Processing low quality report...');
    const report = this.state.results.final;
    
    // For low quality, trigger a revision
    const revisedReport = await this.reviseReport(report);
    this.state.results.final = revisedReport;
    
    return { 
      status: 'revised', 
      quality: 'improved',
      report: revisedReport
    };
  }
  
  /**
   * Finalize the flow execution with any quality level
   */
  @listen(and_('handleHighQualityReport', 'handleMediumQualityReport', 'handleLowQualityReport'))
  async finalizeReport(results: any) {
    console.log('Finalizing report...');
    const startTime = performance.now();
    
    // Complete performance metrics
    this.state.metrics.endTime = Date.now();
    this.state.metrics.duration = this.state.metrics.endTime - this.state.metrics.startTime;
    
    // Log performance summary
    console.log('Flow execution completed:');
    console.log(`Total duration: ${this.state.metrics.duration}ms`);
    console.log('Method durations:');
    this.state.metrics.methodDurations.forEach((duration, method) => {
      console.log(`  ${method}: ${duration.toFixed(2)}ms`);
    });
    
    // Return final result with comprehensive data
    return {
      status: 'success',
      report: this.state.results.final,
      metrics: {
        totalDuration: this.state.metrics.duration,
        methodDurations: Object.fromEntries(this.state.metrics.methodDurations)
      }
    };
  }
  
  /**
   * Create a researcher agent with optimized configuration
   */
  private async createResearcher(): Promise<Agent> {
    return new Agent({
      role: 'AI Research Specialist',
      goal: 'Gather comprehensive and accurate information about AI flow systems',
      backstory: 'You are an expert in AI systems with a focus on workflow orchestration. ' + 
                'You have deep knowledge of AI architectures and performance optimization.',
      // Performance configuration
      allowDelegation: false, // Optimize for direct execution
      verbose: false // Minimize logging
    });
  }
  
  /**
   * Create a writer agent with optimized configuration
   */
  private async createWriter(): Promise<Agent> {
    return new Agent({
      role: 'Technical Writer',
      goal: 'Create clear, comprehensive reports on technical subjects',
      backstory: 'You are a skilled technical writer with expertise in explaining ' + 
                'complex systems. You excel at organizing information logically.',
      // Performance configuration
      allowDelegation: false,
      verbose: false
    });
  }
  
  /**
   * Create a reviewer agent with optimized configuration
   */
  private async createReviewer(): Promise<Agent> {
    return new Agent({
      role: 'Quality Assurance Specialist',
      goal: 'Ensure accuracy, clarity, and completeness of technical reports',
      backstory: 'You have years of experience reviewing technical documentation. ' + 
                'You have an eye for detail and can identify gaps in information.',
      // Performance configuration
      allowDelegation: false,
      verbose: false
    });
  }
  
  /**
   * Calculate quality score based on review result
   * Uses an optimized scoring algorithm
   */
  private calculateQualityScore(reviewResult: any): number {
    // In a real implementation, this would analyze the review content
    // For this example, we'll use a random score between 1-10
    return Math.floor(Math.random() * 10) + 1;
  }
  
  /**
   * Revise a low-quality report
   * Uses optimized processing strategies
   */
  private async reviseReport(report: any): Promise<any> {
    console.log('Revising low quality report...');
    const writer = this.state.agents.get('writer')!;
    
    // Create a revision task
    const revisionTask = new Task({
      description: 'Revise and improve the quality of this report on AI flow systems',
      agent: writer,
      // Pass context for better revision
      context: {
        originalReport: report,
        revisionNeeded: true,
        focusAreas: ['clarity', 'completeness', 'accuracy']
      }
    });
    
    // Execute the revision
    const revisedReport = await revisionTask.execute();
    return revisedReport;
  }
  
  /**
   * Handle any errors that occur during flow execution
   */
  @listen('*')
  async handleError(input: any, error: Error) {
    console.error('Error in flow execution:', error);
    
    // Record error in metrics
    this.state.metrics.endTime = Date.now();
    this.state.metrics.duration = this.state.metrics.endTime - this.state.metrics.startTime;
    
    return {
      status: 'error',
      error: error.message,
      metrics: {
        totalDuration: this.state.metrics.duration,
        methodDurations: Object.fromEntries(this.state.metrics.methodDurations)
      }
    };
  }
}

/**
 * Main execution function with performance optimization
 */
async function main() {
  console.log('Starting research flow with optimized execution...');
  
  try {
    // Create and execute the flow
    const flow = new ResearchFlow();
    
    // Subscribe to performance-related events
    flow.events.on('flow_started', () => {
      console.log('Flow execution started');
    });
    
    flow.events.on('method_execution_started', (event) => {
      console.log(`[${new Date().toISOString()}] Starting method: ${event.methodName}`);
    });
    
    flow.events.on('method_execution_finished', (event) => {
      console.log(`[${new Date().toISOString()}] Finished method: ${event.methodName} in ${event.duration}ms`);
    });
    
    // Execute the flow with performance tracking
    console.time('Total flow execution');
    const result = await flow.execute();
    console.timeEnd('Total flow execution');
    
    // Generate flow visualization for analysis
    console.log('Generating flow visualization...');
    const visualizationPath = await plotFlow(flow, 'research-flow', './visualizations');
    console.log(`Flow visualization saved to: ${visualizationPath}`);
    
    // Display final result
    console.log('\nFinal result:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('Error in main execution:', error);
    throw error;
  }
}

// Execute the example if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

// Export for testing and reuse
export { ResearchFlow, ResearchFlowState, main };
