/**
 * RagTool implementation
 * Provides retrieval-augmented generation capabilities for agents
 * Leverages the optimized KnowledgeStorage system with tiered hot/warm/cold storage
 */

import { z } from 'zod';
import { createStructuredTool } from '../StructuredTool.js';
import { KnowledgeChunk } from '../../knowledge/types.js';
// Import directly from the module
import '../../knowledge/KnowledgeBase.js';
import { KnowledgeStorage } from '../../knowledge/storage/KnowledgeStorage.js';
import { StringKnowledgeSource } from '../../knowledge/source/StringKnowledgeSource.js';

// Input schema for RAG operations
const ragInputSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  contextCount: z.number().int().positive().default(5).optional(),
  similarityThreshold: z.number().min(0).max(1).default(0.7).optional(),
  filterMetadata: z.record(z.any()).optional(),
  includeMetadata: z.boolean().default(true).optional(),
  returnSourceText: z.boolean().default(true).optional(),
});

// Type inference from zod schema
type RagInput = z.infer<typeof ragInputSchema>;

/**
 * Result of a RAG operation
 */
export interface RagResult {
  query: string;
  contextCount: number;
  results: Array<{
    content: string;
    score: number;
    metadata?: Record<string, any>;
    id?: string;
  }>;
}

/**
 * Options for configuring the RagTool
 */
export interface RagToolOptions {
  // Knowledge sources
  knowledgeBase?: any; // Use any type to avoid reference issues
  texts?: string[];
  textChunkSize?: number;
  textChunkOverlap?: number;
  
  // Performance options
  cacheResults?: boolean;
  cacheExpiration?: number; // Time in milliseconds
  timeoutMs?: number;
  maxRetries?: number;
  
  // Tool metadata
  name?: string;
  description?: string;
}

/**
 * Creates an optimized RAG tool that leverages the KnowledgeStorage system
 */
export function createRagTool(options: RagToolOptions = {}) {
  // Create or use provided knowledge base
  let knowledgeBase = options.knowledgeBase;
  
  // If no knowledge base provided but texts are, create a knowledge base from texts
  if (!knowledgeBase && options.texts && options.texts.length > 0) {
    // Create a new storage instance with proper options
    const storage = new KnowledgeStorage({
      collectionName: 'rag-knowledge',
      maxCacheSize: 1000 * 1024 * 1024, // 1000MB
      cacheTTL: 3600000 // 1 hour
    });
    
    // Use the dynamic import pattern to avoid direct instantiation
    // @ts-ignore - Dynamically created instance
    knowledgeBase = { storage };
    
    // Add texts to knowledge base using the storage directly
    options.texts.forEach((text, index) => {
      const source = new StringKnowledgeSource({
        content: text,
        chunkSize: options.textChunkSize || 1000,
        chunkOverlap: options.textChunkOverlap || 200,
        metadata: { sourceIndex: index }
      });
      
      // Add source to storage instead of knowledge base
      if (storage) {
        // @ts-ignore - Use storage directly
        storage.addSource?.(source);
      }
    });
  }
  
  // Ensure we have a knowledge base
  if (!knowledgeBase) {
    const storage = new KnowledgeStorage({
      collectionName: 'default-knowledge',
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      cacheTTL: 3600000 // 1 hour
    });
    
    // @ts-ignore - Dynamically created instance
    knowledgeBase = { storage };
  }
  
  return createStructuredTool({
    name: options.name || "rag",
    description: options.description || "Search for relevant information from a knowledge base using a query",
    inputSchema: ragInputSchema,
    cacheResults: options.cacheResults,
    timeout: options.timeoutMs,
    maxRetries: options.maxRetries,
    func: async (input: RagInput): Promise<RagResult> => {
      // Type safety for the result parameter
      type SearchResult = {
        content: string;
        score: number;
        metadata?: Record<string, any>;
        id?: string;
      };
      try {
        // Search knowledge base
        // @ts-ignore - Access storage directly to avoid type issues
        const searchResults = await knowledgeBase.storage?.search({
          query: input.query,
          k: input.contextCount || 5,
          filterMetadata: input.filterMetadata,
          similarityThreshold: input.similarityThreshold
        }) || [];
        
        // Format results with proper type safety
        const formattedResults = searchResults.map((result: SearchResult) => {
          const formatted: {
            content: string;
            score: number;
            metadata?: Record<string, any>;
            id?: string;
          } = {
            content: result.content,
            score: result.score
          };
          
          if (input.includeMetadata && result.metadata) {
            formatted.metadata = result.metadata;
          }
          
          if (result.id) {
            formatted.id = result.id;
          }
          
          return formatted;
        });
        
        return {
          query: input.query,
          contextCount: input.contextCount || 5,
          results: formattedResults
        };
      } catch (error) {
        // Return empty results on error
        console.error("Error in RAG tool:", error);
        return {
          query: input.query,
          contextCount: input.contextCount || 5,
          results: [{
            content: `Error retrieving information: ${error instanceof Error ? error.message : String(error)}`,
            score: 0
          }]
        };
      }
    }
  });
}
