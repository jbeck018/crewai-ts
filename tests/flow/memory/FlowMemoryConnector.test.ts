/**
 * FlowMemoryConnector Tests
 * 
 * Comprehensive test suite for the Flow Memory integration with
 * performance optimizations and benchmarks.
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Flow, FlowState } from '../../../src/flow/index.js';
import { start, listen, router } from '../../../src/flow/decorators.js';
import { CONTINUE } from '../../../src/flow/types.js';
import { 
  FlowMemoryConnector, 
  FlowMemoryType,
  FlowMemoryItem 
} from '../../../src/flow/memory/FlowMemoryConnector.js';
import { ContextualMemory } from '../../../src/memory/contextual-memory.js';
import { MemoryRetriever } from '../../../src/memory/retrieval.js';
import { VectorStoreMemory } from '../../../src/memory/vector-store.js';

// Performance measurement utilities
const measurePerformance = async <T>(fn: () => Promise<T>): Promise<{ result: T, duration: number }> => {
  const startTime = performance.now();
  const result = await fn();
  const duration = performance.now() - startTime;
  return { result, duration };
};

// Memory usage utilities
const getMemoryUsage = () => process.memoryUsage().heapUsed;

// Test-specific state for performance optimization
class TestFlowState extends FlowState {
  counter: number = 0;
  data: Map<string, any> = new Map();
  results: any[] = [];
}

// Simple flow for testing with optimized methods
class TestFlow extends Flow<TestFlowState> {
  constructor() {
    super({
      initialState: new TestFlowState(),
      cacheResults: true
    });
  }
  
  @start()
  async initialize() {
    this.state.counter = 0;
    return CONTINUE;
  }
  
  @listen('initialize')
  async incrementCounter() {
    this.state.counter += 1;
    return { counter: this.state.counter };
  }
  
  @listen('incrementCounter')
  @router((result) => result?.counter % 2 === 0)
  async handleEven() {
    this.state.data.set('type', 'even');
    return { type: 'even', value: this.state.counter };
  }
  
  @listen('incrementCounter')
  @router((result) => result?.counter % 2 !== 0)
  async handleOdd() {
    this.state.data.set('type', 'odd');
    return { type: 'odd', value: this.state.counter };
  }
  
  @listen('*')
  async handleError(input: any, error: Error) {
    return { error: error.message };
  }
}

// Create mock memory and retriever for optimized testing
const createMockMemory = () => {
  // In-memory storage with O(1) lookups
  const items = new Map<string, FlowMemoryItem>();
  let idCounter = 0;
  
  // Mock memory with optimization for test performance
  const memoryMock = mock(() => ({
    add: async (item: any) => {
      const id = `mock-id-${++idCounter}`;
      items.set(id, { ...item, id });
      return id;
    },
    get: async (query: any) => {
      if (query.id) {
        const item = items.get(query.id);
        return item ? [item] : [];
      }
      
      // Optimized filtering logic
      let filteredItems = Array.from(items.values());
      
      // Apply metadata filters
      if (query.metadata) {
        for (const [key, value] of Object.entries(query.metadata)) {
          filteredItems = filteredItems.filter(item => {
            return item.metadata && item.metadata[key] === value;
          });
        }
      }
      
      // Apply sorting
      if (query.sortBy) {
        filteredItems.sort((a, b) => {
          if (query.sortBy === 'timestamp') {
            return query.sortDirection === 'desc' 
              ? b.timestamp - a.timestamp 
              : a.timestamp - b.timestamp;
          }
          return 0;
        });
      }
      
      // Apply pagination
      if (query.limit) {
        filteredItems = filteredItems.slice(0, query.limit);
      }
      
      if (query.distinct === 'metadata.flowId') {
        const uniqueFlowIds = new Set();
        filteredItems.forEach(item => {
          if (item.metadata?.flowId) {
            uniqueFlowIds.add(item.metadata.flowId);
          }
        });
        
        return Array.from(uniqueFlowIds).map(flowId => ({
          metadata: { flowId }
        }));
      }
      
      return filteredItems;
    },
    delete: async (query: any) => {
      if (query.id) {
        items.delete(query.id);
        return;
      }
      
      // Delete by metadata
      if (query.metadata) {
        for (const [id, item] of items.entries()) {
          let match = true;
          for (const [key, value] of Object.entries(query.metadata)) {
            if (!item.metadata || item.metadata[key] !== value) {
              match = false;
              break;
            }
          }
          if (match) {
            items.delete(id);
          }
        }
      }
    },
    retriever: {
      similaritySearch: async ({ query, k, metadataFilter }: any) => {
        // Simple mock for semantic search
        let filteredItems = Array.from(items.values());
        
        // Apply metadata filters
        if (metadataFilter) {
          for (const [key, value] of Object.entries(metadataFilter)) {
            filteredItems = filteredItems.filter(item => {
              return item.metadata && item.metadata[key] === value;
            });
          }
        }
        
        // Sort by "relevance" (recency in this mock)
        filteredItems.sort((a, b) => b.timestamp - a.timestamp);
        
        // Apply limit
        return filteredItems.slice(0, k || 10);
      }
    }
  }));
  
  return { memory: memoryMock as unknown as ContextualMemory, items };
};

describe('FlowMemoryConnector', () => {
  let connector: FlowMemoryConnector<TestFlowState>;
  let flow: TestFlow;
  let mockMemory: ReturnType<typeof createMockMemory>;
  
  beforeEach(() => {
    // Set up mocks with performance optimizations
    mockMemory = createMockMemory();
    
    // Create connector with mock memory and default options
    connector = new FlowMemoryConnector<TestFlowState>();
    
    // Replace internal memory with mock for performance
    (connector as any).memory = mockMemory.memory;
    (connector as any).retriever = mockMemory.memory.retriever;
    
    // Create test flow
    flow = new TestFlow();
  });
  
  afterEach(() => {
    // Clean up
    mockMemory.items.clear();
  });
  
  test('should connect to a flow and persist initial config', async () => {
    // Arrange & Act
    connector.connectToFlow(flow);
    
    // Assert
    expect(mockMemory.memory.add).toHaveBeenCalled();
    
    // Verify the configuration was persisted with optimized data format
    const addCalls = mockMemory.memory.add.mock.calls;
    const configCall = addCalls.find(call => 
      call[0].memoryType === FlowMemoryType.CONFIG
    );
    
    expect(configCall).toBeDefined();
    expect(configCall[0].flowType).toBe('TestFlow');
  });
  
  test('should persist flow state at start and end of execution', async () => {
    // Arrange
    connector.connectToFlow(flow);
    
    // Pre-test data collection for baseline optimization
    const initialStorageSize = mockMemory.items.size;
    
    // Act - Execute with performance measurement
    const { duration } = await measurePerformance(() => flow.execute());
    
    // Assert
    const stateItems = Array.from(mockMemory.items.values())
      .filter(item => item.memoryType === FlowMemoryType.STATE);
    
    expect(stateItems.length).toBeGreaterThanOrEqual(2); // at least start and finish
    
    // Find the started and finished states
    const startedState = stateItems.find(item => item.metadata?.status === 'started');
    const finishedState = stateItems.find(item => item.metadata?.status === 'finished');
    
    expect(startedState).toBeDefined();
    expect(finishedState).toBeDefined();
    
    // Performance assertions
    console.log(`Flow execution with state persistence: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(1000); // Sanity check for performance
  });
  
  test('should persist method results when enabled', async () => {
    // Arrange - Enable method result persistence
    (connector as any).options.persistMethodResults = true;
    connector.connectToFlow(flow);
    
    // Act - Flow execution
    await flow.execute();
    
    // Assert
    const methodResults = Array.from(mockMemory.items.values())
      .filter(item => item.memoryType === FlowMemoryType.METHOD_RESULT);
    
    expect(methodResults.length).toBeGreaterThan(0);
    
    // Verify method result contents
    const incrementResult = methodResults.find(
      item => item.metadata?.methodName === 'incrementCounter'
    );
    
    expect(incrementResult).toBeDefined();
    expect(JSON.parse(incrementResult!.content)).toEqual({ counter: 1 });
  });
  
  test('should debounce state updates for performance', async () => {
    // Arrange - Enable state persistence with debouncing
    (connector as any).options.persistStateOnEveryChange = true;
    (connector as any).options.statePersistenceDebounceMs = 50;
    connector.connectToFlow(flow);
    
    // Act - Trigger multiple state changes rapidly
    flow.state.counter = 1;
    flow.events.emit('state_changed');
    flow.state.counter = 2;
    flow.events.emit('state_changed');
    flow.state.counter = 3;
    flow.events.emit('state_changed');
    
    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Assert - Should only have persisted the final state
    const stateUpdates = Array.from(mockMemory.items.values())
      .filter(item => 
        item.memoryType === FlowMemoryType.STATE && 
        item.metadata?.status === 'updated'
      );
    
    // Should be only one debounced update
    expect(stateUpdates.length).toBe(1);
    
    // The state should contain the final counter value
    const stateData = JSON.parse(stateUpdates[0].content);
    expect(stateData.counter).toBe(3);
  });
  
  test('should load a flow from persistent state', async () => {
    // Arrange - Execute and persist a flow
    connector.connectToFlow(flow);
    await flow.execute();
    
    // Capture flow ID for retrieval
    const flowId = (connector as any).getFlowId(flow);
    
    // Act - Load flow from persistent state
    const loadedFlow = await connector.loadFlow(flowId, TestFlow);
    
    // Assert
    expect(loadedFlow).not.toBeNull();
    expect(loadedFlow!.state.counter).toBe(1);
  });
  
  test('should get method results with efficient filtering', async () => {
    // Arrange
    (connector as any).options.persistMethodResults = true;
    connector.connectToFlow(flow);
    
    // Execute multiple times to generate various results
    await flow.execute();
    flow.state.counter = 1; // Reset counter to rerun flow
    await flow.execute();
    
    const flowId = (connector as any).getFlowId(flow);
    
    // Act - Retrieve results with optimization benchmark
    const { result: methodResults, duration } = await measurePerformance(() =>
      connector.getMethodResults(flowId, 'incrementCounter')
    );
    
    // Assert
    expect(methodResults.length).toBeGreaterThan(0);
    expect(methodResults.every(item => 
      item.metadata?.methodName === 'incrementCounter'
    )).toBe(true);
    
    // Performance assertion
    console.log(`Method results retrieval time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(500); // Ensure reasonable performance
  });
  
  test('should handle errors and persist them', async () => {
    // Arrange
    connector.connectToFlow(flow);
    
    // Inject an error into the flow
    const error = new Error('Test error');
    flow.events.emit('error', { error, methodName: 'testMethod' });
    
    // Act
    const flowId = (connector as any).getFlowId(flow);
    const errors = await connector.getFlowErrors(flowId);
    
    // Assert
    expect(errors.length).toBe(1);
    expect(errors[0].metadata?.methodName).toBe('testMethod');
    expect(JSON.parse(errors[0].content).message).toBe('Test error');
  });
  
  test('should clear flow data with optimized filtering', async () => {
    // Arrange
    connector.connectToFlow(flow);
    await flow.execute();
    
    const flowId = (connector as any).getFlowId(flow);
    
    // Verify data exists before clearing
    const beforeClear = await mockMemory.memory.get({
      metadata: { flowId }
    });
    expect(beforeClear.length).toBeGreaterThan(0);
    
    // Act - Clear with performance measurement
    const { duration } = await measurePerformance(() =>
      connector.clearFlowData(flowId)
    );
    
    // Assert
    const afterClear = await mockMemory.memory.get({
      metadata: { flowId }
    });
    expect(afterClear.length).toBe(0);
    
    // Performance assertion
    console.log(`Clear flow data execution time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(500); // Ensure reasonable performance
  });
  
  test('performance: should handle large state objects efficiently', async () => {
    // Arrange - Create a large state object
    const largeFlow = new TestFlow();
    
    // Fill with large data for performance testing
    for (let i = 0; i < 1000; i++) {
      largeFlow.state.data.set(`key-${i}`, { 
        id: i, 
        value: `large-value-${i}`.repeat(10),
        timestamp: Date.now()
      });
    }
    
    // Pre-measure memory
    const memoryBefore = getMemoryUsage();
    
    // Connect and persist
    connector.connectToFlow(largeFlow);
    
    // Act - Persist state with performance measurement
    const { duration } = await measurePerformance(() =>
      (connector as any).persistFlowState(largeFlow, 'started')
    );
    
    // Post-measure memory
    const memoryAfter = getMemoryUsage();
    const memoryDelta = memoryAfter - memoryBefore;
    
    // Assert
    console.log(`Large state persistence time: ${duration.toFixed(2)}ms`);
    console.log(`Memory usage delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    
    // Performance expectations
    expect(duration).toBeLessThan(1000); // Should be reasonably fast
    
    // Memory growth should be reasonable given the data size
    // This is a relative check - actual values depend on environment
    const dataSize = JSON.stringify(Array.from(largeFlow.state.data.entries())).length;
    console.log(`Raw data size: ${(dataSize / 1024 / 1024).toFixed(2)}MB`);
    
    // Memory growth should be proportional to data size but with overhead control
    expect(memoryDelta).toBeLessThan(dataSize * 2); // Maximum 2x overhead
  });
  
  test('should use in-memory cache for repeated state retrievals', async () => {
    // Arrange
    (connector as any).options.inMemoryCache = true;
    connector.connectToFlow(flow);
    await flow.execute();
    
    const flowId = (connector as any).getFlowId(flow);
    
    // Act - First retrieval (will hit persistent storage)
    const { duration: firstDuration } = await measurePerformance(() =>
      connector.getLatestFlowState(flowId)
    );
    
    // Second retrieval should use cache
    const { duration: secondDuration } = await measurePerformance(() =>
      connector.getLatestFlowState(flowId)
    );
    
    // Assert - Second retrieval should be significantly faster
    console.log(`First retrieval: ${firstDuration.toFixed(2)}ms`);
    console.log(`Second retrieval (cached): ${secondDuration.toFixed(2)}ms`);
    
    // Cache lookup should be much faster than storage lookup
    expect(secondDuration).toBeLessThan(firstDuration * 0.5);
  });
  
  test('should perform semantic search with optimized filtering', async () => {
    // Skip if no vector store retriever
    if (!((connector as any).retriever instanceof VectorStoreMemory)) {
      console.log('Skipping semantic search test - no vector store retriever');
      return;
    }
    
    // Arrange - Create and persist test data
    connector.connectToFlow(flow);
    await flow.execute();
    
    const flowId = (connector as any).getFlowId(flow);
    
    // Act - Perform semantic search
    const searchResults = await connector.searchFlowData('counter', {
      flowId,
      limit: 5
    });
    
    // Assert
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.every(item => item.flowId === flowId)).toBe(true);
  });
  
  test('should perform optimized batch operations for multiple flows', async () => {
    // Arrange - Create multiple flows
    const flows: TestFlow[] = [];
    const flowCount = 5;
    
    for (let i = 0; i < flowCount; i++) {
      const flow = new TestFlow();
      flow.state.counter = i;
      flows.push(flow);
      connector.connectToFlow(flow);
    }
    
    // Execute all flows to generate various states and results
    await Promise.all(flows.map(f => f.execute()));
    
    // Act - Get all flow IDs with performance measurement
    const { result: flowIds, duration } = await measurePerformance(() =>
      connector.getDistinctFlowIds()
    );
    
    // Assert
    expect(flowIds.length).toBeGreaterThanOrEqual(flowCount);
    
    // Performance assertion
    console.log(`Distinct flow IDs retrieval time: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(500); // Ensure reasonable performance for batch operations
  });
});
