/**
 * Tests for the Telemetry System
 * Verifies functionality and memory optimization characteristics
 */

import { expect, test, describe, beforeEach, afterEach, vi } from 'vitest';
import { Telemetry } from '../../src/telemetry/Telemetry.js';
import { TelemetryEventType } from '../../src/telemetry/types.js';
import { ConsoleProvider } from '../../src/telemetry/providers/ConsoleProvider.js';
import { NoopProvider } from '../../src/telemetry/providers/NoopProvider.js';
import { CustomProvider } from '../../src/telemetry/providers/CustomProvider.js';

describe('Telemetry System', () => {
  let telemetry: Telemetry;
  let originalConsoleLog: typeof console.log;
  
  // Type-safe mock helper for better type checking
  const createTypedMock = <T extends (...args: any[]) => any>() => vi.fn<Parameters<T>, ReturnType<T>>();
  
  // Setup global test environment
  beforeEach(async () => {
    // Save original console methods
    originalConsoleLog = console.log;
    
    // Mock console methods to prevent noise during tests
    console.log = vi.fn(() => {});
    
    // Create a fresh telemetry instance for each test
    telemetry = Telemetry.getInstance({ 
      enabled: true,
      bufferSize: 5,
      flushIntervalMs: 0, // Disable auto-flush for testing
      samplingRate: 1
    });
    
    // Reset the singleton between tests
    (Telemetry as any).instance = undefined;
    
    await telemetry.initialize();
  });
  
  afterEach(async () => {
    // Restore original console methods
    console.log = originalConsoleLog;
    
    // Shut down telemetry
    await telemetry.shutdown(false);
  });
  
  test('creates singleton instance', () => {
    // Get two instances and verify they're the same
    const instance1 = Telemetry.getInstance();
    const instance2 = Telemetry.getInstance();
    
    expect(instance1).toBe(instance2);
  });
  
  test('tracks events with minimal overhead', async () => {
    // Track several events in quick succession to test memory efficiency
    const startTime = performance.now();
    
    for (let i = 0; i < 100; i++) {
      telemetry.track(TelemetryEventType.INFO, {
        // Add custom context instead of directly on the event data
        context: {
          message: `Test event ${i}`,
          value: i
        }
      });
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Verify performance characteristics
    // Should process 100 events in under 10ms for efficiency
    expect(duration).toBeLessThan(10);
    
    // The telemetry system adds an initialization event, so we expect 101 instead of 100
    expect(telemetry.getEventCount()).toBe(101);
  });
  
  test('registers and utilizes providers', async () => {
    // Create a test provider with proper typing
    const mockSubmit = vi.fn().mockImplementation(() => Promise.resolve(true));
    const testProvider = new CustomProvider({
      name: 'test-provider',
      onSubmitEvents: mockSubmit
    });
    
    // Register the provider
    telemetry.registerProvider(testProvider);
    
    // Track an event
    telemetry.track(TelemetryEventType.INFO, { context: { message: 'Test event' } });
    
    // Flush events to providers
    await telemetry.flush();
    
    // Verify provider was called with memory-efficient checking pattern
    // Similar to knowledge embedder tests that properly handle mock data
    expect(mockSubmit).toHaveBeenCalled();
    
    const mockCalls = mockSubmit.mock.calls;
    expect(mockCalls.length).toBe(1);
    
    // Use type-safe access pattern with early returns to avoid deep nesting
    if (!mockCalls[0]) {
      expect.fail('Expected mock to be called but call data was missing');
      return;
    }
    
    const firstCallArgs = mockCalls[0];
    if (!Array.isArray(firstCallArgs[0])) {
      expect.fail('Expected first argument to be an array');
      return;
    }
    
    // We expect 2 events because the initialization event is also included
    expect(firstCallArgs[0].length).toBe(2);
  });
  
  test('properly disables telemetry', async () => {
    // Create a test provider with proper typing
    const mockSubmit = vi.fn().mockImplementation(() => Promise.resolve(true));
    const testProvider = new CustomProvider({
      name: 'test-provider',
      onSubmitEvents: mockSubmit
    });
    
    // Register the provider
    telemetry.registerProvider(testProvider);
    
    // Disable telemetry
    telemetry.disable();
    
    // Track an event (should be ignored)
    telemetry.track(TelemetryEventType.INFO, { context: { message: 'Test event' } });
    
    // Verify no events were buffered
    expect(telemetry.getBufferSize()).toBe(0);
    
    // Flush should not call providers
    await telemetry.flush();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
  
  test('handles provider failures gracefully', async () => {
    // Create a provider that always fails
    const failingProvider = new CustomProvider({
      name: 'failing-provider',
      onSubmitEvents: () => Promise.resolve(false)
    });
    
    // Create a provider that succeeds
    const successProvider = new CustomProvider({
      name: 'success-provider',
      onSubmitEvents: vi.fn().mockImplementation(() => Promise.resolve(true))
    });
    
    // Register both providers
    telemetry.registerProvider(failingProvider);
    telemetry.registerProvider(successProvider);
    
    // Track an event
    telemetry.track(TelemetryEventType.INFO, { context: { message: 'Test event' } });
    
    // Flush should complete without errors
    await telemetry.flush();
    
    // Telemetry should continue to function
    expect(telemetry.isEnabled()).toBe(true);
  });
  
  test('respects sampling rate for memory efficiency', async () => {
    // Create a test provider with proper typing
    const mockSubmit = vi.fn().mockImplementation(() => Promise.resolve(true));
    const testProvider = new CustomProvider({
      name: 'test-provider',
      onSubmitEvents: mockSubmit
    });
    
    // Create new telemetry with low sampling rate
    telemetry = Telemetry.getInstance({ 
      samplingRate: 0.01, // 1% sampling rate
      bufferSize: 10,
      flushIntervalMs: 0
    });
    await telemetry.initialize();
    telemetry.registerProvider(testProvider);
    
    // Track many events
    for (let i = 0; i < 1000; i++) {
      telemetry.track(TelemetryEventType.INFO, { context: { value: i } });
    }
    
    // Flush events
    await telemetry.flush();
    
    // With 1% sampling, we expect roughly 10 events, but it's random
    // We'll check that it's significantly less than 1000 (which would be 100% sampling)
    // This verifies the memory efficiency through sampling
    // Type-safe check for calls and events
    const calls = mockSubmit.mock.calls;
    if (calls.length > 0) {
      let totalEvents = 0;
      
      // Safely accumulate event counts
      for (const call of calls) {
        if (call && Array.isArray(call[0])) {
          totalEvents += call[0].length;
        }
      }
      
      expect(totalEvents).toBeLessThan(100); // Should be roughly 10, but allowing variance
    }
  });
});

describe('Telemetry Providers', () => {
  test('ConsoleProvider formats output efficiently', async () => {
    // Test with nested objects and arrays to verify formatting limits
    const mockLog = vi.fn().mockImplementation(() => {});
    console.log = mockLog;
    
    const provider = new ConsoleProvider({ verbosity: 3 });
    await provider.initialize();
    
    // Create test event with deeply nested data to test memory optimizations
    const events = [{
      id: '1234',
      timestamp: Date.now(),
      type: TelemetryEventType.INFO,
      context: {
        nestedArray: Array(100).fill('test'), // Large array
        nestedObject: {
          level1: {
            level2: {
              level3: {
                level4: 'deeply nested' // Deep nesting
              }
            }
          }
        },
        longString: 'a'.repeat(1000) // Long string
      }
    }];
    
    await provider.submitEvents(events);
    
    // Verify console was called with formatted output
    expect(mockLog).toHaveBeenCalled();
    
    // And that we properly limited the output (memory efficiency)
    // Use type-safe access patterns similar to our knowledge system embedders
    const calls = mockLog.mock.calls || [];
    const outputs: string[] = [];
    
    // Process calls safely with memory-efficient iteration
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      if (call && call.length > 0 && call[0] !== undefined) {
        outputs.push(String(call[0]));
      }
    }
    
    const output = outputs.join('\n');
    
    // Should truncate the array
    expect(output.includes('more items')).toBe(true);
    
    // Should truncate deep nesting
    expect(output.includes('[Object]')).toBe(true);
    
    // Should truncate long strings
    expect(output.includes('truncated')).toBe(true);
  });
  
  test('NoopProvider has zero overhead', async () => {
    const provider = new NoopProvider();
    
    // Measure performance
    const startTime = performance.now();
    
    // Call operations many times
    await provider.initialize();
    for (let i = 0; i < 10000; i++) {
      await provider.submitEvents([{ 
        id: '1234',
        timestamp: Date.now(),
        type: TelemetryEventType.INFO
      }]);
    }
    await provider.shutdown();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // 10,000 operations should complete in under 10ms if truly zero overhead
    expect(duration).toBeLessThan(10);
  });
  
  test('CustomProvider easily integrates user functions', async () => {
    // Test scenario: user wants to send telemetry to their own analytics system
    const events: any[] = [];
    
    // User-defined handler functions with proper typing for memory efficiency
    // Similar to our knowledge system embedders with explicit type parameters
    const userDefinedHandler = (telemetryEvents: any[]): boolean => {
      // Memory-efficient implementation with bounds checking
      if (Array.isArray(telemetryEvents) && telemetryEvents.length > 0) {
        // Iterate instead of spread for more controlled memory usage
        for (let i = 0; i < telemetryEvents.length; i++) {
          events.push(telemetryEvents[i]);
        }
      }
      return true;
    };
    
    // Create provider with user's function
    const provider = new CustomProvider({
      name: 'user-analytics',
      onSubmitEvents: userDefinedHandler
    });
    
    // Send some events
    await provider.submitEvents([{
      id: '1234',
      timestamp: Date.now(),
      type: TelemetryEventType.INFO,
      context: {
        message: 'Custom user event'
      }
    }]);
    
    // Verify user's system received the events
    expect(events.length).toBe(1);
    // Access context property safely for the message
    if (events[0] && events[0].context) {
      expect(events[0].context.message).toBe('Custom user event');
    }
  });
});

describe('Integration examples', () => {
  test('Simple application usage example', async () => {
    // This demonstrates how end users would integrate telemetry
    
    // 1. Get the telemetry instance
    const telemetry = Telemetry.getInstance({
      // Users can easily configure to their needs
      enabled: true,
      bufferSize: 50,
      flushIntervalMs: 30000
    });
    
    // 2. Add a custom provider that ties into their existing systems
    const events: any[] = [];
    telemetry.registerProvider(new CustomProvider({
      name: 'app-analytics',
      onSubmitEvents: (telemetryEvents: any[]): boolean => {
        // Send to their analytics system with memory-efficient processing
        // Similar to knowledge embedders with batch processing
        if (Array.isArray(telemetryEvents)) {
          for (const event of telemetryEvents) {
            if (event) events.push(event);
          }
        }
        return true;
      }
    }));
    
    // 3. Initialize
    await telemetry.initialize();
    
    // 4. Track events in their application
    telemetry.track(TelemetryEventType.INFO, {
      context: {
        component: 'user-service',
        action: 'login',
        userId: '12345'
      }
    });
    
    telemetry.trackCrew(TelemetryEventType.CREW_CREATED, 'crew-1', {
      agentCount: 3,
      taskCount: 5
    });
    
    // 5. Flush events (or wait for auto-flush)
    await telemetry.flush();
    
    // Verify events were received
    expect(events.length).toBe(2);
    if (events[0]) expect(events[0].type).toBe(TelemetryEventType.INFO);
    if (events[1]) expect(events[1].type).toBe(TelemetryEventType.CREW_CREATED);
  });
});
