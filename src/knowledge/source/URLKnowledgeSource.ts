/**
 * URL Knowledge Source
 * Process web content as knowledge sources with optimized fetching and streaming
 */

import { BaseKnowledgeSource, KnowledgeSourceOptions } from './BaseKnowledgeSource.js';
import { KnowledgeChunk, Metadata } from '../types.js';

interface RequestCache {
  [url: string]: {
    etag?: string;
    lastModified?: string;
    content?: string;
    timestamp: number;
  }
}

/**
 * Options specific to URL knowledge sources
 */
export interface URLKnowledgeSourceOptions extends KnowledgeSourceOptions {
  /**
   * URL or array of URLs to fetch
   */
  url: string | string[];

  /**
   * Additional request headers
   */
  headers?: Record<string, string>;

  /**
   * Enable request caching with ETag and Last-Modified
   * @default true
   */
  enableCaching?: boolean;

  /**
   * Cache TTL in milliseconds
   * @default 3600000 (1 hour)
   */
  cacheTTL?: number;

  /**
   * Additional metadata to attach to all chunks
   */
  metadata?: Metadata;

  /**
   * Follow URLs found in content (depth of crawling)
   * @default 0 (no following)
   */
  followDepth?: number;

  /**
   * Request timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Maximum retries for failed requests
   * @default 3
   */
  maxRetries?: number;

  /**
   * Retry delay in milliseconds (base value for exponential backoff)
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Rate limit in milliseconds (minimum time between requests)
   * @default 100
   */
  rateLimit?: number;

  /**
   * Extract text from HTML
   * @default true
   */
  extractText?: boolean;

  /**
   * Include CSS selectors to prioritize in HTML extraction (e.g., 'article', '.content')
   */
  includeSelectors?: string[];

  /**
   * Exclude CSS selectors from HTML extraction (e.g., 'nav', 'footer', '.ads')
   */
  excludeSelectors?: string[];
  
  /**
   * Restrict URL following to specific domains
   */
  restrictToDomains?: string[];
}

/**
 * Knowledge source for processing web content
 * Optimized for efficient fetching, caching, and content extraction
 */
export class URLKnowledgeSource extends BaseKnowledgeSource {
  /**
   * URLs to process
   * @private
   */
  private urls: string[];

  /**
   * Configured URL options with defaults
   * @private
   */
  private urlOptions: Required<Omit<URLKnowledgeSourceOptions, keyof KnowledgeSourceOptions>> & {
    // Explicitly type fields that cause type errors
    url: string;
    includeSelectors: string[];
    excludeSelectors: string[];
    restrictToDomains: string[];
    headers: Record<string, string>;
  };

  /**
   * Request cache for ETag and Last-Modified based caching
   * @private
   */
  private requestCache: RequestCache = {};

  /**
   * Timestamp of last request (for rate limiting)
   * @private
   */
  private lastRequestTime = 0;

  /**
   * Constructor for URLKnowledgeSource
   * @param options - Configuration options
   */
  constructor(options: URLKnowledgeSourceOptions) {
    super(typeof options.url === 'string' ? options.url : 'multiple-urls', {
      ...options,
      metadata: options.metadata || {}
    });

    // Convert single URL to array for consistent processing with type safety
    this.urls = Array.isArray(options.url) 
      ? options.url.filter(Boolean) // Filter out any undefined or null values
      : (options.url ? [options.url] : []);
      
    // Ensure we have at least one URL for type safety
    if (this.urls.length === 0) {
      this.urls = ['placeholder-url'];
      console.warn('No valid URLs provided to URLKnowledgeSource');
    }

    // Set default options with safe fallbacks for type safety
    // Ensure the url field is properly assigned with a valid string value
    // We've already ensured this.urls has at least one element
    // Ensure we have a valid URL string with fallback
    const defaultUrl = (this.urls && this.urls.length > 0) ? this.urls[0] : 'empty-url';
    
    this.urlOptions = {
      url: defaultUrl || 'empty-url', // Ensure we always have a valid string value
      headers: options.headers ?? {},
      enableCaching: options.enableCaching !== false,
      cacheTTL: options.cacheTTL || 3600000, // 1 hour default
      followDepth: options.followDepth || 0,
      timeout: options.timeout || 30000, // 30 seconds default
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      rateLimit: options.rateLimit || 100,
      extractText: options.extractText !== false,
      includeSelectors: options.includeSelectors || [],
      excludeSelectors: options.excludeSelectors || [],
      restrictToDomains: [] // Add missing field for type safety
    };
  }

  /**
   * Process and add all URLs to storage
   * Implements efficient fetching with caching and rate limiting
   * @override
   */
  override async add(): Promise<void> {
    if (!this._storage) {
      throw new Error('Storage not set for URLKnowledgeSource');
    }

    // Process URLs with concurrency control
    const { maxConcurrency } = this.options;
    const processed = new Set<string>(); // Track processed URLs to avoid duplicates

    // Initial URLs to process
    const urlQueue = [...this.urls];
    
    while (urlQueue.length > 0) {
      // Process URLs in batches based on concurrency limit
      const batch = urlQueue.splice(0, Math.min(maxConcurrency, urlQueue.length));
      const uniqueBatch = batch.filter(url => !processed.has(url));
      
      // Mark as processed
      uniqueBatch.forEach(url => processed.add(url));
      
      // Process batch concurrently
      const batchResults = await Promise.allSettled(
        uniqueBatch.map(url => this.processURL(url, 0))
      );
      
      // Extract additional URLs to follow if configured
      if (this.urlOptions.followDepth > 0) {
        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i];
          if (result && result.status === 'fulfilled') {
            const fulfilledResult = result as PromiseFulfilledResult<{ urls?: string[] }>;
            // Check if we have URLs to follow
            if (fulfilledResult.value.urls && fulfilledResult.value.urls.length > 0) {
              // Add new URLs that haven't been processed yet
              const newUrls = fulfilledResult.value.urls.filter(url => 
                !processed.has(url) && !urlQueue.includes(url)
              );
              urlQueue.push(...newUrls);
            }
          }
        }
      }
    }
  }

  /**
   * Create a knowledge chunk from URL content with URL-specific metadata
   * @param content - Content for the chunk
   * @param additionalMetadata - Additional metadata or source URL
   * @returns Knowledge chunk object
   * @private
   */
  protected override createChunk(content: string, additionalMetadata?: Metadata | string): KnowledgeChunk {
    // Handle string parameter (url) for backward compatibility
    const url = typeof additionalMetadata === 'string' ? additionalMetadata : undefined;
    const metadataObj = typeof additionalMetadata === 'object' ? additionalMetadata : {};
    
    // Use the provided URL or default source
    const source = url || this.source;
    
    // Extract domain for metadata
    let domain = '';
    try {
      domain = new URL(source).hostname;
    } catch (e) {
      // Invalid URL, use source as is
    }
    
    return {
      id: this.generateChunkId(content),
      content: content.trim(),
      source,
      metadata: {
        source,
        domain,
        url: source,
        ...this.options.metadata,
        ...metadataObj
      }
    };
  }

  /**
   * Process a single URL
   * Implements caching, rate limiting, and retry logic
   * @param url - URL to process
   * @param depth - Current crawl depth
   * @private
   */
  private async processURL(url: string, depth: number): Promise<{ urls?: string[] }> {
    if (!this._storage) {
      return {};
    }

    // Respect rate limiting
    await this.applyRateLimit();

    try {
      // Apply caching logic
      const { content, foundUrls } = await this.fetchWithRetry(url);
      
      if (!content) {
        return {};
      }

      // Process content
      let processedContent = content;
      
      // Extract text from HTML if enabled
      if (this.urlOptions.extractText && this.isHtml(content)) {
        processedContent = this.extractTextFromHtml(content);
      }

      // Split content into chunks
      const textChunks = this.splitIntoChunks(processedContent);
      
      // Create chunks with proper type handling for URL
      const knowledgeChunks = textChunks.map(text => {
        // Ensure URL is always a valid string
        const safeUrl = url || 'unknown-url';
        return this.createChunk(text, safeUrl);
      });
      
      // Add to storage
      await this._storage.addChunks(knowledgeChunks);

      // Return URLs to follow if within follow depth
      if (depth < this.urlOptions.followDepth) {
        return { urls: foundUrls };
      }

      return {};
    } catch (error) {
      console.error(`Error processing URL ${url}:`, error);
      return {};
    }
  }

  /**
   * Fetch URL content with retry logic and caching
   * @param url - URL to fetch
   * @returns Content and found URLs
   * @private
   */
  private async fetchWithRetry(url: string): Promise<{ content: string, foundUrls: string[] }> {
    let retries = 0;
    let lastError: Error | null = null;

    while (retries <= this.urlOptions.maxRetries) {
      try {
        return await this.fetchWithCaching(url);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries++;
        
        if (retries <= this.urlOptions.maxRetries) {
          // Exponential backoff
          const delay = this.urlOptions.retryDelay * Math.pow(2, retries - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error(`Failed to fetch ${url} after ${this.urlOptions.maxRetries} retries:`, lastError);
    return { content: '', foundUrls: [] };
  }

  /**
   * Fetch URL with caching support
   * @param url - URL to fetch
   * @returns Content and found URLs
   * @private
   */
  private async fetchWithCaching(url: string): Promise<{ content: string, foundUrls: string[] }> {
    // Update last request time for rate limiting
    this.lastRequestTime = Date.now();

    // Check cache first if enabled
    if (this.urlOptions.enableCaching && this.requestCache[url]) {
      const cache = this.requestCache[url];
      const age = Date.now() - cache.timestamp;
      
      // Return cached content if fresh
      if (age < this.urlOptions.cacheTTL && cache.content) {
        return { content: cache.content, foundUrls: [] };
      }
    }

    // Prepare headers with conditional requests
    const headers: Record<string, string> = { ...this.urlOptions.headers };
    
    // Add conditional request headers if cached
    if (this.urlOptions.enableCaching && this.requestCache[url]) {
      const cache = this.requestCache[url];
      if (cache.etag) {
        headers['If-None-Match'] = cache.etag;
      }
      if (cache.lastModified) {
        headers['If-Modified-Since'] = cache.lastModified;
      }
    }

    // Fetch the URL
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(this.urlOptions.timeout)
    });

    // Handle 304 Not Modified
    if (response.status === 304 && this.requestCache[url]?.content) {
      // Update cache timestamp
      this.requestCache[url].timestamp = Date.now();
      return { content: this.requestCache[url].content!, foundUrls: [] };
    }

    // Handle other status codes
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    // Get content
    const content = await response.text();
    const foundUrls: string[] = [];

    // Extract URLs for crawling if needed
    if (this.urlOptions.followDepth > 0 && this.isHtml(content)) {
      foundUrls.push(...this.extractUrls(content, url));
    }

    // Update cache
    if (this.urlOptions.enableCaching) {
      this.requestCache[url] = {
        etag: response.headers.get('etag') || undefined,
        lastModified: response.headers.get('last-modified') || undefined,
        content,
        timestamp: Date.now()
      };
    }

    return { content, foundUrls };
  }

  /**
   * Apply rate limiting
   * Ensures minimum time between requests
   * @private
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    if (elapsed < this.urlOptions.rateLimit) {
      const delay = this.urlOptions.rateLimit - elapsed;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Check if content is HTML
   * @param content - Content to check
   * @returns True if content appears to be HTML
   * @private
   */
  private isHtml(content: string): boolean {
    const trimmed = content.trim().toLowerCase();
    return trimmed.startsWith('<!doctype html>') || 
           trimmed.startsWith('<html') || 
           (trimmed.includes('<body') && trimmed.includes('</body>'));
  }

  /**
   * Extract text content from HTML
   * Implements efficient HTML parsing with selector support
   * @param htmlContent - HTML content
   * @returns Extracted text
   * @private
   */
  private extractTextFromHtml(htmlContent: string): string {
    // This is a simplified version for demonstration
    // In a real implementation, use a library like jsdom, cheerio, or linkedom
    // for more accurate HTML parsing with CSS selector support
    
    let text = htmlContent;

    // Remove scripts
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    
    // Remove styles
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    
    // Remove other unwanted elements (nav, footer, etc. based on exclude selectors)
    for (const selector of this.urlOptions.excludeSelectors) {
      // Very basic implementation - in real code, use a proper HTML parser
      // This is just a placeholder that won't work for all cases
      const regex = new RegExp(`<${selector}\b[^>]*>([\s\S]*?)<\/${selector}>`, 'gi');
      text = text.replace(regex, ' ');
    }
    
    // Extract content from prioritized selectors if specified
    if (this.urlOptions.includeSelectors.length > 0) {
      let extractedContent = '';
      
      for (const selector of this.urlOptions.includeSelectors) {
        // Very basic implementation - in real code, use a proper HTML parser
        // This is just a placeholder that won't work for all cases
        const regex = new RegExp(`<${selector}\b[^>]*>([\s\S]*?)<\/${selector}>`, 'gi');
        const matches = text.matchAll(regex);
        
        for (const match of matches) {
          if (match[1]) {
            extractedContent += match[1] + '\n\n';
          }
        }
      }
      
      // Use extracted content if found, otherwise use the whole document
      if (extractedContent.trim()) {
        text = extractedContent;
      }
    }
    
    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ');
    
    return text.trim();
  }

  /**
   * Extract URLs from HTML content
   * @param htmlContent - HTML content
   * @param baseUrl - Base URL for resolving relative URLs
   * @returns Array of absolute URLs
   * @private
   */
  private extractUrls(htmlContent: string, baseUrl: string): string[] {
    const urls = new Set<string>();
    
    if (!htmlContent || !baseUrl) {
      return Array.from(urls);
    }
    
    // Extract href attributes from anchor tags
    const hrefRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>/gi;
    let match: RegExpExecArray | null;
    
    while ((match = hrefRegex.exec(htmlContent)) !== null) {
      if (match[1]) {
        try {
          // Resolve relative URLs to absolute
          const urlStr = match[1];
          // Ensure baseUrl is valid, defaulting to current URL if needed
          const validBaseUrl = baseUrl || 'http://example.com';
          const absoluteUrl = new URL(urlStr, validBaseUrl).href;
          
          // Only include http/https URLs - with explicit null check
          if (absoluteUrl && (absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://'))) {
            // Remove fragment identifiers
            const urlWithoutFragment = absoluteUrl.split('#')[0];
            // Ensure we only add valid strings to the set
            if (urlWithoutFragment) {
              urls.add(urlWithoutFragment);
            }
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    }
    
    return Array.from(urls);
  }
}
