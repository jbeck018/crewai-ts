/**
 * Prompt template system implementation
 * Optimized for efficient template rendering with token management
 */
import { tokenCounter } from './tokenCounter.js';
import { Cache } from './cache.js';
import { ValidationError } from './errors.js';
// Cache for compiled templates
const templateCache = new Cache({
    maxSize: 100,
    ttl: 3600000 // 1 hour
});
/**
 * PromptTemplate class for efficient template management
 * Optimized for:
 * - Efficient rendering with caching
 * - Token limit management
 * - Flexible variable handling
 */
export class PromptTemplate {
    template;
    options;
    truncationStrategy;
    compiled = null;
    constructor(template, options = {}, truncationStrategy) {
        this.template = template;
        this.options = {
            cache: true,
            strictVariables: false,
            autoTruncate: true,
            ...options
        };
        this.truncationStrategy = truncationStrategy;
        // Pre-compile template if caching is enabled
        if (this.options.cache) {
            this.getCompiledTemplate();
        }
    }
    /**
     * Render the template with variables
     */
    async render(variables = {}) {
        // Preprocess variables if function is provided
        let processedVars = this.options.preprocess
            ? this.options.preprocess(variables)
            : variables;
        // Apply default values
        if (this.options.defaults) {
            processedVars = { ...this.options.defaults, ...processedVars };
        }
        // Apply parent template variables if extending
        if (this.options.extends) {
            const parentVars = this.options.extends.getDefaultVariables();
            processedVars = { ...parentVars, ...processedVars };
        }
        // Automatically truncate long text variables if needed
        if (this.options.autoTruncate && this.options.maxTokens && this.truncationStrategy) {
            processedVars = await this.truncateVariables(processedVars);
        }
        // Get the compiled template function
        const compiled = this.getCompiledTemplate();
        // Render the template
        let rendered = compiled(processedVars);
        // Postprocess if function is provided
        if (this.options.postprocess) {
            rendered = this.options.postprocess(rendered);
        }
        // Handle parent template if extending
        if (this.options.extends) {
            rendered = await this.options.extends.render({
                ...processedVars,
                content: rendered
            });
        }
        // Check if the rendered template exceeds token limit
        if (this.options.maxTokens) {
            const { tokens } = tokenCounter.countTokens(rendered, this.options.model);
            if (tokens > this.options.maxTokens) {
                // If we can't truncate or have already tried, throw an error
                if (!this.options.autoTruncate || !this.truncationStrategy) {
                    throw new ValidationError(`Rendered template exceeds token limit: ${tokens}/${this.options.maxTokens}`, { context: { template: this.template.substring(0, 100) + '...' } });
                }
                // Try emergency truncation of the final result
                rendered = this.emergencyTruncate(rendered, this.options.maxTokens);
            }
        }
        return rendered;
    }
    /**
     * Get the default variables from the template
     */
    getDefaultVariables() {
        return this.options.defaults || {};
    }
    /**
     * Set the truncation strategy
     */
    setTruncationStrategy(strategy) {
        this.truncationStrategy = strategy;
        return this;
    }
    /**
     * Get a compiled template function
     * Performance-optimized with null safety
     */
    getCompiledTemplate() {
        // Return from instance if already compiled - performance optimization
        if (this.compiled) {
            return this.compiled;
        }
        // Check cache if enabled
        const cacheKey = `${this.template}:${this.options.version || 'latest'}`;
        if (this.options.cache) {
            // Use synchronous get method to avoid Promise complications
            try {
                // Ensure we get a non-Promise synchronous result
                const cached = templateCache.get(cacheKey);
                if (cached && typeof cached === 'function') {
                    // Store only if it's actually a function, not a Promise
                    this.compiled = cached;
                    return cached;
                }
            }
            catch (error) {
                // Fallback to compiling if cache retrieval fails
            }
        }
        // Compile the template - explicitly typed to ensure type safety
        const compiledTemplate = this.compileTemplate(this.template);
        this.compiled = compiledTemplate;
        // Cache if enabled - use try/catch for async operations
        if (this.options.cache && compiledTemplate) {
            try {
                templateCache.set(cacheKey, compiledTemplate);
            }
            catch (error) {
                // Ignore cache set errors
            }
        }
        return compiledTemplate;
    }
    /**
     * Compile a template string into a template function
     */
    compileTemplate(template) {
        // Simple implementation using string replacement
        // A more sophisticated implementation might use a proper template engine
        // Find all variable placeholders in the format {{variableName}}
        const variableRegex = /\{\{\s*([\w\.]+)\s*\}\}/g;
        const variables = new Set();
        let match;
        // Collect all variable names with null safety
        while ((match = variableRegex.exec(template)) !== null) {
            if (match[1]) { // Ensure match[1] is defined
                variables.add(match[1]);
            }
        }
        // Create compiled template function
        return (vars) => {
            let result = template;
            // Replace each variable placeholder with its value
            for (const variable of variables) {
                const parts = variable.split('.');
                // Get nested property value
                let value = vars;
                for (const part of parts) {
                    if (value === undefined || value === null) {
                        break;
                    }
                    value = value[part];
                }
                // Handle missing variables
                if (value === undefined || value === null) {
                    if (this.options.strictVariables) {
                        throw new ValidationError(`Missing variable: ${variable}`);
                    }
                    value = `{{${variable}}}`; // Keep placeholder for missing variables
                }
                // Convert non-string values to string
                if (typeof value !== 'string') {
                    if (value === null || value === undefined) {
                        value = ''; // Handle null/undefined as empty strings
                    }
                    else if (typeof value === 'object') {
                        value = JSON.stringify(value, null, 2);
                    }
                    else {
                        value = String(value);
                    }
                }
                // Replace all occurrences
                const regex = new RegExp(`\\{\\{\\s*${String(variable).replace('.', '\\.')}\\s*\\}\\}`, 'g');
                result = result.replace(regex, value);
            }
            return result;
        };
    }
    /**
     * Truncate variables based on the truncation strategy
     */
    async truncateVariables(variables) {
        if (!this.truncationStrategy || !this.options.maxTokens) {
            return variables;
        }
        // Get variable token counts
        const tokenCounts = new Map();
        let totalTokens = 0;
        for (const [key, value] of Object.entries(variables)) {
            if (typeof value === 'string' && value.length > 0) {
                const tokenCount = tokenCounter.countTokens(value, this.options.model);
                tokenCounts.set(key, tokenCount);
                totalTokens += tokenCount.tokens;
            }
        }
        // Estimate template overhead by rendering with empty strings
        const emptyVars = {};
        for (const key of Object.keys(variables)) {
            if (typeof variables[key] === 'string') {
                emptyVars[key] = '';
            }
            else {
                emptyVars[key] = variables[key];
            }
        }
        const compiled = this.getCompiledTemplate();
        const emptyRendered = compiled(emptyVars);
        const templateOverhead = tokenCounter.countTokens(emptyRendered, this.options.model).tokens;
        // If already under max tokens with overhead, return original variables
        if (totalTokens + templateOverhead <= this.options.maxTokens) {
            return variables;
        }
        // Calculate available tokens for variables
        const availableTokens = this.options.maxTokens - templateOverhead;
        // Sort variables by priority
        const prioritizedVars = Object.keys(variables)
            .filter(key => typeof variables[key] === 'string' && variables[key].length > 0)
            .sort((a, b) => {
            const priorityA = this.truncationStrategy?.priorities[a] || 0;
            const priorityB = this.truncationStrategy?.priorities[b] || 0;
            return priorityB - priorityA; // Higher priority first
        });
        // Allocate tokens based on priority and minimum requirements
        const allocations = new Map();
        let remainingTokens = availableTokens;
        // First pass: allocate minimum tokens
        for (const key of prioritizedVars) {
            const minTokens = this.truncationStrategy?.minimumTokens?.[key] || 0;
            allocations.set(key, minTokens);
            remainingTokens -= minTokens;
        }
        // Second pass: allocate remaining tokens by priority and proportion
        if (remainingTokens > 0) {
            // Sort by priority first then by proportion
            const proportionVars = [...prioritizedVars].sort((a, b) => {
                const priorityA = this.truncationStrategy?.priorities[a] || 0;
                const priorityB = this.truncationStrategy?.priorities[b] || 0;
                if (priorityA !== priorityB) {
                    return priorityB - priorityA; // Higher priority first
                }
                const proportionA = this.truncationStrategy?.proportions?.[a] || 0;
                const proportionB = this.truncationStrategy?.proportions?.[b] || 0;
                return proportionB - proportionA; // Higher proportion first
            });
            for (const key of proportionVars) {
                if (remainingTokens <= 0)
                    break;
                const proportion = this.truncationStrategy?.proportions?.[key] || 0;
                const currentCount = tokenCounts.get(key)?.tokens || 0;
                const currentAllocation = allocations.get(key) || 0;
                // Calculate target allocation based on proportion
                const targetAllocation = proportion > 0
                    ? Math.floor(availableTokens * proportion)
                    : currentCount;
                // Allocate up to target or remaining tokens
                const additionalAllocation = Math.min(Math.max(0, targetAllocation - currentAllocation), remainingTokens, currentCount - currentAllocation);
                allocations.set(key, currentAllocation + additionalAllocation);
                remainingTokens -= additionalAllocation;
            }
            // Final pass: distribute any remaining tokens to highest priority vars
            if (remainingTokens > 0) {
                for (const key of prioritizedVars) {
                    if (remainingTokens <= 0)
                        break;
                    const currentCount = tokenCounts.get(key)?.tokens || 0;
                    const currentAllocation = allocations.get(key) || 0;
                    if (currentAllocation < currentCount) {
                        const additionalAllocation = Math.min(remainingTokens, currentCount - currentAllocation);
                        allocations.set(key, currentAllocation + additionalAllocation);
                        remainingTokens -= additionalAllocation;
                    }
                }
            }
        }
        // Create truncated variables
        const truncatedVars = { ...variables };
        for (const [key, allocation] of allocations.entries()) {
            const currentCount = tokenCounts.get(key)?.tokens || 0;
            if (allocation < currentCount) {
                // Use custom truncate function if available
                if (this.truncationStrategy?.customTruncate?.[key]) {
                    truncatedVars[key] = this.truncationStrategy.customTruncate[key](variables[key], allocation);
                }
                else {
                    // Default truncation: keep beginning and end, drop middle
                    truncatedVars[key] = this.truncateText(variables[key], allocation, this.options.model);
                }
            }
        }
        return truncatedVars;
    }
    /**
     * Truncate text to fit within token limit
     */
    truncateText(text, maxTokens, model) {
        if (!text)
            return text;
        const { tokens } = tokenCounter.countTokens(text, model);
        if (tokens <= maxTokens) {
            return text;
        }
        // For very small allocations, just take the beginning
        if (maxTokens < 10) {
            let truncated = text.slice(0, maxTokens * 4); // Rough estimate: 4 chars per token
            while (tokenCounter.countTokens(truncated, model).tokens > maxTokens) {
                truncated = truncated.slice(0, Math.floor(truncated.length * 0.9));
            }
            return truncated + '...';
        }
        // For larger allocations, keep beginning and end, with middle truncated
        const frontRatio = 0.7; // 70% from beginning
        const backRatio = 0.3; // 30% from end
        // Initial estimates
        const frontTokens = Math.floor(maxTokens * frontRatio);
        const backTokens = Math.floor(maxTokens * backRatio);
        // Get the front chunk
        let frontText = text.slice(0, Math.floor(text.length * frontRatio));
        while (tokenCounter.countTokens(frontText, model).tokens > frontTokens) {
            frontText = frontText.slice(0, Math.floor(frontText.length * 0.9));
        }
        // Get the back chunk
        let backText = text.slice(Math.floor(text.length * (1 - backRatio)));
        while (tokenCounter.countTokens(backText, model).tokens > backTokens) {
            backText = backText.slice(Math.floor(backText.length * 0.1));
        }
        return frontText + ' [...] ' + backText;
    }
    /**
     * Emergency truncation of rendered template
     */
    emergencyTruncate(text, maxTokens) {
        const { tokens } = tokenCounter.countTokens(text, this.options.model);
        if (tokens <= maxTokens) {
            return text;
        }
        // Keep 80% from beginning, 20% from end
        const frontRatio = 0.8;
        // Initial estimates
        const frontTokens = Math.floor(maxTokens * frontRatio);
        const backTokens = maxTokens - frontTokens - 1; // -1 for ellipsis
        // Binary search for front text
        let frontText = '';
        let low = 0;
        let high = text.length * frontRatio;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            const chunk = text.slice(0, mid);
            const chunkTokens = tokenCounter.countTokens(chunk, this.options.model).tokens;
            if (chunkTokens <= frontTokens) {
                frontText = chunk;
                low = mid + 1;
            }
            else {
                high = mid - 1;
            }
        }
        // Binary search for back text
        let backText = '';
        low = text.length * (1 - 0.2);
        high = text.length;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            const chunk = text.slice(mid);
            const chunkTokens = tokenCounter.countTokens(chunk, this.options.model).tokens;
            if (chunkTokens <= backTokens) {
                backText = chunk;
                high = mid - 1;
            }
            else {
                low = mid + 1;
            }
        }
        return frontText + ' [...] ' + backText;
    }
}
/**
 * Create a template with predefined variables
 */
export function createTemplate(template, options = {}) {
    return new PromptTemplate(template, options);
}
/**
 * Predefined prompt templates
 */
export const templates = {
    /**
     * Standard agent system prompt template
     */
    agentSystem: createTemplate('# Agent Information\n' +
        'You are {{name}}, {{role}}.\n\n' +
        '## Your Task\n' +
        '{{task}}\n\n' +
        '## Your Goal\n' +
        '{{goal}}\n\n' +
        '{{#if backgroundInfo}}' +
        '## Background Information\n' +
        '{{backgroundInfo}}\n\n' +
        '{{/if}}' +
        '## Guidelines\n' +
        '- {{guidelines}}\n' +
        '- Always maintain professionalism and accuracy in your responses.\n' +
        '- If you do not know something or cannot provide accurate information, say so.\n', {
        maxTokens: 1000,
        defaults: {
            guidelines: 'Focus on providing relevant, concise, and accurate information.'
        }
    }),
    /**
     * Human message template for conversational prompts
     */
    humanMessage: createTemplate('{{content}}', { maxTokens: 8000 }),
    /**
     * Task execution template
     */
    taskExecution: createTemplate('# Task: {{taskName}}\n\n' +
        '## Objective\n' +
        '{{taskDescription}}\n\n' +
        '## Input Data\n' +
        '```\n{{taskInput}}\n```\n\n' +
        '{{#if taskContext}}' +
        '## Context\n' +
        '{{taskContext}}\n\n' +
        '{{/if}}' +
        '## Instructions\n' +
        'Please complete this task according to the objective. ' +
        'Provide your response in a clear and structured format.', {
        maxTokens: 4000,
        strictVariables: true
    }),
    /**
     * Crew orchestration template
     */
    crewOrchestration: createTemplate('# Crew Orchestration\n\n' +
        '## Crew Objective\n' +
        '{{crewObjective}}\n\n' +
        '## Available Agents\n' +
        '{{availableAgents}}\n\n' +
        '## Current Task\n' +
        '{{currentTask}}\n\n' +
        '## Progress So Far\n' +
        '{{progress}}\n\n' +
        '## Instructions\n' +
        'As the orchestrator, determine which agent should handle the current task ' +
        'and provide a plan for completing the crew objective.', { maxTokens: 3000 })
};
//# sourceMappingURL=promptTemplate.js.map