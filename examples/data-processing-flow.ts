/**
 * Optimized Data Processing Flow Example
 * 
 * This example demonstrates how to create a high-performance data processing pipeline
 * using the Flow system with multiple optimization techniques.
 */
import { Flow, FlowState } from '../src/flow/index.js';
import { start, listen, router, and_, or_ } from '../src/flow/decorators.js';
import { CONTINUE, STOP } from '../src/flow/types.js';
import { plotFlow } from '../src/flow/visualization/FlowVisualizer.js';
import * as fs from 'fs/promises';
import path from 'path';

// Sample data interfaces
interface DataPoint {
  id: string;
  value: number;
  timestamp: number;
  category: string;
  metadata?: Record<string, any>;
}

interface ProcessedResult {
  category: string;
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
  processingTime: number;
}

/**
 * Optimized state for data processing flow
 * Uses efficient data structures for performance
 */
class DataProcessingState extends FlowState {
  // Raw data storage with optimized memory usage
  rawData: DataPoint[] = [];
  
  // Use Maps for O(1) lookups by category
  dataByCategory: Map<string, DataPoint[]> = new Map();
  
  // Results with optimized structure for fast access
  results: Map<string, ProcessedResult> = new Map();
  
  // Performance metrics with high-resolution timing
  metrics: {
    loadTime: number;
    processingTime: number;
    totalTime: number;
    memoryUsage: {
      before: number;
      after: number;
      delta: number;
    };
    throughput: number; // items per second
    methodDurations: Map<string, number>;
  } = {
    loadTime: 0,
    processingTime: 0,
    totalTime: 0,
    memoryUsage: {
      before: 0,
      after: 0,
      delta: 0
    },
    throughput: 0,
    methodDurations: new Map()
  };
  
  // Configuration settings
  config: {
    batchSize: number;
    parallelism: number;
    dataSource: string;
    outputPath: string;
  } = {
    batchSize: 1000,
    parallelism: 4,
    dataSource: './data/sample-data.json',
    outputPath: './output/'
  };
}

/**
 * Optimized data processing flow with performance-focused implementation
 */
class DataProcessingFlow extends Flow<DataProcessingState> {
  constructor(config?: Partial<DataProcessingState['config']>) {
    const initialState = new DataProcessingState();
    
    // Apply configuration if provided
    if (config) {
      initialState.config = { ...initialState.config, ...config };
    }
    
    super({ 
      initialState,
      // Enable caching for expensive operations
      cacheResults: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      debug: process.env.DEBUG_FLOW === 'true'
    });
  }
  
  /**
   * Initialize the processing pipeline and measure initial memory usage
   */
  @start()
  async initialize() {
    console.log('Initializing data processing flow...');
    console.log(`Configuration: ${JSON.stringify(this.state.config, null, 2)}`);
    
    // Capture initial memory usage for optimization analysis
    this.state.metrics.memoryUsage.before = process.memoryUsage().heapUsed;
    
    // Ensure output directory exists with non-blocking I/O
    await fs.mkdir(this.state.config.outputPath, { recursive: true })
      .catch(err => {
        if (err.code !== 'EEXIST') throw err;
      });
    
    return CONTINUE;
  }
  
  /**
   * Load data from source with optimized I/O
   */
  @listen('initialize')
  async loadData() {
    console.log(`Loading data from ${this.state.config.dataSource}...`);
    const startTime = performance.now();
    
    try {
      // Check if file exists
      await fs.access(this.state.config.dataSource)
        .catch(() => {
          console.log('Sample data not found, generating...');
          return this.generateSampleData();
        });
      
      // Read data with optimized buffer handling
      const data = await fs.readFile(this.state.config.dataSource, 'utf8');
      this.state.rawData = JSON.parse(data) as DataPoint[];
      
      console.log(`Loaded ${this.state.rawData.length} data points`);
      
      // Track performance metrics
      this.state.metrics.loadTime = performance.now() - startTime;
      this.state.metrics.methodDurations.set('loadData', this.state.metrics.loadTime);
      
      return { dataCount: this.state.rawData.length };
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  }
  
  /**
   * Route to different processing paths based on data size for optimal performance
   */
  @listen('loadData')
  async analyzeDataSize(result: { dataCount: number }) {
    const dataCount = result.dataCount;
    console.log(`Analyzing data size: ${dataCount} points`);
    
    // Return sizing information for efficient routing
    return { 
      dataCount,
      isLarge: dataCount > 10000,
      isMedium: dataCount > 1000 && dataCount <= 10000,
      isSmall: dataCount <= 1000
    };
  }
  
  /**
   * Process large datasets with optimized batch processing
   */
  @listen('analyzeDataSize')
  @router((result) => result?.isLarge === true)
  async processLargeDataset() {
    console.log('Using optimized batch processing for large dataset');
    const startTime = performance.now();
    
    // Use batch processing for large datasets to optimize memory usage
    const batchSize = this.state.config.batchSize;
    const totalItems = this.state.rawData.length;
    const batchCount = Math.ceil(totalItems / batchSize);
    
    console.log(`Processing ${totalItems} items in ${batchCount} batches of ${batchSize}`);
    
    // Pre-allocate category arrays to avoid dynamic resizing
    const categories = new Set(this.state.rawData.map(item => item.category));
    categories.forEach(category => {
      this.state.dataByCategory.set(category, []);
    });
    
    // Process in optimized batches
    for (let i = 0; i < batchCount; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, totalItems);
      const batch = this.state.rawData.slice(start, end);
      
      console.log(`Processing batch ${i+1}/${batchCount} (${batch.length} items)`);
      
      // Group by category for optimized processing
      batch.forEach(item => {
        const categoryItems = this.state.dataByCategory.get(item.category)!;
        categoryItems.push(item);
      });
      
      // Optional: Yield to event loop periodically to prevent blocking
      if (i % 5 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Track metrics
    const duration = performance.now() - startTime;
    this.state.metrics.methodDurations.set('processLargeDataset', duration);
    
    return { processingType: 'batch', categories: Array.from(categories) };
  }
  
  /**
   * Process medium datasets with parallel processing
   */
  @listen('analyzeDataSize')
  @router((result) => result?.isMedium === true)
  async processMediumDataset() {
    console.log('Using parallel processing for medium dataset');
    const startTime = performance.now();
    
    // Group data by category first (single pass for efficiency)
    const categoryMap = new Map<string, DataPoint[]>();
    
    this.state.rawData.forEach(item => {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, []);
      }
      categoryMap.get(item.category)!.push(item);
    });
    
    // Store categorized data
    this.state.dataByCategory = categoryMap;
    
    // Track metrics
    const duration = performance.now() - startTime;
    this.state.metrics.methodDurations.set('processMediumDataset', duration);
    
    return { processingType: 'parallel', categories: Array.from(categoryMap.keys()) };
  }
  
  /**
   * Process small datasets with simple direct processing
   */
  @listen('analyzeDataSize')
  @router((result) => result?.isSmall === true)
  async processSmallDataset() {
    console.log('Using direct processing for small dataset');
    const startTime = performance.now();
    
    // For small datasets, use direct in-memory processing
    const categoryMap = new Map<string, DataPoint[]>();
    
    this.state.rawData.forEach(item => {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, []);
      }
      categoryMap.get(item.category)!.push(item);
    });
    
    // Store categorized data
    this.state.dataByCategory = categoryMap;
    
    // Track metrics
    const duration = performance.now() - startTime;
    this.state.metrics.methodDurations.set('processSmallDataset', duration);
    
    return { processingType: 'direct', categories: Array.from(categoryMap.keys()) };
  }
  
  /**
   * Calculate statistics for each category with optimized algorithms
   */
  @listen(or_('processLargeDataset', 'processMediumDataset', 'processSmallDataset'))
  async calculateStatistics(result: { categories: string[], processingType: string }) {
    console.log(`Calculating statistics for ${result.categories.length} categories...`);
    const startTime = performance.now();
    
    const { parallelism } = this.state.config;
    const categories = result.categories;
    
    // For better performance, process categories in parallel chunks
    const processCategory = async (category: string) => {
      const items = this.state.dataByCategory.get(category) || [];
      
      // Use optimized one-pass algorithm for statistics calculation
      // This reduces memory usage and computation time
      let count = 0;
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;
      
      const categoryStartTime = performance.now();
      
      // Single-pass for O(n) complexity
      for (const item of items) {
        count++;
        sum += item.value;
        min = Math.min(min, item.value);
        max = Math.max(max, item.value);
      }
      
      const average = count > 0 ? sum / count : 0;
      const processingTime = performance.now() - categoryStartTime;
      
      // Store results
      this.state.results.set(category, {
        category,
        count,
        sum,
        average,
        min: min === Infinity ? 0 : min,
        max: max === -Infinity ? 0 : max,
        processingTime
      });
      
      return { category, count, processingTime };
    };
    
    // Process in parallel batches for optimal CPU utilization
    const results = [];
    for (let i = 0; i < categories.length; i += parallelism) {
      const batch = categories.slice(i, i + parallelism);
      const batchResults = await Promise.all(batch.map(processCategory));
      results.push(...batchResults);
    }
    
    // Track metrics
    const duration = performance.now() - startTime;
    this.state.metrics.processingTime = duration;
    this.state.metrics.methodDurations.set('calculateStatistics', duration);
    
    // Calculate throughput for performance analysis
    const totalItems = this.state.rawData.length;
    this.state.metrics.throughput = totalItems / (duration / 1000);
    
    return { 
      totalCategories: categories.length,
      totalItems: this.state.rawData.length,
      processingTime: duration,
      throughput: this.state.metrics.throughput
    };
  }
  
  /**
   * Save results to files with optimized I/O
   */
  @listen('calculateStatistics')
  async saveResults() {
    console.log('Saving results to files...');
    const startTime = performance.now();
    
    try {
      // Convert map to array for serialization
      const results = Array.from(this.state.results.values());
      
      // Write summary file with all results
      const summaryFile = path.join(this.state.config.outputPath, 'summary.json');
      await fs.writeFile(summaryFile, JSON.stringify(results, null, 2));
      
      // Write individual category files in parallel for performance
      const writePromises = results.map(result => {
        const categoryFile = path.join(
          this.state.config.outputPath, 
          `${result.category}.json`
        );
        return fs.writeFile(categoryFile, JSON.stringify(result, null, 2));
      });
      
      await Promise.all(writePromises);
      
      // Track metrics
      const duration = performance.now() - startTime;
      this.state.metrics.methodDurations.set('saveResults', duration);
      
      return { 
        filesWritten: results.length + 1,  // +1 for summary
        outputPath: this.state.config.outputPath
      };
    } catch (error) {
      console.error('Error saving results:', error);
      throw error;
    }
  }
  
  /**
   * Finalize processing and compile all metrics
   */
  @listen('saveResults')
  async finalize() {
    console.log('Finalizing data processing...');
    
    // Capture final memory usage
    this.state.metrics.memoryUsage.after = process.memoryUsage().heapUsed;
    this.state.metrics.memoryUsage.delta = 
      this.state.metrics.memoryUsage.after - this.state.metrics.memoryUsage.before;
    
    // Calculate total time
    this.state.metrics.totalTime = 
      this.state.metrics.loadTime + this.state.metrics.processingTime;
    
    // Log performance summary
    console.log('\nPerformance metrics:');
    console.log(`- Total data points: ${this.state.rawData.length}`);
    console.log(`- Total categories: ${this.state.results.size}`);
    console.log(`- Load time: ${this.state.metrics.loadTime.toFixed(2)}ms`);
    console.log(`- Processing time: ${this.state.metrics.processingTime.toFixed(2)}ms`);
    console.log(`- Total time: ${this.state.metrics.totalTime.toFixed(2)}ms`);
    console.log(`- Throughput: ${this.state.metrics.throughput.toFixed(2)} items/second`);
    console.log(`- Memory usage delta: ${(this.state.metrics.memoryUsage.delta / 1024 / 1024).toFixed(2)}MB`);
    
    // Method durations
    console.log('\nMethod durations:');
    this.state.metrics.methodDurations.forEach((duration, method) => {
      console.log(`- ${method}: ${duration.toFixed(2)}ms`);
    });
    
    // Return comprehensive results and metrics
    return {
      status: 'success',
      results: {
        categoryCount: this.state.results.size,
        totalItems: this.state.rawData.length,
        categories: Array.from(this.state.results.keys())
      },
      metrics: {
        loadTime: this.state.metrics.loadTime,
        processingTime: this.state.metrics.processingTime,
        totalTime: this.state.metrics.totalTime,
        throughput: this.state.metrics.throughput,
        memoryUsage: this.state.metrics.memoryUsage,
        methodDurations: Object.fromEntries(this.state.metrics.methodDurations)
      }
    };
  }
  
  /**
   * Handle any errors during processing
   */
  @listen('*')
  async handleError(input: any, error: Error) {
    console.error('Error in data processing flow:', error);
    
    return {
      status: 'error',
      error: error.message,
      metrics: {
        methodDurations: Object.fromEntries(this.state.metrics.methodDurations)
      }
    };
  }
  
  /**
   * Generate sample data for testing
   * Uses efficient data generation techniques
   */
  private async generateSampleData(): Promise<void> {
    console.log('Generating sample data...');
    const categories = ['A', 'B', 'C', 'D', 'E'];
    const sampleSize = 5000;
    
    // Generate sample data efficiently
    const data: DataPoint[] = [];
    const now = Date.now();
    
    // Pre-allocate array size for better performance
    data.length = sampleSize;
    
    for (let i = 0; i < sampleSize; i++) {
      data[i] = {
        id: `item-${i}`,
        value: Math.random() * 100,
        timestamp: now - Math.floor(Math.random() * 86400000), // Random time in last 24h
        category: categories[Math.floor(Math.random() * categories.length)],
        metadata: {
          source: 'generated',
          batch: Math.floor(i / 1000)
        }
      };
    }
    
    // Ensure output directory exists
    const dataDir = path.dirname(this.state.config.dataSource);
    await fs.mkdir(dataDir, { recursive: true })
      .catch(err => {
        if (err.code !== 'EEXIST') throw err;
      });
    
    // Write data file
    await fs.writeFile(this.state.config.dataSource, JSON.stringify(data, null, 2));
    
    // Update state
    this.state.rawData = data;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('Starting data processing flow with optimized execution...');
  
  try {
    // Create flow with custom configuration
    const flow = new DataProcessingFlow({
      batchSize: 1000,
      parallelism: Math.max(1, Math.floor(navigator.hardwareConcurrency / 2) || 2), // Use half available cores
      dataSource: './data/sample-data.json',
      outputPath: './output/'
    });
    
    // Subscribe to performance-related events
    flow.events.on('flow_started', () => {
      console.log(`[${new Date().toISOString()}] Flow execution started`);
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
    const visualizationPath = await plotFlow(flow, 'data-processing-flow', './visualizations');
    console.log(`Flow visualization saved to: ${visualizationPath}`);
    
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
export { DataProcessingFlow, DataProcessingState, main };
