/**
 * Types for the Telemetry system
 * Optimized for TypeScript type safety and memory efficiency
 */

/**
 * Telemetry event type enumeration
 * These represent the different types of events that can be tracked
 */
export enum TelemetryEventType {
  // System events
  INITIALIZATION = 'initialization',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  DEBUG = 'debug',
  
  // Crew events
  CREW_CREATED = 'crew_created',
  CREW_EXECUTION_STARTED = 'crew_execution_started',
  CREW_EXECUTION_COMPLETED = 'crew_execution_completed',
  CREW_DEPLOYMENT_STARTED = 'crew_deployment_started',
  CREW_DEPLOYMENT_COMPLETED = 'crew_deployment_completed',
  CREW_DEPLOYMENT_ERROR = 'crew_deployment_error',
  CREW_LOGS_REQUESTED = 'crew_logs_requested',
  CREW_REMOVED = 'crew_removed',
  
  // Agent events
  AGENT_CREATED = 'agent_created',
  AGENT_EXECUTION_STARTED = 'agent_execution_started',
  AGENT_EXECUTION_COMPLETED = 'agent_execution_completed',
  AGENT_ROLES_OPTIMIZATION = 'agent_roles_optimization',
  
  // Task events
  TASK_CREATED = 'task_created',
  TASK_EXECUTION_STARTED = 'task_execution_started',
  TASK_EXECUTION_COMPLETED = 'task_execution_completed',
  TASK_EXECUTION_ERROR = 'task_execution_error',
  
  // Tool events
  TOOL_USAGE = 'tool_usage',
  TOOL_USAGE_ERROR = 'tool_usage_error',
  TOOL_REPEATED_USAGE = 'tool_repeated_usage',
  
  // LLM events
  LLM_REQUEST_STARTED = 'llm_request_started',
  LLM_REQUEST_COMPLETED = 'llm_request_completed',
  LLM_REQUEST_ERROR = 'llm_request_error',
  
  // Flow events
  FLOW_CREATED = 'flow_created',
  FLOW_EXECUTION_STARTED = 'flow_execution_started',
  FLOW_EXECUTION_COMPLETED = 'flow_execution_completed',
  FLOW_EXECUTION_ERROR = 'flow_execution_error',
  FLOW_PLOTTING_STARTED = 'flow_plotting_started',
  FLOW_PLOTTING_COMPLETED = 'flow_plotting_completed',
  
  // Test events
  TEST_EXECUTION_STARTED = 'test_execution_started',
  TEST_EXECUTION_COMPLETED = 'test_execution_completed',
  TEST_RESULT = 'test_result',
  
  // Memory events
  MEMORY_USAGE = 'memory_usage',
  MEMORY_STORE_CREATED = 'memory_store_created',
  MEMORY_QUERY_EXECUTED = 'memory_query_executed',
  
  // Custom event
  CUSTOM = 'custom'
}

/**
 * Options for telemetry configuration
 */
export interface TelemetryOptions {
  /** Whether telemetry is enabled (default: true) */
  enabled?: boolean;
  /** Default endpoint for telemetry (if applicable) */
  endpoint?: string;
  /** Buffer size before flushing events (default: 50) */
  bufferSize?: number;
  /** Flush interval in milliseconds (default: 30000) */
  flushIntervalMs?: number;
  /** Maximum number of retries for failed telemetry submissions */
  maxRetries?: number;
  /** Sampling rate (0-1) to reduce volume (default: 1) */
  samplingRate?: number;
  /** Maximum memory allowed for telemetry events in bytes */
  memoryLimit?: number;
  /** Whether to include additional data for better insights */
  shareTelemetry?: boolean;
}

/**
 * Base telemetry event data interface
 * All telemetry events will include these properties
 */
export interface TelemetryEventData {
  /** Event timestamp */
  timestamp: number;
  /** Event type */
  type: TelemetryEventType;
  /** Unique event ID */
  id: string;
  /** Application version */
  version?: string;
  /** User-provided additional context */
  context?: Record<string, any>;
}

/**
 * Telemetry provider interface
 * Implementations can send telemetry to various backends
 */
export interface TelemetryProvider {
  /** Provider name */
  readonly name: string;
  /** Initialize the provider */
  initialize(): Promise<void>;
  /** Submit a batch of events */
  submitEvents(events: TelemetryEventData[]): Promise<boolean>;
  /** Shutdown the provider */
  shutdown(): Promise<void>;
}

/**
 * Error events specific data
 */
export interface ErrorEventData extends TelemetryEventData {
  /** Error message */
  message: string;
  /** Error stack trace (sanitized) */
  stack?: string;
  /** Error source/component */
  source?: string;
}

/**
 * Crew events specific data
 */
export interface CrewEventData extends TelemetryEventData {
  /** Crew ID */
  crewId: string;
  /** Number of agents */
  agentCount?: number;
  /** Number of tasks */
  taskCount?: number;
  /** Process type */
  processType?: string;
  /** Memory usage data */
  memoryUsage?: Record<string, number>;
}

/**
 * Agent events specific data
 */
export interface AgentEventData extends TelemetryEventData {
  /** Agent ID */
  agentId: string;
  /** Agent role */
  role?: string;
  /** Crew ID if applicable */
  crewId?: string;
  /** LLM model used */
  llmModel?: string;
  /** Tools used */
  tools?: string[];
}

/**
 * Task events specific data
 */
export interface TaskEventData extends TelemetryEventData {
  /** Task ID */
  taskId: string;
  /** Task type */
  taskType?: string;
  /** Crew ID if applicable */
  crewId?: string;
  /** Agent ID if applicable */
  agentId?: string;
  /** Execution time in milliseconds */
  executionTimeMs?: number;
  /** Number of tools used */
  toolCount?: number;
}

/**
 * Tool events specific data
 */
export interface ToolEventData extends TelemetryEventData {
  /** Tool name */
  toolName: string;
  /** Agent ID if applicable */
  agentId?: string;
  /** Task ID if applicable */
  taskId?: string;
  /** Usage count */
  usageCount?: number;
  /** Execution time in milliseconds */
  executionTimeMs?: number;
  /** Success status */
  success?: boolean;
}

/**
 * LLM events specific data
 */
export interface LlmEventData extends TelemetryEventData {
  /** LLM provider */
  provider: string;
  /** LLM model */
  model: string;
  /** Request type */
  requestType?: string;
  /** Tokens used - input */
  inputTokens?: number;
  /** Tokens used - output */
  outputTokens?: number;
  /** Request time in milliseconds */
  requestTimeMs?: number;
}

/**
 * System information type
 */
export interface SystemInfo {
  /** Node.js version */
  nodeVersion: string;
  /** Operating system */
  platform: string;
  /** CPU architecture */
  architecture: string;
  /** Application version */
  appVersion?: string;
  /** Total memory available */
  totalMemory?: number;
  /** Free memory */
  freeMemory?: number;
}

/**
 * Flow events specific data
 * Memory-efficient implementation with optional fields and explicit typing
 */
export interface FlowEventData extends TelemetryEventData {
  /** Unique flow identifier */
  flowId: string;
  /** Optional flow name for better debugging */
  flowName?: string;
  /** Number of nodes in the flow graph */
  nodeCount?: number;
  /** Number of completed steps */
  completedSteps?: number;
  /** Number of total steps */
  totalSteps?: number;
  /** Execution time in milliseconds for performance tracking */
  executionTimeMs?: number;
  /** Memory usage in bytes during execution */
  memoryUsageBytes?: number;
  /** Error information if execution failed */
  error?: {
    message: string;
    code?: string;
    step?: string;
  };
}

/**
 * Test events specific data
 * Using optimized data structures similar to knowledge system test implementation
 */
export interface TestEventData extends TelemetryEventData {
  /** Unique test identifier */
  testId: string;
  /** Test name or description */
  testName?: string;
  /** Test result status */
  result?: 'pass' | 'fail' | 'error' | 'skipped';
  /** Duration in milliseconds */
  durationMs?: number;
  /** Test suite information if part of a larger test suite */
  suite?: string;
  /** Error details if test failed */
  error?: {
    message: string;
    expected?: string;
    actual?: string;
    diff?: string;
  };
  /** Optional test metadata */
  metadata?: Record<string, any>;
}

/**
 * Enhanced memory events data
 * With memory-efficient implementation similar to knowledge embedders
 */
export interface MemoryEventData extends TelemetryEventData {
  /** Store identifier */
  storeId?: string;
  /** Store type (e.g., 'vector', 'key-value', 'episodic') */
  storeType?: string;
  /** Operation performed */
  operation: 'create' | 'read' | 'update' | 'delete' | 'query';
  /** Number of items processed */
  itemCount?: number;
  /** Vector dimensions if applicable */
  dimensions?: number;
  /** Query similarity score if applicable */
  similarityScore?: number;
  /** Duration of operation in milliseconds */
  durationMs?: number;
  /** Memory usage before operation in bytes */
  memoryBefore?: number;
  /** Memory usage after operation in bytes */
  memoryAfter?: number;
  /** Cache hit metrics */
  cacheMetrics?: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

/**
 * Deployment events specific data
 * Optimized for minimal memory footprint with typed structure
 */
export interface DeploymentEventData extends TelemetryEventData {
  /** Deployment identifier */
  deploymentId: string;
  /** Target environment */
  environment?: string;
  /** Deployment stage */
  stage?: 'init' | 'build' | 'deploy' | 'complete';
  /** Resource information with explicit typing */
  resources?: {
    /** CPU usage (0-100) */
    cpuPercent?: number;
    /** Memory usage in megabytes */
    memoryMb?: number;
    /** Storage usage in megabytes */
    storageMb?: number;
    /** Network usage in bytes */
    networkBytes?: number;
  };
  /** Duration of deployment operation in milliseconds */
  durationMs?: number;
  /** Deployment status */
  status?: 'started' | 'in_progress' | 'completed' | 'failed';
  /** Error information if deployment failed */
  error?: {
    code?: string;
    message: string;
    component?: string;
  };
}
