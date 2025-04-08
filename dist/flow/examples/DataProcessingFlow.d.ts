/**
 * Example data processing flow demonstrating key Flow system features
 * with various performance optimizations.
 */
import { Flow, FlowState } from '../index.js';
import { CONTINUE, STOP } from '../types.js';
/**
 * Sample data for processing
 */
interface SampleData {
    id: string;
    value: number;
    timestamp: string;
    processed?: boolean;
    validationErrors?: string[];
}
/**
 * State definition for DataProcessingFlow
 * Uses strict typing for improved performance and safety
 */
export declare class DataProcessingState extends FlowState {
    progress: number;
    startTime: number;
    endTime: number;
    executionTimeMs: number;
    completed: boolean;
    inputData: SampleData[];
    validData: SampleData[];
    invalidData: SampleData[];
    processedData: SampleData[];
    summary: Record<string, number>;
    hasErrors: boolean;
    errorMessages: string[];
}
/**
 * Example data processing flow with performance optimizations.
 * Demonstrates:
 * - Parallel data processing
 * - Intelligent flow branching
 * - Optimized state management
 * - Type-safe implementation
 */
export declare class DataProcessingFlow extends Flow<DataProcessingState> {
    constructor(initialData?: SampleData[]);
    /**
     * Starting point for the flow
     * Initializes execution tracking and validates inputs
     */
    begin(): Promise<typeof CONTINUE | typeof STOP>;
    /**
     * Validates input data with parallel processing for performance
     */
    validateData(): Promise<typeof STOP | SampleData[]>;
    /**
     * Validates a single data item (used by parallel validator)
     * Pure function design for better performance
     */
    private validateDataItem;
    /**
     * Processes validated data in parallel for maximum performance
     */
    processData(validatedData: SampleData[]): Promise<typeof STOP | SampleData[]>;
    /**
     * Processes a single data item (used by parallel processor)
     * Pure function design for better performance
     */
    private processDataItem;
    /**
     * Analyzes processed data and generates summary metrics
     */
    analyzeResults(processedData: SampleData[]): Promise<Record<string, number>>;
    /**
     * Finalizes the flow and provides completion metrics
     */
    complete(): Promise<symbol>;
    /**
     * Error handler that listens to multiple methods
     * Uses OR condition to trigger on any error
     */
    handleError(): Promise<symbol>;
}
export {};
//# sourceMappingURL=DataProcessingFlow.d.ts.map