/**
 * FlowRouter
 * 
 * Provides optimized conditional routing for flows with
 * efficient condition evaluation and minimal memory overhead.
 */
import { Flow, FlowState } from '../index.js';

/**
 * Types of routing conditions that can be evaluated
 */
export enum ConditionType {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  REGEX = 'regex',
  FUNCTION = 'function'
}

/**
 * Basic condition interface
 */
export interface BaseCondition {
  type: ConditionType;
  path: string; // Property path to evaluate, can be dotted path (e.g. 'user.profile.name')
}

/**
 * Value comparison condition
 */
export interface ValueCondition extends BaseCondition {
  type: ConditionType.EQUALS | ConditionType.NOT_EQUALS | 
         ConditionType.GREATER_THAN | ConditionType.LESS_THAN;
  value: any;
}

/**
 * String or array contains condition
 */
export interface ContainsCondition extends BaseCondition {
  type: ConditionType.CONTAINS | ConditionType.NOT_CONTAINS;
  value: any;
}

/**
 * Regex matching condition
 */
export interface RegexCondition extends BaseCondition {
  type: ConditionType.REGEX;
  pattern: string;
  flags?: string;
}

/**
 * Function condition with custom evaluation logic
 */
export interface FunctionCondition extends BaseCondition {
  type: ConditionType.FUNCTION;
  predicate: (value: any, state: any) => boolean;
}

/**
 * Combined conditions with logical operators
 */
export interface LogicalGroup {
  operator: 'AND' | 'OR';
  conditions: RouteCondition[];
}

/**
 * Complete route condition type
 */
export type RouteCondition = 
  | ValueCondition
  | ContainsCondition
  | RegexCondition
  | FunctionCondition
  | LogicalGroup;

/**
 * Route definition with condition and target
 */
export interface Route<T extends FlowState = FlowState> {
  id: string;
  name: string;
  condition: RouteCondition;
  target: Flow<T> | string;
  priority?: number;
  metadata?: Record<string, any>;
}

/**
 * Options for route evaluation
 */
export interface RouteEvaluationOptions {
  enableConditionCache?: boolean;
  cacheTTLMs?: number;
  traceEvaluation?: boolean;
  shortCircuitEvaluation?: boolean;
  maxTraceResults?: number;
}

/**
 * Result from evaluating routes
 */
export interface RouteEvaluationResult<T extends FlowState = FlowState> {
  matched: Route<T>[];
  matchedIds: string[];
  trace?: {
    route: string;
    condition: RouteCondition;
    result: boolean;
    timestamp: number;
    evaluationTimeMs: number;
  }[];
}

/**
 * FlowRouter provides efficient conditional routing for flows
 */
export class FlowRouter<T extends FlowState = FlowState> {
  // Routes storage with fast lookup
  private routes: Map<string, Route<T>> = new Map();
  private routePriorities: Map<string, number> = new Map();
  
  // Optimization features
  private conditionCache: Map<string, { result: boolean, timestamp: number }> = new Map();
  private compiledFunctions: Map<string, Function> = new Map();
  private fastPathLookup: Map<string, Set<string>> = new Map();
  
  // Route evaluation counters
  private evaluationCount: number = 0;
  private cacheHitCount: number = 0;
  
  /**
   * Create a new FlowRouter with optimized routing capabilities
   * @param options Default options for route evaluation
   */
  constructor(private defaultOptions: RouteEvaluationOptions = {}) {
    // Set default options
    this.defaultOptions = {
      enableConditionCache: true,
      cacheTTLMs: 10000, // 10 seconds default
      traceEvaluation: false,
      shortCircuitEvaluation: true,
      maxTraceResults: 100,
      ...defaultOptions
    };
  }
  
  /**
   * Register a new route
   * @param route Route definition to register
   */
  registerRoute(route: Route<T>): void {
    if (this.routes.has(route.id)) {
      throw new Error(`Route with id ${route.id} already exists`);
    }
    
    // Store route
    this.routes.set(route.id, route);
    
    // Set priority (default to 0 if not specified)
    this.routePriorities.set(route.id, route.priority ?? 0);
    
    // Build fast path lookup for direct property access
    this.buildFastPathLookup(route.id, route.condition);
    
    // Pre-compile function conditions if possible
    if (this.isFunctionCondition(route.condition)) {
      this.compiledFunctions.set(route.id, route.condition.predicate);
    }
  }
  
  /**
   * Update an existing route
   * @param routeId ID of the route to update
   * @param updates Updates to apply to the route
   */
  updateRoute(routeId: string, updates: Partial<Route<T>>): void {
    const existingRoute = this.routes.get(routeId);
    if (!existingRoute) {
      throw new Error(`Route with id ${routeId} does not exist`);
    }
    
    // Apply updates
    const updatedRoute = { ...existingRoute, ...updates };
    
    // Update route
    this.routes.set(routeId, updatedRoute);
    
    // Update priority if changed
    if (updates.priority !== undefined) {
      this.routePriorities.set(routeId, updates.priority);
    }
    
    // Rebuild fast path lookup if condition changed
    if (updates.condition) {
      this.buildFastPathLookup(routeId, updatedRoute.condition);
      
      // Update compiled function
      if (this.isFunctionCondition(updatedRoute.condition)) {
        this.compiledFunctions.set(routeId, updatedRoute.condition.predicate);
      } else {
        // Remove compiled function if condition is no longer a function
        this.compiledFunctions.delete(routeId);
      }
    }
    
    // Clear condition cache for this route
    this.clearConditionCache();
  }
  
  /**
   * Remove a route
   * @param routeId ID of the route to remove
   */
  removeRoute(routeId: string): boolean {
    if (!this.routes.has(routeId)) {
      return false;
    }
    
    // Remove route
    this.routes.delete(routeId);
    this.routePriorities.delete(routeId);
    
    // Clean up lookup structures
    this.compiledFunctions.delete(routeId);
    
    // Clear fast path lookup
    for (const [path, routeIds] of this.fastPathLookup.entries()) {
      routeIds.delete(routeId);
      if (routeIds.size === 0) {
        this.fastPathLookup.delete(path);
      }
    }
    
    return true;
  }
  
  /**
   * Find matching routes for a given state
   * @param state State to evaluate routes against
   * @param options Route evaluation options
   */
  findMatchingRoutes(state: T, options: RouteEvaluationOptions = {}): RouteEvaluationResult<T> {
    // Merge with default options
    const evalOptions = { ...this.defaultOptions, ...options };
    
    // Initialize result
    const result: RouteEvaluationResult<T> = {
      matched: [],
      matchedIds: [],
      trace: evalOptions.traceEvaluation ? [] : undefined
    };
    
    // Get optimized route evaluation order
    const routesToEvaluate = this.getOptimizedRouteEvaluationOrder(state);
    
    // Evaluate each route
    for (const routeId of routesToEvaluate) {
      const route = this.routes.get(routeId);
      if (!route) continue;
      
      const startTime = evalOptions.traceEvaluation ? performance.now() : 0;
      
      // Evaluate route condition
      const matches = this.evaluateCondition(route.condition, state, routeId, evalOptions);
      
      // Add to trace if enabled
      if (evalOptions.traceEvaluation && result.trace) {
        const endTime = performance.now();
        result.trace.push({
          route: route.id,
          condition: route.condition,
          result: matches,
          timestamp: Date.now(),
          evaluationTimeMs: endTime - startTime
        });
        
        // Limit trace size
        if (result.trace.length > evalOptions.maxTraceResults!) {
          result.trace = result.trace.slice(-evalOptions.maxTraceResults!);
        }
      }
      
      // Add to matches if condition is true
      if (matches) {
        result.matched.push(route);
        result.matchedIds.push(route.id);
        
        // Short-circuit if only interested in first match
        if (evalOptions.shortCircuitEvaluation) {
          break;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Get a specific route by ID
   * @param routeId ID of the route to get
   */
  getRoute(routeId: string): Route<T> | undefined {
    return this.routes.get(routeId);
  }
  
  /**
   * Get all registered routes
   */
  getAllRoutes(): Route<T>[] {
    return Array.from(this.routes.values());
  }
  
  /**
   * Clear the condition evaluation cache
   */
  clearConditionCache(): void {
    this.conditionCache.clear();
  }
  
  /**
   * Get evaluation performance metrics
   */
  getPerformanceMetrics(): { evaluations: number, cacheHitRate: number } {
    const cacheHitRate = this.evaluationCount > 0 ? 
      this.cacheHitCount / this.evaluationCount : 0;
    
    return {
      evaluations: this.evaluationCount,
      cacheHitRate
    };
  }
  
  /**
   * Get an optimized evaluation order for routes
   * This prioritizes routes based on:
   * 1. Explicit priority (higher first)
   * 2. Matching properties in state (routes that check properties present in state)
   * 3. Complexity (simpler conditions evaluated first)
   */
  private getOptimizedRouteEvaluationOrder(state: T): string[] {
    const routeIds = Array.from(this.routes.keys());
    
    // Find properties that exist in the state
    const stateProps = new Set<string>();
    this.extractPropertyPaths(state, '', stateProps);
    
    return routeIds.sort((a, b) => {
      // 1. Sort by priority (higher first)
      const priorityA = this.routePriorities.get(a) ?? 0;
      const priorityB = this.routePriorities.get(b) ?? 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      
      // 2. Sort by property match (routes that check properties in state first)
      const routeA = this.routes.get(a)!;
      const routeB = this.routes.get(b)!;
      
      const aRelevance = this.calculateStateRelevance(routeA.condition, stateProps);
      const bRelevance = this.calculateStateRelevance(routeB.condition, stateProps);
      
      if (aRelevance !== bRelevance) {
        return bRelevance - aRelevance;
      }
      
      // 3. Sort by condition complexity (simpler first)
      return this.getConditionComplexity(routeA.condition) - 
             this.getConditionComplexity(routeB.condition);
    });
  }
  
  /**
   * Evaluate a route condition against a state
   */
  private evaluateCondition(
    condition: RouteCondition, 
    state: T, 
    routeId: string, 
    options: RouteEvaluationOptions
  ): boolean {
    this.evaluationCount++;
    
    // Check cache if enabled
    if (options.enableConditionCache) {
      const cacheKey = `${routeId}:${JSON.stringify(state)}`;
      const cached = this.conditionCache.get(cacheKey);
      
      if (cached) {
        // Check if cache entry is still valid
        const now = Date.now();
        if (now - cached.timestamp < options.cacheTTLMs!) {
          this.cacheHitCount++;
          return cached.result;
        }
        
        // Remove expired cache entry
        this.conditionCache.delete(cacheKey);
      }
      
      // Evaluate and cache result
      const result = this.doEvaluateCondition(condition, state);
      
      this.conditionCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
      
      return result;
    }
    
    // Evaluate without caching
    return this.doEvaluateCondition(condition, state);
  }
  
  /**
   * Actual condition evaluation logic
   */
  private doEvaluateCondition(condition: RouteCondition, state: any): boolean {
    // Handle logical groups
    if ('operator' in condition) {
      if (condition.operator === 'AND') {
        // Short-circuit AND (all must be true)
        for (const subCondition of condition.conditions) {
          if (!this.doEvaluateCondition(subCondition, state)) {
            return false;
          }
        }
        return true;
      } else { // OR
        // Short-circuit OR (any can be true)
        for (const subCondition of condition.conditions) {
          if (this.doEvaluateCondition(subCondition, state)) {
            return true;
          }
        }
        return false;
      }
    }
    
    // Handle basic conditions
    const value = this.getValueFromPath(state, condition.path);
    
    switch (condition.type) {
      case ConditionType.EQUALS:
        return value === condition.value;
        
      case ConditionType.NOT_EQUALS:
        return value !== condition.value;
        
      case ConditionType.GREATER_THAN:
        return value > condition.value;
        
      case ConditionType.LESS_THAN:
        return value < condition.value;
        
      case ConditionType.CONTAINS:
        if (Array.isArray(value)) {
          return value.includes(condition.value);
        } else if (typeof value === 'string') {
          return value.includes(String(condition.value));
        }
        return false;
        
      case ConditionType.NOT_CONTAINS:
        if (Array.isArray(value)) {
          return !value.includes(condition.value);
        } else if (typeof value === 'string') {
          return !value.includes(String(condition.value));
        }
        return true;
        
      case ConditionType.REGEX:
        if (typeof value === 'string') {
          const regex = new RegExp(condition.pattern, condition.flags);
          return regex.test(value);
        }
        return false;
        
      case ConditionType.FUNCTION:
        return condition.predicate(value, state);
        
      default:
        return false;
    }
  }
  
  /**
   * Get a value from a dotted path in an object
   */
  private getValueFromPath(obj: any, path: string): any {
    if (!path) return obj;
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }
  
  /**
   * Calculate how relevant a condition is to the current state
   * Returns a number representing relevance (higher is more relevant)
   */
  private calculateStateRelevance(condition: RouteCondition, stateProps: Set<string>): number {
    // For logical groups, sum relevance of children
    if ('operator' in condition) {
      return condition.conditions.reduce(
        (sum, subCondition) => sum + this.calculateStateRelevance(subCondition, stateProps),
        0
      );
    }
    
    // Basic condition - check if path exists in state
    return stateProps.has(condition.path) ? 1 : 0;
  }
  
  /**
   * Extract all property paths from an object
   * Used to find which properties are available in the state
   */
  private extractPropertyPaths(obj: any, prefix: string, result: Set<string>): void {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key of Object.keys(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      result.add(path);
      
      // Recursively extract nested properties (up to a reasonable depth)
      if (obj[key] && typeof obj[key] === 'object' && prefix.split('.').length < 3) {
        this.extractPropertyPaths(obj[key], path, result);
      }
    }
  }
  
  /**
   * Calculate the complexity of a condition
   * Used for sorting conditions by complexity (simpler first)
   */
  private getConditionComplexity(condition: RouteCondition): number {
    // Logical groups are more complex
    if ('operator' in condition) {
      return 10 + condition.conditions.reduce(
        (sum, subCondition) => sum + this.getConditionComplexity(subCondition),
        0
      );
    }
    
    // Function conditions are most complex
    if (condition.type === ConditionType.FUNCTION) {
      return 5;
    }
    
    // Regex conditions are more complex than basic conditions
    if (condition.type === ConditionType.REGEX) {
      return 3;
    }
    
    // Basic conditions are simplest
    return 1;
  }
  
  /**
   * Build fast path lookup for direct property access
   * This optimizes route finding by indexing routes by the properties they check
   */
  private buildFastPathLookup(routeId: string, condition: RouteCondition): void {
    const paths = new Set<string>();
    this.extractConditionPaths(condition, paths);
    
    // Remove this route from existing path lookups
    for (const [path, routeIds] of this.fastPathLookup.entries()) {
      routeIds.delete(routeId);
      if (routeIds.size === 0) {
        this.fastPathLookup.delete(path);
      }
    }
    
    // Add to new path lookups
    for (const path of paths) {
      if (!this.fastPathLookup.has(path)) {
        this.fastPathLookup.set(path, new Set<string>());
      }
      this.fastPathLookup.get(path)!.add(routeId);
    }
  }
  
  /**
   * Extract all condition paths from a condition
   */
  private extractConditionPaths(condition: RouteCondition, result: Set<string>): void {
    if ('operator' in condition) {
      // Logical group - extract from all subconditions
      for (const subCondition of condition.conditions) {
        this.extractConditionPaths(subCondition, result);
      }
    } else {
      // Basic condition - add path
      result.add(condition.path);
    }
  }
  
  /**
   * Type guard for function conditions
   */
  private isFunctionCondition(condition: RouteCondition): condition is FunctionCondition {
    return !('operator' in condition) && condition.type === ConditionType.FUNCTION;
  }
}
