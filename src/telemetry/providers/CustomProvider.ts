/**
 * Custom Telemetry Provider
 * Allows users to easily plug in their own telemetry implementation
 * Memory-optimized with minimal overhead
 */

import { TelemetryEventData, TelemetryProvider } from '../types.js';

/**
 * Custom provider handler types
 */
type InitHandler = () => Promise<void> | void;
type SubmitHandler = (events: TelemetryEventData[]) => Promise<boolean> | boolean;
type ShutdownHandler = () => Promise<void> | void;

/**
 * Custom provider options
 */
export interface CustomProviderOptions {
  /** Provider name (must be unique) */
  name: string;
  /** Initialize handler */
  onInitialize?: InitHandler;
  /** Submit events handler */
  onSubmitEvents: SubmitHandler;
  /** Shutdown handler */
  onShutdown?: ShutdownHandler;
}

/**
 * CustomProvider allows integration with external telemetry systems
 * Optimized for minimal overhead when interfacing with external systems
 */
export class CustomProvider implements TelemetryProvider {
  public readonly name: string;
  private initHandler?: InitHandler;
  private submitHandler: SubmitHandler;
  private shutdownHandler?: ShutdownHandler;
  
  /**
   * Create new custom provider
   * 
   * @param options Provider options
   */
  constructor(options: CustomProviderOptions) {
    if (!options.name) {
      throw new Error('Custom provider requires a name');
    }
    
    if (!options.onSubmitEvents) {
      throw new Error('Custom provider requires an onSubmitEvents handler');
    }
    
    this.name = options.name;
    this.initHandler = options.onInitialize;
    this.submitHandler = options.onSubmitEvents;
    this.shutdownHandler = options.onShutdown;
  }
  
  /**
   * Initialize provider
   */
  public async initialize(): Promise<void> {
    try {
      if (this.initHandler) {
        // Handle both sync and async handlers
        const result = this.initHandler();
        if (result instanceof Promise) {
          await result;
        }
      }
    } catch (error) {
      console.warn(`[Telemetry] Error initializing custom provider '${this.name}':`, error);
    }
  }
  
  /**
   * Submit events using custom handler
   * Provides memory-efficient error isolation
   * 
   * @param events Events to submit
   * @returns Success status
   */
  public async submitEvents(events: TelemetryEventData[]): Promise<boolean> {
    if (events.length === 0) {
      return true;
    }
    
    try {
      // Create a shallow copy of events to prevent modification
      // This is more memory-efficient than a deep copy
      const eventsCopy = [...events];
      
      // Handle both sync and async handlers
      const result = this.submitHandler(eventsCopy);
      if (result instanceof Promise) {
        return await result;
      }
      return result;
    } catch (error) {
      console.warn(`[Telemetry] Error submitting events to custom provider '${this.name}':`, error);
      return false;
    }
  }
  
  /**
   * Shutdown provider
   */
  public async shutdown(): Promise<void> {
    try {
      if (this.shutdownHandler) {
        // Handle both sync and async handlers
        const result = this.shutdownHandler();
        if (result instanceof Promise) {
          await result;
        }
      }
    } catch (error) {
      console.warn(`[Telemetry] Error shutting down custom provider '${this.name}':`, error);
    }
  }
}
