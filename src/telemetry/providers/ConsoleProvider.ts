/**
 * Console Telemetry Provider
 * Outputs telemetry events to console for debugging
 * Memory-optimized with configurable verbosity
 */

import { TelemetryEventData, TelemetryProvider } from '../types.js';

/**
 * Console provider options
 */
export interface ConsoleProviderOptions {
  /** Verbosity level (0-3) */
  verbosity?: number;
  /** Whether to use colors in output */
  useColors?: boolean;
  /** Maximum array items to display */
  maxArrayItems?: number;
  /** Maximum object depth to display */
  maxObjectDepth?: number;
  /** String length limit to prevent massive logs */
  stringLengthLimit?: number;
}

/**
 * Console telemetry provider
 * Logs events to console with memory-efficient formatting
 */
export class ConsoleProvider implements TelemetryProvider {
  public readonly name = 'console';
  private options: Required<ConsoleProviderOptions>;
  
  /**
   * Create new console provider
   * 
   * @param options Provider options
   */
  constructor(options: ConsoleProviderOptions = {}) {
    this.options = {
      verbosity: options.verbosity ?? 1,
      useColors: options.useColors ?? true,
      maxArrayItems: options.maxArrayItems ?? 5,
      maxObjectDepth: options.maxObjectDepth ?? 2,
      stringLengthLimit: options.stringLengthLimit ?? 200
    };
  }
  
  /**
   * Initialize provider
   */
  public async initialize(): Promise<void> {
    // Nothing to initialize
    return Promise.resolve();
  }
  
  /**
   * Submit events to console
   * 
   * @param events Events to submit
   * @returns Success status
   */
  public async submitEvents(events: TelemetryEventData[]): Promise<boolean> {
    if (this.options.verbosity === 0 || events.length === 0) {
      return true;
    }
    
    try {
      // Log events based on verbosity
      switch (this.options.verbosity) {
        case 1: // Basic info only
          console.log(`[Telemetry] Processing ${events.length} events`);
          break;
        
        case 2: // Summary info
          this.logSummary(events);
          break;
        
        case 3: // Full detail
          this.logDetailedEvents(events);
          break;
      }
      
      return true;
    } catch (error) {
      console.error('[Telemetry] Error logging events:', error);
      return false;
    }
  }
  
  /**
   * Shutdown provider
   */
  public async shutdown(): Promise<void> {
    // Nothing to shutdown
    return Promise.resolve();
  }
  
  /**
   * Log summary of events
   * 
   * @param events Events to summarize
   */
  private logSummary(events: TelemetryEventData[]): void {
    // Group events by type
    const eventsByType = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});
    
    // Log summary
    console.log(`[Telemetry] Processing ${events.length} events:`);
    
    Object.entries(eventsByType).forEach(([type, count]) => {
      const colorize = this.options.useColors
        ? (str: string) => `\x1b[36m${str}\x1b[0m`
        : (str: string) => str;
      
      console.log(`  ${colorize(type)}: ${count} events`);
    });
  }
  
  /**
   * Log detailed event information
   * Memory-efficient implementation that limits output size
   * 
   * @param events Events to log
   */
  private logDetailedEvents(events: TelemetryEventData[]): void {
    console.log(`[Telemetry] Processing ${events.length} events:`);
    
    events.forEach((event, index) => {
      const colorize = this.options.useColors
        ? (str: string) => `\x1b[36m${str}\x1b[0m`
        : (str: string) => str;
      
      console.log(`Event ${index + 1}/${events.length} - ${colorize(event.type)}:`);
      console.log(this.formatObject(event, 1));
    });
  }
  
  /**
   * Format object for console output with memory efficiency
   * Limits depth, array items, and string length to prevent memory issues
   * 
   * @param obj Object to format
   * @param depth Current depth
   * @param indent Indentation level
   * @returns Formatted string
   */
  private formatObject(obj: any, depth = 0, indent = '  '): string {
    if (obj === null || obj === undefined) {
      return String(obj);
    }
    
    // Limit recursion depth
    if (depth > this.options.maxObjectDepth) {
      return '[Object]';
    }
    
    if (Array.isArray(obj)) {
      // Handle arrays with length limits
      const items = obj.slice(0, this.options.maxArrayItems);
      const formatted = items.map(item => this.formatObject(item, depth + 1, indent + '  '));
      
      if (obj.length > this.options.maxArrayItems) {
        formatted.push(`... (${obj.length - this.options.maxArrayItems} more items)`);
      }
      
      return `[\n${indent}  ${formatted.join(`,\n${indent}  `)}\n${indent}]`;
    }
    
    if (typeof obj === 'object') {
      // Handle objects
      const entries = Object.entries(obj);
      const formatted = entries.map(([key, value]) => {
        return `${key}: ${this.formatObject(value, depth + 1, indent + '  ')}`;
      });
      
      return `{\n${indent}  ${formatted.join(`,\n${indent}  `)}\n${indent}}`;
    }
    
    if (typeof obj === 'string') {
      // Truncate long strings
      if (obj.length > this.options.stringLengthLimit) {
        return `"${obj.substring(0, this.options.stringLengthLimit)}..." (truncated)`;
      }
      return `"${obj}"`;
    }
    
    // Return primitives as-is
    return String(obj);
  }
}
