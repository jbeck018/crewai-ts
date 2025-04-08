/**
 * Decorators for flow control and method registration.
 * Optimized for TypeScript with proper method metadata handling.
 */
import { Condition, ComplexCondition } from './types.js';

/**
 * Method decorator metadata symbol
 * Using Symbol for memory efficiency and name collision avoidance
 */
const FLOW_METADATA = Symbol('flow:metadata');

/**
 * Utility to safely get or create metadata object on methods
 */
function getMetadata(target: any): any {
  const metadata = target[FLOW_METADATA] || {};
  target[FLOW_METADATA] = metadata;
  return metadata;
}

/**
 * Marks a method as a flow's starting point.
 * 
 * @param condition Optional condition that determines when the method starts
 */
export function start(condition?: Condition): MethodDecorator {
  return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metadata = getMetadata(originalMethod);
    
    // Set start method metadata
    metadata.isStartMethod = true;
    if (condition) {
      metadata.condition = condition;
    }
    
    // Store metadata on the method
    originalMethod.__metadata = metadata;
    
    return descriptor;
  };
}

/**
 * Creates a listener that executes when specified conditions are met.
 * 
 * @param condition Condition that triggers this listener
 */
export function listen(condition: Condition): MethodDecorator {
  return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metadata = getMetadata(originalMethod);
    
    // Set listener metadata
    metadata.isListener = true;
    metadata.condition = condition;
    
    // Store metadata on the method
    originalMethod.__metadata = metadata;
    
    return descriptor;
  };
}

/**
 * Creates a routing method that directs flow execution based on conditions.
 * 
 * @param condition Condition that triggers this router
 */
export function router(condition: Condition): MethodDecorator {
  return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metadata = getMetadata(originalMethod);
    
    // Set router metadata
    metadata.isRouter = true;
    metadata.condition = condition;
    
    // Add listener capabilities for triggering
    metadata.isListener = true;
    
    // Store metadata on the method
    originalMethod.__metadata = metadata;
    
    return descriptor;
  };
}

/**
 * Combines multiple conditions with OR logic for flow control.
 * Creates a condition that is satisfied when any of the specified conditions are met.
 * 
 * @param conditions List of conditions to combine with OR logic
 */
export function or_(...conditions: Condition[]): ComplexCondition {
  if (conditions.length === 0) {
    throw new Error('or_() requires at least one condition');
  }
  
  // Extract method names from conditions
  const methods: string[] = [];
  for (const condition of conditions) {
    if (typeof condition === 'string') {
      methods.push(condition);
    } else if (typeof condition === 'object' && 'methods' in condition) {
      methods.push(...condition.methods);
    } else if (typeof condition === 'function') {
      throw new Error('Function conditions not supported in or_() yet');
    } else {
      throw new Error(`Invalid condition type: ${typeof condition}`);
    }
  }
  
  return {
    type: 'OR',
    methods: [...new Set(methods)] // Deduplicate methods for efficiency
  };
}

/**
 * Combines multiple conditions with AND logic for flow control.
 * Creates a condition that is satisfied only when all specified conditions are met.
 * 
 * @param conditions List of conditions to combine with AND logic
 */
export function and_(...conditions: Condition[]): ComplexCondition {
  if (conditions.length === 0) {
    throw new Error('and_() requires at least one condition');
  }
  
  // Extract method names from conditions
  const methods: string[] = [];
  for (const condition of conditions) {
    if (typeof condition === 'string') {
      methods.push(condition);
    } else if (typeof condition === 'object' && 'methods' in condition) {
      methods.push(...condition.methods);
    } else if (typeof condition === 'function') {
      throw new Error('Function conditions not supported in and_() yet');
    } else {
      throw new Error(`Invalid condition type: ${typeof condition}`);
    }
  }
  
  return {
    type: 'AND',
    methods: [...new Set(methods)] // Deduplicate methods for efficiency
  };
}
