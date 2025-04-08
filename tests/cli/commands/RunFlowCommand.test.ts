import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
/**
 * Tests for RunFlowCommand with performance optimizations.
 */
import { describe, test, expect, beforeEach, afterEach, jest, mock } from '../../../tests/vitest-utils.js';
import fs from 'fs';
import path from 'path';
import { RunFlowCommand } from '../../../src/cli/commands/RunFlowCommand.js';
import { Flow } from '../../../src/flow/Flow.js';

// Mock filesystem operations for isolated testing
mock.module('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn()
}));

mock.module('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  resolve: vi.fn((...args) => args.join('/')),
  dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
  extname: vi.fn((p) => '.ts'),
  isAbsolute: vi.fn((p) => p.startsWith('/'))
}));

// Mock dynamic import for testing
const mockFlow = {
  default: class MockFlow extends Flow {
    constructor() {
      super({ initialState: {} });
    }
    
    execute = vi.fn().mockResolvedValue({ result: 'success' })
  }
};

// Create a mock implementation for dynamic import
global.import = vi.fn().mockResolvedValue(mockFlow);

describe('RunFlowCommand', () => {
  let command: RunFlowCommand;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleTimeSpy: jest.SpyInstance;
  let consoleTimeEndSpy: jest.SpyInstance;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
    consoleTimeSpy = vi.spyOn(console, 'time').mockImplementation();
    consoleTimeEndSpy = vi.spyOn(console, 'timeEnd').mockImplementation();
    
    // Default behavior
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Create command instance
    command = new RunFlowCommand();
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleTimeSpy.mockRestore();
    consoleTimeEndSpy.mockRestore();
  });
  
  // Test command name and description
  test('has correct name and description', () => {
    expect(command.name).toBe('run-flow');
    expect(command.description).toContain('Execute a Flow');
  });
  
  // Test argument parsing
  test('parses arguments correctly', () => {
    const args = ['MyFlow', '--input', '{"test":true}'];
    const parsedArgs = command['parseArgs'](args);
    
    expect(parsedArgs.flowPath).toBe('MyFlow');
    expect(parsedArgs.input).toEqual({ test: true });
  });
  
  // Test default values
  test('uses default values when arguments are not provided', () => {
    const args = ['MyFlow'];
    const parsedArgs = command['parseArgs'](args);
    
    expect(parsedArgs.flowPath).toBe('MyFlow');
    expect(parsedArgs.input).toEqual({});
  });
  
  // Test flow path resolution
  test('resolves flow path correctly', () => {
    const result = command['resolveFlowPath']('MyFlow');
    expect(path.resolve).toHaveBeenCalled();
  });
  
  // Test with absolute path
  test('handles absolute flow paths', () => {
    const absolutePath = '/abs/path/to/MyFlow.flow.ts';
    (path.isAbsolute as jest.Mock).mockReturnValueOnce(true);
    
    const result = command['resolveFlowPath'](absolutePath);
    expect(result).toBe(absolutePath);
  });
  
  // Test file not found error
  test('throws error when flow file does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
    
    await command.execute(['NonExistentFlow']);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('not found')
    );
  });
  
  // Test successful flow execution
  test('executes flow successfully', async () => {
    await command.execute(['MyFlow']);
    
    // Check that dynamic import was called
    expect(global.import).toHaveBeenCalled();
    
    // Check that flow execute was called
    const flowInstance = await (global.import as jest.Mock).mock.results[0].value.default.prototype.execute;
    expect(flowInstance).toHaveBeenCalled();
    
    // Check for success output
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Result:')
    );
  });
  
  // Test input data parsing
  test('parses JSON input correctly', async () => {
    const inputData = { key: 'value', nested: { data: true } };
    await command.execute(['MyFlow', '--input', JSON.stringify(inputData)]);
    
    // Get the mock flow instance that was created
    const MockFlowClass = (await (global.import as jest.Mock).mock.results[0].value).default;
    const mockExecute = MockFlowClass.prototype.execute;
    
    // Check that execute was called with the correct input
    expect(mockExecute).toHaveBeenCalledWith(inputData);
  });
  
  // Test error handling during execution
  test('handles flow execution errors', async () => {
    // Mock flow execution to throw an error
    const mockFlowWithError = {
      default: class ErrorFlow extends Flow {
        constructor() {
          super({ initialState: {} });
        }
        
        execute = vi.fn().mockRejectedValue(new Error('Flow execution error'))
      }
    };
    
    (global.import as jest.Mock).mockResolvedValueOnce(mockFlowWithError);
    
    await command.execute(['ErrorFlow']);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error executing flow')
    );
  });
  
  // Test performance monitoring
  test('measures and reports execution time', async () => {
    await command.execute(['MyFlow']);
    
    // Check that timer was started and stopped
    expect(consoleTimeSpy).toHaveBeenCalledWith('Flow execution');
    expect(consoleTimeEndSpy).toHaveBeenCalledWith('Flow execution');
  });
  
  // Test debug mode
  test('enables debug output when DEBUG_FLOW is set', async () => {
    // Save original environment
    const originalEnv = process.env.DEBUG_FLOW;
    
    try {
      // Set debug environment variable
      process.env.DEBUG_FLOW = 'true';
      
      await command.execute(['MyFlow']);
      
      // Should log more detailed information
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Debug:')
      );
    } finally {
      // Restore original environment
      process.env.DEBUG_FLOW = originalEnv;
    }
  });
});
