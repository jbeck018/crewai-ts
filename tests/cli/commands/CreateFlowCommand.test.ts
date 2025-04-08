import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
/**
 * Tests for CreateFlowCommand with performance optimizations.
 */
import { describe, test, expect, beforeEach, afterEach, jest, mock } from '../../../tests/vitest-utils.js';
import fs from 'fs';
import path from 'path';
import { CreateFlowCommand } from '../../../src/cli/commands/CreateFlowCommand.js';

// Mock fs and path modules for isolated testing
mock.module('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => 'Template content with {{FLOW_NAME}} and {{FLOW_DESCRIPTION}}')
}));

mock.module('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
  resolve: vi.fn((...args) => args.join('/')),
  extname: vi.fn((p) => '.ts')
}));

describe('CreateFlowCommand', () => {
  let command: CreateFlowCommand;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  
  // Set up testing environment
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
    
    // Default behavior for fs methods
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    // Create command instance
    command = new CreateFlowCommand();
  });
  
  // Clean up after tests
  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
  
  // Test command name and description
  test('has correct name and description', () => {
    expect(command.name).toBe('create-flow');
    expect(command.description).toContain('Create a new Flow');
  });
  
  // Test argument parsing
  test('parses arguments correctly', () => {
    const args = ['MyTestFlow', '--description', 'Test flow description'];
    const parsedArgs = command['parseArgs'](args);
    
    expect(parsedArgs.name).toBe('MyTestFlow');
    expect(parsedArgs.description).toBe('Test flow description');
  });
  
  // Test default directory
  test('uses default directory when not specified', () => {
    const args = ['MyFlow'];
    const parsedArgs = command['parseArgs'](args);
    
    expect(parsedArgs.directory).toBe('./src/flows');
  });
  
  // Test name formatting
  test('formats flow name correctly', () => {
    expect(command['formatFlowName']('my-test-flow')).toBe('MyTestFlow');
    expect(command['formatFlowName']('my_test_flow')).toBe('MyTestFlow');
    expect(command['formatFlowName']('my test flow')).toBe('MyTestFlow');
    expect(command['formatFlowName']('MyTestFlow')).toBe('MyTestFlow');
  });
  
  // Test flow file path generation
  test('generates correct flow file path', () => {
    const args = ['TestFlow', '--directory', './custom/flows'];
    const parsedArgs = command['parseArgs'](args);
    
    command['generateFlowFilePath'](parsedArgs);
    
    expect(path.join).toHaveBeenCalledWith('./custom/flows', 'TestFlow.flow.ts');
  });
  
  // Test file already exists error
  test('throws error when flow file already exists', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    const args = ['ExistingFlow'];
    
    await command.execute(args);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('already exists')
    );
  });
  
  // Test successful flow creation
  test('creates flow file successfully', async () => {
    const args = ['NewFlow', '--description', 'A new test flow'];
    
    await command.execute(args);
    
    // Check if directory was created
    expect(fs.mkdirSync).toHaveBeenCalledWith('./src/flows', { recursive: true });
    
    // Check if file was written
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('NewFlow'),
      'utf8'
    );
    
    // Check for success message
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Created flow')
    );
  });
  
  // Test template replacement
  test('replaces template placeholders correctly', async () => {
    const args = ['PlaceholderFlow', '--description', 'Testing placeholders'];
    
    await command.execute(args);
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('PlaceholderFlow'),
      'utf8'
    );
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Testing placeholders'),
      'utf8'
    );
  });
  
  // Test template loading performance
  test('loads template efficiently using caching', async () => {
    const readFileSpy = vi.spyOn(fs, 'readFileSync');
    
    // First execution
    await command.execute(['CachedFlow1']);
    expect(readFileSpy).toHaveBeenCalledTimes(1);
    
    // Second execution should use cached template
    await command.execute(['CachedFlow2']);
    expect(readFileSpy).toHaveBeenCalledTimes(1); // Still 1 if using caching
  });
});
