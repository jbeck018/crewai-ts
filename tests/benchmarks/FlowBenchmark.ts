/**
 * Flow System Performance Benchmark Suite
 * 
 * Comprehensive benchmarks to measure performance of the Flow System
 * under various loads and configurations.
 */

import { Flow, FlowState } from '../../src/flow/index.js';
import { start, listen, router, and_, or_ } from '../../src/flow/decorators.js';
import { CONTINUE } from '../../src/flow/types.js';
import { FlowMemoryConnector } from '../../src/flow/memory/FlowMemoryConnector.js';
import { plotFlow } from '../../src/flow/visualization/FlowVisualizer.js';
import * as fs from 'fs/promises';
import path from 'path';

// Define benchmark suite configuration
interface BenchmarkConfig {
  name: string;
  iterations: number;
  warmupIterations: number;
  flowOptions?: any;
  memoryOptions?: any;
  dataSize?: 'small' | 'medium' | 'large';
  description?: string;
}

// Benchmark metrics
interface BenchmarkMetrics {
  name: string;
  description?: string;
  iterations: number;
  meanExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  stdDeviation: number;
  medianExecutionTime: number;
  memoryUsage: {
    before: number;
    after: number;
    delta: number;
  };
  methodMetrics: Record<string, {
    mean: number;
    min: number;
    max: number;
  }>;
  timestamp: string;
  config: any;
}

// Define a state type that can be scaled in size
class BenchmarkFlowState extends FlowState {
  // Scalable data structures
  dataMap: Map<string, any> = new Map();
  results: any[] = [];
  inputSize: number = 0;
  processedCount: number = 0;
  
  // Method durations tracking
  methodDurations: Map<string, number[]> = new Map();
}

/**
 * Benchmark flow with configurable complexity and optimizations
 */
class BenchmarkFlow extends Flow<BenchmarkFlowState> {
  constructor(options: any = {}) {
    super({
      initialState: new BenchmarkFlowState(),
      ...options
    });
  }
  
  // Record execution time for each method
  private trackMethodDuration(method: string, duration: number) {
    if (!this.state.methodDurations.has(method)) {
      this.state.methodDurations.set(method, []);
    }
    this.state.methodDurations.get(method)!.push(duration);
  }
  
  @start()
  async initialize() {
    const startTime = performance.now();
    
    // Reset the state
    this.state.dataMap.clear();
    this.state.results = [];
    this.state.processedCount = 0;
    
    const duration = performance.now() - startTime;
    this.trackMethodDuration('initialize', duration);
    
    return CONTINUE;
  }
  
  @listen('initialize')
  async loadData() {
    const startTime = performance.now();
    
    // Generate synthetic data based on input size
    const dataSize = this.state.inputSize;
    
    // Pre-allocate array for better performance
    const data = new Array(dataSize);
    
    // Generate data with direct array indexing instead of push
    for (let i = 0; i < dataSize; i++) {
      data[i] = {
        id: `item-${i}`,
        value: Math.random() * 1000,
        timestamp: Date.now() - Math.floor(Math.random() * 86400000),
        metadata: {
          category: i % 5 === 0 ? 'A' : i % 3 === 0 ? 'B' : 'C',
          priority: i % 10 === 0 ? 'high' : i % 5 === 0 ? 'medium' : 'low',
          tags: [`tag-${i % 10}`, `group-${i % 5}`]
        }
      };
    }
    
    // Store data using efficient Map
    for (const item of data) {
      this.state.dataMap.set(item.id, item);
    }
    
    const duration = performance.now() - startTime;
    this.trackMethodDuration('loadData', duration);
    
    return { count: this.state.dataMap.size };
  }
  
  @listen('loadData')
  async processItems() {
    const startTime = performance.now();
    
    // Process items in optimized batches
    const items = Array.from(this.state.dataMap.values());
    const batchSize = Math.min(100, Math.ceil(items.length / 10));
    const batches = Math.ceil(items.length / batchSize);
    
    const results = new Array(items.length);
    
    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, items.length);
      const batch = items.slice(start, end);
      
      // Process batch with Map for O(1) lookups
      const processedBatch = batch.map((item, index) => {
        const result = this.processItem(item);
        // Store directly in pre-allocated array
        results[start + index] = result;
        return result;
      });
      
      this.state.processedCount += processedBatch.length;
      
      // Periodically yield to event loop
      if (i % 10 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Store results
    this.state.results = results;
    
    const duration = performance.now() - startTime;
    this.trackMethodDuration('processItems', duration);
    
    return { processedCount: this.state.processedCount };
  }
  
  @listen('processItems')
  @router((result) => result?.processedCount > 1000)
  async handleLargeResults() {
    const startTime = performance.now();
    
    // Special handling for large results
    // Using typed arrays for numeric aggregation
    const values = new Float64Array(this.state.results.length);
    
    // Optimize with direct indexing
    for (let i = 0; i < this.state.results.length; i++) {
      values[i] = this.state.results[i].value;
    }
    
    // Calculate statistics in single pass for performance
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    
    for (const value of values) {
      sum += value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    
    const avg = sum / values.length;
    
    const duration = performance.now() - startTime;
    this.trackMethodDuration('handleLargeResults', duration);
    
    return { 
      type: 'large',
      stats: { count: values.length, sum, min, max, avg }
    };
  }
  
  @listen('processItems')
  @router((result) => result?.processedCount <= 1000)
  async handleSmallResults() {
    const startTime = performance.now();
    
    // Simple handling for small results
    // Group by category using Map for performance
    const categories = new Map<string, number>();
    
    for (const result of this.state.results) {
      const category = result.category;
      categories.set(category, (categories.get(category) || 0) + 1);
    }
    
    const duration = performance.now() - startTime;
    this.trackMethodDuration('handleSmallResults', duration);
    
    return { 
      type: 'small',
      categoryCounts: Object.fromEntries(categories)
    };
  }
  
  @listen(and_('handleLargeResults', 'handleSmallResults'))
  async finalize(results: any) {
    const startTime = performance.now();
    
    // Final aggregation - different processing based on size
    const finalResult = {
      processedCount: this.state.processedCount,
      resultsType: results.type,
      summary: results.type === 'large' ? results.stats : results.categoryCounts
    };
    
    const duration = performance.now() - startTime;
    this.trackMethodDuration('finalize', duration);
    
    return finalResult;
  }
  
  // Process an individual item with simulated work
  private processItem(item: any) {
    // Simulate computational work based on value
    let value = item.value;
    
    // Do some computation to simulate real work
    for (let i = 0; i < 1000; i++) {
      value = Math.sqrt(value * Math.sin(value) + i);
    }
    
    return {
      id: item.id,
      originalValue: item.value,
      value,
      category: item.metadata.category,
      priority: item.metadata.priority
    };
  }
}

/**
 * Run a benchmark with the specified configuration
 */
async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkMetrics> {
  console.log(`Running benchmark: ${config.name}`);
  console.log(`  Description: ${config.description || 'N/A'}`);
  console.log(`  Iterations: ${config.iterations} (${config.warmupIterations} warmup)`);
  
  // Track execution times
  const executionTimes: number[] = [];
  
  // Create flow with appropriate options
  const flow = new BenchmarkFlow(config.flowOptions || {});
  
  // Connect to memory if specified
  let connector: FlowMemoryConnector | undefined;
  if (config.memoryOptions) {
    connector = new FlowMemoryConnector(config.memoryOptions);
    connector.connectToFlow(flow);
  }
  
  // Setup data size
  const getDataSize = () => {
    switch (config.dataSize) {
      case 'large': return 10000;
      case 'medium': return 1000;
      case 'small': default: return 100;
    }
  };
  
  flow.state.inputSize = getDataSize();
  
  // Warmup runs to prime caches
  console.log('  Performing warmup runs...');
  for (let i = 0; i < config.warmupIterations; i++) {
    await flow.execute();
  }
  
  // Actual benchmark runs
  console.log('  Performing benchmark runs...');
  
  // Record initial memory
  const memoryBefore = process.memoryUsage().heapUsed;
  
  // Run actual benchmark iterations
  for (let i = 0; i < config.iterations; i++) {
    // Reset flow state
    flow.state = new BenchmarkFlowState();
    flow.state.inputSize = getDataSize();
    
    const startTime = performance.now();
    await flow.execute();
    const endTime = performance.now();
    
    executionTimes.push(endTime - startTime);
    process.stdout.write('.');
  }
  
  // Record final memory
  const memoryAfter = process.memoryUsage().heapUsed;
  
  console.log('\n  Benchmark complete!');
  
  // Calculate statistics
  executionTimes.sort((a, b) => a - b); // Sort for median/percentiles
  
  const sum = executionTimes.reduce((a, b) => a + b, 0);
  const mean = sum / executionTimes.length;
  const min = executionTimes[0];
  const max = executionTimes[executionTimes.length - 1];
  const median = executionTimes[Math.floor(executionTimes.length / 2)];
  
  // Calculate standard deviation
  const squareDiffs = executionTimes.map(value => {
    const diff = value - mean;
    return diff * diff;
  });
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  const stdDev = Math.sqrt(avgSquareDiff);
  
  // Calculate method-specific metrics
  const methodMetrics: Record<string, { mean: number; min: number; max: number }> = {};
  
  for (const [method, durations] of flow.state.methodDurations.entries()) {
    const methodSum = durations.reduce((a, b) => a + b, 0);
    const methodMean = methodSum / durations.length;
    const methodMin = Math.min(...durations);
    const methodMax = Math.max(...durations);
    
    methodMetrics[method] = {
      mean: methodMean,
      min: methodMin,
      max: methodMax
    };
  }
  
  // Format benchmark results
  const metrics: BenchmarkMetrics = {
    name: config.name,
    description: config.description,
    iterations: config.iterations,
    meanExecutionTime: mean,
    minExecutionTime: min,
    maxExecutionTime: max,
    stdDeviation: stdDev,
    medianExecutionTime: median,
    memoryUsage: {
      before: memoryBefore,
      after: memoryAfter,
      delta: memoryAfter - memoryBefore
    },
    methodMetrics,
    timestamp: new Date().toISOString(),
    config: {
      ...config,
      dataSize: config.dataSize,
      inputItemCount: getDataSize()
    }
  };
  
  // Print summary
  console.log(`  Results:`);
  console.log(`    Mean execution time: ${mean.toFixed(2)}ms`);
  console.log(`    Min execution time: ${min.toFixed(2)}ms`);
  console.log(`    Max execution time: ${max.toFixed(2)}ms`);
  console.log(`    Std Deviation: ${stdDev.toFixed(2)}ms`);
  console.log(`    Memory delta: ${(metrics.memoryUsage.delta / 1024 / 1024).toFixed(2)}MB`);
  
  return metrics;
}

/**
 * Run a complete benchmark suite with multiple configurations
 */
async function runBenchmarkSuite() {
  console.log('Starting Flow System Benchmark Suite');
  
  const benchmarkConfigs: BenchmarkConfig[] = [
    // Baseline benchmarks with different data sizes
    {
      name: 'baseline-small',
      description: 'Baseline flow with small dataset and no optimizations',
      iterations: 10,
      warmupIterations: 2,
      dataSize: 'small',
      flowOptions: {
        cacheResults: false
      }
    },
    {
      name: 'baseline-medium',
      description: 'Baseline flow with medium dataset and no optimizations',
      iterations: 5,
      warmupIterations: 2,
      dataSize: 'medium',
      flowOptions: {
        cacheResults: false
      }
    },
    {
      name: 'baseline-large',
      description: 'Baseline flow with large dataset and no optimizations',
      iterations: 3,
      warmupIterations: 1,
      dataSize: 'large',
      flowOptions: {
        cacheResults: false
      }
    },
    
    // Optimized benchmarks with different data sizes
    {
      name: 'optimized-small',
      description: 'Optimized flow with small dataset and result caching',
      iterations: 10,
      warmupIterations: 2,
      dataSize: 'small',
      flowOptions: {
        cacheResults: true,
        cacheTTL: 5 * 60 * 1000
      }
    },
    {
      name: 'optimized-medium',
      description: 'Optimized flow with medium dataset and result caching',
      iterations: 5,
      warmupIterations: 2,
      dataSize: 'medium',
      flowOptions: {
        cacheResults: true,
        cacheTTL: 5 * 60 * 1000
      }
    },
    {
      name: 'optimized-large',
      description: 'Optimized flow with large dataset and result caching',
      iterations: 3,
      warmupIterations: 1,
      dataSize: 'large',
      flowOptions: {
        cacheResults: true,
        cacheTTL: 5 * 60 * 1000
      }
    },
    
    // Memory persistence benchmarks
    {
      name: 'memory-persistence-small',
      description: 'Flow with memory persistence and small dataset',
      iterations: 5,
      warmupIterations: 2,
      dataSize: 'small',
      flowOptions: {
        cacheResults: true
      },
      memoryOptions: {
        persistStateOnEveryChange: false,
        persistMethodResults: true,
        inMemoryCache: true
      }
    },
    {
      name: 'memory-persistence-medium',
      description: 'Flow with memory persistence and medium dataset',
      iterations: 3,
      warmupIterations: 1,
      dataSize: 'medium',
      flowOptions: {
        cacheResults: true
      },
      memoryOptions: {
        persistStateOnEveryChange: false,
        persistMethodResults: true,
        inMemoryCache: true
      }
    }
  ];
  
  // Ensure output directory exists
  const benchmarkOutputDir = './benchmark-results';
  await fs.mkdir(benchmarkOutputDir, { recursive: true }).catch(() => {});
  
  // Run all benchmarks and collect results
  const allResults: BenchmarkMetrics[] = [];
  
  for (const config of benchmarkConfigs) {
    const result = await runBenchmark(config);
    allResults.push(result);
    
    // Save individual benchmark result
    const resultFilePath = path.join(benchmarkOutputDir, `${config.name}.json`);
    await fs.writeFile(resultFilePath, JSON.stringify(result, null, 2));
    
    // Add small delay between benchmarks to let system settle
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Generate comparison report
  const comparisonReport = generateComparisonReport(allResults);
  
  // Save full benchmark results and comparison
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const summaryFilePath = path.join(benchmarkOutputDir, `summary-${timestamp}.json`);
  const comparisonFilePath = path.join(benchmarkOutputDir, `comparison-${timestamp}.json`);
  
  await fs.writeFile(summaryFilePath, JSON.stringify(allResults, null, 2));
  await fs.writeFile(comparisonFilePath, JSON.stringify(comparisonReport, null, 2));
  
  console.log(`\nBenchmark suite complete!`);
  console.log(`Results saved to: ${benchmarkOutputDir}`);
  console.log(`Summary: ${summaryFilePath}`);
  console.log(`Comparison: ${comparisonFilePath}`);
  
  return { results: allResults, comparison: comparisonReport };
}

/**
 * Generate a comparison report from benchmark results
 */
function generateComparisonReport(results: BenchmarkMetrics[]) {
  // Group results by data size
  const bySize: Record<string, BenchmarkMetrics[]> = {};
  
  results.forEach(result => {
    const dataSize = result.config.dataSize;
    if (!bySize[dataSize]) {
      bySize[dataSize] = [];
    }
    bySize[dataSize].push(result);
  });
  
  // Generate comparisons for each size
  const comparisons: Record<string, any> = {};
  
  for (const [size, sizeResults] of Object.entries(bySize)) {
    // Find baseline and optimized results
    const baseline = sizeResults.find(r => r.name.startsWith('baseline-'));
    const optimized = sizeResults.find(r => r.name.startsWith('optimized-'));
    const memory = sizeResults.find(r => r.name.startsWith('memory-'));
    
    if (baseline && optimized) {
      const executionImprovement = (baseline.meanExecutionTime - optimized.meanExecutionTime) / baseline.meanExecutionTime * 100;
      const memoryImprovement = (baseline.memoryUsage.delta - optimized.memoryUsage.delta) / baseline.memoryUsage.delta * 100;
      
      comparisons[size] = {
        executionTimeComparison: {
          baseline: baseline.meanExecutionTime,
          optimized: optimized.meanExecutionTime,
          improvement: executionImprovement,
          improvementFormatted: `${executionImprovement.toFixed(2)}%`
        },
        memoryUsageComparison: {
          baseline: baseline.memoryUsage.delta,
          optimized: optimized.memoryUsage.delta,
          improvement: memoryImprovement,
          improvementFormatted: `${memoryImprovement.toFixed(2)}%`
        },
        methodComparisons: {}
      };
      
      // Compare individual methods
      const methods = new Set([
        ...Object.keys(baseline.methodMetrics),
        ...Object.keys(optimized.methodMetrics)
      ]);
      
      for (const method of methods) {
        if (baseline.methodMetrics[method] && optimized.methodMetrics[method]) {
          const baselineMean = baseline.methodMetrics[method].mean;
          const optimizedMean = optimized.methodMetrics[method].mean;
          const methodImprovement = (baselineMean - optimizedMean) / baselineMean * 100;
          
          comparisons[size].methodComparisons[method] = {
            baseline: baselineMean,
            optimized: optimizedMean,
            improvement: methodImprovement,
            improvementFormatted: `${methodImprovement.toFixed(2)}%`
          };
        }
      }
      
      // Add memory persistence comparison if available
      if (memory) {
        const memoryVsOptimized = (optimized.meanExecutionTime - memory.meanExecutionTime) / optimized.meanExecutionTime * 100;
        
        comparisons[size].memoryPersistenceComparison = {
          optimizedOnly: optimized.meanExecutionTime,
          withMemoryPersistence: memory.meanExecutionTime,
          difference: memoryVsOptimized,
          differenceFormatted: `${memoryVsOptimized.toFixed(2)}%`
        };
      }
    }
  }
  
  // Generate overall summary
  const baselineAvg = results
    .filter(r => r.name.startsWith('baseline-'))
    .reduce((sum, r) => sum + r.meanExecutionTime, 0) / 
    results.filter(r => r.name.startsWith('baseline-')).length;
  
  const optimizedAvg = results
    .filter(r => r.name.startsWith('optimized-'))
    .reduce((sum, r) => sum + r.meanExecutionTime, 0) / 
    results.filter(r => r.name.startsWith('optimized-')).length;
  
  const overallImprovement = (baselineAvg - optimizedAvg) / baselineAvg * 100;
  
  return {
    timestamp: new Date().toISOString(),
    summary: {
      baselineAverageExecutionTime: baselineAvg,
      optimizedAverageExecutionTime: optimizedAvg,
      overallImprovement,
      overallImprovementFormatted: `${overallImprovement.toFixed(2)}%`
    },
    dataSizeComparisons: comparisons
  };
}

// Run the benchmark suite if this file is executed directly
if (require.main === module) {
  runBenchmarkSuite().catch(error => {
    console.error('Benchmark error:', error);
    process.exit(1);
  });
}

// Export for programmatic usage
export { 
  runBenchmark, 
  runBenchmarkSuite, 
  BenchmarkFlow, 
  BenchmarkFlowState,
  BenchmarkConfig,
  BenchmarkMetrics
};
