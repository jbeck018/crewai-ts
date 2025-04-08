// Error types for compatibility with Python error handling
export class FlowExecutionError extends Error {
    methodName;
    constructor(message, methodName) {
        super(message);
        this.methodName = methodName;
        this.name = 'FlowExecutionError';
    }
}
export class FlowValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FlowValidationError';
    }
}
// Constants for flow control
export const CONTINUE = Symbol('CONTINUE');
export const STOP = Symbol('STOP');
//# sourceMappingURL=types.js.map