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
    Object.defineProperty(originalMethod, 'is_before_kickoff', {
      value: true,
      writable: false,
      enumerable: false
    });
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
    Object.defineProperty(originalMethod, 'is_after_kickoff', {
      value: true,
      writable: false,
      enumerable: false
    });
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
    
    // Add property to the wrapped method
    Object.defineProperty(wrappedMethod, 'is_task', {
      value: true,
      writable: false,
      enumerable: false
    });
    
    // Memoize the wrapped method
    descriptor.value = memoize(wrappedMethod);
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
    
    // Add property to the memoized method
    Object.defineProperty(memoizedMethod, 'is_agent', {
      value: true,
      writable: false,
      enumerable: false
    });
    
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
    
    // Add property to the memoized method
    Object.defineProperty(memoizedMethod, 'is_llm', {
      value: true,
      writable: false,
      enumerable: false
    });
    
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
    
    // Add property to the memoized method
    Object.defineProperty(memoizedMethod, 'is_tool', {
      value: true,
      writable: false,
      enumerable: false
    });
    
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
    
    // Add property to the memoized method
    Object.defineProperty(memoizedMethod, 'is_callback', {
      value: true,
      writable: false,
      enumerable: false
    });
    
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
    
    // Add property to the memoized method
    Object.defineProperty(memoizedMethod, 'is_cache_handler', {
      value: true,
      writable: false,
      enumerable: false
    });
    
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
    
    // Create wrapper function for crew execution
    const wrappedMethod = function(this: any, ...args: any[]) {
      const self = this;
      const instantiatedTasks: any[] = [];
      const instantiatedAgents: any[] = [];
      const agentRoles = new Set<string>();
      
      // Use the preserved task and agent information
      const tasks = Object.entries(self._original_tasks || {}) as [string, Function][];
      const agents = Object.entries(self._original_agents || {}) as [string, Function][];
      
      // Instantiate tasks in order with efficient caching
      for (const [taskName, taskMethod] of tasks) {
        const taskInstance = taskMethod.call(self);
        instantiatedTasks.push(taskInstance);
        
        const agentInstance = taskInstance.agent;
        if (agentInstance && !agentRoles.has(agentInstance.role)) {
          instantiatedAgents.push(agentInstance);
          agentRoles.add(agentInstance.role);
        }
      }
      
      // Instantiate agents not included by tasks with efficient role tracking
      for (const [agentName, agentMethod] of agents) {
        const agentInstance = agentMethod.call(self);
        if (!agentRoles.has(agentInstance.role)) {
          instantiatedAgents.push(agentInstance);
          agentRoles.add(agentInstance.role);
        }
      }
      
      self.agents = instantiatedAgents;
      self.tasks = instantiatedTasks;
      
      const crew = originalMethod.apply(self, args) as Crew;
      
      // Efficient callback binding with proper this context
      const callbackWrapper = (callback: Function, instance: any) => {
        return (...args: any[]) => callback.call(instance, ...args);
      };
      
      // Optimized event handler binding
      if (self._before_kickoff) {
        for (const [_, callback] of Object.entries(self._before_kickoff) as [string, Function][]) {
          if (Array.isArray(crew.before_kickoff_callbacks)) {
            crew.before_kickoff_callbacks.push(callbackWrapper(callback, self));
          }
        }
      }
      
      if (self._after_kickoff) {
        for (const [_, callback] of Object.entries(self._after_kickoff) as [string, Function][]) {
          if (Array.isArray(crew.after_kickoff_callbacks)) {
            crew.after_kickoff_callbacks.push(callbackWrapper(callback, self));
          }
        }
      }
      
      return crew;
    };
    
    // Add property to the wrapped method
    Object.defineProperty(wrappedMethod, 'is_crew', {
      value: true,
      writable: false,
      enumerable: false
    });
    
    // Memoize the wrapped method
    descriptor.value = memoize(wrappedMethod);
    return descriptor;
  };
}
