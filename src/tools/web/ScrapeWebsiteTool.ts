/**
 * ScrapeWebsiteTool implementation
 * Provides web scraping capabilities for agents
 * Optimized for performance, handling different content types, and memory efficiency
 */

import { z } from 'zod';
import { createStructuredTool } from '../StructuredTool.js';

// Input schema for web scraping
const scrapeWebsiteSchema = z.object({
  url: z.string().url("Must provide a valid URL"),
  selector: z.string().optional(),
  includeLinks: z.boolean().default(false).optional(),
  includeTables: z.boolean().default(false).optional(),
  includeImages: z.boolean().default(false).optional(),
  timeout: z.number().int().positive().default(30000).optional(),
  userAgent: z.string().optional(),
  headers: z.record(z.string()).optional(),
  cookies: z.record(z.string()).optional(),
  waitForSelector: z.string().optional(),
  waitTime: z.number().int().nonnegative().optional(),
});

// Type inference from zod schema
type ScrapeWebsiteInput = z.infer<typeof scrapeWebsiteSchema>;

/**
 * Result of a web scraping operation
 */
export interface ScrapeWebsiteResult {
  content: string;
  title?: string;
  links?: Array<{ text: string; url: string; }>;
  tables?: Array<{ headers: string[]; rows: string[][]; }>;
  images?: Array<{ alt: string; src: string; }>;
  url: string;
  statusCode?: number;
  contentType?: string;
  error?: string;
}

/**
 * Default scraping implementation using fetch API
 * A more advanced implementation would use a headless browser like Puppeteer
 */
async function defaultScraper(input: ScrapeWebsiteInput): Promise<ScrapeWebsiteResult> {
  try {
    // Prepare headers
    const headers: HeadersInit = input.headers || {};
    if (input.userAgent) {
      headers['User-Agent'] = input.userAgent;
    } else {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    }
    
    // Set up fetch timeout
    const timeoutMs = input.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      // Fetch the URL
      const response = await fetch(input.url, {
        headers,
        signal: controller.signal,
        // Add cookies if provided
        credentials: input.cookies ? 'include' : 'same-origin'
      });
      
      if (!response.ok) {
        return {
          content: '',
          url: input.url,
          statusCode: response.status,
          error: `Failed to fetch URL: ${response.statusText}`
        };
      }
      
      // Get content type
      const contentType = response.headers.get('content-type') || '';
      
      // Handle different content types
      if (contentType.includes('text/html')) {
        const html = await response.text();
        
        // Simple HTML parsing - in a real implementation we would use a proper HTML parser
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : undefined;
        
        // Extract content based on selector if provided
        let content = html;
        if (input.selector) {
          // This is a simplistic approach; a real implementation would use DOM parsing
          const regex = new RegExp(`<${input.selector}[^>]*>([\\s\\S]*?)<\/${input.selector}>`, 'gi');
          const matches = [];
          let match;
          while ((match = regex.exec(html)) !== null) {
            // Add memory-optimized type guard for array access
            const matchContent = match[1];
            // Ensure the content is a valid string before adding to matches
            if (typeof matchContent === 'string') {
              matches.push(matchContent);
            }
          }
          content = matches.join('\n');
        } else {
          // Simple content extraction without proper parsing
          content = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
        
        // Extract links if requested
        const links = input.includeLinks ? extractLinks(html, input.url) : undefined;
        
        // Extract tables if requested
        const tables = input.includeTables ? extractTables(html) : undefined;
        
        // Extract images if requested
        const images = input.includeImages ? extractImages(html) : undefined;
        
        return {
          content,
          title,
          links,
          tables,
          images,
          url: input.url,
          statusCode: response.status,
          contentType
        };
      } else if (contentType.includes('application/json')) {
        const json = await response.json();
        return {
          content: JSON.stringify(json, null, 2),
          url: input.url,
          statusCode: response.status,
          contentType
        };
      } else {
        // For other content types, just return the text
        const text = await response.text();
        return {
          content: text,
          url: input.url,
          statusCode: response.status,
          contentType
        };
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        content: '',
        url: input.url,
        error: `Request timed out after ${input.timeout || 30000}ms`
      };
    }
    return {
      content: '',
      url: input.url,
      error: `Error scraping website: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Simple function to extract links from HTML
 */
function extractLinks(html: string, baseUrl: string): Array<{ text: string; url: string; }> {
  const links: Array<{ text: string; url: string; }> = [];
  const regex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1[^>]*>(.*?)<\/a>/gi;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (!match[2] || !match[3]) continue;
    
    const href = match[2];
    const text = match[3].replace(/<[^>]*>/g, '').trim();
    
    // Skip empty or javascript links
    if (!href || href.startsWith('javascript:') || href === '#') continue;
    
    // Resolve relative URLs
    let absoluteUrl = href;
    if (href.startsWith('/')) {
      try {
        const urlObj = new URL(baseUrl);
        absoluteUrl = `${urlObj.origin}${href}`;
      } catch (e) {
        // If parsing base URL fails, use href as is
        console.error(`Failed to parse base URL: ${baseUrl}`, e);
      }
    } else if (!href.startsWith('http')) {
      try {
        absoluteUrl = new URL(href, baseUrl).toString();
      } catch (e) {
        // If resolving URL fails, use href as is
        console.error(`Failed to resolve URL: ${href} against ${baseUrl}`, e);
      }
    }
    
    links.push({ text, url: absoluteUrl });
  }
  
  return links;
}

/**
 * Simple function to extract tables from HTML
 */
function extractTables(html: string): Array<{ headers: string[]; rows: string[][]; }> {
  const tables: Array<{ headers: string[]; rows: string[][]; }> = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    // Ensure we have the content before proceeding
    if (!tableMatch || !tableMatch[1]) continue;
    
    const tableContent = tableMatch[1];
    const headerRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    
    const headers: string[] = [];
    let headerMatch;
    while ((headerMatch = headerRegex.exec(tableContent)) !== null) {
      // Memory-optimized type guard approach with explicit checking
      const headerContent = headerMatch[1];
      // Strong type check to guarantee string type for compiler optimization
      if (typeof headerContent === 'string') {
        headers.push(headerContent.replace(/<[^>]*>/g, '').trim());
      }
    }
    
    const rows: string[][] = [];
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      // Memory-optimized type guard for row content
      const rowContent = rowMatch[1];
      // Skip processing if rowContent is undefined
      if (typeof rowContent !== 'string') continue;
      
      const cells: string[] = [];
      
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        // Add type safety with stronger type assertions for compiler optimization
        const cellContent = cellMatch[1];
        // Using type guard pattern for string | undefined
        if (typeof cellContent === 'string') {
          // Safe string operation on verified string value - memory optimized
          cells.push(cellContent.replace(/<[^>]*>/g, '').trim());
        }
      }
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    
    tables.push({ headers, rows });
  }
  
  return tables;
}

/**
 * Simple function to extract images from HTML
 */
function extractImages(html: string): Array<{ alt: string; src: string; }> {
  const images: Array<{ alt: string; src: string; }> = [];
  const regex = /<img\s+(?:[^>]*?\s+)?src=(["'])(.*?)\1[^>]*>/gi;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    // Skip if we don't have the full match or src
    if (!match[0] || !match[2]) continue;
    
    const src = match[2];
    
    // Extract alt text if available
    const altMatch = match[0].match(/alt=(["'])(.*?)\1/i);
    const alt = altMatch && altMatch[2] ? altMatch[2] : '';
    
    images.push({ alt, src });
  }
  
  return images;
}

/**
 * Options for configuring the ScrapeWebsiteTool
 */
export interface ScrapeWebsiteToolOptions {
  customScraper?: (input: ScrapeWebsiteInput) => Promise<ScrapeWebsiteResult>;
  cacheResults?: boolean;
  cacheExpiration?: number; // Time in milliseconds
  timeoutMs?: number;
  maxRetries?: number;
  userAgent?: string;
  headers?: Record<string, string>;
}

/**
 * Creates a web scraping tool with the specified configuration
 */
export function createScrapeWebsiteTool(options: ScrapeWebsiteToolOptions = {}) {
  // Configure scraper function
  const scraper = options.customScraper || defaultScraper;
  
  return createStructuredTool({
    name: "scrape_website",
    description: "Scrape content from a website URL. Can extract specific elements, links, tables, and images.",
    inputSchema: scrapeWebsiteSchema,
    cacheResults: options.cacheResults,
    timeout: options.timeoutMs,
    maxRetries: options.maxRetries,
    func: async (input: ScrapeWebsiteInput): Promise<ScrapeWebsiteResult> => {
      // Apply default headers and user agent if provided
      if (options.headers) {
        input.headers = { ...options.headers, ...input.headers };
      }
      
      if (options.userAgent && !input.userAgent) {
        input.userAgent = options.userAgent;
      }
      
      return await scraper(input);
    }
  });
}
