/**
 * TelemetryEvent class
 * Represents a single telemetry event with memory-efficient storage
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TelemetryEventType,
  TelemetryEventData,
  ErrorEventData,
  CrewEventData,
  AgentEventData,
  TaskEventData,
  ToolEventData,
  LlmEventData,
  FlowEventData,
  TestEventData,
  MemoryEventData,
  DeploymentEventData
} from './types.js';

/**
 * TelemetryEvent class for creating and managing telemetry events
 * Optimized for memory efficiency through shared data structures and weak references
 */
export class TelemetryEvent {
  private static eventCache = new WeakMap<object, TelemetryEventData>();
  private static contextMap = new WeakMap<object, Record<string, any>>();
  
  /**
   * Create a new telemetry event
   * 
   * @param type Event type
   * @param data Event specific data
   * @param context Additional context
   * @returns A new telemetry event
   */
  static create<T extends TelemetryEventData>(type: TelemetryEventType, data: Partial<T> = {}, context?: Record<string, any>): T {
    // Create base event with minimal allocation
    const event = {
      id: data.id || uuidv4(),
      timestamp: data.timestamp || Date.now(),
      type,
      ...data
    } as T;
    
    // Store context separately if provided to reduce main object size
    if (context && Object.keys(context).length > 0) {
      this.contextMap.set(event, { ...context });
    }
    
    // Cache the event data for future reference
    this.eventCache.set(event, event);
    
    return event;
  }
  
  /**
   * Create an error event
   * 
   * @param error Error object
   * @param source Error source
   * @param context Additional context
   * @returns Error event data
   */
  static createErrorEvent(error: Error, source?: string, context?: Record<string, any>): ErrorEventData {
    return this.create<ErrorEventData>(
      TelemetryEventType.ERROR,
      {
        message: error.message,
        // Only include sanitized stack trace (no sensitive info)
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        source
      },
      context
    );
  }
  
  /**
   * Create a crew event
   * 
   * @param type Event type
   * @param crewId Crew ID
   * @param data Additional crew data
   * @param context Additional context
   * @returns Crew event data
   */
  static createCrewEvent(type: TelemetryEventType, crewId: string, data?: Partial<CrewEventData>, context?: Record<string, any>): CrewEventData {
    return this.create<CrewEventData>(
      type,
      {
        crewId,
        ...data
      },
      context
    );
  }
  
  /**
   * Create an agent event
   * 
   * @param type Event type
   * @param agentId Agent ID
   * @param data Additional agent data
   * @param context Additional context
   * @returns Agent event data
   */
  static createAgentEvent(type: TelemetryEventType, agentId: string, data?: Partial<AgentEventData>, context?: Record<string, any>): AgentEventData {
    return this.create<AgentEventData>(
      type,
      {
        agentId,
        ...data
      },
      context
    );
  }
  
  /**
   * Create a task event
   * 
   * @param type Event type
   * @param taskId Task ID
   * @param data Additional task data
   * @param context Additional context
   * @returns Task event data
   */
  static createTaskEvent(type: TelemetryEventType, taskId: string, data?: Partial<TaskEventData>, context?: Record<string, any>): TaskEventData {
    return this.create<TaskEventData>(
      type,
      {
        taskId,
        ...data
      },
      context
    );
  }
  
  /**
   * Create a tool event
   * 
   * @param type Event type
   * @param toolName Tool name
   * @param data Additional tool data
   * @param context Additional context
   * @returns Tool event data
   */
  static createToolEvent(type: TelemetryEventType, toolName: string, data?: Partial<ToolEventData>, context?: Record<string, any>): ToolEventData {
    return this.create<ToolEventData>(
      type,
      {
        toolName,
        ...data
      },
      context
    );
  }
  
  /**
   * Create an LLM event
   * 
   * @param type Event type
   * @param provider LLM provider
   * @param model LLM model
   * @param data Additional LLM data
   * @param context Additional context
   * @returns LLM event data
   */
  static createLlmEvent(type: TelemetryEventType, provider: string, model: string, data?: Partial<LlmEventData>, context?: Record<string, any>): LlmEventData {
    return this.create<LlmEventData>(
      type,
      {
        provider,
        model,
        ...data
      },
      context
    );
  }
  
  /**
   * Create a flow event with memory-efficient implementation
   * Similar to knowledge system patterns for memory optimization
   * 
   * @param type Flow event type
   * @param flowId Unique flow identifier
   * @param data Additional flow data
   * @param context Additional context
   * @returns Flow event data
   */
  static createFlowEvent(type: TelemetryEventType, flowId: string, data?: Partial<FlowEventData>, context?: Record<string, any>): FlowEventData {
    // Reuse object creation pattern for memory efficiency
    return this.create<FlowEventData>(
      type,
      {
        flowId,
        ...data
      },
      context
    );
  }
  
  /**
   * Create a test event with memory-efficient implementation
   * 
   * @param type Test event type
   * @param testId Test identifier
   * @param data Additional test data
   * @param context Additional context
   * @returns Test event data
   */
  static createTestEvent(type: TelemetryEventType, testId: string, data?: Partial<TestEventData>, context?: Record<string, any>): TestEventData {
    return this.create<TestEventData>(
      type,
      {
        testId,
        ...data
      },
      context
    );
  }
  
  /**
   * Create a memory operation event with memory-efficient implementation
   * Uses the same memory optimization techniques as our knowledge embedders
   * 
   * @param type Memory event type
   * @param storeId Store identifier
   * @param operation Operation type
   * @param data Additional memory operation data
   * @param context Additional context
   * @returns Memory event data
   */
  static createMemoryEvent(
    type: TelemetryEventType, 
    storeId: string, 
    operation: MemoryEventData['operation'],
    data?: Partial<MemoryEventData>, 
    context?: Record<string, any>
  ): MemoryEventData {
    return this.create<MemoryEventData>(
      type,
      {
        storeId,
        operation,
        ...data
      },
      context
    );
  }
  
  /**
   * Create a deployment event with memory-efficient implementation
   * 
   * @param type Deployment event type
   * @param deploymentId Unique deployment identifier
   * @param data Additional deployment data
   * @param context Additional context
   * @returns Deployment event data
   */
  static createDeploymentEvent(
    type: TelemetryEventType,
    deploymentId: string,
    data?: Partial<DeploymentEventData>,
    context?: Record<string, any>
  ): DeploymentEventData {
    return this.create<DeploymentEventData>(
      type,
      {
        deploymentId,
        ...data
      },
      context
    );
  }
  
  /**
   * Get context for an event
   * 
   * @param event Event to get context for
   * @returns Event context or empty object
   */
  static getContext(event: TelemetryEventData): Record<string, any> {
    return this.contextMap.get(event) || {};
  }
  
  /**
   * Serialize event for transmission
   * Efficiently combines event data with context
   * 
   * @param event Event to serialize
   * @returns Serialized event data
   */
  static serialize(event: TelemetryEventData): Record<string, any> {
    const context = this.getContext(event);
    return {
      ...event,
      context: Object.keys(context).length > 0 ? context : undefined
    };
  }
  
  /**
   * Filter sensitive information from event data
   * 
   * @param event Event to sanitize
   * @returns Sanitized event data
   */
  static sanitize(event: TelemetryEventData): TelemetryEventData {
    // Create a shallow copy to avoid modifying the original
    const sanitized = { ...event };
    
    // Remove potentially sensitive fields
    // This would depend on your specific application
    const sensitiveFields = ['apiKey', 'password', 'token', 'secret', 'credential'];
    
    // Sanitize the event data
    for (const field of sensitiveFields) {
      if ((sanitized as any)[field]) {
        (sanitized as any)[field] = '[REDACTED]';
      }
    }
    
    // Sanitize nested context if present
    const context = this.getContext(event);
    if (Object.keys(context).length > 0) {
      const sanitizedContext = { ...context };
      for (const field of sensitiveFields) {
        if (sanitizedContext[field]) {
          sanitizedContext[field] = '[REDACTED]';
        }
      }
      this.contextMap.set(sanitized, sanitizedContext);
    }
    
    return sanitized;
  }
}
