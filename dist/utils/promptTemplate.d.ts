/**
 * Prompt template system implementation
 * Optimized for efficient template rendering with token management
 */
/**
 * Template variable types
 */
export type TemplateVariables = Record<string, any>;
/**
 * Template rendering options
 */
export interface TemplateOptions {
    /**
     * Maximum tokens allowed for the rendered template
     */
    maxTokens?: number;
    /**
     * Model to use for token counting
     */
    model?: string;
    /**
     * Whether to enable caching for this template
     * @default true
     */
    cache?: boolean;
    /**
     * Function to preprocess variables before rendering
     */
    preprocess?: (variables: TemplateVariables) => TemplateVariables;
    /**
     * Function to postprocess the rendered template
     */
    postprocess?: (rendered: string) => string;
    /**
     * Whether to throw an error if variables are missing
     * @default false
     */
    strictVariables?: boolean;
    /**
     * Default values for variables
     */
    defaults?: TemplateVariables;
    /**
     * Whether to enable automatic truncation of long text variables
     * @default true
     */
    autoTruncate?: boolean;
    /**
     * Optional parent template to extend
     */
    extends?: PromptTemplate;
    /**
     * Template version for tracking changes
     */
    version?: string;
}
/**
 * Truncation strategy interface
 */
export interface TruncationStrategy {
    /**
     * Variable priority map (higher value = higher priority)
     */
    priorities: Record<string, number>;
    /**
     * Maximum proportion of tokens to allocate to each variable
     */
    proportions?: Record<string, number>;
    /**
     * Minimum number of tokens to preserve for each variable
     */
    minimumTokens?: Record<string, number>;
    /**
     * Custom truncation function for specific variables
     */
    customTruncate?: Record<string, (text: string, maxTokens: number) => string>;
}
/**
 * PromptTemplate class for efficient template management
 * Optimized for:
 * - Efficient rendering with caching
 * - Token limit management
 * - Flexible variable handling
 */
export declare class PromptTemplate {
    private template;
    private options;
    private truncationStrategy?;
    private compiled;
    constructor(template: string, options?: TemplateOptions, truncationStrategy?: TruncationStrategy);
    /**
     * Render the template with variables
     */
    render(variables?: TemplateVariables): Promise<string>;
    /**
     * Get the default variables from the template
     */
    getDefaultVariables(): TemplateVariables;
    /**
     * Set the truncation strategy
     */
    setTruncationStrategy(strategy: TruncationStrategy): this;
    /**
     * Get a compiled template function
     * Performance-optimized with null safety
     */
    private getCompiledTemplate;
    /**
     * Compile a template string into a template function
     */
    private compileTemplate;
    /**
     * Truncate variables based on the truncation strategy
     */
    private truncateVariables;
    /**
     * Truncate text to fit within token limit
     */
    private truncateText;
    /**
     * Emergency truncation of rendered template
     */
    private emergencyTruncate;
}
/**
 * Create a template with predefined variables
 */
export declare function createTemplate(template: string, options?: TemplateOptions): PromptTemplate;
/**
 * Predefined prompt templates
 */
export declare const templates: {
    /**
     * Standard agent system prompt template
     */
    agentSystem: PromptTemplate;
    /**
     * Human message template for conversational prompts
     */
    humanMessage: PromptTemplate;
    /**
     * Task execution template
     */
    taskExecution: PromptTemplate;
    /**
     * Crew orchestration template
     */
    crewOrchestration: PromptTemplate;
};
//# sourceMappingURL=promptTemplate.d.ts.map