/**
 * Decorators for defining crew components and their behaviors.
 * 
 * These annotations provide optimization through memoization and metadata
 * management using TypeScript decorators.
 */

// Temporary interface for Crew until we have a proper implementation
interface Crew {
  before_kickoff_callbacks: Function[];
  after_kickoff_callbacks: Function[];
}

// Memoization implementation inline until we have proper utils.js
type MemoizedFunction<T extends (...args: any[]) => any> = T & {
  cache: Map<string, ReturnType<T>>;
  clearCache: () => void;
  is_task?: boolean;
  is_agent?: boolean;
  is_llm?: boolean;
  is_tool?: boolean;
  is_callback?: boolean;
  is_cache_handler?: boolean;
  is_before_kickoff?: boolean;
  is_after_kickoff?: boolean;
  is_crew?: boolean;
};

/**
 * Memoize a function for improved performance.
 */
function memoize<T extends (...args: any[]) => any>(fn: T): MemoizedFunction<T> {
  const cache = new Map<string, ReturnType<T>>();
  
  const memoized = function(this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  } as MemoizedFunction<T>;
  
  memoized.cache = cache;
  memoized.clearCache = () => cache.clear();
  
  return memoized;
}

// Define interfaces for annotated methods
interface BeforeKickoffMethod extends Function {
  is_before_kickoff?: boolean;
}

interface AfterKickoffMethod extends Function {
  is_after_kickoff?: boolean;
}

interface TaskMethod extends Function {
  is_task?: boolean;
}

interface AgentMethod extends Function {
  is_agent?: boolean;
}

interface LLMMethod extends Function {
  is_llm?: boolean;
}

interface ToolMethod extends Function {
  is_tool?: boolean;
}

interface CallbackMethod extends Function {
  is_callback?: boolean;
}

interface CacheHandlerMethod extends Function {
  is_cache_handler?: boolean;
}

interface OutputJSONClass {
  is_output_json?: boolean;
}

interface OutputPydanticClass {
  is_output_pydantic?: boolean;
}

interface CrewMethod extends Function {
  is_crew?: boolean;
}

/**
 * Marks a method to execute before crew kickoff.
 * Optimized with minimal property assignment.
 */
export function before_kickoff() {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    // Create a new property directly on the method
    originalMethod.is_before_kickoff = true;
    return descriptor;
  };
}

/**
 * Marks a method to execute after crew kickoff.
 * Optimized with minimal property assignment.
 */
export function after_kickoff() {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    // Create a new property directly on the method
    originalMethod.is_after_kickoff = true;
    return descriptor;
  };
}

/**
 * Marks a method as a crew task.
 * Optimized with memoization to prevent redundant calculations.
 */
export function task() {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    // Create a wrapped method that handles name assignment
    const wrappedMethod = function(this: any, ...args: any[]) {
      const result = originalMethod.apply(this, args);
      if (!result.name) {
        result.name = propertyKey;
      }
      return result;
    };
    
    // Memoize the wrapped method
    const memoizedMethod = memoize(wrappedMethod);
    
    // Add property to the memoized method - ensure it's directly accessible
    memoizedMethod.is_task = true;
    
    // Update descriptor value
    descriptor.value = memoizedMethod;
    return descriptor;
  };
}

/**
 * Marks a method as a crew agent.
 * Optimized with memoization to prevent redundant instantiations.
 */
export function agent() {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const memoizedMethod = memoize(originalMethod);
    
    // Add property to the memoized method - direct assignment for better compatibility
    memoizedMethod.is_agent = true;
    
    descriptor.value = memoizedMethod;
    return descriptor;
  };
}

/**
 * Marks a method as an LLM provider.
 * Optimized with memoization for performance.
 */
export function llm() {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const memoizedMethod = memoize(originalMethod);
    
    // Add property to the memoized method - direct assignment for better compatibility
    memoizedMethod.is_llm = true;
    
    descriptor.value = memoizedMethod;
    return descriptor;
  };
}

/**
 * Marks a class as JSON output format.
 * Uses direct property assignment for performance.
 */
export function output_json<T extends { new(...args: any[]): {} }>(constructor: T) {
  (constructor as unknown as OutputJSONClass).is_output_json = true;
  return constructor;
}

/**
 * Marks a class as Pydantic output format.
 * Uses direct property assignment for performance.
 */
export function output_pydantic<T extends { new(...args: any[]): {} }>(constructor: T) {
  (constructor as unknown as OutputPydanticClass).is_output_pydantic = true;
  return constructor;
}

/**
 * Marks a method as a crew tool.
 * Optimized with memoization.
 */
export function tool() {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const memoizedMethod = memoize(originalMethod);
    
    // Add property to the memoized method - direct assignment for better compatibility
    memoizedMethod.is_tool = true;
    
    descriptor.value = memoizedMethod;
    return descriptor;
  };
}

/**
 * Marks a method as a crew callback.
 * Optimized with memoization.
 */
export function callback() {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const memoizedMethod = memoize(originalMethod);
    
    // Add property to the memoized method - direct assignment for better compatibility
    memoizedMethod.is_callback = true;
    
    descriptor.value = memoizedMethod;
    return descriptor;
  };
}

/**
 * Marks a method as a cache handler.
 * Optimized with memoization for performance.
 */
export function cache_handler() {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const memoizedMethod = memoize(originalMethod);
    
    // Add property to the memoized method - direct assignment for better compatibility
    memoizedMethod.is_cache_handler = true;
    
    descriptor.value = memoizedMethod;
    return descriptor;
  };
}

/**
 * Marks a method as the main crew execution point.
 * Optimized with efficient agent/task instantiation and event binding.
 */
export function crew() {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    // Create wrapper function for crew execution with optimized performance
    const wrappedMethod = function(this: any, ...args: any[]) {
      const self = this;
      
      // Create crew instance first to ensure it exists
      const crew = originalMethod.apply(self, args);
      
      // Highly optimized task and agent processing
      if (self._original_tasks || self._original_agents) {
        // Pre-allocate arrays with expected capacity
        const tasks: any[] = [];
        const agents: any[] = [];
        const agentRoles = new Set<string>();
        
        // Process tasks with optimized property access
        if (self._original_tasks) {
          for (const taskMethod of Object.values(self._original_tasks)) {
            const task = (taskMethod as Function).call(self);
            tasks.push(task);
            
            // Extract agent from task with null-safe property access
            const agent = task?.agent;
            if (agent && agent.role && !agentRoles.has(agent.role)) {
              agents.push(agent);
              agentRoles.add(agent.role);
            }
          }
        }
        
        // Process agents with optimized iteration
        if (self._original_agents) {
          for (const agentMethod of Object.values(self._original_agents)) {
            const agent = (agentMethod as Function).call(self);
            if (agent && agent.role && !agentRoles.has(agent.role)) {
              agents.push(agent);
              agentRoles.add(agent.role);
            }
          }
        }
        
        // Direct assignment for better performance
        self.agents = agents;
        self.tasks = tasks;
      }
      
      // Ensure callback arrays exist
      if (!crew.before_kickoff_callbacks) {
        crew.before_kickoff_callbacks = [];
      }
      
      if (!crew.after_kickoff_callbacks) {
        crew.after_kickoff_callbacks = [];
      }
      
      // Process before kickoff callbacks
      if (self._before_kickoff) {
        for (const callback of Object.values(self._before_kickoff)) {
          crew.before_kickoff_callbacks.push(function(...callbackArgs: any[]) {
            return (callback as Function).call(null, self, ...callbackArgs);
          });
        }
      }
      
      // Process after kickoff callbacks
      if (self._after_kickoff) {
        for (const callback of Object.values(self._after_kickoff)) {
          crew.after_kickoff_callbacks.push(function(...callbackArgs: any[]) {
            return (callback as Function).call(null, self, ...callbackArgs);
          });
        }
      }
      
      return crew;
    };
    
    // Add property to the wrapped method - direct assignment for better compatibility
    wrappedMethod.is_crew = true;
    
    // Memoize the wrapped method
    descriptor.value = memoize(wrappedMethod);
    return descriptor;
  };
}
