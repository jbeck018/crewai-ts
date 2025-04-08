/**
 * Tests for PlotFlowCommand with performance optimizations.
 */
import { describe, test, expect, beforeEach, afterEach, jest, mock } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { PlotFlowCommand } from '../../../src/cli/commands/PlotFlowCommand.js';
import { Flow } from '../../../src/flow/Flow.js';

// Mock filesystem operations for isolated testing
mock.module('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn()
}));

mock.module('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((p) => p.split('/').slice(0, -1).join('/')),
  basename: jest.fn((p) => p.split('/').pop() || ''),
  extname: jest.fn((p) => '.ts'),
  isAbsolute: jest.fn((p) => p.startsWith('/'))
}));

// Mock Flow Visualizer functionality
const mockPlotFlow = jest.fn().mockResolvedValue('/path/to/visualization.html');
mock.module('../../../src/flow/visualization/FlowVisualizer.js', () => ({
  plotFlow: mockPlotFlow
}));

// Mock dynamic import for testing
const mockFlow = {
  default: class MockFlow extends Flow {
    constructor() {
      super({ initialState: {} });
    }
  }
};

// Create a mock implementation for dynamic import
global.import = jest.fn().mockResolvedValue(mockFlow);

describe('PlotFlowCommand', () => {
  let command: PlotFlowCommand;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleTimeSpy: jest.SpyInstance;
  let consoleTimeEndSpy: jest.SpyInstance;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleTimeSpy = jest.spyOn(console, 'time').mockImplementation();
    consoleTimeEndSpy = jest.spyOn(console, 'timeEnd').mockImplementation();
    
    // Default behavior
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Create command instance with optimization
    command = new PlotFlowCommand();
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleTimeSpy.mockRestore();
    consoleTimeEndSpy.mockRestore();
  });
  
  // Test command name and description
  test('has correct name and description', () => {
    expect(command.name).toBe('plot-flow');
    expect(command.description).toContain('Generate a visual representation');
  });
  
  // Test argument parsing
  test('parses arguments correctly', () => {
    const args = ['MyFlow', '--output', 'custom-viz', '--outDir', './visuals'];
    const parsedArgs = command['parseArgs'](args);
    
    expect(parsedArgs.flowPath).toBe('MyFlow');
    expect(parsedArgs.output).toBe('custom-viz');
    expect(parsedArgs.outDir).toBe('./visuals');
  });
  
  // Test default values
  test('uses default values when arguments are not provided', () => {
    const args = ['MyFlow'];
    const parsedArgs = command['parseArgs'](args);
    
    expect(parsedArgs.flowPath).toBe('MyFlow');
    expect(parsedArgs.output).toBeUndefined();
    expect(parsedArgs.outDir).toBeUndefined();
  });
  
  // Test flow path resolution
  test('resolves flow path correctly', () => {
    const result = command['resolveFlowPath']('MyFlow');
    expect(path.resolve).toHaveBeenCalled();
  });
  
  // Test file not found error
  test('throws error when flow file does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
    
    await command.execute(['NonExistentFlow']);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('not found')
    );
  });
  
  // Test successful visualization creation
  test('generates flow visualization successfully', async () => {
    const customFilename = 'custom-visualization';
    await command.execute(['MyFlow', '--output', customFilename]);
    
    // Check that dynamic import was called
    expect(global.import).toHaveBeenCalled();
    
    // Check that plotFlow was called with correct args
    expect(mockPlotFlow).toHaveBeenCalledWith(
      expect.any(Object),
      customFilename,
      expect.any(String)
    );
    
    // Check success message
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully generated')
    );
  });
  
  // Test visualization output directory
  test('creates output directory if it does not exist', async () => {
    const outDir = './custom/viz/dir';
    (fs.existsSync as jest.Mock).mockReturnValueOnce(true) // Flow file exists
      .mockReturnValueOnce(false); // Output dir doesn't exist
    
    await command.execute(['MyFlow', '--outDir', outDir]);
    
    // Directory should be created
    expect(fs.mkdirSync).toHaveBeenCalledWith(outDir, { recursive: true });
  });
  
  // Test error handling during generation
  test('handles visualization generation errors', async () => {
    // Mock plotFlow to throw error
    mockPlotFlow.mockRejectedValueOnce(new Error('Visualization error'));
    
    await command.execute(['ErrorFlow']);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to generate')
    );
  });
  
  // Test performance monitoring
  test('measures and reports generation time', async () => {
    await command.execute(['MyFlow']);
    
    // Check that timer was started and stopped
    expect(consoleTimeSpy).toHaveBeenCalledWith('Flow visualization');
    expect(consoleTimeEndSpy).toHaveBeenCalledWith('Flow visualization');
  });
  
  // Test caching behavior
  test('uses visualization cache for performance when available', async () => {
    // Setup a mock implementation that tracks cache access
    let cacheHit = false;
    const originalResolveFlowPath = command['resolveFlowPath'];
    command['resolveFlowPath'] = jest.fn(originalResolveFlowPath);
    command['getCachedVisualization'] = jest.fn(() => {
      cacheHit = true;
      return '/path/to/cached/viz.html';
    });
    
    // Mock that cache exists
    command['hasCachedVisualization'] = jest.fn().mockReturnValue(true);
    
    await command.execute(['MyFlow', '--useCache']);
    
    // Should use cache and not generate new visualization
    expect(cacheHit).toBe(true);
    expect(mockPlotFlow).not.toHaveBeenCalled();
    
    // Check success message references cache
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Using cached')
    );
  });
  
  // Test force refresh option
  test('ignores cache when forceRefresh is true', async () => {
    // Setup mock cache
    command['hasCachedVisualization'] = jest.fn().mockReturnValue(true);
    
    await command.execute(['MyFlow', '--forceRefresh']);
    
    // Should generate new visualization despite cache availability
    expect(mockPlotFlow).toHaveBeenCalled();
  });
  
  // Test memory optimization
  test('optimizes memory usage during visualization', async () => {
    // Create a memory usage spy
    const memoryUsageSpy = jest.spyOn(process, 'memoryUsage');
    
    await command.execute(['MyFlow']);
    
    // Should use WeakMap or other memory-efficient structures
    expect(memoryUsageSpy).toHaveBeenCalled();
    
    memoryUsageSpy.mockRestore();
  });
  
  // Test optimized imports
  test('uses dynamic imports for better performance', async () => {
    const dynamicImportSpy = jest.spyOn(global, 'import');
    
    await command.execute(['MyFlow']);
    
    // Should use dynamic import
    expect(dynamicImportSpy).toHaveBeenCalled();
    
    dynamicImportSpy.mockRestore();
  });
});
