/**
 * Token counter implementation
 * Optimized for accurate token counting with model-specific strategies
 */
// Cache of previously counted strings to avoid recounting
const tokenCache = new Map();
const MAX_CACHE_SIZE = 10000;
/**
 * TokenCounter class for accurate token counting
 * Optimized for:
 * - Model-specific counting strategies
 * - Efficient caching for repeated texts
 * - Chunked processing for large inputs
 */
export class TokenCounter {
    static instance;
    tokenizers = {};
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!TokenCounter.instance) {
            TokenCounter.instance = new TokenCounter();
        }
        return TokenCounter.instance;
    }
    constructor() {
        // Initialize tokenizers
        this.initializeTokenizers();
    }
    /**
     * Count tokens in text for a specific model
     */
    countTokens(text, model = 'general') {
        // Generate a cache key
        const cacheKey = `${model}:${this.generateCacheKey(text)}`;
        // Check cache first
        if (tokenCache.has(cacheKey)) {
            return tokenCache.get(cacheKey);
        }
        // Get appropriate tokenizer
        const tokenizer = this.getTokenizer(model);
        // Count tokens
        const tokens = tokenizer(text);
        // Create result
        const result = {
            tokens,
            characters: text.length,
            model
        };
        // Update cache
        this.updateCache(cacheKey, result);
        return result;
    }
    /**
     * Count tokens in a message format that includes role and content
     */
    countMessageTokens(messages, model = 'gpt-3.5-turbo') {
        // OpenAI message tokens include formatting overhead
        let totalTokens = 0;
        let totalChars = 0;
        // Different models have different message formatting
        const isOpenAI = model.startsWith('gpt');
        const isClaude = model.startsWith('claude');
        if (isOpenAI) {
            // OpenAI uses a specific message formatting with tokens for roles
            // 3 tokens for message formatting
            totalTokens += 3;
            for (const message of messages) {
                // Each message has a base overhead (4 for role, format, etc.)
                totalTokens += 4;
                // Name field adds overhead if present
                if (message.name) {
                    totalTokens += 1; // name indicator token
                    totalTokens += this.countTokens(message.name, model).tokens;
                }
                // Content tokens
                totalTokens += this.countTokens(message.content, model).tokens;
                totalChars += message.content.length;
            }
        }
        else if (isClaude) {
            // Claude uses different message formatting overhead
            // Base overhead for conversation
            totalTokens += 2;
            for (const message of messages) {
                // Role prefix adds some overhead
                totalTokens += 2;
                // Content tokens
                totalTokens += this.countTokens(message.content, model).tokens;
                totalChars += message.content.length;
            }
        }
        else {
            // Generic handling for other models
            for (const message of messages) {
                // Simple concatenation approach
                const rolePrefix = `${message.role}: `;
                totalTokens += this.countTokens(rolePrefix + message.content, model).tokens;
                totalChars += message.content.length + rolePrefix.length;
            }
        }
        return {
            tokens: totalTokens,
            characters: totalChars,
            model
        };
    }
    /**
     * Initialize tokenizers for different models
     */
    initializeTokenizers() {
        // GPT models use tiktoken or similar
        this.tokenizers['gpt-3.5-turbo'] = this.estimateGptTokens;
        this.tokenizers['gpt-4'] = this.estimateGptTokens;
        this.tokenizers['gpt-4-turbo'] = this.estimateGptTokens;
        // Claude models
        this.tokenizers['claude-2'] = this.estimateClaudeTokens;
        this.tokenizers['claude-3'] = this.estimateClaudeTokens;
        // Gemini
        this.tokenizers['gemini-pro'] = this.estimateGeminiTokens;
        // Llama
        this.tokenizers['llama'] = this.estimateLlamaTokens;
        // Mistral
        this.tokenizers['mistral'] = this.estimateMistralTokens;
        // General fallback
        this.tokenizers['general'] = this.estimateGenericTokens;
    }
    /**
     * Get the appropriate tokenizer for a model
     */
    getTokenizer(model) {
        // Ensure we always return a valid function with null safety
        return this.tokenizers[model] || this.tokenizers['general'] || ((text) => Math.ceil(text.length / 4));
    }
    /**
     * Estimate GPT model tokens
     * Approximates tiktoken behavior
     */
    estimateGptTokens(text) {
        // This is a simplified approximation
        // In production, use a proper tokenizer like tiktoken or GPT-3 Tokenizer
        // or split into subtokens based on BPE vocabulary
        // Very rough approximation: ~4 chars per token for English text
        return Math.ceil(text.length / 4);
    }
    /**
     * Estimate Claude model tokens
     */
    estimateClaudeTokens(text) {
        // Claude also uses BPE similar to GPT models
        // Approximately 4 chars per token for English text
        return Math.ceil(text.length / 4);
    }
    /**
     * Estimate Gemini model tokens
     */
    estimateGeminiTokens(text) {
        // Gemini uses SentencePiece tokenization
        // Approximately 5 chars per token for English text
        return Math.ceil(text.length / 5);
    }
    /**
     * Estimate Llama model tokens
     */
    estimateLlamaTokens(text) {
        // Llama uses a BPE tokenizer
        // Approximately 4.5 chars per token for English text
        return Math.ceil(text.length / 4.5);
    }
    /**
     * Estimate Mistral model tokens
     */
    estimateMistralTokens(text) {
        // Mistral uses a variant of BPE
        // Approximately 4.5 chars per token for English text
        return Math.ceil(text.length / 4.5);
    }
    /**
     * Estimate tokens for generic models
     */
    estimateGenericTokens(text) {
        // Generic fallback - more conservative estimate
        // For safety, we use a lower chars-per-token ratio
        return Math.ceil(text.length / 3.5);
    }
    /**
     * Generate a cache key for a text string
     * For very long strings, we hash a subset to avoid excessive memory usage
     */
    generateCacheKey(text) {
        // For short strings, use the text directly
        if (text.length < 100) {
            return text;
        }
        // For longer strings, use the first 50 and last 50 chars plus length
        // This is a simplified approach - in production, consider using a proper hash function
        const prefix = text.substring(0, 50);
        const suffix = text.substring(text.length - 50);
        return `${prefix}...${text.length}...${suffix}`;
    }
    /**
     * Update the token cache
     */
    updateCache(key, result) {
        // If cache is full, remove oldest entries (simplified LRU)
        if (tokenCache.size >= MAX_CACHE_SIZE) {
            // Remove a batch of old entries (10% of max size)
            const entriesToRemove = Math.ceil(MAX_CACHE_SIZE * 0.1);
            const keys = Array.from(tokenCache.keys()).slice(0, entriesToRemove);
            for (const key of keys) {
                tokenCache.delete(key);
            }
        }
        tokenCache.set(key, result);
    }
}
/**
 * Singleton instance for convenient access
 */
export const tokenCounter = TokenCounter.getInstance();
//# sourceMappingURL=tokenCounter.js.map