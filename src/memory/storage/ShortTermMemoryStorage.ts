/**
 * Storage adapter for short-term memory
 * Optimized for memory efficiency, performance, and limited retention
 */
import fs from 'fs';
import path from 'path';

// Memory entry interface with optimized structure
export interface ShortTermMemoryEntry {
  id: string;
  content: string;
  timestamp: number;
  expiresAt?: number; // Optional expiration time
  metadata?: Record<string, any>;
}

/**
 * Short-term memory storage implementation
 * Uses efficient storage patterns with time-based expiration
 */
export class ShortTermMemoryStorage {
  private dbPath: string;
  private cache: Map<string, ShortTermMemoryEntry>;
  private lastCleanup: number = 0;
  private cleanupInterval: number = 1000 * 60 * 10; // 10 minutes
  private defaultTtl: number = 1000 * 60 * 60 * 24; // 24 hours
  
  /**
   * Initialize storage with optimized caching
   * @param dbPath Optional custom database path
   * @param defaultTtl Default time-to-live in milliseconds
   */
  constructor(dbPath?: string, defaultTtl?: number) {
    this.dbPath = dbPath || path.join(process.cwd(), '.crewai', 'short_term_memory.json');
    this.cache = new Map<string, ShortTermMemoryEntry>();
    
    if (defaultTtl) {
      this.defaultTtl = defaultTtl;
    }
    
    this.ensureStorageExists();
  }
  
  /**
   * Ensure storage directory exists
   */
  private ensureStorageExists(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, JSON.stringify([]));
    }
  }
  
  /**
   * Add a memory entry
   * @param entry Memory entry to add (with or without ID and timestamp)
   * @param ttl Optional time-to-live in milliseconds
   * @returns Memory entry with ID and timestamps
   */
  async add(entry: Omit<ShortTermMemoryEntry, 'id' | 'timestamp'> & { id?: string, timestamp?: number }, ttl?: number): Promise<ShortTermMemoryEntry> {
    const now = Date.now();
    
    // Create complete memory entry
    const memoryEntry: ShortTermMemoryEntry = {
      id: entry.id || `stm_${now}_${Math.floor(Math.random() * 10000)}`,
      content: entry.content,
      timestamp: entry.timestamp || now,
      expiresAt: ttl ? now + ttl : now + this.defaultTtl,
      metadata: entry.metadata || {}
    };
    
    // Perform cleanup if needed
    if (now - this.lastCleanup > this.cleanupInterval) {
      await this.cleanup();
    }
    
    // Add to storage
    const entries = await this.getAll();
    
    // Check if entry already exists
    const existingIndex = memoryEntry.id ? entries.findIndex(e => e.id === memoryEntry.id) : -1;
    
    if (existingIndex >= 0) {
      // Update existing entry
      entries[existingIndex] = memoryEntry;
    } else {
      // Add new entry
      entries.push(memoryEntry);
    }
    
    // Write to storage with optimized I/O pattern
    await fs.promises.writeFile(this.dbPath, JSON.stringify(entries, null, 2));
    
    // Update cache
    this.cache.set(memoryEntry.id, memoryEntry);
    
    return memoryEntry;
  }
  
  /**
   * Get all active memory entries
   * Uses memory-efficient loading and automatic expiration
   * @returns Array of active memory entries
   */
  async getAll(): Promise<ShortTermMemoryEntry[]> {
    try {
      const data = await fs.promises.readFile(this.dbPath, 'utf8');
      const entries: ShortTermMemoryEntry[] = JSON.parse(data || '[]');
      const now = Date.now();
      
      // Filter out expired entries
      const activeEntries = entries.filter(entry => {
        return !entry.expiresAt || entry.expiresAt > now;
      });
      
      // Update cache with efficient batch operation
      this.cache.clear();
      activeEntries.forEach(entry => {
        this.cache.set(entry.id, entry);
      });
      
      // If entries were filtered out, update storage
      if (activeEntries.length < entries.length) {
        // Schedule async write without waiting
        queueMicrotask(() => {
          fs.promises.writeFile(this.dbPath, JSON.stringify(activeEntries, null, 2))
            .catch(err => console.error('Error updating storage after expiration:', err));
        });
      }
      
      return activeEntries;
    } catch (error) {
      console.error('Error loading short-term memory:', error);
      return [];
    }
  }
  
  /**
   * Get a memory entry by ID
   * @param id Memory entry ID
   * @returns Memory entry or null if not found or expired
   */
  async getById(id: string): Promise<ShortTermMemoryEntry | null> {
    // Check cache first for performance
    const cachedEntry = this.cache.get(id);
    if (cachedEntry) {
      // Check if expired
      if (!cachedEntry.expiresAt || cachedEntry.expiresAt > Date.now()) {
        return cachedEntry;
      }
      // If expired, remove from cache
      this.cache.delete(id);
      return null;
    }
    
    const entries = await this.getAll();
    const entry = entries.find(e => e.id === id);
    
    if (entry) {
      // Verify not expired (should already be filtered by getAll, but double check)
      if (!entry.expiresAt || entry.expiresAt > Date.now()) {
        this.cache.set(id, entry);
        return entry;
      }
    }
    
    return null;
  }
  
  /**
   * Delete a memory entry by ID
   * @param id Memory entry ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const entries = await this.getAll();
    const initialLength = entries.length;
    
    const filteredEntries = entries.filter(entry => entry.id !== id);
    
    if (filteredEntries.length === initialLength) {
      return false; // Entry not found
    }
    
    await fs.promises.writeFile(this.dbPath, JSON.stringify(filteredEntries, null, 2));
    this.cache.delete(id);
    
    return true;
  }
  
  /**
   * Clear all memory entries
   */
  async clear(): Promise<void> {
    await fs.promises.writeFile(this.dbPath, JSON.stringify([]));
    this.cache.clear();
  }
  
  /**
   * Clean up expired entries
   * Uses efficient batch processing for performance
   */
  private async cleanup(): Promise<void> {
    const now = Date.now();
    this.lastCleanup = now;
    
    const entries = await this.getAll();
    const activeEntries = entries.filter(entry => {
      return !entry.expiresAt || entry.expiresAt > now;
    });
    
    if (activeEntries.length < entries.length) {
      await fs.promises.writeFile(this.dbPath, JSON.stringify(activeEntries, null, 2));
      
      // Update cache
      this.cache.clear();
      activeEntries.forEach(entry => {
        this.cache.set(entry.id, entry);
      });
    }
  }

  /**
   * Get memory entries by content search
   * @param query Text to search for
   * @param limit Maximum number of results
   * @returns Matching memory entries
   */
  async search(query: string, limit?: number): Promise<ShortTermMemoryEntry[]> {
    const entries = await this.getAll();
    
    // Perform simple text search with memory-efficient string operations
    const lowerQuery = query.toLowerCase();
    const matchingEntries = entries
      .filter(entry => entry.content.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
    
    return limit && limit > 0 ? matchingEntries.slice(0, limit) : matchingEntries;
  }
}
