/**
 * DeduplicatedContentStorage implementation
 * Provides memory-efficient storage with content deduplication
 * to minimize redundant memory usage for identical or similar content
 */

import { createHash } from 'crypto';

/**
 * Options for configuring DeduplicatedContentStorage behavior
 */
export interface DeduplicatedContentStorageOptions {
  /**
   * Hashing algorithm to use for content deduplication
   * @default 'sha256'
   */
  hashAlgorithm?: string;
  
  /**
   * Whether to use a bloom filter for faster negative lookups
   * @default true
   */
  useBloomFilter?: boolean;
  
  /**
   * Whether to track memory usage statistics
   * @default true
   */
  trackStats?: boolean;
  
  /**
   * Size of content chunks for partial deduplication (in characters)
   * Set to 0 to disable chunk-level deduplication
   * @default 0
   */
  chunkSize?: number;
  
  /**
   * Whether to compress stored content
   * @default false
   */
  compressContent?: boolean;
}

/**
 * Metadata for stored content
 */
export interface ContentMetadata {
  hash: string;
  size: number;
  originalSize: number;
  referenceCount: number;
  createdAt: number;
  lastAccessedAt: number;
  compressionRatio?: number;
}

/**
 * Content reference with metadata
 */
export interface ContentReference {
  hash: string;
  metadata?: Record<string, any>;
}

/**
 * Simple bloom filter implementation for fast negative lookups
 * A bloom filter allows quickly determining if an item is definitely NOT in a set
 * with no false negatives (but possible false positives)
 */
class BloomFilter {
  private bits: Uint8Array;
  private hashFunctions: number;
  private size: number;
  
  constructor(size = 10000, hashFunctions = 7) {
    this.size = size;
    this.bits = new Uint8Array(Math.ceil(size / 8));
    this.hashFunctions = hashFunctions;
  }
  
  add(item: string): void {
    const positions = this.getPositions(item);
    for (const pos of positions) {
      const byteIndex = Math.floor(pos / 8);
      // Add bounds check to ensure byteIndex is valid
      if (byteIndex >= 0 && byteIndex < this.bits.length) {
        const bitIndex = pos % 8;
        this.bits[byteIndex] |= (1 << bitIndex);
      }
    }
  }
  
  contains(item: string): boolean {
    const positions = this.getPositions(item);
    for (const pos of positions) {
      const byteIndex = Math.floor(pos / 8);
      // Add bounds check to ensure byteIndex is valid
      if (byteIndex < 0 || byteIndex >= this.bits.length) {
        return false; // Position out of bounds, so item can't be in set
      }
      const bitIndex = pos % 8;
      if (!(this.bits[byteIndex] & (1 << bitIndex))) {
        return false; // Definitely not in the set
      }
    }
    return true; // Might be in the set
  }
  
  clear(): void {
    this.bits.fill(0);
  }
  
  // Generate hash positions for an item
  private getPositions(item: string): number[] {
    const positions: number[] = [];
    const h1 = this.hash1(item);
    const h2 = this.hash2(item);
    
    for (let i = 0; i < this.hashFunctions; i++) {
      const pos = (h1 + i * h2) % this.size;
      positions.push(pos);
    }
    
    return positions;
  }
  
  // Simple hash functions for the bloom filter
  private hash1(item: string): number {
    let hash = 0;
    for (let i = 0; i < item.length; i++) {
      hash = ((hash << 5) - hash) + item.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash % this.size);
  }
  
  private hash2(item: string): number {
    let hash = 0;
    for (let i = 0; i < item.length; i++) {
      hash = ((hash << 7) - hash) + item.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash % this.size) || 1; // Ensure non-zero
  }
}

/**
 * DeduplicatedContentStorage class
 * Provides memory-efficient storage through content deduplication
 */
export class DeduplicatedContentStorage {
  // Content store maps content hashes to actual content
  private contentStore = new Map<string, string>();
  
  // Metadata for each stored content
  private contentMetadata = new Map<string, ContentMetadata>();
  
  // Reference mappings (ID -> content hash)
  private references = new Map<string, string>();
  
  // Bloom filter for fast negative lookups
  private bloomFilter: BloomFilter | null = null;
  
  // Partial content chunks for chunk-level deduplication
  private contentChunks = new Map<string, string>();
  
  // Configuration
  private hashAlgorithm: string;
  private trackStats: boolean;
  private chunkSize: number;
  private compressContent: boolean;
  
  // Statistics for monitoring performance
  private stats = {
    totalItems: 0,
    uniqueContents: 0,
    totalSizeBytes: 0,
    dedupSavingsBytes: 0,
    dedupRatio: 0,
    retrievals: 0,
    stores: 0,
    chunkStats: {
      totalChunks: 0,
      uniqueChunks: 0,
      chunkSavingsBytes: 0
    }
  };
  
  constructor(options: DeduplicatedContentStorageOptions = {}) {
    this.hashAlgorithm = options.hashAlgorithm ?? 'sha256';
    this.trackStats = options.trackStats ?? true;
    this.chunkSize = options.chunkSize ?? 0;
    this.compressContent = options.compressContent ?? false;
    
    // Initialize bloom filter if enabled
    if (options.useBloomFilter ?? true) {
      this.bloomFilter = new BloomFilter();
    }
  }
  
  /**
   * Store content with deduplication
   * Returns a reference ID for the stored content
   */
  store(content: string, id?: string, metadata?: Record<string, any>): string {
    // Generate ID if not provided
    const contentId = id ?? this.generateId();
    
    // Calculate content hash
    const hash = this.hashContent(content);
    
    // Check if content already exists using bloom filter for fast negative lookups
    if (this.bloomFilter && !this.bloomFilter.contains(hash)) {
      // Definitely not in the store, add to bloom filter
      this.bloomFilter.add(hash);
    }
    
    // Store content if it doesn't exist yet
    if (!this.contentStore.has(hash)) {
      // Process content for storage (chunk or compress if enabled)
      const processedContent = this.processContentForStorage(content);
      
      // Store the content
      this.contentStore.set(hash, processedContent);
      
      // Create metadata
      this.contentMetadata.set(hash, {
        hash,
        size: processedContent.length,
        originalSize: content.length,
        referenceCount: 0,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        compressionRatio: this.compressContent ? processedContent.length / content.length : undefined
      });
      
      // Update statistics
      if (this.trackStats) {
        this.stats.uniqueContents++;
      }
    }
    
    // Update the reference mapping
    this.references.set(contentId, hash);
    
    // Increment reference count
    const metadata_ = this.contentMetadata.get(hash);
    if (metadata_) {
      metadata_.referenceCount++;
      metadata_.lastAccessedAt = Date.now();
      this.contentMetadata.set(hash, metadata_);
    }
    
    // Update statistics
    if (this.trackStats) {
      this.stats.totalItems++;
      this.stats.totalSizeBytes += content.length;
      this.stats.dedupSavingsBytes = this.calculateDedupSavings();
      this.stats.dedupRatio = this.stats.dedupSavingsBytes / this.stats.totalSizeBytes;
      this.stats.stores++;
    }
    
    return contentId;
  }
  
  /**
   * Retrieve content by reference ID
   */
  retrieve(id: string): string | null {
    // Get the content hash from the reference
    const hash = this.references.get(id);
    if (!hash) {
      return null;
    }
    
    // Get the content using the hash
    const content = this.contentStore.get(hash);
    if (!content) {
      return null;
    }
    
    // Update access time
    const metadata = this.contentMetadata.get(hash);
    if (metadata) {
      metadata.lastAccessedAt = Date.now();
      this.contentMetadata.set(hash, metadata);
    }
    
    // Update statistics
    if (this.trackStats) {
      this.stats.retrievals++;
    }
    
    // Process content for retrieval (unchunk or decompress)
    return this.processContentForRetrieval(content);
  }
  
  /**
   * Get content metadata
   */
  getMetadata(id: string): ContentMetadata | null {
    const hash = this.references.get(id);
    if (!hash) {
      return null;
    }
    
    return this.contentMetadata.get(hash) || null;
  }
  
  /**
   * Remove content reference
   * Content is only deleted when no more references exist
   */
  remove(id: string): boolean {
    // Get the content hash from the reference
    const hash = this.references.get(id);
    if (!hash) {
      return false;
    }
    
    // Remove the reference
    this.references.delete(id);
    
    // Get metadata to update reference count
    const metadata = this.contentMetadata.get(hash);
    if (metadata) {
      metadata.referenceCount--;
      
      // If no more references, remove the content
      if (metadata.referenceCount <= 0) {
        this.contentStore.delete(hash);
        this.contentMetadata.delete(hash);
        
        // Update statistics
        if (this.trackStats) {
          this.stats.uniqueContents--;
        }
      } else {
        // Update metadata
        this.contentMetadata.set(hash, metadata);
      }
    }
    
    // Update statistics
    if (this.trackStats) {
      this.stats.totalItems--;
      this.stats.dedupSavingsBytes = this.calculateDedupSavings();
      this.stats.dedupRatio = this.stats.dedupSavingsBytes / (this.stats.totalSizeBytes || 1);
    }
    
    return true;
  }
  
  /**
   * Check if a reference exists
   */
  has(id: string): boolean {
    return this.references.has(id);
  }
  
  /**
   * Clear all content and references
   */
  clear(): void {
    this.contentStore.clear();
    this.contentMetadata.clear();
    this.references.clear();
    this.contentChunks.clear();
    
    if (this.bloomFilter) {
      this.bloomFilter.clear();
    }
    
    // Reset statistics
    if (this.trackStats) {
      this.stats = {
        totalItems: 0,
        uniqueContents: 0,
        totalSizeBytes: 0,
        dedupSavingsBytes: 0,
        dedupRatio: 0,
        retrievals: 0,
        stores: 0,
        chunkStats: {
          totalChunks: 0,
          uniqueChunks: 0,
          chunkSavingsBytes: 0
        }
      };
    }
  }
  
  /**
   * Get storage statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * Calculate the memory savings due to deduplication
   */
  calculateDedupSavings(): number {
    // Sum all original content sizes
    let totalOriginalSize = 0;
    let actualStorageSize = 0;
    
    for (const [hash, metadata] of this.contentMetadata.entries()) {
      totalOriginalSize += metadata.originalSize * metadata.referenceCount;
      actualStorageSize += metadata.size; // Only count once since content is shared
    }
    
    return totalOriginalSize - actualStorageSize;
  }
  
  /**
   * Process content for storage, including chunking or compression
   */
  private processContentForStorage(content: string): string {
    if (this.chunkSize > 0) {
      // Implement chunk-level deduplication
      return this.chunkifyContent(content);
    }
    
    if (this.compressContent) {
      // In a real implementation, we would compress content here
      // For demonstration, we'll just return the original content
      // since actual compression would require additional libraries
      return content;
    }
    
    return content;
  }
  
  /**
   * Process content for retrieval, including unchunking or decompression
   */
  private processContentForRetrieval(content: string): string {
    if (this.chunkSize > 0) {
      // Rebuild content from chunks
      return this.unchunkifyContent(content);
    }
    
    if (this.compressContent) {
      // In a real implementation, we would decompress content here
      return content;
    }
    
    return content;
  }
  
  /**
   * Chunkify content for chunk-level deduplication
   */
  private chunkifyContent(content: string): string {
    if (this.chunkSize <= 0) {
      return content;
    }
    
    // Split content into chunks of chunkSize
    const chunks: string[] = [];
    
    for (let i = 0; i < content.length; i += this.chunkSize) {
      const chunkContent = content.substring(i, i + this.chunkSize);
      const chunkHash = this.hashContent(chunkContent);
      
      // Store chunk if it doesn't exist
      if (!this.contentChunks.has(chunkHash)) {
        this.contentChunks.set(chunkHash, chunkContent);
        
        if (this.trackStats) {
          this.stats.chunkStats.uniqueChunks++;
        }
      }
      
      // Add chunk hash to the list
      chunks.push(chunkHash);
      
      if (this.trackStats) {
        this.stats.chunkStats.totalChunks++;
      }
    }
    
    // Return the list of chunk hashes as a string
    return chunks.join('|');
  }
  
  /**
   * Rebuild content from chunks
   */
  private unchunkifyContent(chunkedContent: string): string {
    if (this.chunkSize <= 0 || !chunkedContent.includes('|')) {
      return chunkedContent;
    }
    
    // Split the chunked content into hash references
    const chunkHashes = chunkedContent.split('|');
    
    // Rebuild the content from chunks
    const contentParts: string[] = [];
    
    for (const chunkHash of chunkHashes) {
      const chunkContent = this.contentChunks.get(chunkHash);
      if (chunkContent) {
        contentParts.push(chunkContent);
      } else {
        // Missing chunk - this shouldn't happen with proper reference counting
        contentParts.push(`[Missing chunk: ${chunkHash}]`);
      }
    }
    
    return contentParts.join('');
  }
  
  /**
   * Hash content using configured algorithm
   */
  private hashContent(content: string): string {
    if (this.hashAlgorithm === 'simple') {
      // Simple non-cryptographic hash for performance
      return this.simpleHash(content);
    }
    
    // Use Node.js crypto module for cryptographic hashes
    return createHash(this.hashAlgorithm).update(content).digest('hex');
  }
  
  /**
   * Simple non-cryptographic hash function
   * This is faster but has more collisions than cryptographic hashes
   */
  private simpleHash(content: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    
    for (let i = 0; i < content.length; i++) {
      const ch = content.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    
    // Combine h1 and h2 into a 16-character hex string
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }
  
  /**
   * Generate a unique ID for content references
   */
  private generateId(): string {
    return createHash('md5')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex');
  }
}
