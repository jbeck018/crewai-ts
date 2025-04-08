/**
 * Tests for the FlowVisualizer component with performance optimizations.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { Mock } from 'bun:test';

// Import types only to avoid actual module loading during tests
import type { Flow } from '../../src/flow/Flow.js';
import type { FlowVisualizer } from '../../src/flow/visualization/FlowVisualizer.js';

// Mock dependencies
const fs = {
  existsSync: (() => true) as Mock<() => boolean>,
  mkdirSync: (() => {}) as Mock<() => void>,
  writeFileSync: (() => {}) as Mock<() => void>,
  readFileSync: (() => 'mock template content') as Mock<() => string>
};

const path = {
  join: ((...args: string[]) => args.join('/')) as Mock<(...args: string[]) => string>,
  dirname: ((p: string) => p.split('/').slice(0, -1).join('/')) as Mock<(p: string) => string>,
  resolve: ((...args: string[]) => args.join('/')) as Mock<(...args: string[]) => string>
};

// Mock jsdom
const jsdom = {
  JSDOM: class {
    window: any;
    constructor(html: string) {
      this.window = {
        document: {
          getElementById: () => ({
            // Mock element with required functions
            appendChild: jest.fn(),
            innerHTML: ''
          })
        }
      };
    }
  }
};

// Mock vis-network module
class MockNetwork {
  add = jest.fn();
  setOptions = jest.fn();
  on = jest.fn();
  fit = jest.fn();
  stabilize = jest.fn();
  getPositions = jest.fn(() => ({}));
  
  constructor() {}
}

const mockVisNetwork = {
  Network: MockNetwork
};

// Mock Flow and FlowState
class FlowState {
  id: string = 'test-id';
}

class TestFlowState extends FlowState {
  data: any[] = [];
}

class TestFlow extends Flow<TestFlowState> {
  constructor() {
    super({ initialState: new TestFlowState() });
  }
  
  @start()
  async begin() {
    return 'begin';
  }
  
  @listen('begin')
  async processA() {
    return 'processA';
  }
  
  @listen('begin')
  async processB() {
    return 'processB';
  }
  
  @listen(and_('processA', 'processB'))
  async complete() {
    return 'complete';
  }
  
  @router('processB')
  async route(data: any) {
    return data;
  }
}

describe('FlowVisualizer', () => {
  let flow: TestFlow;
  let visualizer: FlowVisualizer;
  let mockOutputDir: string;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    flow = new TestFlow();
    mockOutputDir = '/mock/output/dir';
    visualizer = new FlowVisualizer(flow, { outputDir: mockOutputDir });
  });
  
  // Optimized test for constructor
  test('constructor initializes with correct properties', () => {
    expect(visualizer['flow']).toBe(flow);
    expect(visualizer['outputDir']).toBe(mockOutputDir);
    expect(visualizer['nodePositions']).toBeInstanceOf(Map);
  });
  
  // Optimized test for precomputePositions
  test('precomputePositions calculates node positions efficiently', () => {
    // The constructor already calls precomputePositions
    // Check that nodePositions map is populated
    expect(visualizer['nodePositions'].size).toBeGreaterThan(0);
  });
  
  // Optimized test for generateVisualization
  test('generateVisualization creates and saves visualization', async () => {
    const filename = 'test_flow';
    const result = await visualizer.generateVisualization(filename);
    
    // Check that file operations were called
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(filename),
      expect.any(String),
      'utf8'
    );
    
    // Verify result path
    expect(result).toContain(filename);
  });
  
  // Test for plotFlow convenience function
  test('plotFlow creates visualizer and generates visualization', async () => {
    const filename = 'convenience_test';
    const result = await plotFlow(flow, filename, mockOutputDir);
    
    // Check that file was created
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(result).toContain(filename);
  });
  
  // Optimized test for caching behavior
  test('visualizer uses cached position calculations for performance', async () => {
    // Create a spy on the computePositions utility
    const computePositionsSpy = jest.spyOn(require('../../src/flow/visualization/utils.js'), 'computePositions');
    
    // First call already happened in constructor
    expect(computePositionsSpy).toHaveBeenCalledTimes(1);
    
    // Generate visualization
    await visualizer.generateVisualization();
    
    // Should not call computePositions again
    expect(computePositionsSpy).toHaveBeenCalledTimes(1);
    
    // Create a new visualizer with same flow
    const newVisualizer = new FlowVisualizer(flow);
    
    // Should use cached positions and not recompute
    expect(computePositionsSpy).toHaveBeenCalledTimes(1);
  });
  
  // Mock error handling test
  test('handles errors gracefully', async () => {
    // Mock a network generation error
    jest.spyOn(global, 'Error').mockImplementation(() => {
      throw new Error('Network generation error');
    });
    
    await expect(visualizer.generateVisualization()).rejects.toThrow();
  });
  
  // Optimized test for template fallback
  test('uses default template when template file not found', async () => {
    // Mock file not found
    jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
    
    // This should use default template
    await visualizer.generateVisualization();
    
    // Check that writeFileSync was called with default template
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('<html'),
      'utf8'
    );
  });
});
