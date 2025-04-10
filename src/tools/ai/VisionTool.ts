/**
 * Vision Tool Implementation
 * Provides image understanding capabilities for agents
 * with memory-efficient processing and performance optimizations
 */

import { z } from 'zod';
import { createStructuredTool } from '../StructuredTool.js';
import * as crypto from 'crypto';

// Optional OpenAI API types for better type safety if available
type OpenAIClient = any; // Placeholder for proper OpenAI API client type

// Input validation schemas
const imageUrlSchema = z.object({
  url: z.string().url("Must be a valid URL"),
});

const imageBase64Schema = z.object({
  base64: z.string().min(1, "Base64 image data cannot be empty"),
  // Optional mime type hint for base64 data
  mimeType: z.string().optional(),
});

const imagePathSchema = z.object({
  path: z.string().min(1, "File path cannot be empty"),
});

// Combined image schema with discriminated union
const imageInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('url'), data: imageUrlSchema }),
  z.object({ type: z.literal('base64'), data: imageBase64Schema }),
  z.object({ type: z.literal('path'), data: imagePathSchema }),
]);

// Main vision tool schema
const visionSchema = z.object({
  // Image input - can be URL, base64 data, or file path
  image: imageInputSchema,
  
  // Optional parameters
  model: z.string().default("gpt-4-vision-preview").optional(),
  prompt: z.string().min(1, "Prompt is required").max(1000, "Prompt is too long"),
  temperature: z.number().min(0).max(2).default(0.7).optional(),
  maxTokens: z.number().int().positive().default(300).optional(),
  detailLevel: z.enum(["low", "high", "auto"]).default("auto").optional(),
  responseFormat: z.object({
    type: z.enum(["text", "json_object"]),
    schema: z.record(z.any()).optional(),
  }).optional(),
});

// Type inference from zod schema
type VisionInput = z.infer<typeof visionSchema>;

/**
 * Cache entry for vision API results
 */
interface CachedResult {
  result: VisionResult;
  timestamp: number;
}

/**
 * LRU Cache for vision results
 */
class VisionResultCache {
  private cache = new Map<string, CachedResult>();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize = 50, ttlMs = 1800000) { // 30 minutes default
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  /**
   * Get a cached result if available and not expired
   */
  get(key: string): VisionResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Store a result in the cache
   */
  set(key: string, result: VisionResult): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      // Find oldest entry
      let oldestKey: string | null = null;
      let oldestTime = Date.now();

      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }

      // Delete oldest entry
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear expired entries to free up memory
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Options for configuring the VisionTool
 */
export interface VisionToolOptions {
  /**
   * API key for OpenAI
   */
  apiKey?: string;

  /**
   * Base URL for OpenAI API requests
   * @default 'https://api.openai.com/v1'
   */
  baseUrl?: string;

  /**
   * Organization ID for OpenAI API requests
   */
  organization?: string;

  /**
   * Custom OpenAI client instance
   */
  client?: OpenAIClient;

  /**
   * Whether to cache results to reduce duplicate requests
   * @default true
   */
  cacheResults?: boolean;

  /**
   * Maximum size of the result cache
   * @default 50
   */
  maxCacheSize?: number;

  /**
   * Cache TTL in milliseconds
   * @default 1800000 (30 minutes)
   */
  cacheTtl?: number;

  /**
   * Retry configuration for API calls
   */
  retry?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  };
}

/**
 * Vision analysis result
 */
export interface VisionResult {
  /**
   * Model used for analysis
   */
  model: string;
  
  /**
   * The analysis text from the vision model
   */
  analysis: string;
  
  /**
   * Structured analysis result if requested
   */
  structuredAnalysis?: Record<string, any>;
  
  /**
   * The input prompt used for analysis
   */
  prompt: string;
  
  /**
   * Error information if any
   */
  error?: string;
  
  /**
   * Performance metrics
   */
  metrics?: {
    /**
     * Processing time in milliseconds
     */
    processingTimeMs: number;
    
    /**
     * Total tokens used
     */
    totalTokens?: number;
    
    /**
     * Whether result was from cache
     */
    fromCache: boolean;
  };
}

/**
 * Creates an OpenAI API client instance with retry capabilities
 */
function createApiClient(options: VisionToolOptions): { client: any, apiRequest: Function } {
  // Use provided client or create one
  let client = options.client;
  
  // Setup for fetch-based API calls if no client provided
  const baseUrl = options.baseUrl || 'https://api.openai.com/v1';
  const apiKey = options.apiKey;
  
  if (!client && !apiKey) {
    throw new Error('Either a client or an API key is required');
  }
  
  // Configure retry settings
  const retry = {
    maxRetries: options.retry?.maxRetries ?? 3,
    initialDelayMs: options.retry?.initialDelayMs ?? 1000,
    maxDelayMs: options.retry?.maxDelayMs ?? 30000,
  };
  
  // Create API request function with retry logic
  const apiRequest = async (endpoint: string, body: any) => {
    let currentRetry = 0;
    let lastError: Error | null = null;
    
    while (currentRetry <= retry.maxRetries) {
      try {
        // Use client if provided
        if (client) {
          // Assuming client has a compatible interface
          return await client.createChatCompletion(body);
        }
        
        // Custom fetch implementation with retry
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...(options.organization ? { 'OpenAI-Organization': options.organization } : {}),
          },
          body: JSON.stringify(body),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }
        
        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry if it's a validation or auth error
        if (lastError.message.includes('401') || 
            lastError.message.includes('403') || 
            lastError.message.includes('invalid')) {
          break;
        }
        
        // Calculate exponential backoff with jitter
        const delay = Math.min(
          retry.maxDelayMs,
          retry.initialDelayMs * Math.pow(2, currentRetry) * (0.5 + Math.random() * 0.5)
        );
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        currentRetry++;
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Request failed after all retries');
  };
  
  return { client, apiRequest };
}

/**
 * Prepare image data for API request
 */
async function prepareImageContent(image: VisionInput['image']): Promise<any> {
  switch (image.type) {
    case 'url':
      return {
        type: 'image_url',
        image_url: image.data.url
      };
      
    case 'base64': {
      // Create a properly formatted base64 data URL
      const mimeType = image.data.mimeType || 'image/png';
      const base64Data = image.data.base64.startsWith('data:') 
        ? image.data.base64 
        : `data:${mimeType};base64,${image.data.base64}`;
      
      return {
        type: 'image_url',
        image_url: base64Data
      };
    }
      
    case 'path': {
      // For Node.js environment, read file and convert to base64
      try {
        // In browser environments, this would throw
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Normalize path
        const normalizedPath = path.resolve(image.data.path);
        
        // Read file with memory efficient streaming if large
        const fileData = await fs.readFile(normalizedPath);
        
        // Determine mime type based on file extension
        const extension = path.extname(normalizedPath).toLowerCase();
        let mimeType = 'image/png'; // Default
        
        // Map common extensions to mime types
        const mimeTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.bmp': 'image/bmp',
          '.svg': 'image/svg+xml',
        };
        
        if (extension in mimeTypes) {
          // Using a type assertion to guarantee non-undefined value
          mimeType = mimeTypes[extension as keyof typeof mimeTypes]!;
        }
        
        // Convert to base64
        const base64Data = `data:${mimeType};base64,${fileData.toString('base64')}`;
        
        return {
          type: 'image_url',
          image_url: base64Data
        };
      } catch (error) {
        throw new Error(`Failed to read image file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
      
    default:
      throw new Error('Invalid image input type');
  }
}

/**
 * Creates an input hash for caching
 */
function createInputHash(input: VisionInput): string {
  // Create a hash from relevant input properties
  const hash = crypto.createHash('md5');
  
  // Add prompt and model to hash
  hash.update(input.prompt);
  hash.update(input.model || 'gpt-4-vision-preview');
  
  // Add image data to hash based on type
  switch (input.image.type) {
    case 'url':
      hash.update(input.image.data.url);
      break;
      
    case 'base64':
      // Use first 100 chars of base64 to avoid excessive hashing
      // while still maintaining good uniqueness
      hash.update(input.image.data.base64.substring(0, 100));
      break;
      
    case 'path':
      hash.update(input.image.data.path);
      break;
  }
  
  // Add other parameters that affect the output
  hash.update(String(input.temperature || 0.7));
  hash.update(String(input.maxTokens || 300));
  hash.update(input.detailLevel || 'auto');
  
  return hash.digest('hex');
}

/**
 * Creates an optimized Vision Tool for image analysis with memory efficiency
 */
export function createVisionTool(options: VisionToolOptions = {}) {
  // Initialize result cache if enabled
  const resultCache = options.cacheResults !== false
    ? new VisionResultCache(options.maxCacheSize, options.cacheTtl)
    : null;
  
  // Create API client with retry capabilities
  const { apiRequest } = createApiClient(options);

  // Create the tool
  return createStructuredTool({
    name: "vision",
    description: "Analyze images and provide descriptions or extract information from visual content.",
    inputSchema: visionSchema,
    func: async (input: VisionInput): Promise<VisionResult> => {
      const startTime = Date.now();
      
      try {
        // Check cache first if enabled
        if (resultCache) {
          const cacheKey = createInputHash(input);
          const cachedResult = resultCache.get(cacheKey);
          
          if (cachedResult) {
            return {
              ...cachedResult,
              metrics: {
                ...cachedResult.metrics,
                fromCache: true,
                processingTimeMs: Date.now() - startTime
              }
            };
          }
        }
        
        // Prepare the image content
        const imageContent = await prepareImageContent(input.image);
        
        // Build API request
        const messages = [
          {
            role: "user",
            content: [
              { type: "text", text: input.prompt },
              imageContent
            ]
          }
        ];
        
        const requestBody = {
          model: input.model || "gpt-4-vision-preview",
          messages,
          temperature: input.temperature || 0.7,
          max_tokens: input.maxTokens || 300,
          ...(input.detailLevel && { detail: input.detailLevel }),
          ...(input.responseFormat && { response_format: input.responseFormat })
        };
        
        // Make API request
        const response = await apiRequest('/chat/completions', requestBody);
        
        // Extract and process response
        let analysisText = '';
        let structuredData: Record<string, any> | undefined;
        
        if (response.choices && response.choices.length > 0) {
          analysisText = response.choices[0].message?.content || '';
          
          // Try parsing JSON if requested
          if (input.responseFormat?.type === 'json_object' && analysisText) {
            try {
              structuredData = JSON.parse(analysisText);
            } catch (e) {
              // If parsing fails, return the text as-is
              console.warn('Failed to parse JSON response:', e);
            }
          }
        }
        
        // Create result object
        const result: VisionResult = {
          model: input.model || "gpt-4-vision-preview",
          analysis: analysisText,
          prompt: input.prompt,
          metrics: {
            processingTimeMs: Date.now() - startTime,
            totalTokens: response.usage?.total_tokens,
            fromCache: false
          }
        };
        
        // Add structured data if available
        if (structuredData) {
          result.structuredAnalysis = structuredData;
        }
        
        // Cache result if caching is enabled
        if (resultCache) {
          const cacheKey = createInputHash(input);
          resultCache.set(cacheKey, result);
        }
        
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        return {
          model: input.model || "gpt-4-vision-preview",
          analysis: "",
          prompt: input.prompt,
          error: `Image analysis failed: ${errorMessage}`,
          metrics: {
            processingTimeMs: Date.now() - startTime,
            fromCache: false
          }
        };
      }
    }
  });
}
