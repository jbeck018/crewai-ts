/**
 * Flow Memory Integration Example
 * 
 * Demonstrates how to use the Flow Memory Connector to create persistent flows
 * with optimized memory integration.
 */

import { Flow, FlowState } from '../src/flow/index.js';
import { start, listen, router, and_ } from '../src/flow/decorators.js';
import { CONTINUE } from '../src/flow/types.js';
import { 
  FlowMemoryConnector, 
  FlowMemoryType 
} from '../src/flow/memory/FlowMemoryConnector.js';
import { ContextualMemory, ContextualMemoryOptions } from '../src/memory/contextual-memory.js';
import { plotFlow } from '../src/flow/visualization/FlowVisualizer.js';
import * as fs from 'fs/promises';
import path from 'path';

// Optimized document processing state with efficient data structures
class DocumentProcessingState extends FlowState {
  // Use Map for O(1) document lookups
  documents: Map<string, {
    content: string;
    metadata: Record<string, any>;
    processed: boolean;
    timestamp: number;
  }> = new Map();
  
  // Use Set for fast existence checks
  processedIds: Set<string> = new Set();
  
  // Use typed arrays for numeric results (memory efficient)
  analysisScores: Float64Array = new Float64Array(0);
  
  // Cache to minimize reprocessing
  cache: Map<string, any> = new Map();
  
  // Performance metrics with high-resolution timing
  metrics: {
    startTime: number;
    endTime?: number;
    documentCount: number;
    processingTime: number;
    averageDocumentTime: number;
    methodDurations: Map<string, number>;
  } = {
    startTime: Date.now(),
    documentCount: 0,
    processingTime: 0,
    averageDocumentTime: 0,
    methodDurations: new Map()
  };
}

/**
 * Document processing flow with Memory persistence and optimized performance
 */
class DocumentProcessingFlow extends Flow<DocumentProcessingState> {
  constructor() {
    super({
      initialState: new DocumentProcessingState(),
      // Enable performance optimizations
      cacheResults: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      debug: process.env.DEBUG_FLOW === 'true'
    });
  }
  
  /**
   * Initialize document processing
   */
  @start()
  async initialize() {
    console.log('Initializing document processing flow...');
    const startTime = performance.now();
    
    // Create necessary directories with optimized promise handling
    await Promise.all([
      fs.mkdir('./data/documents', { recursive: true }).catch(err => {
        if (err.code !== 'EEXIST') throw err;
      }),
      fs.mkdir('./data/results', { recursive: true }).catch(err => {
        if (err.code !== 'EEXIST') throw err;
      })
    ]);
    
    const duration = performance.now() - startTime;
    this.state.metrics.methodDurations.set('initialize', duration);
    
    return CONTINUE;
  }
  
  /**
   * Load documents with optimized I/O and memory usage
   */
  @listen('initialize')
  async loadDocuments() {
    console.log('Loading documents...');
    const startTime = performance.now();
    
    try {
      // Check if sample documents exist, create if not
      let docFiles: string[] = [];
      try {
        docFiles = await fs.readdir('./data/documents');
      } catch (err) {
        console.log('No documents found, creating samples...');
        await this.createSampleDocuments();
        docFiles = await fs.readdir('./data/documents');
      }
      
      // Filter only text files for optimization
      const textFiles = docFiles.filter(file => file.endsWith('.txt'));
      
      // Load documents in optimized batches with Promise.all
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < textFiles.length; i += batchSize) {
        const batch = textFiles.slice(i, i + batchSize);
        batches.push(batch);
      }
      
      // Process batches sequentially but files within batch in parallel
      for (const batch of batches) {
        await Promise.all(batch.map(async (file) => {
          const filePath = path.join('./data/documents', file);
          const content = await fs.readFile(filePath, 'utf8');
          
          // Store with optimized metadata extraction
          const docId = path.basename(file, '.txt');
          this.state.documents.set(docId, {
            content,
            metadata: this.extractMetadata(content, docId),
            processed: false,
            timestamp: Date.now()
          });
        }));
        
        // Optional: yield to event loop to prevent blocking
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      // Update metrics
      this.state.metrics.documentCount = this.state.documents.size;
      
      // Prepare analysis scores array (pre-allocate for performance)
      this.state.analysisScores = new Float64Array(this.state.documents.size);
      
      const duration = performance.now() - startTime;
      this.state.metrics.methodDurations.set('loadDocuments', duration);
      
      return { documentCount: this.state.documents.size };
    } catch (error) {
      console.error('Error loading documents:', error);
      throw error;
    }
  }
  
  /**
   * Process documents with optimized algorithms
   */
  @listen('loadDocuments')
  async processDocuments() {
    console.log('Processing documents...');
    const startTime = performance.now();
    
    // Get document IDs with array pre-allocation for performance
    const docIds = Array.from(this.state.documents.keys());
    const results = new Array(docIds.length);
    
    // Process in optimized batches
    const batchSize = 5;
    const processingTimes: number[] = [];
    
    for (let i = 0; i < docIds.length; i += batchSize) {
      const batch = docIds.slice(i, i + batchSize);
      
      // Process batch with individual timing
      const batchResults = await Promise.all(batch.map(async (docId, batchIndex) => {
        const docStartTime = performance.now();
        const index = i + batchIndex;
        
        // Check cache first to avoid reprocessing
        const cacheKey = `doc_process_${docId}`;
        if (this.state.cache.has(cacheKey)) {
          console.log(`Using cached results for document ${docId}`);
          const cachedResult = this.state.cache.get(cacheKey);
          this.state.analysisScores[index] = cachedResult.score;
          this.state.processedIds.add(docId);
          return cachedResult;
        }
        
        // Process document
        const doc = this.state.documents.get(docId)!;
        const result = await this.analyzeDocument(doc.content, doc.metadata);
        
        // Store results efficiently
        this.state.analysisScores[index] = result.score;
        this.state.processedIds.add(docId);
        
        // Mark as processed in the documents map
        doc.processed = true;
        
        // Cache results
        this.state.cache.set(cacheKey, result);
        
        // Track individual document processing time
        const docDuration = performance.now() - docStartTime;
        processingTimes.push(docDuration);
        
        return result;
      }));
      
      // Store batch results
      for (let j = 0; j < batch.length; j++) {
        results[i + j] = batchResults[j];
      }
      
      // Yield to event loop periodically to prevent blocking
      if (i + batchSize < docIds.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Calculate average processing time
    const totalProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0);
    const averageTime = processingTimes.length > 0 ? totalProcessingTime / processingTimes.length : 0;
    
    // Update metrics
    this.state.metrics.processingTime = performance.now() - startTime;
    this.state.metrics.averageDocumentTime = averageTime;
    this.state.metrics.methodDurations.set('processDocuments', this.state.metrics.processingTime);
    
    return { 
      processed: this.state.processedIds.size,
      averageTime,
      scores: Array.from(this.state.analysisScores)
    };
  }
  
  /**
   * Analyze results and generate report
   */
  @listen('processDocuments')
  async analyzeResults() {
    console.log('Analyzing results...');
    const startTime = performance.now();
    
    // Calculate statistics efficiently
    const scores = this.state.analysisScores;
    
    // Use optimized typed array operations
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    
    // Single-pass algorithm for better performance
    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];
      sum += score;
      min = Math.min(min, score);
      max = Math.max(max, score);
    }
    
    const avg = sum / scores.length;
    
    // Calculate standard deviation efficiently
    let sumSqDiff = 0;
    for (let i = 0; i < scores.length; i++) {
      const diff = scores[i] - avg;
      sumSqDiff += diff * diff;
    }
    const stdDev = Math.sqrt(sumSqDiff / scores.length);
    
    // Generate categories with Map for performance
    const categories = new Map<string, number>();
    
    this.state.documents.forEach((doc, id) => {
      if (doc.metadata.category) {
        const category = doc.metadata.category;
        categories.set(category, (categories.get(category) || 0) + 1);
      }
    });
    
    // Prepare results
    const analysisResults = {
      documentCount: scores.length,
      statistics: {
        min: min === Infinity ? 0 : min,
        max: max === -Infinity ? 0 : max,
        average: avg,
        standardDeviation: stdDev
      },
      categoryBreakdown: Object.fromEntries(categories)
    };
    
    // Write analysis results with optimized I/O
    await fs.writeFile(
      './data/results/analysis.json', 
      JSON.stringify(analysisResults, null, 2)
    );
    
    const duration = performance.now() - startTime;
    this.state.metrics.methodDurations.set('analyzeResults', duration);
    
    return analysisResults;
  }
  
  /**
   * Generate individual document reports
   */
  @listen('analyzeResults')
  async generateReports() {
    console.log('Generating document reports...');
    const startTime = performance.now();
    
    // Process in parallel for better performance
    const docIds = Array.from(this.state.processedIds);
    
    // Process in optimized batches
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < docIds.length; i += batchSize) {
      batches.push(docIds.slice(i, i + batchSize));
    }
    
    // Process batches sequentially for memory efficiency
    for (const batch of batches) {
      await Promise.all(batch.map(async (docId) => {
        const doc = this.state.documents.get(docId)!;
        
        // Generate report with document content summary
        const reportData = {
          id: docId,
          metadata: doc.metadata,
          summary: this.generateSummary(doc.content),
          processedAt: new Date().toISOString(),
          analysisScore: this.getScoreForDocument(docId)
        };
        
        // Write report file
        await fs.writeFile(
          `./data/results/${docId}-report.json`,
          JSON.stringify(reportData, null, 2)
        );
      }));
    }
    
    const duration = performance.now() - startTime;
    this.state.metrics.methodDurations.set('generateReports', duration);
    
    return { reportsGenerated: this.state.processedIds.size };
  }
  
  /**
   * Finalize processing and compile metrics
   */
  @listen('generateReports')
  async finalize() {
    console.log('Finalizing document processing...');
    
    // Complete metrics
    this.state.metrics.endTime = Date.now();
    
    // Generate summary report with all metrics
    const summary = {
      totalDocuments: this.state.metrics.documentCount,
      processedDocuments: this.state.processedIds.size,
      totalTime: this.state.metrics.endTime - this.state.metrics.startTime,
      processingTime: this.state.metrics.processingTime,
      averageDocumentTime: this.state.metrics.averageDocumentTime,
      methodDurations: Object.fromEntries(this.state.metrics.methodDurations)
    };
    
    // Write summary file
    await fs.writeFile(
      './data/results/summary.json', 
      JSON.stringify(summary, null, 2)
    );
    
    // Log performance summary
    console.log('\nPerformance metrics:');
    console.log(`- Documents processed: ${summary.processedDocuments}`);
    console.log(`- Total processing time: ${summary.totalTime}ms`);
    console.log(`- Average document processing time: ${summary.averageDocumentTime.toFixed(2)}ms`);
    
    // Method durations
    console.log('\nMethod durations:');
    this.state.metrics.methodDurations.forEach((duration, method) => {
      console.log(`- ${method}: ${duration.toFixed(2)}ms`);
    });
    
    return summary;
  }
  
  /**
   * Handle errors with optimized error reporting
   */
  @listen('*')
  async handleError(input: any, error: Error) {
    console.error('Error in document processing flow:', error);
    
    // Complete metrics even for errors
    if (!this.state.metrics.endTime) {
      this.state.metrics.endTime = Date.now();
    }
    
    // Write error report with optimized I/O
    try {
      await fs.writeFile(
        './data/results/error-report.json',
        JSON.stringify({
          error: error.message,
          stack: error.stack,
          input,
          timestamp: new Date().toISOString(),
          metrics: {
            documentCount: this.state.metrics.documentCount,
            processedCount: this.state.processedIds.size,
            methodDurations: Object.fromEntries(this.state.metrics.methodDurations)
          }
        }, null, 2)
      );
    } catch (writeError) {
      console.error('Failed to write error report:', writeError);
    }
    
    return {
      status: 'error',
      error: error.message,
      processedDocuments: this.state.processedIds.size,
      totalDocuments: this.state.metrics.documentCount
    };
  }
  
  /**
   * Get analysis score for a specific document
   */
  private getScoreForDocument(docId: string): number {
    const docIds = Array.from(this.state.documents.keys());
    const index = docIds.indexOf(docId);
    
    if (index >= 0 && index < this.state.analysisScores.length) {
      return this.state.analysisScores[index];
    }
    
    return 0;
  }
  
  /**
   * Create sample documents for testing
   */
  private async createSampleDocuments(): Promise<void> {
    console.log('Creating sample documents...');
    
    // Optimized document generation
    const documents = [
      {
        id: 'doc1',
        title: 'Introduction to Flow Systems',
        category: 'technical',
        content: 'Flow systems provide a structured way to manage complex processes. ' +
                'They enable clear visualization and execution of multi-step operations. ' +
                'KEY INSIGHTS: Modular design, event-driven architecture, and optimization.'
      },
      {
        id: 'doc2',
        title: 'Memory Integration Patterns',
        category: 'technical',
        content: 'Integrating memory systems with workflows improves persistence and reliability. ' +
                'Best practices include caching, efficient serialization, and proper indexing. ' +
                'KEY INSIGHTS: Performance optimization, data integrity, and retrieval patterns.'
      },
      {
        id: 'doc3',
        title: 'Project Planning Guide',
        category: 'business',
        content: 'Effective project planning requires clear goals and realistic timelines. ' +
                'Teams should focus on deliverables while maintaining flexibility for changes. ' +
                'KEY INSIGHTS: Resource allocation, milestone tracking, and risk management.'
      },
      {
        id: 'doc4',
        title: 'Market Research Summary',
        category: 'business',
        content: 'Our market analysis shows growing demand for workflow automation tools. ' +
                'Competitors are focusing on UI improvements while neglecting performance. ' +
                'KEY INSIGHTS: Performance optimization is our key differentiator.'
      },
      {
        id: 'doc5',
        title: 'Developer Onboarding',
        category: 'technical',
        content: 'New developers should first understand our architecture and tooling. ' +
                'Focus areas include TypeScript fundamentals, testing practices, and optimization techniques. ' +
                'KEY INSIGHTS: Code quality, performance best practices, and documentation.'
      }
    ];
    
    // Create files in parallel for performance
    await Promise.all(documents.map(async (doc) => {
      const filePath = path.join('./data/documents', `${doc.id}.txt`);
      
      // Create content with embedded metadata
      const content = `TITLE: ${doc.title}\n` +
                      `CATEGORY: ${doc.category}\n` +
                      `DATE: ${new Date().toISOString()}\n\n` +
                      doc.content;
      
      await fs.writeFile(filePath, content);
    }));
    
    console.log(`Created ${documents.length} sample documents`);
  }
  
  /**
   * Extract metadata from document content with optimized parsing
   */
  private extractMetadata(content: string, docId: string): Record<string, any> {
    const metadata: Record<string, any> = { id: docId };
    
    // Fast metadata extraction with regex and caching
    const titleMatch = content.match(/TITLE: (.+)/);
    if (titleMatch) metadata.title = titleMatch[1];
    
    const categoryMatch = content.match(/CATEGORY: (.+)/);
    if (categoryMatch) metadata.category = categoryMatch[1];
    
    const dateMatch = content.match(/DATE: (.+)/);
    if (dateMatch) metadata.date = dateMatch[1];
    
    // Extract key insights if present
    const insightsMatch = content.match(/KEY INSIGHTS: (.+)/);
    if (insightsMatch) {
      metadata.keyInsights = insightsMatch[1].split(', ');
    }
    
    return metadata;
  }
  
  /**
   * Analyze document with optimized text processing
   */
  private async analyzeDocument(
    content: string, 
    metadata: Record<string, any>
  ): Promise<{ score: number; analysis: any }> {
    // Simulate document analysis with optimized processing
    
    // Calculate relevance score based on content length and keyword density
    const contentWithoutMetadata = content.split('\n\n').slice(1).join('\n\n');
    const wordCount = contentWithoutMetadata.split(/\s+/).length;
    
    // Use optimized scoring algorithm
    const lengthScore = Math.min(wordCount / 100, 1) * 5; // 0-5 points based on length
    
    // Calculate keyword density with optimized search
    const keywordScores: Record<string, number> = {
      'optimization': 2,
      'performance': 2,
      'flow': 1.5,
      'system': 1,
      'integration': 1.5,
      'memory': 1.5
    };
    
    let keywordScore = 0;
    const contentLower = contentWithoutMetadata.toLowerCase();
    
    // Single pass keyword counting for performance
    Object.entries(keywordScores).forEach(([keyword, value]) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = contentLower.match(regex);
      if (matches) {
        keywordScore += matches.length * value;
      }
    });
    
    // Normalize keyword score
    keywordScore = Math.min(keywordScore, 5);
    
    // Add category bonus
    const categoryScore = metadata.category === 'technical' ? 1 : 0.5;
    
    // Compute final score (0-10)
    const score = (lengthScore + keywordScore + categoryScore) / 1.15;
    
    // Simulate processing delay (non-blocking)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      score,
      analysis: {
        wordCount,
        lengthScore,
        keywordScore,
        categoryScore,
        category: metadata.category
      }
    };
  }
  
  /**
   * Generate text summary with optimized NLP-like processing
   */
  private generateSummary(content: string): string {
    // Extract content without metadata
    const contentWithoutMetadata = content.split('\n\n').slice(1).join('\n\n');
    
    // For this example, extract first sentence of each paragraph
    const paragraphs = contentWithoutMetadata.split('\n').filter(p => p.trim().length > 0);
    const sentences = paragraphs.map(p => {
      const match = p.match(/^([^.!?]+[.!?])/);
      return match ? match[1].trim() : p.substring(0, Math.min(p.length, 100));
    });
    
    // Limit summary length for performance
    return sentences.join(' ');
  }
}

/**
 * Main execution function with memory integration
 */
async function main() {
  console.log('Starting document processing flow with memory integration...');
  
  try {
    // Set up memory for optimal persistence
    const memoryOptions: ContextualMemoryOptions = {
      retriever: 'vector',                   // Use vector store for semantic retrieval
      maxMemoryEntries: 1000,               // Limit total entries for performance
      memoryExpiry: 30 * 24 * 60 * 60 * 1000 // 30 days cache
    };
    
    // Create memory connector with optimized settings
    const connector = new FlowMemoryConnector<DocumentProcessingState>({
      memoryOptions,
      persistStateOnEveryChange: false,      // Only persist at key points for performance
      persistMethodResults: true,            // Store method results for analysis
      statePersistenceDebounceMs: 1000,      // Debounce updates
      useCompression: true,                  // Use compression for large states
      maxStateSnapshotsPerFlow: 5,           // Limit snapshots for optimized storage
      inMemoryCache: true                    // Use in-memory cache for speed
    });
    
    // Create and execute the flow
    const flow = new DocumentProcessingFlow();
    
    // Connect flow to memory system
    connector.connectToFlow(flow);
    
    // Subscribe to performance-related events
    flow.events.on('method_execution_started', (event) => {
      console.log(`[${new Date().toISOString()}] Starting method: ${event.methodName}`);
    });
    
    flow.events.on('method_execution_finished', (event) => {
      console.log(`[${new Date().toISOString()}] Finished method: ${event.methodName} in ${event.duration}ms`);
    });
    
    // Execute with performance measurement
    console.time('Flow execution');
    const result = await flow.execute();
    console.timeEnd('Flow execution');
    
    // Generate flow visualization
    console.log('Generating flow visualization...');
    const visualizationPath = await plotFlow(flow, 'document-processing-flow', './visualizations');
    console.log(`Flow visualization saved to: ${visualizationPath}`);
    
    // Display memory persistence stats
    const flowId = flow.id || flow.constructor.name;
    const stateHistory = await connector.getFlowStateHistory(flowId);
    const methodResults = await connector.getMethodResults(flowId);
    
    console.log('\nMemory system persistence stats:');
    console.log(`- State snapshots: ${stateHistory.length}`);
    console.log(`- Method results: ${methodResults.length}`);
    
    // Test loading from memory
    console.log('\nTesting flow restoration from memory...');
    console.time('Flow restoration');
    const restoredFlow = await connector.loadFlow(flowId, DocumentProcessingFlow);
    console.timeEnd('Flow restoration');
    
    if (restoredFlow) {
      console.log('Successfully restored flow from memory');
      console.log(`Restored state has ${restoredFlow.state.documents.size} documents and ${restoredFlow.state.processedIds.size} processed items`);
    } else {
      console.log('Failed to restore flow from memory');
    }
    
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
export { DocumentProcessingFlow, DocumentProcessingState, main };
