/**
 * Configuration system implementation
 * Optimized for efficient and type-safe configuration management
 */
export interface ConfigSource<T = Record<string, any>> {
    /**
     * Load configuration from this source
     */
    load(): Promise<Partial<T>> | Partial<T>;
    /**
     * Save configuration to this source (if supported)
     */
    save?(config: Partial<T>): Promise<void> | void;
    /**
     * Priority of this source (higher overrides lower)
     */
    priority: number;
    /**
     * Name of this source for debugging
     */
    name: string;
}
export interface ConfigOptions<T = Record<string, any>> {
    /**
     * Default configuration values
     */
    defaults?: Partial<T>;
    /**
     * Configuration sources in order of priority
     */
    sources?: Array<ConfigSource<T>>;
    /**
     * Whether to cache the configuration
     * @default true
     */
    cache?: boolean;
    /**
     * Schema validation function
     */
    validate?: (config: Partial<T>) => boolean | Promise<boolean>;
    /**
     * Observer function for configuration changes
     */
    onChange?: (config: T) => void | Promise<void>;
}
/**
 * Configuration class for managing settings
 * Optimized for:
 * - Type safety with generics
 * - Efficient access with caching
 * - Flexible configuration sources
 */
export declare class Config<T extends Record<string, any> = Record<string, any>> {
    private defaults;
    private sources;
    private cache;
    private validate?;
    private onChange?;
    private cachedConfig;
    private isLoading;
    private loadPromise;
    constructor(options?: ConfigOptions<T>);
    /**
     * Add a configuration source
     */
    addSource(source: ConfigSource<T>): void;
    /**
     * Get configuration value
     */
    get<K extends keyof T>(key: K): Promise<T[K]>;
    /**
     * Get all configuration values
     */
    getAll(): Promise<T>;
    /**
     * Set a configuration value
     */
    set<K extends keyof T>(key: K, value: T[K]): Promise<void>;
    /**
     * Set multiple configuration values
     */
    setMany(values: Partial<T>): Promise<void>;
    /**
     * Reset configuration to defaults
     */
    reset(): Promise<void>;
    /**
     * Invalidate the configuration cache
     */
    invalidateCache(): void;
    /**
     * Create an environment variable configuration source
     */
    static envSource<T extends Record<string, any>>(options: {
        /**
         * Environment variable prefix
         */
        prefix: string;
        /**
         * Mapping of config keys to env var names
         * If not provided, will convert from camelCase to UPPER_SNAKE_CASE with prefix
         */
        mapping?: Partial<Record<keyof T, string>>;
        /**
         * Priority of this source
         * @default 100
         */
        priority?: number;
        /**
         * Type transformations for values
         */
        transform?: Partial<Record<keyof T, (value: string) => any>>;
    }): ConfigSource<T>;
    /**
     * Create a memory configuration source
     */
    static memorySource<T>(initialValues?: Partial<T>, priority?: number): ConfigSource<T>;
    /**
     * Load configuration from all sources
     */
    private loadConfig;
}
/**
 * Define a configuration schema with type information
 */
export declare function defineConfig<T extends Record<string, any>>(defaults: Partial<T>): Partial<T>;
/**
 * Singleton global configuration instance
 */
export declare const globalConfig: Config<{
    debug: boolean;
    logLevel: "debug" | "info" | "warn" | "error";
    maxConcurrency: number;
    defaultTimeoutMs: number;
    llmDefaults: {
        model: string;
        temperature: number;
        maxTokens: number;
    };
}>;
//# sourceMappingURL=config.d.ts.map