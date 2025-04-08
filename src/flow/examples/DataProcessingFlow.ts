/**
 * Example data processing flow demonstrating key Flow system features
 * with various performance optimizations.
 */
import { Flow, FlowState } from '../index.js';
import { start, listen, router, or_, and_ } from '../decorators.js';
import { CONTINUE, STOP } from '../types.js';

/**
 * Sample data for processing
 */
interface SampleData {
  id: string;
  value: number;
  timestamp: string;
  processed?: boolean;
  validationErrors?: string[];
}

/**
 * State definition for DataProcessingFlow
 * Uses strict typing for improved performance and safety
 */
export class DataProcessingState extends FlowState {
  // Execution tracking with optimized data types
  progress: number = 0;
  startTime: number = 0;
  endTime: number = 0;
  executionTimeMs: number = 0;
  completed: boolean = false;
  
  // Data storage with strong typing for improved performance
  inputData: SampleData[] = [];
  validData: SampleData[] = [];
  invalidData: SampleData[] = [];
  processedData: SampleData[] = [];
  summary: Record<string, number> = {};
  
  // Error handling
  hasErrors: boolean = false;
  errorMessages: string[] = [];
}

/**
 * Example data processing flow with performance optimizations.
 * Demonstrates:
 * - Parallel data processing
 * - Intelligent flow branching
 * - Optimized state management
 * - Type-safe implementation
 */
export class DataProcessingFlow extends Flow<DataProcessingState> {
  constructor(initialData: SampleData[] = []) {
    super({
      initialState: new DataProcessingState()
    });
    
    // Pre-populate with initial data if provided
    this.state.inputData = initialData;
  }
  
  /**
   * Starting point for the flow
   * Initializes execution tracking and validates inputs
   */
  // @ts-ignore - Decorator type compatibility issue
  @start()
  async begin() {
    console.log('Starting data processing flow');
    
    // Record start time for performance tracking
    this.state.startTime = Date.now();
    this.state.progress = 5;
    
    // Check if we have data to process
    if (this.state.inputData.length === 0) {
      console.log('No input data provided');
      this.state.errorMessages.push('No input data to process');
      this.state.hasErrors = true;
      return STOP;
    }
    
    console.log(`Found ${this.state.inputData.length} data items to process`);
    this.state.progress = 10;
    return CONTINUE;
  }
  
  /**
   * Validates input data with parallel processing for performance
   */
  // @ts-ignore - Decorator type compatibility issue
  @listen('begin')
  async validateData() {
    console.log('Validating input data...');
    
    // Use Promise.all for parallel validation (performance optimization)
    const validationResults = await Promise.all(
      this.state.inputData.map(this.validateDataItem.bind(this))
    );
    
    // Split into valid and invalid data
    this.state.validData = validationResults.filter(item => 
      !item.validationErrors || item.validationErrors.length === 0
    );
    
    this.state.invalidData = validationResults.filter(item => 
      item.validationErrors && item.validationErrors.length > 0
    );
    
    // Update progress
    this.state.progress = 30;
    
    console.log(`Validation complete: ${this.state.validData.length} valid, ${this.state.invalidData.length} invalid`);
    
    if (this.state.validData.length === 0) {
      this.state.errorMessages.push('No valid data items to process');
      this.state.hasErrors = true;
      return STOP;
    }
    
    return this.state.validData;
  }
  
  /**
   * Validates a single data item (used by parallel validator)
   * Pure function design for better performance
   */
  private async validateDataItem(item: SampleData): Promise<SampleData> {
    const errors: string[] = [];
    
    // Simulate validation checks
    if (!item.id) errors.push('Missing ID');
    if (typeof item.value !== 'number') errors.push('Invalid value type');
    if (item.value < 0) errors.push('Value must be positive');
    if (!item.timestamp) errors.push('Missing timestamp');
    
    // Simulate some async validation that might take time
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return {
      ...item,
      validationErrors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * Processes validated data in parallel for maximum performance
   */
  // @ts-ignore - Decorator type compatibility issue
  @listen('validateData')
  async processData(validatedData: SampleData[]) {
    console.log(`Processing ${validatedData.length} valid items...`);
    
    try {
      // Process items in parallel for maximum performance
      this.state.processedData = await Promise.all(
        validatedData.map(this.processDataItem.bind(this))
      );
      
      // Update progress
      this.state.progress = 70;
      
      console.log(`Processed ${this.state.processedData.length} items`);
      return this.state.processedData;
    } catch (error) {
      this.state.errorMessages.push(`Processing error: ${(error as Error).message}`);
      this.state.hasErrors = true;
      return STOP;
    }
  }
  
  /**
   * Processes a single data item (used by parallel processor)
   * Pure function design for better performance
   */
  private async processDataItem(item: SampleData): Promise<SampleData> {
    // Simulate processing that takes time
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Apply transformation to the item
    return {
      ...item,
      value: item.value * 2, // Double the value as sample processing
      processed: true
    };
  }
  
  /**
   * Analyzes processed data and generates summary metrics
   */
  // @ts-ignore - Decorator type compatibility issue
  @listen('processData')
  async analyzeResults(processedData: SampleData[]) {
    console.log('Generating results summary...');
    
    // Calculate summary statistics
    const sum = processedData.reduce((acc, item) => acc + item.value, 0);
    const average = sum / processedData.length;
    const min = Math.min(...processedData.map(item => item.value));
    const max = Math.max(...processedData.map(item => item.value));
    
    // Save to state
    this.state.summary = {
      count: processedData.length,
      sum,
      average,
      min,
      max
    };
    
    // Update progress
    this.state.progress = 90;
    
    console.log('Analysis complete');
    return this.state.summary;
  }
  
  /**
   * Finalizes the flow and provides completion metrics
   */
  // @ts-ignore - Decorator type compatibility issue
  @listen('analyzeResults')
  async complete() {
    // Record completion time and calculate execution time
    this.state.endTime = Date.now();
    this.state.executionTimeMs = this.state.endTime - this.state.startTime;
    this.state.completed = true;
    this.state.progress = 100;
    
    console.log(`Flow completed in ${this.state.executionTimeMs} ms`);
    console.log(`Processed ${this.state.processedData.length} items successfully`);
    console.log(`Found ${this.state.invalidData.length} invalid items`);
    
    return STOP;
  }
  
  /**
   * Error handler that listens to multiple methods
   * Uses OR condition to trigger on any error
   */
  // @ts-ignore - Decorator type compatibility issue
  @listen(or_('validateData', 'processData', 'analyzeResults'))
  async handleError() {
    console.error('Error detected in flow:', this.state.errorMessages);
    
    // Record completion time with error
    this.state.endTime = Date.now();
    this.state.executionTimeMs = this.state.endTime - this.state.startTime;
    this.state.hasErrors = true;
    
    // Always indicate 100% even on error - better UX
    this.state.progress = 100;
    
    return STOP;
  }
}
