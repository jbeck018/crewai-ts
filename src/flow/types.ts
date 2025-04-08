/**
 * Types for the Flow System
 */
import { FlowState } from './FlowState.js';

// Type for condition functions that determine when methods are triggered
export type ConditionFunction = () => boolean;

// Types for conditions that can be used in flow decorators
export type SimpleCondition = string; // Method name
export type ComplexCondition = {
  type: 'AND' | 'OR';
  methods: Array<string>;
};

export type Condition = SimpleCondition | ComplexCondition | ConditionFunction;

// Result of a method execution
export interface MethodExecutionResult {
  success: boolean;
  result?: any;
  error?: Error;
}

// Event for flow system
export interface FlowEvent {
  type: string;
  flowName: string;
  [key: string]: any;
}

// Specific flow events
export interface FlowCreatedEvent extends FlowEvent {
  type: 'flow_created';
}

export interface FlowStartedEvent extends FlowEvent {
  type: 'flow_started';
  stateId: string;
}

export interface FlowFinishedEvent extends FlowEvent {
  type: 'flow_finished';
  result: any;
  stateId: string;
}

export interface MethodExecutionStartedEvent extends FlowEvent {
  type: 'method_execution_started';
  methodName: string;
  stateId: string;
}

export interface MethodExecutionFinishedEvent extends FlowEvent {
  type: 'method_execution_finished';
  methodName: string;
  stateId: string;
  result: any;
}

export interface MethodExecutionFailedEvent extends FlowEvent {
  type: 'method_execution_failed';
  methodName: string;
  stateId: string;
  error: Error;
}

export interface FlowPlotEvent extends FlowEvent {
  type: 'flow_plot';
}

// Flow method metadata
export interface FlowMethodMetadata {
  isStartMethod?: boolean;
  isListener?: boolean;
  isRouter?: boolean;
  condition?: Condition;
}

// Flow configuration options
export interface FlowOptions<T extends FlowState> {
  initialState?: Partial<T>;
  persistence?: FlowPersistence;
}

// Flow persistence interface
export interface FlowPersistence {
  saveState: (state: FlowState) => Promise<void>;
  loadState: (stateId: string) => Promise<FlowState | null>;
  deleteState: (stateId: string) => Promise<void>;
  listStates: () => Promise<string[]>;
}

// Constants for flow control
export const CONTINUE = Symbol('CONTINUE');
export const STOP = Symbol('STOP');
