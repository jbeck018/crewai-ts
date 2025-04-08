/**
 * Configuration system implementation
 * Optimized for efficient and type-safe configuration management
 */
/**
 * Configuration class for managing settings
 * Optimized for:
 * - Type safety with generics
 * - Efficient access with caching
 * - Flexible configuration sources
 */
export class Config {
    defaults;
    sources;
    cache;
    validate;
    onChange;
    cachedConfig = null;
    isLoading = false;
    loadPromise = null;
    constructor(options = {}) {
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
    addSource(source) {
        this.sources.push(source);
        this.sources.sort((a, b) => b.priority - a.priority);
        this.invalidateCache();
    }
    /**
     * Get configuration value
     */
    async get(key) {
        const config = await this.getAll();
        return config[key];
    }
    /**
     * Get all configuration values
     */
    async getAll() {
        if (this.cache && this.cachedConfig) {
            return this.cachedConfig;
        }
        if (this.isLoading) {
            // If already loading, return the existing promise
            return this.loadPromise;
        }
        this.isLoading = true;
        this.loadPromise = this.loadConfig();
        try {
            const config = await this.loadPromise;
            if (this.cache) {
                this.cachedConfig = config;
            }
            return config;
        }
        finally {
            this.isLoading = false;
            this.loadPromise = null;
        }
    }
    /**
     * Set a configuration value
     */
    async set(key, value) {
        // Update cached config if available
        if (this.cachedConfig) {
            this.cachedConfig = { ...this.cachedConfig, [key]: value };
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
        await Promise.resolve(writableSource.save(updatedConfig));
        // Trigger onChange if provided
        if (this.onChange) {
            const fullConfig = await this.getAll();
            await Promise.resolve(this.onChange(fullConfig));
        }
    }
    /**
     * Set multiple configuration values
     */
    async setMany(values) {
        // Update cached config if available
        if (this.cachedConfig) {
            this.cachedConfig = { ...this.cachedConfig, ...values };
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
        await Promise.resolve(writableSource.save(updatedConfig));
        // Trigger onChange if provided
        if (this.onChange) {
            const fullConfig = await this.getAll();
            await Promise.resolve(this.onChange(fullConfig));
        }
    }
    /**
     * Reset configuration to defaults
     */
    async reset() {
        // Reset cached config
        this.invalidateCache();
        // Find all writable sources
        const writableSources = this.sources.filter(source => !!source.save);
        // Reset each source
        for (const source of writableSources) {
            await Promise.resolve(source.save({}));
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
    invalidateCache() {
        this.cachedConfig = null;
    }
    /**
     * Create an environment variable configuration source
     */
    static envSource(options) {
        const { prefix, mapping = {}, priority = 100, transform = {} } = options;
        return {
            name: `env:${prefix}`,
            priority,
            load() {
                const config = {};
                // Get all environment variables with the prefix
                // Safely access process.env with proper type handling
                const envVars = typeof process !== 'undefined' && process.env ? process.env : {};
                for (const [key, value] of Object.entries(envVars)) {
                    if (!key.startsWith(prefix)) {
                        continue;
                    }
                    // Convert env var name to config key
                    let configKey;
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
                            ? transform[configKey]
                            : undefined;
                        // Safely set with validated key and casting
                        config[configKey] = transformer ? transformer(value) : value;
                    }
                }
                return config;
            }
        };
    }
    /**
     * Create a memory configuration source
     */
    static memorySource(initialValues = {}, priority = 50) {
        let values = { ...initialValues };
        return {
            name: 'memory',
            priority,
            load() {
                return values;
            },
            save(config) {
                values = { ...config };
            }
        };
    }
    /**
     * Load configuration from all sources
     */
    async loadConfig() {
        // Start with defaults
        let config = { ...this.defaults };
        // Load from each source in order (highest priority last)
        for (const source of [...this.sources].reverse()) {
            try {
                const sourceConfig = await Promise.resolve(source.load());
                config = { ...config, ...sourceConfig };
            }
            catch (error) {
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
export function defineConfig(defaults) {
    return defaults;
}
/**
 * Singleton global configuration instance
 */
export const globalConfig = new Config({
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
            ? [Config.envSource({ prefix: 'CREWAI_' })]
            : [])
    ]
});
//# sourceMappingURL=config.js.map