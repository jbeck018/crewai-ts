var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
/**
 * Example data processing flow demonstrating key Flow system features
 * with various performance optimizations.
 */
import { Flow, FlowState } from '../index.js';
import { start, listen, or_ } from '../decorators.js';
import { CONTINUE, STOP } from '../types.js';
/**
 * State definition for DataProcessingFlow
 * Uses strict typing for improved performance and safety
 */
export class DataProcessingState extends FlowState {
    // Execution tracking with optimized data types
    progress = 0;
    startTime = 0;
    endTime = 0;
    executionTimeMs = 0;
    completed = false;
    // Data storage with strong typing for improved performance
    inputData = [];
    validData = [];
    invalidData = [];
    processedData = [];
    summary = {};
    // Error handling
    hasErrors = false;
    errorMessages = [];
}
/**
 * Example data processing flow with performance optimizations.
 * Demonstrates:
 * - Parallel data processing
 * - Intelligent flow branching
 * - Optimized state management
 * - Type-safe implementation
 */
let DataProcessingFlow = (() => {
    let _classSuper = Flow;
    let _instanceExtraInitializers = [];
    let _begin_decorators;
    let _validateData_decorators;
    let _processData_decorators;
    let _analyzeResults_decorators;
    let _complete_decorators;
    let _handleError_decorators;
    return class DataProcessingFlow extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _begin_decorators = [start()];
            _validateData_decorators = [listen('begin')];
            _processData_decorators = [listen('validateData')];
            _analyzeResults_decorators = [listen('processData')];
            _complete_decorators = [listen('analyzeResults')];
            _handleError_decorators = [listen(or_('validateData', 'processData', 'analyzeResults'))];
            __esDecorate(this, null, _begin_decorators, { kind: "method", name: "begin", static: false, private: false, access: { has: obj => "begin" in obj, get: obj => obj.begin }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _validateData_decorators, { kind: "method", name: "validateData", static: false, private: false, access: { has: obj => "validateData" in obj, get: obj => obj.validateData }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _processData_decorators, { kind: "method", name: "processData", static: false, private: false, access: { has: obj => "processData" in obj, get: obj => obj.processData }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _analyzeResults_decorators, { kind: "method", name: "analyzeResults", static: false, private: false, access: { has: obj => "analyzeResults" in obj, get: obj => obj.analyzeResults }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _complete_decorators, { kind: "method", name: "complete", static: false, private: false, access: { has: obj => "complete" in obj, get: obj => obj.complete }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _handleError_decorators, { kind: "method", name: "handleError", static: false, private: false, access: { has: obj => "handleError" in obj, get: obj => obj.handleError }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        constructor(initialData = []) {
            super({
                initialState: new DataProcessingState()
            });
            __runInitializers(this, _instanceExtraInitializers);
            // Pre-populate with initial data if provided
            this.state.inputData = initialData;
        }
        /**
         * Starting point for the flow
         * Initializes execution tracking and validates inputs
         */
        // @ts-ignore - Decorator type compatibility issue
        async begin() {
            console.log('Starting data processing flow');
            // Record start time for performance tracking
            this.state.startTime = Date.now();
            this.state.progress = 5;
            // Check if we have data to process
            if (this.state.inputData.length === 0) {
                console.log('No input data provided');
                this.state.errorMessages.push('No input data to process');
                this.state.hasErrors = true;
                return STOP;
            }
            console.log(`Found ${this.state.inputData.length} data items to process`);
            this.state.progress = 10;
            return CONTINUE;
        }
        /**
         * Validates input data with parallel processing for performance
         */
        // @ts-ignore - Decorator type compatibility issue
        async validateData() {
            console.log('Validating input data...');
            // Use Promise.all for parallel validation (performance optimization)
            const validationResults = await Promise.all(this.state.inputData.map(this.validateDataItem.bind(this)));
            // Split into valid and invalid data
            this.state.validData = validationResults.filter(item => !item.validationErrors || item.validationErrors.length === 0);
            this.state.invalidData = validationResults.filter(item => item.validationErrors && item.validationErrors.length > 0);
            // Update progress
            this.state.progress = 30;
            console.log(`Validation complete: ${this.state.validData.length} valid, ${this.state.invalidData.length} invalid`);
            if (this.state.validData.length === 0) {
                this.state.errorMessages.push('No valid data items to process');
                this.state.hasErrors = true;
                return STOP;
            }
            return this.state.validData;
        }
        /**
         * Validates a single data item (used by parallel validator)
         * Pure function design for better performance
         */
        async validateDataItem(item) {
            const errors = [];
            // Simulate validation checks
            if (!item.id)
                errors.push('Missing ID');
            if (typeof item.value !== 'number')
                errors.push('Invalid value type');
            if (item.value < 0)
                errors.push('Value must be positive');
            if (!item.timestamp)
                errors.push('Missing timestamp');
            // Simulate some async validation that might take time
            await new Promise(resolve => setTimeout(resolve, 10));
            return {
                ...item,
                validationErrors: errors.length > 0 ? errors : undefined
            };
        }
        /**
         * Processes validated data in parallel for maximum performance
         */
        // @ts-ignore - Decorator type compatibility issue
        async processData(validatedData) {
            console.log(`Processing ${validatedData.length} valid items...`);
            try {
                // Process items in parallel for maximum performance
                this.state.processedData = await Promise.all(validatedData.map(this.processDataItem.bind(this)));
                // Update progress
                this.state.progress = 70;
                console.log(`Processed ${this.state.processedData.length} items`);
                return this.state.processedData;
            }
            catch (error) {
                this.state.errorMessages.push(`Processing error: ${error.message}`);
                this.state.hasErrors = true;
                return STOP;
            }
        }
        /**
         * Processes a single data item (used by parallel processor)
         * Pure function design for better performance
         */
        async processDataItem(item) {
            // Simulate processing that takes time
            await new Promise(resolve => setTimeout(resolve, 50));
            // Apply transformation to the item
            return {
                ...item,
                value: item.value * 2, // Double the value as sample processing
                processed: true
            };
        }
        /**
         * Analyzes processed data and generates summary metrics
         */
        // @ts-ignore - Decorator type compatibility issue
        async analyzeResults(processedData) {
            console.log('Generating results summary...');
            // Calculate summary statistics
            const sum = processedData.reduce((acc, item) => acc + item.value, 0);
            const average = sum / processedData.length;
            const min = Math.min(...processedData.map(item => item.value));
            const max = Math.max(...processedData.map(item => item.value));
            // Save to state
            this.state.summary = {
                count: processedData.length,
                sum,
                average,
                min,
                max
            };
            // Update progress
            this.state.progress = 90;
            console.log('Analysis complete');
            return this.state.summary;
        }
        /**
         * Finalizes the flow and provides completion metrics
         */
        // @ts-ignore - Decorator type compatibility issue
        async complete() {
            // Record completion time and calculate execution time
            this.state.endTime = Date.now();
            this.state.executionTimeMs = this.state.endTime - this.state.startTime;
            this.state.completed = true;
            this.state.progress = 100;
            console.log(`Flow completed in ${this.state.executionTimeMs} ms`);
            console.log(`Processed ${this.state.processedData.length} items successfully`);
            console.log(`Found ${this.state.invalidData.length} invalid items`);
            return STOP;
        }
        /**
         * Error handler that listens to multiple methods
         * Uses OR condition to trigger on any error
         */
        // @ts-ignore - Decorator type compatibility issue
        async handleError() {
            console.error('Error detected in flow:', this.state.errorMessages);
            // Record completion time with error
            this.state.endTime = Date.now();
            this.state.executionTimeMs = this.state.endTime - this.state.startTime;
            this.state.hasErrors = true;
            // Always indicate 100% even on error - better UX
            this.state.progress = 100;
            return STOP;
        }
    };
})();
export { DataProcessingFlow };
//# sourceMappingURL=DataProcessingFlow.js.map