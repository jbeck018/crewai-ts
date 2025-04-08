/**
 * Decorators for flow control and method registration.
 * Optimized for TypeScript with proper method metadata handling.
 * Harmonized with Python crewAI implementation for API consistency.
 */
import { Condition, ComplexCondition, FlowValidationError } from './types.js';

/**
 * Method decorator metadata symbol
 * Using Symbol for memory efficiency and name collision avoidance
 */
const FLOW_METADATA = Symbol('flow:metadata');

/**
 * Utility to safely get or create metadata object on methods
 * - Performance optimized with metadata caching
 * - Uses a WeakMap for memory efficiency with object references
 */
const metadataCache = new WeakMap<object, any>();

function getMetadata(target: any): any {
  // Check cache first for performance optimization
  if (metadataCache.has(target)) {
    return metadataCache.get(target);
  }
  
  // Create new metadata if not found
  const metadata = target[FLOW_METADATA] || {};
  target[FLOW_METADATA] = metadata;
  
  // Cache for future access (memory efficient as it uses weak references)
  metadataCache.set(target, metadata);
  
  return metadata;
}

/**
 * Validates condition objects to ensure compatibility with Python implementation
 * @param condition The condition to validate
 * @throws FlowValidationError if condition is invalid
 */
function validateCondition(condition: Condition): void {
  if (typeof condition === 'string') {
    // String conditions are simple method names - always valid
    return;
  }
  
  if (typeof condition === 'function') {
    // Function conditions are valid but with a compatibility warning
    console.warn(
      'Function conditions work differently between Python and TypeScript implementations. ' +
      'For maximum compatibility, use string or object conditions.'
    );
    return;
  }
  
  if (typeof condition === 'object' && condition !== null) {
    // Complex conditions must have valid type and methods
    if (!('type' in condition) || !('methods' in condition)) {
      throw new FlowValidationError('Complex condition must have type and methods properties');
    }
    
    if (condition.type !== 'AND' && condition.type !== 'OR') {
      throw new FlowValidationError('Complex condition type must be \'AND\' or \'OR\'');
    }
    
    if (!Array.isArray(condition.methods) || condition.methods.length === 0) {
      throw new FlowValidationError('Complex condition methods must be a non-empty array');
    }
    
    // Validate each method name is a string
    for (const method of condition.methods) {
      if (typeof method !== 'string') {
        throw new FlowValidationError('All method names in condition must be strings');
      }
    }
    
    return;
  }
  
  throw new FlowValidationError(`Invalid condition type: ${typeof condition}`);
}

/**
 * Marks a method as a flow's starting point.
 * Optimized for performance with metadata validation and caching.
 * 
 * @param condition Optional condition that determines when the method starts
 */
export function start(condition?: Condition): MethodDecorator {
  return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Performance optimization: capture original once
    const originalMethod = descriptor.value;
    
    // Validate condition if provided (ensures Python compatibility)
    if (condition) {
      validateCondition(condition);
    }
    
    // Get metadata with optimized caching
    const metadata = getMetadata(originalMethod);
    
    // Set start method metadata with type safety
    metadata.isStartMethod = true;
    if (condition) {
      metadata.condition = condition;
    }
    
    // Store metadata on the method with efficient property access
    originalMethod.__metadata = metadata;
    
    return descriptor;
  };
}

/**
 * Creates a listener that executes when specified conditions are met.
 * Performance optimized with condition validation for Python compatibility.
 * 
 * @param condition Condition that triggers this listener
 */
export function listen(condition: Condition): MethodDecorator {
  // Input validation for better error messages
  if (!condition) {
    throw new FlowValidationError('listen() requires a condition parameter');
  }
  
  // Validate condition structure for compatibility
  validateCondition(condition);
  
  return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Performance optimization: capture original once
    const originalMethod = descriptor.value;
    
    // Get metadata with optimized caching
    const metadata = getMetadata(originalMethod);
    
    // Set listener metadata with type safety
    metadata.isListener = true;
    metadata.condition = condition;
    
    // Store metadata on the method with efficient property access
    originalMethod.__metadata = metadata;
    
    return descriptor;
  };
}

/**
 * Creates a routing method that directs flow execution based on conditions.
 * Performance optimized with Python compatibility validation.
 * 
 * @param condition Condition that triggers this router
 */
export function router(condition: Condition): MethodDecorator {
  // Input validation for better error messages
  if (!condition) {
    throw new FlowValidationError('router() requires a condition parameter');
  }
  
  // Validate condition structure for compatibility
  validateCondition(condition);
  
  return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Performance optimization: capture original once
    const originalMethod = descriptor.value;
    
    // Get metadata with optimized caching
    const metadata = getMetadata(originalMethod);
    
    // Set router metadata with type safety
    metadata.isRouter = true;
    metadata.condition = condition;
    
    // Add listener capabilities for triggering
    metadata.isListener = true;
    
    // Store metadata on the method with efficient property access
    originalMethod.__metadata = metadata;
    
    return descriptor;
  };
}

/**
 * Combines multiple conditions with OR logic for flow control.
 * Creates a condition that is satisfied when any of the specified conditions are met.
 * Performance optimized with proper validation for Python compatibility.
 * 
 * @param conditions List of conditions to combine with OR logic
 */
export function or_(...conditions: Condition[]): ComplexCondition {
  // Validate input conditions
  if (conditions.length === 0) {
    throw new FlowValidationError('or_() requires at least one condition');
  }
  
  // Create a Set directly for O(1) lookups and automatic deduplication
  const methodsSet = new Set<string>();
  
  // Process conditions with optimized type handling
  for (const condition of conditions) {
    try {
      // Validate each condition for structure consistency
      validateCondition(condition);
      
      if (typeof condition === 'string') {
        // Fast path for string conditions
        methodsSet.add(condition);
      } else if (typeof condition === 'object' && condition !== null && 'methods' in condition) {
        // Fast path for complex conditions
        condition.methods.forEach(method => methodsSet.add(method));
      } else if (typeof condition === 'function') {
        throw new FlowValidationError(
          'Function conditions are not supported in or_() for cross-platform compatibility'
        );
      }
    } catch (error) {
      // Enhanced error handling with context
      if (error instanceof FlowValidationError) {
        throw new FlowValidationError(`Invalid condition in or_(): ${error.message}`);
      }
      throw error;
    }
  }
  
  // Convert set to array only once at the end for efficiency
  return {
    type: 'OR',
    methods: Array.from(methodsSet)
  };
}

/**
 * Combines multiple conditions with AND logic for flow control.
 * Creates a condition that is satisfied only when all specified conditions are met.
 * Performance optimized with proper validation for Python compatibility.
 * 
 * @param conditions List of conditions to combine with AND logic
 */
export function and_(...conditions: Condition[]): ComplexCondition {
  // Validate input conditions
  if (conditions.length === 0) {
    throw new FlowValidationError('and_() requires at least one condition');
  }
  
  // Create a Set directly for O(1) lookups and automatic deduplication
  const methodsSet = new Set<string>();
  
  // Process conditions with optimized type handling
  for (const condition of conditions) {
    try {
      // Validate each condition for structure consistency
      validateCondition(condition);
      
      if (typeof condition === 'string') {
        // Fast path for string conditions
        methodsSet.add(condition);
      } else if (typeof condition === 'object' && condition !== null && 'methods' in condition) {
        // Fast path for complex conditions
        condition.methods.forEach(method => methodsSet.add(method));
      } else if (typeof condition === 'function') {
        throw new FlowValidationError(
          'Function conditions are not supported in and_() for cross-platform compatibility'
        );
      }
    } catch (error) {
      // Enhanced error handling with context
      if (error instanceof FlowValidationError) {
        throw new FlowValidationError(`Invalid condition in and_(): ${error.message}`);
      }
      throw error;
    }
  }
  
  // Convert set to array only once at the end for efficiency
  return {
    type: 'AND',
    methods: Array.from(methodsSet)
  };
}

/**
 * Aliases for Python compatibility
 * These ensure the TypeScript API matches the Python naming conventions
 */
export const Start = start;
export const Listen = listen;
export const Router = router;
export const OR = or_;
export const AND = and_;
