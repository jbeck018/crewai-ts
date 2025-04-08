/**
 * FlowOrchestrator Tests
 * 
 * Comprehensive tests for the Flow Orchestrator with performance benchmarking.
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Flow, FlowState } from '../../../src/flow/index.js';
import { start, listen, router } from '../../../src/flow/decorators.js';
import { CONTINUE } from '../../../src/flow/types.js';
import { FlowOrchestrator } from '../../../src/flow/orchestration/FlowOrchestrator.js';
import { FlowMemoryConnector } from '../../../src/flow/memory/FlowMemoryConnector.js';

// Performance measurement utility
const measurePerformance = async <T>(fn: () => Promise<T>): Promise<{ result: T, duration: number }> => {
  const startTime = performance.now();
  const result = await fn();
  const duration = performance.now() - startTime;
  return { result, duration };
};

// Memory usage utility
const getMemoryUsage = () => process.memoryUsage().heapUsed;

// Simple test states with optimized data structures
class SimpleFlowState extends FlowState {
  counter: number = 0;
  data: Map<string, any> = new Map();
  processed: boolean = false;
  startTime: number = 0;
  endTime?: number;
}

// Test flow implementations with performance optimizations
class SimpleFlow extends Flow<SimpleFlowState> {
  constructor(options?: any) {
    super({
      initialState: new SimpleFlowState(),
      ...options
    });
  }
  
  @start()
  async initialize() {
    this.state.startTime = performance.now();
    this.state.counter = 0;
    this.state.processed = false;
    return CONTINUE;
  }
  
  @listen('initialize')
  async process() {
    this.state.counter += 1;
    this.state.processed = true;
    return { processed: true, counter: this.state.counter };
  }
  
  @listen('process')
  async finalize() {
    this.state.endTime = performance.now();
    const duration = this.state.endTime - this.state.startTime;
    return { 
      success: true, 
      duration,
      counter: this.state.counter
    };
  }
}

// Flow with controllable execution time for performance testing
class DelayedFlow extends Flow<SimpleFlowState> {
  private delayMs: number;
  
  constructor(delayMs: number = 10, options?: any) {
    super({
      initialState: new SimpleFlowState(),
      ...options
    });
    this.delayMs = delayMs;
  }
  
  @start()
  async initialize() {
    this.state.startTime = performance.now();
    return CONTINUE;
  }
  
  @listen('initialize')
  async process() {
    // Simulate work with controlled delay
    await new Promise(resolve => setTimeout(resolve, this.delayMs));
    this.state.processed = true;
    return { processed: true, delayMs: this.delayMs };
  }
  
  @listen('process')
  async finalize() {
    this.state.endTime = performance.now();
    const duration = this.state.endTime - this.state.startTime;
    return { 
      success: true, 
      duration,
      processed: this.state.processed
    };
  }
}

// Conditional flow for testing dependencies
class ConditionalFlow extends Flow<SimpleFlowState> {
  constructor(options?: any) {
    super({
      initialState: new SimpleFlowState(),
      ...options
    });
  }
  
  @start()
  async initialize() {
    return CONTINUE;
  }
  
  @listen('initialize')
  async process(input?: any) {
    // Process based on input
    const condition = input?.condition === true;
    this.state.data.set('condition', condition);
    return { condition };
  }
  
  @listen('process')
  @router((result) => result?.condition === true)
  async processTrue() {
    return { path: 'true', status: 'success' };
  }
  
  @listen('process')
  @router((result) => result?.condition !== true)
  async processFalse() {
    return { path: 'false', status: 'success' };
  }
}

// Create mock memory connector for testing
const createMockMemoryConnector = () => {
  const connectToFlowMock = mock(() => {});
  
  const memoryConnector = {
    connectToFlow: connectToFlowMock
  } as unknown as FlowMemoryConnector;
  
  return { memoryConnector, connectToFlowMock };
};

describe('FlowOrchestrator', () => {
  let orchestrator: FlowOrchestrator;
  
  beforeEach(() => {
    // Create new orchestrator for each test with optimized settings
    orchestrator = new FlowOrchestrator({
      optimizeFor: 'speed',
      execution: {
        maxConcurrency: 4,
        timeout: 5000,
        retryCount: 0,
        checkpointInterval: 1000
      }
    });
  });
  
  test('should register a flow with the orchestrator', () => {
    // Arrange
    const flow = new SimpleFlow();
    
    // Act
    const flowId = orchestrator.registerFlow(flow, { priority: 5 });
    
    // Assert
    expect(flowId).toBeDefined();
    expect(typeof flowId).toBe('string');
    expect(flowId).toContain('SimpleFlow');
    
    // Verify flow graph contains the registered flow
    const graph = orchestrator.getFlowGraph();
    expect(graph.nodes.length).toBe(1);
    expect(graph.nodes[0].id).toBe(flowId);
    expect(graph.nodes[0].priority).toBe(5);
  });
  
  test('should add dependencies between flows', () => {
    // Arrange
    const flow1 = new SimpleFlow();
    const flow2 = new SimpleFlow();
    const flow3 = new SimpleFlow();
    
    const id1 = orchestrator.registerFlow(flow1, { id: 'flow1' });
    const id2 = orchestrator.registerFlow(flow2, { id: 'flow2' });
    const id3 = orchestrator.registerFlow(flow3, { id: 'flow3' });
    
    // Act
    orchestrator.addDependency(id1, id2); // flow2 depends on flow1
    orchestrator.addDependency(id2, id3); // flow3 depends on flow2
    
    // Assert
    const graph = orchestrator.getFlowGraph();
    expect(graph.edges.length).toBe(2);
    
    // Verify edges
    const edge1 = graph.edges.find(e => e.from === id1 && e.to === id2);
    const edge2 = graph.edges.find(e => e.from === id2 && e.to === id3);
    
    expect(edge1).toBeDefined();
    expect(edge2).toBeDefined();
  });
  
  test('should detect circular dependencies', () => {
    // Arrange
    const flow1 = new SimpleFlow();
    const flow2 = new SimpleFlow();
    
    const id1 = orchestrator.registerFlow(flow1, { id: 'flow1' });
    const id2 = orchestrator.registerFlow(flow2, { id: 'flow2' });
    
    orchestrator.addDependency(id1, id2); // flow2 depends on flow1
    
    // Act & Assert
    expect(() => {
      orchestrator.addDependency(id2, id1); // This would create a cycle
    }).toThrow(/would create a cycle/);
  });
  
  test('should execute a single flow', async () => {
    // Arrange
    const flow = new SimpleFlow();
    orchestrator.registerFlow(flow, { id: 'single-flow' });
    
    // Act - measure performance
    const { result, duration } = await measurePerformance(() => 
      orchestrator.execute()
    );
    
    // Assert
    expect(result.size).toBe(1);
    expect(result.get('single-flow')).toBeDefined();
    expect(result.get('single-flow').success).toBe(true);
    
    // Log performance
    console.log(`Single flow execution time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(1000); // Sanity check for performance
  });
  
  test('should execute flows in dependency order', async () => {
    // Arrange
    const flow1 = new SimpleFlow();
    const flow2 = new SimpleFlow();
    const flow3 = new SimpleFlow();
    
    const id1 = orchestrator.registerFlow(flow1, { id: 'flow1' });
    const id2 = orchestrator.registerFlow(flow2, { id: 'flow2' });
    const id3 = orchestrator.registerFlow(flow3, { id: 'flow3' });
    
    orchestrator.addDependency(id1, id2); // flow2 depends on flow1
    orchestrator.addDependency(id2, id3); // flow3 depends on flow2
    
    // Track execution order
    const executionOrder: string[] = [];
    
    orchestrator.events.on('flow_started', (event) => {
      executionOrder.push(event.id);
    });
    
    // Act
    await orchestrator.execute();
    
    // Assert
    expect(executionOrder).toEqual(['flow1', 'flow2', 'flow3']);
  });
  
  test('should pass data between dependent flows', async () => {
    // Arrange
    const flow1 = new SimpleFlow();
    const flow2 = new ConditionalFlow();
    
    const id1 = orchestrator.registerFlow(flow1, { id: 'data-producer' });
    const id2 = orchestrator.registerFlow(flow2, { id: 'data-consumer' });
    
    // Add dependency with data mapping
    orchestrator.addDependency(id1, id2, {
      dataMapping: (fromResult) => ({
        condition: fromResult.counter > 0
      })
    });
    
    // Act
    const results = await orchestrator.execute();
    
    // Assert
    expect(results.size).toBe(2);
    
    // Verify data was passed correctly
    const consumerResult = results.get('data-consumer');
    expect(consumerResult).toBeDefined();
    expect(consumerResult.path).toBe('true');
  });
  
  test('should execute flows in parallel for optimal performance', async () => {
    // Arrange
    const flowCount = 10;
    const flows: DelayedFlow[] = [];
    const flowIds: string[] = [];
    
    // Create independent flows that can run in parallel
    for (let i = 0; i < flowCount; i++) {
      const flow = new DelayedFlow(50); // Each flow takes 50ms
      const id = orchestrator.registerFlow(flow, { id: `parallel-flow-${i}` });
      flows.push(flow);
      flowIds.push(id);
    }
    
    // Configure for maximum parallelism
    orchestrator = new FlowOrchestrator({
      optimizeFor: 'speed',
      execution: {
        maxConcurrency: flowCount, // Allow all flows to run in parallel
        timeout: 5000
      }
    });
    
    // Re-register flows with new orchestrator
    for (let i = 0; i < flowCount; i++) {
      orchestrator.registerFlow(flows[i], { id: flowIds[i] });
    }
    
    // Act - measure performance
    const { duration } = await measurePerformance(() => 
      orchestrator.execute()
    );
    
    // Assert
    // If truly parallel, this should take ~50ms plus overhead, not 50*flowCount
    console.log(`${flowCount} parallel flows execution time: ${duration.toFixed(2)}ms`);
    
    // With some overhead, should still be much faster than sequential
    // Sequential would be at least flowCount * 50ms = 500ms
    expect(duration).toBeLessThan(300);
  });
  
  test('should limit concurrency based on configuration', async () => {
    // Arrange
    const flowCount = 10;
    const flows: DelayedFlow[] = [];
    const flowIds: string[] = [];
    
    // Create flows that can run in parallel
    for (let i = 0; i < flowCount; i++) {
      const flow = new DelayedFlow(50); // Each flow takes 50ms
      const id = `limited-flow-${i}`;
      flows.push(flow);
      flowIds.push(id);
    }
    
    // Configure with limited concurrency
    orchestrator = new FlowOrchestrator({
      execution: {
        maxConcurrency: 2, // Only allow 2 flows to run concurrently
        timeout: 5000
      }
    });
    
    // Register flows with new orchestrator
    for (let i = 0; i < flowCount; i++) {
      orchestrator.registerFlow(flows[i], { id: flowIds[i] });
    }
    
    // Track concurrent execution
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    
    orchestrator.events.on('flow_started', () => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
    });
    
    orchestrator.events.on('flow_completed', () => {
      currentConcurrent--;
    });
    
    // Act
    await orchestrator.execute();
    
    // Assert
    expect(maxConcurrent).toBe(2); // Should never exceed configured limit
  });
  
  test('should handle conditional dependencies', async () => {
    // Arrange
    const flow1 = new ConditionalFlow();
    const flow2 = new SimpleFlow();
    const flow3 = new SimpleFlow();
    
    const id1 = orchestrator.registerFlow(flow1, { id: 'condition-flow' });
    const id2 = orchestrator.registerFlow(flow2, { id: 'true-branch' });
    const id3 = orchestrator.registerFlow(flow3, { id: 'false-branch' });
    
    // Add conditional dependencies
    orchestrator.addDependency(id1, id2, {
      condition: (result) => result.condition === true
    });
    
    orchestrator.addDependency(id1, id3, {
      condition: (result) => result.condition !== true
    });
    
    // Set initial input for conditional flow
    const options = {
      inputData: {
        condition: true // This should trigger the true-branch
      }
    };
    
    // Act
    const results = await orchestrator.execute(options);
    
    // Assert
    expect(results.has('condition-flow')).toBe(true);
    expect(results.has('true-branch')).toBe(true);
    expect(results.has('false-branch')).toBe(false); // Shouldn't run
  });
  
  test('should integrate with memory connector when enabled', async () => {
    // Arrange
    const { memoryConnector, connectToFlowMock } = createMockMemoryConnector();
    
    orchestrator = new FlowOrchestrator({
      enableMemoryIntegration: true,
      memoryConnector
    });
    
    const flow = new SimpleFlow();
    orchestrator.registerFlow(flow);
    
    // Act
    await orchestrator.execute();
    
    // Assert
    expect(connectToFlowMock).toHaveBeenCalled();
  });
  
  test('performance: should execute complex workflow efficiently', async () => {
    // Arrange - Create a more complex workflow
    const flowCount = 20;
    
    // Create a diamond dependency pattern with fan-out and fan-in
    const sourceFlow = new SimpleFlow();
    const sourceId = orchestrator.registerFlow(sourceFlow, { id: 'source' });
    
    // Middle layer flows with varying priorities
    const middleFlows: DelayedFlow[] = [];
    const middleIds: string[] = [];
    
    for (let i = 0; i < flowCount; i++) {
      // Create flows with different delays to simulate varying workloads
      const delay = 10 + (i % 5) * 10; // 10, 20, 30, 40, 50ms repeated
      const flow = new DelayedFlow(delay);
      const id = `middle-${i}`;
      
      // Assign different priorities to test priority-based scheduling
      const priority = Math.floor(i / 5); // 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, etc.
      
      orchestrator.registerFlow(flow, { id, priority });
      orchestrator.addDependency(sourceId, id);
      
      middleFlows.push(flow);
      middleIds.push(id);
    }
    
    // Sink flow that depends on all middle flows
    const sinkFlow = new SimpleFlow();
    const sinkId = orchestrator.registerFlow(sinkFlow, { id: 'sink' });
    
    for (const middleId of middleIds) {
      orchestrator.addDependency(middleId, sinkId);
    }
    
    // Measure memory before execution
    const memoryBefore = getMemoryUsage();
    
    // Act - measure performance
    const { duration } = await measurePerformance(() => 
      orchestrator.execute()
    );
    
    // Measure memory after execution
    const memoryAfter = getMemoryUsage();
    const memoryDelta = memoryAfter - memoryBefore;
    
    // Get execution metrics
    const metrics = orchestrator.getExecutionMetrics();
    
    // Assert
    console.log(`Complex workflow execution time: ${duration.toFixed(2)}ms`);
    console.log(`Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Average flow execution time: ${metrics.averageFlowExecutionTime.toFixed(2)}ms`);
    
    // Performance expectations based on the workflow
    // Source + parallel middle (max of delays, ~50ms with overhead) + sink
    expect(duration).toBeLessThan(flowCount * 20); // Much less than sequential execution
    
    // Verify all flows completed
    expect(metrics.completedFlows).toBe(flowCount + 2); // Middle flows + source + sink
    expect(metrics.failedFlows).toBe(0);
  });
});
