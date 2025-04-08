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
export class Config<T extends Record<string, any> = Record<string, any>> {
  private defaults: Partial<T>;
  private sources: Array<ConfigSource<T>>;
  private cache: boolean;
  private validate?: (config: Partial<T>) => boolean | Promise<boolean>;
  private onChange?: (config: T) => void | Promise<void>;
  private cachedConfig: T | null = null;
  private isLoading = false;
  private loadPromise: Promise<T> | null = null;
  
  constructor(options: ConfigOptions<T> = {}) {
    this.defaults = options.defaults ?? {};
    this.sources = options.sources ?? [];
    this.cache = options.cache ?? true;
    this.validate = options.validate;
    this.onChange = options.onChange;
    
    // Sort sources by priority
    this.sources.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Add a configuration source
   */
  addSource(source: ConfigSource<T>): void {
    this.sources.push(source);
    this.sources.sort((a, b) => b.priority - a.priority);
    this.invalidateCache();
  }
  
  /**
   * Get configuration value
   */
  async get<K extends keyof T>(key: K): Promise<T[K]> {
    const config = await this.getAll();
    return config[key];
  }
  
  /**
   * Get all configuration values
   */
  async getAll(): Promise<T> {
    if (this.cache && this.cachedConfig) {
      return this.cachedConfig;
    }
    
    if (this.isLoading) {
      // If already loading, return the existing promise
      return this.loadPromise!;
    }
    
    this.isLoading = true;
    this.loadPromise = this.loadConfig();
    
    try {
      const config = await this.loadPromise;
      if (this.cache) {
        this.cachedConfig = config;
      }
      return config;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }
  
  /**
   * Set a configuration value
   */
  async set<K extends keyof T>(key: K, value: T[K]): Promise<void> {
    // Update cached config if available
    if (this.cachedConfig) {
      this.cachedConfig = { ...this.cachedConfig, [key]: value } as T;
    }
    
    // Find the first writable source
    const writableSource = this.sources.find(source => !!source.save);
    
    if (!writableSource) {
      throw new Error('No writable configuration source available');
    }
    
    // Get the current config from this source
    const sourceConfig = await Promise.resolve(writableSource.load());
    
    // Update the value
    const updatedConfig = { ...sourceConfig, [key]: value };
    
    // Validate if needed
    if (this.validate) {
      const isValid = await Promise.resolve(this.validate(updatedConfig));
      if (!isValid) {
        throw new Error(`Invalid configuration: ${String(key)}=${String(value)}`);
      }
    }
    
    // Save the updated config
    await Promise.resolve(writableSource.save!(updatedConfig));
    
    // Trigger onChange if provided
    if (this.onChange) {
      const fullConfig = await this.getAll();
      await Promise.resolve(this.onChange(fullConfig));
    }
  }
  
  /**
   * Set multiple configuration values
   */
  async setMany(values: Partial<T>): Promise<void> {
    // Update cached config if available
    if (this.cachedConfig) {
      this.cachedConfig = { ...this.cachedConfig, ...values } as T;
    }
    
    // Find the first writable source
    const writableSource = this.sources.find(source => !!source.save);
    
    if (!writableSource) {
      throw new Error('No writable configuration source available');
    }
    
    // Get the current config from this source
    const sourceConfig = await Promise.resolve(writableSource.load());
    
    // Update the values
    const updatedConfig = { ...sourceConfig, ...values };
    
    // Validate if needed
    if (this.validate) {
      const isValid = await Promise.resolve(this.validate(updatedConfig));
      if (!isValid) {
        throw new Error(`Invalid configuration: ${JSON.stringify(values)}`);
      }
    }
    
    // Save the updated config
    await Promise.resolve(writableSource.save!(updatedConfig));
    
    // Trigger onChange if provided
    if (this.onChange) {
      const fullConfig = await this.getAll();
      await Promise.resolve(this.onChange(fullConfig));
    }
  }
  
  /**
   * Reset configuration to defaults
   */
  async reset(): Promise<void> {
    // Reset cached config
    this.invalidateCache();
    
    // Find all writable sources
    const writableSources = this.sources.filter(source => !!source.save);
    
    // Reset each source
    for (const source of writableSources) {
      await Promise.resolve(source.save!({}));
    }
    
    // Trigger onChange if provided
    if (this.onChange) {
      const fullConfig = await this.getAll();
      await Promise.resolve(this.onChange(fullConfig));
    }
  }
  
  /**
   * Invalidate the configuration cache
   */
  invalidateCache(): void {
    this.cachedConfig = null;
  }
  
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
  }): ConfigSource<T> {
    const { prefix, mapping = {}, priority = 100, transform = {} } = options;
    
    return {
      name: `env:${prefix}`,
      priority,
      
      load(): Partial<T> {
        const config: Partial<T> = {};
        
        // Get all environment variables with the prefix
        // Safely access process.env with proper type handling
        const envVars: Record<string, string | undefined> = 
          typeof process !== 'undefined' && process.env ? process.env : {};
        
        for (const [key, value] of Object.entries(envVars)) {
          if (!key.startsWith(prefix)) {
            continue;
          }
          
          // Convert env var name to config key
          let configKey: string | undefined;
          
          // Check if this env var is in the mapping
          for (const [mapKey, mapValue] of Object.entries(mapping)) {
            if (mapValue === key) {
              // Ensure proper string conversion for symbol keys
              configKey = String(mapKey);
              break;
            }
          }
          
          // If not in mapping, convert from UPPER_SNAKE_CASE to camelCase
          if (!configKey) {
            const keyWithoutPrefix = key.substring(prefix.length);
            configKey = keyWithoutPrefix
              .toLowerCase()
              .replace(/_(\w)/g, (_, c) => c.toUpperCase());
          }
          
          // Set the value, applying transform if available
          if (value !== undefined && configKey) {
            // Safely access transformer with proper typing
            const transformer = configKey in transform 
              ? (transform as Record<string, (value: string) => any>)[configKey] 
              : undefined;
            // Safely set with validated key and casting
            (config as Record<string, any>)[configKey] = transformer ? transformer(value) : value;
          }
        }
        
        return config;
      }
    };
  }
  
  /**
   * Create a memory configuration source
   */
  static memorySource<T>(initialValues: Partial<T> = {}, priority = 50): ConfigSource<T> {
    let values = { ...initialValues };
    
    return {
      name: 'memory',
      priority,
      
      load(): Partial<T> {
        return values;
      },
      
      save(config: Partial<T>): void {
        values = { ...config };
      }
    };
  }
  
  /**
   * Load configuration from all sources
   */
  private async loadConfig(): Promise<T> {
    // Start with defaults
    let config = { ...this.defaults } as T;
    
    // Load from each source in order (highest priority last)
    for (const source of [...this.sources].reverse()) {
      try {
        const sourceConfig = await Promise.resolve(source.load());
        config = { ...config, ...sourceConfig };
      } catch (error) {
        console.error(`Failed to load config from source ${source.name}:`, error);
      }
    }
    
    // Validate if needed
    if (this.validate) {
      const isValid = await Promise.resolve(this.validate(config));
      if (!isValid) {
        throw new Error(`Invalid configuration: ${JSON.stringify(config)}`);
      }
    }
    
    return config;
  }
}

/**
 * Define a configuration schema with type information
 */
export function defineConfig<T extends Record<string, any>>(defaults: Partial<T>): Partial<T> {
  return defaults;
}

/**
 * Singleton global configuration instance
 */
export const globalConfig = new Config<{
  // Define global configuration schema here
  debug: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxConcurrency: number;
  defaultTimeoutMs: number;
  llmDefaults: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
}>({  
  defaults: {
    debug: false,
    logLevel: 'info',
    maxConcurrency: 4,
    defaultTimeoutMs: 60000,
    llmDefaults: {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
    },
  },
  sources: [
    // Add memory source as a default writable source
    Config.memorySource({}),
    
    // Add environment variables source if in Node environment
    // With proper environment detection
    ...((typeof process !== 'undefined' && typeof process.env !== 'undefined')
      ? [Config.envSource<any>({ prefix: 'CREWAI_' })]
      : [])
  ]
});
