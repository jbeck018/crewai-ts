/**
 * Multi-Flow Orchestration Example
 * 
 * This example demonstrates the usage of the Multi-Flow Orchestration system
 * with optimized performance, dependency management, and visualization.
 */

import { Flow, FlowState } from '../src/flow/index.js';
import { start, listen, router } from '../src/flow/decorators.js';
import { CONTINUE } from '../src/flow/types.js';
import { MultiFlowOrchestrator } from '../src/flow/orchestration/MultiFlowOrchestrator.js';
import { FlowMemoryConnector } from '../src/flow/memory/FlowMemoryConnector.js';
import { ContextualMemory } from '../src/memory/contextual-memory.js';
import * as fs from 'fs/promises';
import path from 'path';

// Optimized flow state with efficient data structures
class DocumentState extends FlowState {
  documents: Map<string, any> = new Map();
  processed: Set<string> = new Set();
  vectorized: Set<string> = new Set();
  startTime: number = 0;
  endTime?: number;
  processingStats: {
    documentsProcessed: number;
    totalTokens: number;
    processingTimeMs: number;
    averageDocumentSizeBytes: number;
  } = {
    documentsProcessed: 0,
    totalTokens: 0,
    processingTimeMs: 0,
    averageDocumentSizeBytes: 0
  };
}

// Document loading flow optimized for performance
class DocumentLoaderFlow extends Flow<DocumentState> {
  private sourcePath: string;
  private filePattern: RegExp;
  
  constructor(sourcePath: string, filePattern: RegExp = /\.(txt|md|json)$/) {
    super({
      initialState: new DocumentState(),
      id: 'document-loader'
    });
    
    this.sourcePath = sourcePath;
    this.filePattern = filePattern;
  }
  
  @start()
  async initialize() {
    this.state.startTime = performance.now();
    this.state.documents.clear();
    this.state.processed.clear();
    console.log(`[DocumentLoader] Starting document loading from ${this.sourcePath}`);
    return CONTINUE;
  }
  
  @listen('initialize')
  async loadDocuments() {
    console.log(`[DocumentLoader] Loading documents...`);
    
    // Efficient file loading with batching
    try {
      const files = await this.getFiles(this.sourcePath);
      const validFiles = files.filter(file => this.filePattern.test(file));
      
      console.log(`[DocumentLoader] Found ${validFiles.length} documents`);
      
      // Use Promise.all for parallel loading with optimized batches
      const BATCH_SIZE = 10; // Adjust based on file sizes
      let totalSize = 0;
      
      for (let i = 0; i < validFiles.length; i += BATCH_SIZE) {
        const batch = validFiles.slice(i, i + BATCH_SIZE);
        
        // Load batch in parallel
        const loadPromises = batch.map(async (file) => {
          const fullPath = path.join(this.sourcePath, file);
          const content = await fs.readFile(fullPath, 'utf8');
          const stats = await fs.stat(fullPath);
          
          // Store document with metadata
          this.state.documents.set(file, {
            path: fullPath,
            content,
            size: stats.size,
            lastModified: stats.mtime
          });
          
          totalSize += stats.size;
          return stats.size;
        });
        
        await Promise.all(loadPromises);
        console.log(`[DocumentLoader] Loaded batch ${i / BATCH_SIZE + 1}/${Math.ceil(validFiles.length / BATCH_SIZE)}`);
      }
      
      // Update stats
      this.state.processingStats.documentsProcessed = validFiles.length;
      this.state.processingStats.averageDocumentSizeBytes = 
        validFiles.length > 0 ? totalSize / validFiles.length : 0;
      
      return {
        documentCount: validFiles.length,
        documents: Array.from(this.state.documents.keys())
      };
    } catch (error) {
      console.error(`[DocumentLoader] Error loading documents:`, error);
      throw error;
    }
  }
  
  @listen('loadDocuments')
  async finalize(result: any) {
    this.state.endTime = performance.now();
    this.state.processingStats.processingTimeMs = this.state.endTime - this.state.startTime;
    
    console.log(`[DocumentLoader] Completed in ${this.state.processingStats.processingTimeMs.toFixed(2)}ms`);
    console.log(`[DocumentLoader] Loaded ${result.documentCount} documents`);
    
    return {
      success: true,
      documentCount: result.documentCount,
      processingTimeMs: this.state.processingStats.processingTimeMs,
      averageDocumentSizeBytes: this.state.processingStats.averageDocumentSizeBytes,
      documents: result.documents
    };
  }
  
  // Helpers with performance optimizations
  private async getFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    // Use efficient list operations
    const files = entries
      .filter(entry => entry.isFile())
      .map(entry => entry.name);
      
    return files;
  }
}

// Document processing flow 
class DocumentProcessorFlow extends Flow<DocumentState> {
  constructor() {
    super({
      initialState: new DocumentState(),
      id: 'document-processor'
    });
  }
  
  @start()
  async initialize() {
    this.state.startTime = performance.now();
    console.log(`[DocumentProcessor] Starting document processing`);
    return CONTINUE;
  }
  
  @listen('initialize')
  async processDocuments(input?: any) {
    console.log(`[DocumentProcessor] Processing documents...`);
    
    // Get documents from input data mapping
    const documents = input?.documents || [];
    const documentData = input?.documentData || new Map();
    
    if (documents.length === 0) {
      console.log(`[DocumentProcessor] No documents to process`);
      return { processed: 0, tokenCount: 0 };
    }
    
    console.log(`[DocumentProcessor] Processing ${documents.length} documents`);
    
    // Process in parallel with optimized batching
    const BATCH_SIZE = 5;
    let totalTokens = 0;
    
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      
      const processPromises = batch.map(async (docId: string) => {
        // Simulate document processing
        await new Promise(resolve => setTimeout(resolve, 50)); 
        
        // Count tokens (simplified)
        const content = documentData.get(docId)?.content || '';
        const tokenCount = this.countTokens(content);
        totalTokens += tokenCount;
        
        // Mark as processed
        this.state.processed.add(docId);
        
        return {
          docId,
          tokenCount
        };
      });
      
      await Promise.all(processPromises);
    }
    
    // Update stats
    this.state.processingStats.documentsProcessed = documents.length;
    this.state.processingStats.totalTokens = totalTokens;
    
    return {
      processed: documents.length,
      tokenCount: totalTokens
    };
  }
  
  @listen('processDocuments')
  async finalize(result: any) {
    this.state.endTime = performance.now();
    this.state.processingStats.processingTimeMs = this.state.endTime - this.state.startTime;
    
    console.log(`[DocumentProcessor] Completed in ${this.state.processingStats.processingTimeMs.toFixed(2)}ms`);
    console.log(`[DocumentProcessor] Processed ${result.processed} documents with ${result.tokenCount} tokens`);
    
    return {
      success: true,
      documentsProcessed: result.processed,
      tokenCount: result.tokenCount,
      processingTimeMs: this.state.processingStats.processingTimeMs
    };
  }
  
  // Count tokens (simplified)
  private countTokens(text: string): number {
    // Very simplified tokenization
    return text.split(/\s+/).length;
  }
}

// Vectorization flow
class VectorizationFlow extends Flow<DocumentState> {
  constructor() {
    super({
      initialState: new DocumentState(),
      id: 'document-vectorizer'
    });
  }
  
  @start()
  async initialize() {
    this.state.startTime = performance.now();
    console.log(`[Vectorizer] Starting document vectorization`);
    return CONTINUE;
  }
  
  @listen('initialize')
  async vectorizeDocuments(input?: any) {
    console.log(`[Vectorizer] Vectorizing documents...`);
    
    // Get processed documents
    const processedDocs = input?.documentsProcessed || 0;
    const documentData = input?.documentData || new Map();
    
    if (processedDocs === 0) {
      console.log(`[Vectorizer] No documents to vectorize`);
      return { vectorized: 0 };
    }
    
    console.log(`[Vectorizer] Vectorizing ${processedDocs} documents`);
    
    // Simulate vectorization with controlled parallelism
    // In real implementation, this would use a proper embedding model
    const processedDocIds = Array.from(this.state.processed);
    let vectorized = 0;
    
    // Process in smaller batches for memory efficiency
    const BATCH_SIZE = 3;
    
    for (let i = 0; i < processedDocIds.length; i += BATCH_SIZE) {
      const batch = processedDocIds.slice(i, i + BATCH_SIZE);
      
      // Simulate parallel vectorization
      await Promise.all(batch.map(async (docId) => {
        // More compute-intensive operation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.state.vectorized.add(docId);
        vectorized++;
        
        return docId;
      }));
    }
    
    return { vectorized };
  }
  
  @listen('vectorizeDocuments')
  async finalize(result: any) {
    this.state.endTime = performance.now();
    this.state.processingStats.processingTimeMs = this.state.endTime - this.state.startTime;
    
    console.log(`[Vectorizer] Completed in ${this.state.processingStats.processingTimeMs.toFixed(2)}ms`);
    console.log(`[Vectorizer] Vectorized ${result.vectorized} documents`);
    
    return {
      success: true,
      vectorized: result.vectorized,
      processingTimeMs: this.state.processingStats.processingTimeMs
    };
  }
}

// Search index flow
class SearchIndexFlow extends Flow<DocumentState> {
  constructor() {
    super({
      initialState: new DocumentState(),
      id: 'search-indexer'
    });
  }
  
  @start()
  async initialize() {
    this.state.startTime = performance.now();
    console.log(`[SearchIndexer] Starting search index building`);
    return CONTINUE;
  }
  
  @listen('initialize')
  async buildIndex(input?: any) {
    console.log(`[SearchIndexer] Building search index...`);
    
    // Get vectorized documents
    const vectorized = input?.vectorized || 0;
    
    if (vectorized === 0) {
      console.log(`[SearchIndexer] No documents to index`);
      return { indexed: 0 };
    }
    
    console.log(`[SearchIndexer] Indexing ${vectorized} documents`);
    
    // Simulate index building (resource-intensive operation)
    await new Promise(resolve => setTimeout(resolve, vectorized * 30));
    
    return { indexed: vectorized };
  }
  
  @listen('buildIndex')
  async finalize(result: any) {
    this.state.endTime = performance.now();
    this.state.processingStats.processingTimeMs = this.state.endTime - this.state.startTime;
    
    console.log(`[SearchIndexer] Completed in ${this.state.processingStats.processingTimeMs.toFixed(2)}ms`);
    console.log(`[SearchIndexer] Indexed ${result.indexed} documents`);
    
    return {
      success: true,
      indexed: result.indexed,
      processingTimeMs: this.state.processingStats.processingTimeMs
    };
  }
}

// Aggregation flow - compiles results from all other flows
class ResultAggregatorFlow extends Flow<DocumentState> {
  constructor() {
    super({
      initialState: new DocumentState(),
      id: 'result-aggregator'
    });
  }
  
  @start()
  async initialize() {
    this.state.startTime = performance.now();
    console.log(`[Aggregator] Starting result aggregation`);
    return CONTINUE;
  }
  
  @listen('initialize')
  async aggregateResults(input?: any) {
    console.log(`[Aggregator] Aggregating results...`);
    
    // Get results from all flows through input data mapping
    const loaderResult = input?.loaderResult || {};
    const processorResult = input?.processorResult || {};
    const vectorizerResult = input?.vectorizerResult || {};
    const indexerResult = input?.indexerResult || {};
    
    // Compile comprehensive stats
    const stats = {
      documentsLoaded: loaderResult.documentCount || 0,
      documentsProcessed: processorResult.documentsProcessed || 0,
      documentsVectorized: vectorizerResult.vectorized || 0,
      documentsIndexed: indexerResult.indexed || 0,
      totalTokens: processorResult.tokenCount || 0,
      timings: {
        loading: loaderResult.processingTimeMs || 0,
        processing: processorResult.processingTimeMs || 0,
        vectorizing: vectorizerResult.processingTimeMs || 0,
        indexing: indexerResult.processingTimeMs || 0
      }
    };
    
    return stats;
  }
  
  @listen('aggregateResults')
  async finalize(stats: any) {
    this.state.endTime = performance.now();
    const totalTime = this.state.endTime - this.state.startTime;
    
    // Add total time to stats
    stats.timings.aggregation = totalTime;
    stats.timings.total = 
      stats.timings.loading + 
      stats.timings.processing + 
      stats.timings.vectorizing + 
      stats.timings.indexing + 
      totalTime;
    
    console.log(`[Aggregator] Completed in ${totalTime.toFixed(2)}ms`);
    console.log(`[Aggregator] Final statistics:`, stats);
    
    return {
      success: true,
      statistics: stats,
      summary: this.generateSummary(stats)
    };
  }
  
  private generateSummary(stats: any): string {
    return `
Document Processing Summary:
-------------------------
Documents Loaded: ${stats.documentsLoaded}
Documents Processed: ${stats.documentsProcessed}
Documents Vectorized: ${stats.documentsVectorized}
Documents Indexed: ${stats.documentsIndexed}
Total Tokens: ${stats.totalTokens}

Execution Times:
---------------
Loading: ${stats.timings.loading.toFixed(2)}ms
Processing: ${stats.timings.processing.toFixed(2)}ms
Vectorizing: ${stats.timings.vectorizing.toFixed(2)}ms
Indexing: ${stats.timings.indexing.toFixed(2)}ms
Aggregation: ${stats.timings.aggregation.toFixed(2)}ms

Total Execution Time: ${stats.timings.total.toFixed(2)}ms
`;
  }
}

// Main execution function
async function runDocumentProcessingExample() {
  console.log('Starting Multi-Flow Document Processing Example');
  console.log('-------------------------------------------');
  
  // Create memory connector for state persistence
  const memory = new ContextualMemory();
  const memoryConnector = new FlowMemoryConnector({ 
    memory,
    enableCaching: true,
    compressionLevel: 'fast'
  });
  
  // Configure orchestrator with optimized settings
  const orchestrator = new MultiFlowOrchestrator({
    optimizeFor: 'balanced',
    enableMemoryIntegration: true,
    memoryConnector,
    execution: {
      maxConcurrency: 4,
      timeout: 30000,
      checkpointInterval: 1000
    },
    memory: {
      aggressiveCleanup: true,
      enableStateSharing: true,
      compressionLevel: 'fast'
    },
    metrics: {
      enableDetailedTracking: true,
      exportToConsole: true
    },
    debug: {
      verbose: true
    },
    visualization: {
      colorScheme: 'performance',
      includeExecutionMetrics: true,
      formatOptions: {
        enableInteractivity: true
      }
    }
  });
  
  // Create and register flows
  const loaderFlow = new DocumentLoaderFlow('./documents');
  const processorFlow = new DocumentProcessorFlow();
  const vectorizerFlow = new VectorizationFlow();
  const indexerFlow = new SearchIndexFlow();
  const aggregatorFlow = new ResultAggregatorFlow();
  
  // Register flows with different priorities
  const loaderId = orchestrator.registerFlow({
    flow: loaderFlow,
    priority: 10, // Highest priority
    resourceEstimate: {
      cpu: 0.3,
      memory: 100,
      io: 0.8, // IO-intensive
      network: 0.1
    }
  });
  
  const processorId = orchestrator.registerFlow({
    flow: processorFlow,
    priority: 8,
    dependencies: [loaderId],
    resourceEstimate: {
      cpu: 0.7, // CPU-intensive
      memory: 200,
      io: 0.2,
      network: 0.1
    },
    // Data mapping from loader to processor
    dataMapping: (loaderResult) => ({
      documents: loaderResult.documents,
      documentData: loaderFlow.state.documents // Pass document data
    })
  });
  
  const vectorizerId = orchestrator.registerFlow({
    flow: vectorizerFlow,
    priority: 6,
    dependencies: [processorId],
    resourceEstimate: {
      cpu: 0.9, // Very CPU-intensive
      memory: 300,
      io: 0.1,
      network: 0.1
    },
    // Data mapping from processor to vectorizer
    dataMapping: (processorResult) => ({
      documentsProcessed: processorResult.documentsProcessed,
      documentData: loaderFlow.state.documents // Pass document data
    })
  });
  
  const indexerId = orchestrator.registerFlow({
    flow: indexerFlow,
    priority: 5,
    dependencies: [vectorizerId],
    resourceEstimate: {
      cpu: 0.5,
      memory: 400, // Memory-intensive
      io: 0.3,
      network: 0.1
    },
    // Data mapping from vectorizer to indexer
    dataMapping: (vectorizerResult) => ({
      vectorized: vectorizerResult.vectorized
    })
  });
  
  const aggregatorId = orchestrator.registerFlow({
    flow: aggregatorFlow,
    priority: 3, // Lowest priority, runs last
    dependencies: [loaderId, processorId, vectorizerId, indexerId],
    resourceEstimate: {
      cpu: 0.2,
      memory: 50,
      io: 0.1,
      network: 0.1
    },
    // Complex data mapping from all flows
    dataMapping: (upstreamResults) => {
      // In a real scenario, this would get results from the actual flow executions
      // Here we're simulating for the example
      return {
        loaderResult: orchestrator.resultCache?.get(loaderId),
        processorResult: orchestrator.resultCache?.get(processorId),
        vectorizerResult: orchestrator.resultCache?.get(vectorizerId),
        indexerResult: orchestrator.resultCache?.get(indexerId)
      };
    }
  });
  
  // Listen to orchestration events
  orchestrator.on('flow_started', (event) => {
    console.log(`[Orchestrator] Flow started: ${event.id}`);
  });
  
  orchestrator.on('flow_completed', (event) => {
    console.log(`[Orchestrator] Flow completed: ${event.id} (success: ${event.success})`);
  });
  
  orchestrator.on('flow_error', (event) => {
    console.error(`[Orchestrator] Flow error in ${event.id}:`, event.error);
  });
  
  // Execute the orchestrated flows
  console.log('Executing document processing flow orchestration...');
  console.log('-------------------------------------------');
  
  try {
    // Create documents directory if it doesn't exist
    await fs.mkdir('./documents', { recursive: true });
    
    // Create some sample documents for processing
    await createSampleDocuments();
    
    // Execute with visualization
    const result = await orchestrator.execute({
      generateVisualization: true
    });
    
    console.log('\nExecution completed successfully!');
    console.log('-------------------------------------------');
    console.log('Results summary:');
    console.log(`Total execution time: ${result.metrics.totalExecutionTime.toFixed(2)}ms`);
    console.log(`Flows executed: ${result.metrics.flowsExecuted} (${result.metrics.flowsSucceeded} succeeded, ${result.metrics.flowsFailed} failed)`);
    console.log(`Average flow execution time: ${result.metrics.averageFlowExecutionTime.toFixed(2)}ms`);
    console.log(`Peak memory usage: ${result.metrics.peakMemoryUsageMB.toFixed(2)}MB`);
    console.log(`Critical path execution time: ${result.metrics.criticalPathTime.toFixed(2)}ms`);
    
    if (result.visualizationPath) {
      console.log(`\nVisualization generated at: ${result.visualizationPath}`);
      console.log('Open this file in a browser to view the flow execution graph.');
    }
    
    // Get detailed metrics
    console.log('\nDetailed metrics:');
    console.log('-------------------------------------------');
    const detailedMetrics = orchestrator.getMetrics();
    
    // Print bottlenecks
    if (detailedMetrics.bottlenecks && detailedMetrics.bottlenecks.length > 0) {
      console.log('\nPerformance bottlenecks:');
      detailedMetrics.bottlenecks.forEach(bottleneck => {
        const executionTime = detailedMetrics.flowExecutionTimes[bottleneck] || 0;
        console.log(`- ${bottleneck}: ${executionTime.toFixed(2)}ms`);
      });
    }
    
    // Final aggregated result
    const finalResult = result.results.get(aggregatorId);
    if (finalResult && finalResult.summary) {
      console.log('\nFinal processing summary:');
      console.log(finalResult.summary);
    }
    
    return result;
  } catch (error) {
    console.error('Error executing flow orchestration:', error);
    throw error;
  }
}

// Helper to create sample documents
async function createSampleDocuments() {
  const sampleDocs = [
    { name: 'document1.txt', content: 'This is the first sample document. It contains some basic text for processing.' },
    { name: 'document2.txt', content: 'The second document has different content. This will be vectorized and indexed for search.' },
    { name: 'document3.txt', content: 'Document three discusses various topics including performance optimization and memory efficiency.' },
    { name: 'notes.md', content: '# Notes\n\n- Implement performance optimizations\n- Add memory efficiency\n- Test with larger datasets' },
    { name: 'config.json', content: JSON.stringify({ enableOptimization: true, batchSize: 10, maxMemory: 512 }, null, 2) }
  ];
  
  for (const doc of sampleDocs) {
    await fs.writeFile(`./documents/${doc.name}`, doc.content);
  }
  
  console.log(`Created ${sampleDocs.length} sample documents for processing`);
}

// Run the example
runDocumentProcessingExample()
  .then(() => {
    console.log('Example completed successfully');
  })
  .catch(error => {
    console.error('Example failed:', error);
  });
