/**
 * CompressedMemoryStorage implementation
 * Provides memory compression to reduce memory footprint for long-term storage
 */

import { gzipSync, gunzipSync } from 'zlib';
import { v4 as uuidv4 } from 'uuid';
import { BaseMemory, MemoryItem, MemorySearchParams, MemorySearchResult } from '../BaseMemory.js';

/**
 * Options for configuring CompressedMemoryStorage
 */
export interface CompressedMemoryStorageOptions {
  /**
   * Compression level (1-9, where 9 is maximum compression)
   * @default 6
   */
  compressionLevel?: number;
  
  /**
   * Size threshold in bytes for when to compress items
   * Items smaller than this will not be compressed
   * @default 1024 (1KB)
   */
  compressionThreshold?: number;
  
  /**
   * Whether to track statistics about compression
   * @default true
   */
  trackStats?: boolean;
  
  /**
   * Backing memory storage to use for storing compressed items
   * If not provided, items will be stored in memory
   */
  backingStorage?: BaseMemory;
}

/**
 * Metadata for compressed memory items
 */
interface CompressedItemMetadata {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  isCompressed: boolean;
  createdAt: number;
  lastAccessedAt: number;
}

/**
 * CompressedMemoryStorage class
 * Provides transparent compression/decompression for memory items
 */
export class CompressedMemoryStorage implements BaseMemory {
  private items = new Map<string, string>(); // Stores compressed content
  private metadata = new Map<string, CompressedItemMetadata>(); // Metadata for items
  private itemMetadata = new Map<string, Record<string, any>>(); // User metadata
  
  // Configuration
  private compressionLevel: number;
  private compressionThreshold: number;
  private trackStats: boolean;
  private backingStorage?: BaseMemory;
  
  // Statistics
  private stats = {
    totalItems: 0,
    compressedItems: 0,
    originalSizeTotal: 0,
    compressedSizeTotal: 0,
    compressionRatio: 0,
    maxCompressionRatio: 0,
    minCompressionRatio: 1,
    retrievals: 0,
    compressions: 0
  };
  
  constructor(options: CompressedMemoryStorageOptions = {}) {
    this.compressionLevel = options.compressionLevel ?? 6;
    this.compressionThreshold = options.compressionThreshold ?? 1024; // 1KB
    this.trackStats = options.trackStats ?? true;
    this.backingStorage = options.backingStorage;
  }
  
  /**
   * Add a new item to memory with compression
   */
  async add(content: string, metadata?: Record<string, any>): Promise<MemoryItem> {
    const id = uuidv4();
    const now = Date.now();
    
    // Store original metadata
    if (metadata) {
      this.itemMetadata.set(id, metadata);
    }
    
    // Determine if compression should be applied
    const shouldCompress = content.length > this.compressionThreshold;
    let compressedContent: string;
    let compressionRatio = 1;
    
    if (shouldCompress) {
      // Apply compression
      const compressed = gzipSync(Buffer.from(content), { 
        level: this.compressionLevel 
      });
      compressedContent = compressed.toString('base64');
      compressionRatio = compressedContent.length / content.length;
      
      if (this.trackStats) {
        this.stats.compressions++;
        this.stats.compressedItems++;
        this.stats.maxCompressionRatio = Math.max(this.stats.maxCompressionRatio, compressionRatio);
        this.stats.minCompressionRatio = Math.min(this.stats.minCompressionRatio, compressionRatio);
      }
    } else {
      // Store without compression
      compressedContent = content;
    }
    
    // Store compression metadata
    const itemMetadata: CompressedItemMetadata = {
      originalSize: content.length,
      compressedSize: compressedContent.length,
      compressionRatio,
      isCompressed: shouldCompress,
      createdAt: now,
      lastAccessedAt: now
    };
    
    this.metadata.set(id, itemMetadata);
    
    // Store the content (either compressed or original)
    if (this.backingStorage) {
      // Store in backing storage
      await this.backingStorage.add(compressedContent, {
        ...metadata,
        __compressed: shouldCompress,
        __originalSize: content.length,
        __id: id
      });
    } else {
      // Store in memory
      this.items.set(id, compressedContent);
    }
    
    // Update statistics
    if (this.trackStats) {
      this.stats.totalItems++;
      this.stats.originalSizeTotal += content.length;
      this.stats.compressedSizeTotal += compressedContent.length;
      this.stats.compressionRatio = this.stats.compressedSizeTotal / this.stats.originalSizeTotal;
    }
    
    // Return memory item (with uncompressed content)
    return {
      id,
      content,
      metadata,
      createdAt: now,
      lastAccessedAt: now
    };
  }
  
  /**
   * Search for items in memory
   * Note: This performs a basic search in memory - for more advanced searching,
   * use a specialized backing storage with vector search capabilities
   */
  async search(params: MemorySearchParams): Promise<MemorySearchResult> {
    const { query, metadata, limit = 10, offset = 0, minRelevance = 0 } = params;
    
    if (this.backingStorage) {
      // Delegate search to backing storage
      const results = await this.backingStorage.search(params);
      
      // Decompress items in results
      const decompressedItems: MemoryItem[] = [];
      
      for (const item of results.items) {
        if (item.metadata?.__compressed) {
          // This is a compressed item, decompress it
          const decompressedContent = this.decompress(item.content);
          decompressedItems.push({
            ...item,
            content: decompressedContent,
            metadata: { ...item.metadata }
          });
          
          // Remove compression metadata
          const lastItem = decompressedItems[decompressedItems.length - 1];
          if (lastItem && lastItem.metadata) {
            // Use optional chaining to safely delete properties
            const metadata = lastItem.metadata;
            if ('__compressed' in metadata) delete metadata.__compressed;
            if ('__originalSize' in metadata) delete metadata.__originalSize;
            if ('__id' in metadata) delete metadata.__id;
          }
        } else {
          // Not compressed, add as is
          decompressedItems.push(item);
        }
      }
      
      return {
        items: decompressedItems,
        total: results.total
      };
    }
    
    // Perform in-memory search if no backing storage
    const matchingItems: MemoryItem[] = [];
    let matchCount = 0;
    
    // Get all item IDs
    const itemIds = Array.from(this.items.keys());
    
    for (const id of itemIds) {
      // Get item metadata for filtering
      const itemUserMetadata = this.itemMetadata.get(id) || {};
      
      // Check if metadata matches filters
      if (metadata) {
        let matches = true;
        for (const [key, value] of Object.entries(metadata)) {
          if (itemUserMetadata[key] !== value) {
            matches = false;
            break;
          }
        }
        
        if (!matches) {
          continue;
        }
      }
      
      // Get compressed content
      const compressedContent = this.items.get(id);
      if (!compressedContent) continue;
      
      // Get compression metadata
      const compressionMetadata = this.metadata.get(id);
      if (!compressionMetadata) continue;
      
      // Decompress if needed and check if content contains query
      let content: string;
      if (compressionMetadata.isCompressed) {
        content = this.decompress(compressedContent);
      } else {
        content = compressedContent;
      }
      
      // Simple text match (for more advanced matching, use a backing storage with vector search)
      if (!query || content.toLowerCase().includes(query.toLowerCase())) {
        matchCount++;
        
        // Only collect items within the requested pagination range
        if (matchCount > offset && matchingItems.length < limit) {
          matchingItems.push({
            id,
            content,
            metadata: itemUserMetadata,
            createdAt: compressionMetadata.createdAt,
            lastAccessedAt: compressionMetadata.lastAccessedAt
          });
          
          // Update last accessed time
          compressionMetadata.lastAccessedAt = Date.now();
          this.metadata.set(id, compressionMetadata);
          
          // Update statistics
          if (this.trackStats) {
            this.stats.retrievals++;
          }
        }
      }
    }
    
    return {
      items: matchingItems,
      total: matchCount
    };
  }
  
  /**
   * Get an item by its ID
   */
  async get(id: string): Promise<MemoryItem | null> {
    let compressedContent: string | null = null;
    let itemMetadata: Record<string, any> | undefined;
    
    if (this.backingStorage) {
      // Try to get from backing storage
      const result = await this.backingStorage.search({
        metadata: { __id: id },
        limit: 1
      });
      
      if (result.items.length > 0) {
        const item = result.items[0];
        if (item) {
          compressedContent = item.content;
          itemMetadata = item.metadata ? { ...item.metadata } : undefined;
          
          // Remove compression metadata
          if (itemMetadata) {
            delete itemMetadata.__compressed;
            delete itemMetadata.__originalSize;
            delete itemMetadata.__id;
          }
        }
      }
    } else {
      // Get from in-memory storage
      compressedContent = this.items.get(id) || null;
      itemMetadata = this.itemMetadata.get(id);
    }
    
    if (!compressedContent) {
      return null;
    }
    
    // Get compression metadata
    const compressionMetadata = this.metadata.get(id);
    if (!compressionMetadata) {
      // Metadata missing, return content as is
      return {
        id,
        content: compressedContent,
        metadata: itemMetadata,
        createdAt: Date.now(), // Fallback
        lastAccessedAt: Date.now() // Fallback
      };
    }
    
    // Decompress if needed
    let content: string;
    if (compressionMetadata.isCompressed) {
      content = this.decompress(compressedContent);
    } else {
      content = compressedContent;
    }
    
    // Update last accessed time
    compressionMetadata.lastAccessedAt = Date.now();
    this.metadata.set(id, compressionMetadata);
    
    // Update statistics
    if (this.trackStats) {
      this.stats.retrievals++;
    }
    
    return {
      id,
      content,
      metadata: itemMetadata,
      createdAt: compressionMetadata.createdAt,
      lastAccessedAt: compressionMetadata.lastAccessedAt
    };
  }
  
  /**
   * Update an existing memory item
   */
  async update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null> {
    // Get existing item
    const existingItem = await this.get(id);
    if (!existingItem) {
      return null;
    }
    
    // If content is being updated, we need to compress it again
    if (updates.content !== undefined) {
      // Remove the old item
      await this.remove(id);
      
      // Create a new item with the updated content and metadata
      return this.add(
        updates.content,
        updates.metadata || existingItem.metadata
      );
    }
    
    // If only metadata is being updated
    if (updates.metadata) {
      // Update metadata
      if (this.backingStorage) {
        // This is more complex with backing storage - we need to get, remove, and re-add
        // with updated metadata
        await this.remove(id);
        
        // Add back with updated metadata
        return this.add(
          existingItem.content,
          updates.metadata
        );
      } else {
        // Update in-memory metadata
        this.itemMetadata.set(id, updates.metadata);
      }
    }
    
    // Get the updated item
    return this.get(id);
  }
  
  /**
   * Remove an item from memory
   */
  async remove(id: string): Promise<boolean> {
    if (this.backingStorage) {
      // Find the item to remove
      const result = await this.backingStorage.search({
        metadata: { __id: id },
        limit: 1
      });
      
      if (result.items.length > 0) {
        const item = result.items[0];
        if (item && this.backingStorage) {
          // Remove from backing storage
          await this.backingStorage.remove(item.id);
        }
      }
    } else {
      // Remove from in-memory storage
      this.items.delete(id);
    }
    
    // Remove metadata
    const metadata = this.metadata.get(id);
    this.metadata.delete(id);
    this.itemMetadata.delete(id);
    
    // Update statistics
    if (this.trackStats && metadata) {
      this.stats.totalItems--;
      this.stats.originalSizeTotal -= metadata.originalSize;
      this.stats.compressedSizeTotal -= metadata.compressedSize;
      
      if (metadata.isCompressed) {
        this.stats.compressedItems--;
      }
      
      // Recalculate compression ratio
      if (this.stats.originalSizeTotal > 0) {
        this.stats.compressionRatio = this.stats.compressedSizeTotal / this.stats.originalSizeTotal;
      } else {
        this.stats.compressionRatio = 0;
      }
    }
    
    return true;
  }
  
  /**
   * Clear all items from memory
   */
  async clear(): Promise<void> {
    if (this.backingStorage) {
      // Clear backing storage (this might not be possible for all storage types)
      try {
        await this.backingStorage.clear();
      } catch (e) {
        console.warn('Failed to clear backing storage:', e);
      }
    }
    
    // Clear in-memory storage
    this.items.clear();
    this.metadata.clear();
    this.itemMetadata.clear();
    
    // Reset statistics
    if (this.trackStats) {
      this.stats = {
        totalItems: 0,
        compressedItems: 0,
        originalSizeTotal: 0,
        compressedSizeTotal: 0,
        compressionRatio: 0,
        maxCompressionRatio: 0,
        minCompressionRatio: 1,
        retrievals: 0,
        compressions: 0
      };
    }
  }
  
  /**
   * Reset memory (same as clear for this implementation)
   */
  async reset(): Promise<void> {
    await this.clear();
  }
  
  /**
   * Get memory statistics
   */
  getStats(): Record<string, any> {
    if (!this.trackStats) {
      return { size: this.items.size };
    }
    
    return {
      ...this.stats,
      itemCount: this.items.size,
      savingsBytes: this.stats.originalSizeTotal - this.stats.compressedSizeTotal,
      savingsPercent: ((this.stats.originalSizeTotal - this.stats.compressedSizeTotal) / 
        Math.max(1, this.stats.originalSizeTotal)) * 100
    };
  }
  
  /**
   * Get the current number of items in memory
   */
  get size(): number {
    return this.items.size;
  }
  
  /**
   * Decompress content
   * @private
   */
  private decompress(compressedContent: string): string {
    try {
      const buffer = Buffer.from(compressedContent, 'base64');
      const decompressed = gunzipSync(buffer);
      return decompressed.toString();
    } catch (e) {
      // If decompression fails, return the content as is
      console.warn('Failed to decompress content, returning as is:', e);
      return compressedContent;
    }
  }
}
