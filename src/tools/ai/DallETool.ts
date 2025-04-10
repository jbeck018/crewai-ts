/**
 * DALL-E Image Generation Tool
 * Provides optimized image generation capabilities for agents
 * with memory-efficient response handling and performance optimizations
 */

import { z } from 'zod';
import { createStructuredTool } from '../StructuredTool.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Optional OpenAI API types for better type safety if available
type OpenAIClient = any; // Placeholder for proper OpenAI API client type

/**
 * Result cache entry for optimized memory usage
 */
interface CachedResult {
  result: DallEResult;
  timestamp: number;
}

/**
 * LRU cache for DALL-E image results
 */
class DallEResultCache {
  private cache = new Map<string, CachedResult>();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize = 100, ttlMs = 3600000) { // 1 hour default
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  /**
   * Get a cached result if available and not expired
   */
  get(key: string): DallEResult | null {
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
  set(key: string, result: DallEResult): void {
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

// Input schema for DALL-E image generation
const dalleSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty").max(1000, "Prompt is too long"),
  model: z.enum([
    "dall-e-2", 
    "dall-e-3"
  ]).default("dall-e-3").optional(),
  n: z.number().int().min(1).max(10).default(1).optional(),
  size: z.enum([
    "256x256", 
    "512x512", 
    "1024x1024", 
    "1792x1024", 
    "1024x1792"
  ]).default("1024x1024").optional(),
  quality: z.enum(["standard", "hd"]).default("standard").optional(),
  style: z.enum(["vivid", "natural"]).default("vivid").optional(),
  response_format: z.enum(["url", "b64_json"]).default("url").optional(),
  save: z.boolean().default(false).optional(),
  saveDirectory: z.string().optional(),
});

// Type inference from zod schema
type DallEInput = z.infer<typeof dalleSchema>;

/**
 * DALL-E image generation response
 */
export interface DallEResult {
  /**
   * Array of generated images
   */
  images: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
    filePath?: string; // Local file path if saved
  }>;
  /**
   * Prompt that was used for generation
   */
  prompt: string;
  /**
   * Model used for generation
   */
  model: string;
  /**
   * Error message if generation failed
   */
  error?: string;
}

/**
 * Options for configuring the DallETool
 */
export interface DallEToolOptions {
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
   * Whether to cache results to reduce duplicate generations
   * @default true
   */
  cacheResults?: boolean;

  /**
   * Maximum size of the result cache
   * @default 100
   */
  maxCacheSize?: number;

  /**
   * Cache TTL in milliseconds
   * @default 3600000 (1 hour)
   */
  cacheTtl?: number;

  /**
   * Default save directory for images
   * @default './generated-images'
   */
  defaultSaveDirectory?: string;

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
 * Creates a hash for the given input for caching
 */
function createInputHash(input: DallEInput): string {
  const hash = crypto.createHash('md5');
  hash.update(JSON.stringify({
    prompt: input.prompt,
    model: input.model,
    n: input.n,
    size: input.size,
    quality: input.quality,
    style: input.style,
    // Exclude save options from hash as they don't affect generation
  }));
  return hash.digest('hex');
}

/**
 * Safely create a directory if it doesn't exist
 */
async function ensureDirectory(directoryPath: string): Promise<void> {
  try {
    await fs.mkdir(directoryPath, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Save the image data to a file
 */
async function saveImage(
  imageData: string | undefined,
  isBase64: boolean,
  directory: string,
  prompt: string
): Promise<string> {
  if (!imageData) {
    throw new Error('No image data provided');
  }
  
  // Create a safe filename based on the prompt
  const safePrompt = prompt
    .substring(0, 50)
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
    
  const timestamp = Date.now();
  const filename = `dalle_${safePrompt}_${timestamp}.png`;
  const filepath = path.join(directory, filename);
  
  // Ensure directory exists
  await ensureDirectory(directory);
  
  // Save the image
  if (isBase64) {
    // Convert base64 to buffer and save
    const buffer = Buffer.from(imageData, 'base64');
    await fs.writeFile(filepath, buffer);
  } else {
    // Download from URL and save
    const response = await fetch(imageData);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filepath, buffer);
  }
  
  return filepath;
}

/**
 * Creates an OpenAI API client instance with retry capabilities
 */
function createApiClient(options: DallEToolOptions): { client: any, apiRequest: Function } {
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
          return await client.createImage(body);
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
 * Creates a DALL-E image generation tool with optimized memory usage and performance
 */
export function createDallETool(options: DallEToolOptions = {}) {
  // Initialize result cache if enabled
  const resultCache = options.cacheResults !== false 
    ? new DallEResultCache(options.maxCacheSize, options.cacheTtl)
    : null;
  
  // Create API client with retry capabilities 
  const { apiRequest } = createApiClient(options);
  
  // Default save directory
  const defaultSaveDirectory = options.defaultSaveDirectory || './generated-images';
  
  return createStructuredTool({
    name: "dalle",
    description: "Generate images using DALL-E. Provide a detailed text description of the image you want to create.",
    inputSchema: dalleSchema,
    func: async (input: DallEInput): Promise<DallEResult> => {
      try {
        // Check cache first if enabled
        if (resultCache) {
          const cacheKey = createInputHash(input);
          const cachedResult = resultCache.get(cacheKey);
          if (cachedResult) {
            return cachedResult;
          }
        }
        
        // Prepare request to OpenAI API
        const requestBody = {
          prompt: input.prompt,
          model: input.model || 'dall-e-3',
          n: input.n || 1,
          size: input.size || '1024x1024',
          quality: input.quality || 'standard',
          style: input.style || 'vivid',
          response_format: input.response_format || 'url',
        };
        
        // Call OpenAI API with retry handling
        const response = await apiRequest('/images/generations', requestBody);
        
        // Process the response
        const images = await Promise.all((response.data || []).map(async (image: any) => {
          const result: { url?: string; b64_json?: string; revised_prompt?: string; filePath?: string } = {
            revised_prompt: image.revised_prompt,
          };
          
          // Store image data according to response format
          if (input.response_format === 'b64_json') {
            result.b64_json = image.b64_json;
          } else {
            result.url = image.url;
          }
          
          // Save image to file if requested
          if (input.save) {
            const saveDir = input.saveDirectory || defaultSaveDirectory;
            const isBase64 = input.response_format === 'b64_json';
            const imageData = isBase64 ? image.b64_json : image.url;
            
            try {
              result.filePath = await saveImage(imageData, isBase64, saveDir, input.prompt);
            } catch (error) {
              console.error('Failed to save image:', error);
              // Continue without saving if there's an error
            }
          }
          
          return result;
        }));
        
        // Construct final result
        const result: DallEResult = {
          images,
          prompt: input.prompt,
          model: input.model || 'dall-e-3',
        };
        
        // Cache result if caching is enabled
        if (resultCache) {
          const cacheKey = createInputHash(input);
          resultCache.set(cacheKey, result);
        }
        
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          images: [],
          prompt: input.prompt,
          model: input.model || 'dall-e-3',
          error: `Image generation failed: ${errorMessage}`
        };
      }
    }
  });
}
