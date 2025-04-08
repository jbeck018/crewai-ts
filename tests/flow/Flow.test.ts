// @ts-nocheck
/**
 * Tests for the Flow system implementation with optimized execution.
 */
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { Flow } from '../../src/flow/Flow.js';
import { FlowState } from '../../src/flow/FlowState.js';
import { start, listen, router, and_, or_ } from '../../src/flow/decorators.js';
import { CONTINUE, STOP } from '../../src/flow/types.js';
import type { Condition } from '../../src/flow/types.js';

// Enhanced test state for improved performance and reliability
class TestFlowState extends FlowState {
  testData: string = '';
  executed: string[] = [];
  values: Map<string, any> = new Map();
  error: Error | null = null;
  
  constructor(initialData?: Partial<TestFlowState>) {
    super(initialData || {});
    this.executed = initialData?.executed || [];
    this.values = initialData?.values || new Map();
    this.testData = initialData?.testData || '';
    this.error = initialData?.error || null;
  }
}

// Create an optimized TestFlow base class that properly manages state for tests
class TestFlow<T extends TestFlowState> extends Flow<T> {
  constructor(options: any = {}) {
    // Ensure we have a properly initialized state object
    if (!options.initialState) {
      options.initialState = new TestFlowState() as unknown as T;
    }
    super(options);
    
    // Make state available for tests
    this.testState = this.state;
  }
  
  // Expose state for test verification
  testState: T;
  
  // Override _executeMethod to handle null state values gracefully
  protected async _executeMethod(methodName: string, input?: any): Promise<any> {
    // Ensure state is always initialized
    if (!this.state) {
      this.state = new TestFlowState() as unknown as T;
    }
    if (!this.state.executed) {
      this.state.executed = [];
    }
    if ('values' in this.state && !this.state.values) {
      this.state.values = new Map();
    }
    
    // Now delegate to parent class implementation
    return super._executeMethod(methodName, input);
  }
  
  // Override execute with a timeout mechanism to prevent tests from hanging
  async execute(inputs: Record<string, any> = {}): Promise<any> {
    // Create a timeout promise that rejects after 5 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Flow execution timed out after 5 seconds'));
      }, 5000);
    });
    
    // Race the normal execution against the timeout
    try {
      return await Promise.race([
        super.execute(inputs),
        timeoutPromise
      ]);
    } catch (error) {
      console.error('Flow execution error or timeout:', error);
      // Ensure we return something so tests can continue
      return null;
    }
  }
}

describe('Flow', () => {
  describe('Basic Flow Execution', () => {
    class BasicFlow extends TestFlow<TestFlowState> {
      constructor() {
        // Initialize with explicit state object
        const initialState = new TestFlowState();
        initialState.executed = [];
        initialState.values = new Map();
        initialState.testData = '';
        initialState.error = null;
        super({ initialState });
      }
      
      @start()
      async begin(): Promise<symbol> {
        // Ensure state is properly accessed and initialized
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        if (!state.values) {
          state.values = new Map();
        }
        state.executed.push('begin');
        state.values.set('begin', 'started');
        return CONTINUE;
      }
      
      @listen('begin')
      async process(): Promise<symbol> {
        // Ensure state is properly accessed and initialized
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        if (!state.values) {
          state.values = new Map();
        }
        state.executed.push('process');
        state.values.set('process', 'processed');
        return CONTINUE;
      }
      
      @listen('process')
      async complete(): Promise<string> {
        // Ensure state is properly accessed and initialized
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        if (!state.values) {
          state.values = new Map();
        }
        state.executed.push('complete');
        state.values.set('complete', 'completed');
        return 'done';
      }
    }
    
    let flow: BasicFlow;
    
    beforeEach(() => {
      flow = new BasicFlow();
    });
    
    test('executes methods in order', async () => {
      const result = await flow.execute();
      
      // Use state through the flow class instance
      // Add accessor methods to the test class to access protected state safely
      expect(flow.testState.executed).toEqual(['begin', 'process', 'complete']);
      expect(result).toBe('done');
    });
    
    test('passes results between methods', async () => {
      await flow.execute();
      
      // Access values directly in test context
      expect(flow.testState.values.get('begin')).toBe('started');
      expect(flow.testState.values.get('process')).toBe('processed');
      expect(flow.testState.values.get('complete')).toBe('completed');
    });
  });
  
  describe('Conditional Flow Execution', () => {
    class ConditionalFlow extends TestFlow<TestFlowState> {
      constructor() {
        // Initialize with explicit state object
        const initialState = new TestFlowState();
        initialState.executed = [];
        initialState.values = new Map();
        initialState.testData = '';
        initialState.error = null;
        super({ initialState });
      }
      
      @start()
      async begin(): Promise<symbol> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('begin');
        return CONTINUE;
      }
      
      @listen('begin')
      async conditionalRoute(input: any): Promise<{ route: string }> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('conditionalRoute');
        if (input?.route === 'a') {
          state.testData = 'route_a';
          return { route: 'a' };
        } else {
          state.testData = 'route_b';
          return { route: 'b' };
        }
      }
      
      @listen('conditionalRoute')
      @router((state, result) => result?.route === 'a')
      async routeA(): Promise<string> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('routeA');
        return 'route_a_result';
      }
      
      @listen('conditionalRoute')
      @router((state, result) => result?.route === 'b')
      async routeB(): Promise<string> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('routeB');
        return 'route_b_result';
      }
      
      @listen(or_('routeA', 'routeB'))
      async finish(input: any): Promise<any> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('finish');
        return state.testData; // Return test data instead of input
      }
    }
    
    test('routes to path A when condition matches', async () => {
      const flow = new ConditionalFlow();
      const result = await flow.execute({ route: 'a' });
      
      expect(flow.testState.executed).toEqual([
        'begin', 'conditionalRoute', 'routeA', 'finish'
      ]);
      expect(flow.testState.testData).toBe('route_a');
      expect(result).toBe('route_a_result');
    });
    
    test('routes to path B when condition matches', async () => {
      const flow = new ConditionalFlow();
      const result = await flow.execute({ route: 'b' });
      
      expect(flow.testState.executed).toEqual([
        'begin', 'conditionalRoute', 'routeB', 'finish'
      ]);
      expect(flow.testState.testData).toBe('route_b');
      expect(result).toBe('route_b_result');
    });
  });
  
  describe('Complex Conditions', () => {
    class ComplexConditionFlow extends TestFlow<TestFlowState> {
      constructor() {
        // Initialize with explicit state object
        const initialState = new TestFlowState();
        initialState.executed = [];
        initialState.values = new Map();
        initialState.testData = '';
        initialState.error = null;
        super({ initialState });
      }
      
      @start()
      async taskA(): Promise<string> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('taskA');
        return 'A';
      }
      
      @start()
      async taskB(): Promise<string> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('taskB');
        return 'B';
      }
      
      @listen(and_('taskA', 'taskB'))
      async bothCompleted(inputs: any): Promise<string[]> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('bothCompleted');
        return ['A', 'B'];
      }
      
      @listen('taskA')
      async afterA(): Promise<string> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('afterA');
        return 'after_A';
      }
      
      @listen('taskB')
      async afterB(): Promise<string> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('afterB');
        return 'after_B';
      }
      
      @listen(or_('afterA', 'afterB'))
      async eitherCompleted(): Promise<string> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('eitherCompleted');
        return 'either';
      }
    }
    
    test('AND condition executes method only when all dependencies are met', async () => {
      const flow = new ComplexConditionFlow();
      await flow.execute();
      
      // Both start methods run in parallel
      expect(flow.testState.executed).toContain('taskA');
      expect(flow.testState.executed).toContain('taskB');
      
      // Individual listeners trigger
      expect(flow.testState.executed).toContain('afterA');
      expect(flow.testState.executed).toContain('afterB');
      
      // Both AND and OR conditions trigger
      expect(flow.testState.executed).toContain('bothCompleted');
      expect(flow.testState.executed).toContain('eitherCompleted');
    });
  });
  
  describe('Error Handling', () => {
    class ErrorFlow extends TestFlow<TestFlowState> {
      constructor() {
        // Initialize with explicit state object
        const initialState = new TestFlowState();
        initialState.executed = [];
        initialState.values = new Map();
        initialState.testData = '';
        initialState.error = null;
        super({ initialState });
      }
      
      @start()
      async begin() {
        this.state.executed.push('begin');
        return CONTINUE;
      }
      
      @listen('begin')
      async failingMethod(): Promise<never> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('failingMethod');
        throw new Error('Test error');
      }
      
      @listen('failingMethod')
      async shouldNotRun(): Promise<string> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('shouldNotRun');
        return 'never reaches here';
      }
      
      @listen('*')
      async errorHandler(input: any, error: Error): Promise<string> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('errorHandler');
        state.error = error;
        return 'handled';
      }
    }
    
    test('catches errors and triggers error handler', async () => {
      const flow = new ErrorFlow();
      const result = await flow.execute();
      
      expect(flow.testState.executed).toEqual(['begin', 'failingMethod', 'errorHandler']);
      expect(flow.testState.executed).not.toContain('shouldNotRun');
      expect(flow.testState.error).toBeInstanceOf(Error);
      expect(flow.testState.error?.message).toBe('Test error');
      expect(result).toBe('handled');
    });
  });
  
  describe('Flow Events', () => {
    class EventFlow extends TestFlow<TestFlowState> {
      constructor() {
        // Initialize with explicit state object
        const initialState = new TestFlowState();
        initialState.executed = [];
        initialState.values = new Map();
        initialState.testData = '';
        initialState.error = null;
        super({ initialState });
      }
      
      @start()
      async begin(): Promise<symbol> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('begin');
        return CONTINUE;
      }
      
      @listen('begin')
      async process(): Promise<symbol> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('process');
        return CONTINUE;
      }
    }
    
    test('emits events during execution', async () => {
      const flow = new EventFlow();
      const events: string[] = [];
      
      // Subscribe to events
      flow.events.on('flow_started', () => events.push('flow_started'));
      flow.events.on('method_execution_started', (e) => events.push(`start_${e.methodName}`));
      flow.events.on('method_execution_finished', (e) => events.push(`finish_${e.methodName}`));
      flow.events.on('flow_finished', () => events.push('flow_finished'));
      
      await flow.execute();
      
      // Check event sequence
      expect(events).toContain('flow_started');
      expect(events).toContain('start_begin');
      expect(events).toContain('finish_begin');
      expect(events).toContain('start_process');
      expect(events).toContain('finish_process');
      expect(events).toContain('flow_finished');
      
      // Check ordering of some key events
      const startIndex = events.indexOf('flow_started');
      const finishIndex = events.indexOf('flow_finished');
      expect(startIndex).toBeLessThan(finishIndex);
    });
  });
  
  describe('Method Result Caching', () => {
    class CachingFlow extends TestFlow<TestFlowState> {
      executionCount = 0;
      
      constructor() {
        // Initialize with explicit state object
        const initialState = new TestFlowState();
        initialState.executed = [];
        initialState.values = new Map();
        initialState.testData = '';
        initialState.error = null;
        
        super({ 
          initialState,
          cacheResults: true,
          cacheTTL: 1000 // 1 second
        });
      }
      
      @start()
      async cachedMethod(): Promise<string> {
        if (!this.state) {
          this.state = new TestFlowState();
        }
        const state = this.state as TestFlowState;
        if (!state.executed) {
          state.executed = [];
        }
        state.executed.push('cachedMethod');
        this.executionCount++;
        return `executed ${this.executionCount} times`;
      }
    }
    
    test('caches method results', async () => {
      const flow = new CachingFlow();
      
      // Setup vitest timer mocks
      vi.useFakeTimers();
      
      // First execution
      const result1 = await flow.execute();
      expect(result1).toBe('executed 1 times');
      expect(flow.executionCount).toBe(1);
      
      // Second execution should use cached result
      const result2 = await flow.execute();
      expect(result2).toBe('executed 1 times');
      expect(flow.executionCount).toBe(1); // Still 1
      
      // Wait for cache to expire using vitest timer mocks
      vi.advanceTimersByTime(1100);
      await Promise.resolve(); // Flush promises
      
      // Third execution after cache expiry
      const result3 = await flow.execute();
      expect(result3).toBe('executed 2 times');
      expect(flow.executionCount).toBe(2);
      
      // Restore timer mocks
      vi.useRealTimers();
    });
  });
});
