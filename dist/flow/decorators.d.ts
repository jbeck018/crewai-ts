/**
 * Decorators for flow control and method registration.
 * Optimized for TypeScript with proper method metadata handling.
 * Harmonized with Python crewAI implementation for API consistency.
 */
import { Condition, ComplexCondition } from './types.js';
/**
 * Marks a method as a flow's starting point.
 * Optimized for performance with metadata validation and caching.
 *
 * @param condition Optional condition that determines when the method starts
 */
export declare function start(condition?: Condition): MethodDecorator;
/**
 * Creates a listener that executes when specified conditions are met.
 * Performance optimized with condition validation for Python compatibility.
 *
 * @param condition Condition that triggers this listener
 */
export declare function listen(condition: Condition): MethodDecorator;
/**
 * Creates a routing method that directs flow execution based on conditions.
 * Performance optimized with Python compatibility validation.
 *
 * @param condition Condition that triggers this router
 */
export declare function router(condition: Condition): MethodDecorator;
/**
 * Combines multiple conditions with OR logic for flow control.
 * Creates a condition that is satisfied when any of the specified conditions are met.
 * Performance optimized with proper validation for Python compatibility.
 *
 * @param conditions List of conditions to combine with OR logic
 */
export declare function or_(...conditions: Condition[]): ComplexCondition;
/**
 * Combines multiple conditions with AND logic for flow control.
 * Creates a condition that is satisfied only when all specified conditions are met.
 * Performance optimized with proper validation for Python compatibility.
 *
 * @param conditions List of conditions to combine with AND logic
 */
export declare function and_(...conditions: Condition[]): ComplexCondition;
/**
 * Aliases for Python compatibility
 * These ensure the TypeScript API matches the Python naming conventions
 */
export declare const Start: typeof start;
export declare const Listen: typeof listen;
export declare const Router: typeof router;
export declare const OR: typeof or_;
export declare const AND: typeof and_;
//# sourceMappingURL=decorators.d.ts.map