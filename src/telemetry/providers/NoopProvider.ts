/**
 * No-operation Telemetry Provider
 * Zero overhead implementation for when telemetry is disabled
 */

import { TelemetryEventData, TelemetryProvider } from '../types.js';

/**
 * NoopProvider is a zero-overhead implementation of the TelemetryProvider interface
 * It's used when telemetry is disabled but the API surface needs to remain consistent
 * Optimized for absolute minimal memory footprint and CPU usage
 */
export class NoopProvider implements TelemetryProvider {
  public readonly name = 'noop';
  
  /**
   * Initialize provider - does nothing
   */
  public async initialize(): Promise<void> {
    // No-op implementation returns resolved promise with no allocation
    return Promise.resolve();
  }
  
  /**
   * Submit events - does nothing but return success
   */
  public async submitEvents(_events: TelemetryEventData[]): Promise<boolean> {
    // Always returns true immediately with no processing
    return true;
  }
  
  /**
   * Shutdown provider - does nothing
   */
  public async shutdown(): Promise<void> {
    // No-op implementation returns resolved promise with no allocation
    return Promise.resolve();
  }
}
