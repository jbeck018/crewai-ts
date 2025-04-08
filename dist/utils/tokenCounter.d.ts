/**
 * Token counter implementation
 * Optimized for accurate token counting with model-specific strategies
 */
export type ModelType = 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo' | 'claude-2' | 'claude-3' | 'gemini-pro' | 'llama' | 'mistral' | 'general';
export interface TokenCountResult {
    tokens: number;
    characters: number;
    model: ModelType;
}
/**
 * TokenCounter class for accurate token counting
 * Optimized for:
 * - Model-specific counting strategies
 * - Efficient caching for repeated texts
 * - Chunked processing for large inputs
 */
export declare class TokenCounter {
    private static instance;
    private tokenizers;
    /**
     * Get the singleton instance
     */
    static getInstance(): TokenCounter;
    private constructor();
    /**
     * Count tokens in text for a specific model
     */
    countTokens(text: string, model?: ModelType): TokenCountResult;
    /**
     * Count tokens in a message format that includes role and content
     */
    countMessageTokens(messages: Array<{
        role: string;
        content: string;
        name?: string;
    }>, model?: ModelType): TokenCountResult;
    /**
     * Initialize tokenizers for different models
     */
    private initializeTokenizers;
    /**
     * Get the appropriate tokenizer for a model
     */
    private getTokenizer;
    /**
     * Estimate GPT model tokens
     * Approximates tiktoken behavior
     */
    private estimateGptTokens;
    /**
     * Estimate Claude model tokens
     */
    private estimateClaudeTokens;
    /**
     * Estimate Gemini model tokens
     */
    private estimateGeminiTokens;
    /**
     * Estimate Llama model tokens
     */
    private estimateLlamaTokens;
    /**
     * Estimate Mistral model tokens
     */
    private estimateMistralTokens;
    /**
     * Estimate tokens for generic models
     */
    private estimateGenericTokens;
    /**
     * Generate a cache key for a text string
     * For very long strings, we hash a subset to avoid excessive memory usage
     */
    private generateCacheKey;
    /**
     * Update the token cache
     */
    private updateCache;
}
/**
 * Singleton instance for convenient access
 */
export declare const tokenCounter: TokenCounter;
//# sourceMappingURL=tokenCounter.d.ts.map