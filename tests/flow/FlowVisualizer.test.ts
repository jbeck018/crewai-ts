/**
 * Tests for the FlowVisualizer component with performance optimizations.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from '../vitest-utils.js';

// Import actual modules for proper test execution
import { Flow } from '../../src/flow/Flow.js';
import { FlowVisualizer, plotFlow } from '../../src/flow/visualization/FlowVisualizer.js';
import { start, listen, and_, router } from '../../src/flow/decorators.js';

// Define vis-network mock before mocking to avoid reference errors
const mockVisNetwork = {
  Network: class MockNetwork {
    // Use more efficient function mocks with specific return values
    add = vi.fn().mockReturnValue(undefined);
    setOptions = vi.fn().mockReturnValue(undefined);
    on = vi.fn().mockImplementation((event, callback) => {
      // Immediately trigger the callback for faster tests
      if (event === 'stabilized') {
        setTimeout(() => callback(), 0);
      }
      return undefined;
    });
    fit = vi.fn().mockReturnValue(undefined);
    stabilize = vi.fn().mockReturnValue(undefined);
    getPositions = vi.fn().mockReturnValue({
      'begin': { x: 0, y: 0 },
      'processA': { x: 100, y: 0 },
      'processB': { x: 0, y: 100 },
      'complete': { x: 100, y: 100 }
    });
    
    constructor() {}
  }
};

// Performance-optimized cross-framework compatibility approach
// Create a global mock that can be accessed by the module under test
// This works with Bun, Jest, and Vitest without requiring framework-specific APIs
global.vis = mockVisNetwork;

// Modify the component to use the global mock instead of importing
// This is done by monkey-patching the module system in FlowVisualizer.js
// FlowVisualizer will import 'vis-network' which is now available as global.vis

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
            appendChild: vi.fn(),
            innerHTML: ''
          })
        }
      };
    }
  }
};

// Mock classes are defined above

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
    vi.clearAllMocks();
    
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
  
  // Optimized test for caching behavior with better performance monitoring
  test('visualizer uses cached position calculations for performance', async () => {
    // Create a spy on the internal method that would use computePositions
    // This avoids the need to import utils with require which is slower
    const precomputePositionsSpy = vi.spyOn(visualizer as any, 'precomputePositions');
    
    // Generate visualization - should use cached positions
    await visualizer.generateVisualization();
    
    // Should not call precomputePositions again
    expect(precomputePositionsSpy).not.toHaveBeenCalled();
    
    // Create a new visualizer with same flow but clear the spy first
    precomputePositionsSpy.mockClear();
    const newVisualizer = new FlowVisualizer(flow);
    
    // Now verify the call count on the new instance
    // It should be exactly 1 for the initialization
    expect(precomputePositionsSpy).toHaveBeenCalledTimes(1);
  });
  
  // Mock error handling test
  test('handles errors gracefully', async () => {
    // Mock a network generation error
    vi.spyOn(global, 'Error').mockImplementation(() => {
      throw new Error('Network generation error');
    });
    
    await expect(visualizer.generateVisualization()).rejects.toThrow();
  });
  
  // Optimized test for template fallback
  test('uses default template when template file not found', async () => {
    // Mock file not found
    vi.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
    
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
