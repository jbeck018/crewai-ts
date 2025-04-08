/**
 * Decorators for defining crew components and their behaviors.
 *
 * These annotations provide optimization through memoization and metadata
 * management using TypeScript decorators.
 */
/**
 * Marks a method to execute before crew kickoff.
 * Optimized with minimal property assignment.
 */
export declare function before_kickoff(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Marks a method to execute after crew kickoff.
 * Optimized with minimal property assignment.
 */
export declare function after_kickoff(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Marks a method as a crew task.
 * Optimized with memoization to prevent redundant calculations.
 */
export declare function task(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Marks a method as a crew agent.
 * Optimized with memoization to prevent redundant instantiations.
 */
export declare function agent(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Marks a method as an LLM provider.
 * Optimized with memoization for performance.
 */
export declare function llm(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Marks a class as JSON output format.
 * Uses direct property assignment for performance.
 */
export declare function output_json<T extends {
    new (...args: any[]): {};
}>(constructor: T): T;
/**
 * Marks a class as Pydantic output format.
 * Uses direct property assignment for performance.
 */
export declare function output_pydantic<T extends {
    new (...args: any[]): {};
}>(constructor: T): T;
/**
 * Marks a method as a crew tool.
 * Optimized with memoization.
 */
export declare function tool(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Marks a method as a crew callback.
 * Optimized with memoization.
 */
export declare function callback(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Marks a method as a cache handler.
 * Optimized with memoization for performance.
 */
export declare function cache_handler(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Marks a method as the main crew execution point.
 * Optimized with efficient agent/task instantiation and event binding.
 */
export declare function crew(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
//# sourceMappingURL=annotations.d.ts.map