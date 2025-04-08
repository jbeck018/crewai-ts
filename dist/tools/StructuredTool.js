/**
 * StructuredTool implementation
 * Provides a tool with structured input and output validation
 * Optimized with performance-focused validation and schema generation
 */
import { Tool } from './BaseTool.js';
/**
 * StructuredTool class for creating tools with structured schema validation
 * Optimized for:
 * - Type safety with zod schema validation
 * - Performance-optimized validation
 * - Function-based tool creation
 */
export class StructuredTool extends Tool {
    func;
    outputSchema;
    constructor(options) {
        super({
            name: options.name,
            description: options.description,
            schema: options.inputSchema,
            verbose: options.verbose,
            cacheResults: options.cacheResults,
            timeout: options.timeout,
            maxRetries: options.maxRetries,
            tags: options.tags,
        });
        this.func = options.func;
        this.outputSchema = options.outputSchema;
    }
    /**
     * Execute the tool with the given input
     * Validates both input (handled by base class) and output
     */
    async _execute(input, options) {
        // Execute the function
        const result = await this.func(input, options);
        // Validate output if schema provided
        if (this.outputSchema) {
            try {
                return this.outputSchema.parse(result);
            }
            catch (error) {
                throw new Error(`Invalid output: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return result;
    }
}
/**
 * Create a structured tool from a function
 * Factory function optimized for ease of use
 */
export function createStructuredTool(options) {
    return new StructuredTool(options);
}
//# sourceMappingURL=StructuredTool.js.map