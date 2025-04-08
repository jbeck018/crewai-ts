/**
 * Base decorator for creating crew classes with configuration and function management.
 * Optimized for performance and memory efficiency.
 */
/**
 * Interface for classes that can be wrapped by CrewBase
 */
interface CrewBaseClass {
    new (...args: any[]): any;
    prototype: any;
}
/**
 * Wraps a class with crew functionality and configuration management.
 * Implements optimizations for configuration loading and function mapping.
 */
export declare function CrewBase<T extends CrewBaseClass>(BaseClass: T): T;
export {};
//# sourceMappingURL=CrewBase.d.ts.map