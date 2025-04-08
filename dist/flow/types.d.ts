/**
 * Types for the Flow System - harmonized with Python crewAI implementation
 */
import { FlowState } from './FlowState.js';
export type FlowId = string;
export type FlowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
export type FlowNode = string;
export interface Flow<T extends FlowState = FlowState> {
    readonly state: T;
    run(): Promise<any>;
    reset(): void;
}
export type ConditionFunction = () => boolean;
export type SimpleCondition = string;
export type ComplexCondition = {
    type: 'AND' | 'OR';
    methods: Array<string>;
};
export type Condition = SimpleCondition | ComplexCondition | ConditionFunction;
export declare class FlowExecutionError extends Error {
    readonly methodName?: string | undefined;
    constructor(message: string, methodName?: string | undefined);
}
export declare class FlowValidationError extends Error {
    constructor(message: string);
}
export interface MethodExecutionResult {
    success: boolean;
    result?: any;
    error?: Error;
}
export interface FlowEvent {
    type: string;
    flowName: string;
    [key: string]: any;
}
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
export interface FlowMethodMetadata {
    isStartMethod?: boolean;
    isListener?: boolean;
    isRouter?: boolean;
    condition?: Condition;
}
export interface FlowOptions<T extends FlowState> {
    initialState?: Partial<T>;
    persistence?: FlowPersistence;
}
export interface FlowPersistence {
    saveState: (state: FlowState) => Promise<void>;
    loadState: (stateId: string) => Promise<FlowState | null>;
    deleteState: (stateId: string) => Promise<void>;
    listStates: () => Promise<string[]>;
}
export declare const CONTINUE: unique symbol;
export declare const STOP: unique symbol;
//# sourceMappingURL=types.d.ts.map