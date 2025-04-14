/**
 * IncrementalMemoryLoader implementation
 * Provides efficient loading of large datasets with minimal memory pressure
 * by loading only what's needed when it's needed
 */

/**
 * Options for configuring IncrementalMemoryLoader behavior
 */
export interface IncrementalMemoryLoaderOptions<T> {
  /**
   * Page size for batch loading
   * @default 100
   */
  pageSize?: number;
  
  /**
   * Maximum number of pages to keep in memory
   * @default 10
   */
  maxCachedPages?: number;
  
  /**
   * Total number of items if known (allows for range validation)
   */
  totalItems?: number;
  
  /**
   * Cache strategy: 'lru' keeps most recently used pages, 'window' keeps contiguous range
   * @default 'lru'
   */
  cacheStrategy?: 'lru' | 'window';
  
  /**
   * Optional key function to generate unique identifiers for items
   * If not provided, array indices will be used
   */
  keyFn?: (item: T) => string;
  
  /**
   * Optional pre-processing function for loaded items
   */
  processItem?: (item: T) => T;
}

/**
 * Page of loaded items
 */
interface LoadedPage<T> {
  items: T[];
  pageIndex: number;
  lastAccessed: number;
}

/**
 * IncrementalMemoryLoader class
 * Implements efficient loading of large datasets with pagination and caching
 */
export class IncrementalMemoryLoader<T> {
  // Function to fetch a page of items (supplied by consumer)
  private fetchFn: (offset: number, limit: number) => Promise<T[]>;
  
  // Configuration options
  private pageSize: number;
  private maxCachedPages: number;
  private cacheStrategy: 'lru' | 'window';
  private totalItems?: number;
  private keyFn?: (item: T) => string;
  private processItem?: (item: T) => T;
  
  // Cache of loaded pages
  private pageCache = new Map<number, LoadedPage<T>>();
  
  // LRU tracking for page eviction
  private pageAccessOrder: number[] = [];
  
  // If using keyFn, we maintain a map from keys to page/index
  private keyToLocationMap = new Map<string, { pageIndex: number, indexInPage: number }>();
  
  // State tracking for window mode
  private windowStart = 0;
  private windowEnd = 0;
  
  // Statistics for monitoring performance
  private stats = {
    pageLoads: 0,
    pageEvictions: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  
  constructor(
    fetchFn: (offset: number, limit: number) => Promise<T[]>,
    options: IncrementalMemoryLoaderOptions<T> = {}
  ) {
    this.fetchFn = fetchFn;
    this.pageSize = options.pageSize ?? 100;
    this.maxCachedPages = options.maxCachedPages ?? 10;
    this.cacheStrategy = options.cacheStrategy ?? 'lru';
    this.totalItems = options.totalItems;
    this.keyFn = options.keyFn;
    this.processItem = options.processItem;
  }
  
  /**
   * Get an item by its index
   */
  async getItem(index: number): Promise<T | undefined> {
    if (this.totalItems !== undefined && (index < 0 || index >= this.totalItems)) {
      return undefined;
    }
    
    const pageIndex = Math.floor(index / this.pageSize);
    const indexInPage = index % this.pageSize;
    
    try {
      const page = await this.getPage(pageIndex);
      return page[indexInPage];
    } catch (error) {
      console.error(`Error loading item at index ${index}:`, error);
      return undefined;
    }
  }
  
  /**
   * Get an item by its key (if keyFn was provided)
   */
  async getItemByKey(key: string): Promise<T | undefined> {
    if (!this.keyFn) {
      throw new Error('keyFn must be provided to use getItemByKey');
    }
    
    // Check if we already know where this item is
    const location = this.keyToLocationMap.get(key);
    if (location) {
      const { pageIndex, indexInPage } = location;
      const page = await this.getPage(pageIndex);
      return page[indexInPage];
    }
    
    // We don't know where this item is, we need to search for it
    // This would typically require a separate index lookup mechanism
    // or scanning through pages until found, which is inefficient
    // A real implementation would have a proper index structure
    return undefined;
  }
  
  /**
   * Get a page of items by page index
   */
  async getPage(pageIndex: number): Promise<T[]> {
    // Check if page is already in cache
    const cachedPage = this.pageCache.get(pageIndex);
    if (cachedPage) {
      // Update access time and order
      cachedPage.lastAccessed = Date.now();
      this.updateAccessOrder(pageIndex);
      
      this.stats.cacheHits++;
      return cachedPage.items;
    }
    
    this.stats.cacheMisses++;
    
    // Fetch the page
    const offset = pageIndex * this.pageSize;
    const items = await this.fetchItems(offset, this.pageSize);
    
    // Process items if processor function is provided
    const processedItems = this.processItem 
      ? items.map(item => this.processItem!(item))
      : items;
    
    // Create the page object
    const page: LoadedPage<T> = {
      items: processedItems,
      pageIndex,
      lastAccessed: Date.now()
    };
    
    // Update key to location map if using keys
    if (this.keyFn) {
      processedItems.forEach((item, i) => {
        const key = this.keyFn!(item);
        this.keyToLocationMap.set(key, {
          pageIndex,
          indexInPage: i
        });
      });
    }
    
    // Add to cache and update access order
    this.pageCache.set(pageIndex, page);
    this.pageAccessOrder.push(pageIndex);
    
    // Update window range if using window strategy
    if (this.cacheStrategy === 'window') {
      if (this.pageCache.size === 1) {
        // First page
        this.windowStart = pageIndex;
        this.windowEnd = pageIndex;
      } else {
        this.windowStart = Math.min(this.windowStart, pageIndex);
        this.windowEnd = Math.max(this.windowEnd, pageIndex);
      }
    }
    
    // Ensure cache doesn't exceed max size
    this.enforceMaxCacheSize();
    
    this.stats.pageLoads++;
    return processedItems;
  }
  
  /**
   * Get a range of items
   */
  async getRange(startIndex: number, endIndex: number): Promise<T[]> {
    if (startIndex < 0 || (this.totalItems !== undefined && startIndex >= this.totalItems)) {
      throw new Error(`Start index ${startIndex} out of bounds`);
    }
    
    if (endIndex < startIndex || (this.totalItems !== undefined && endIndex >= this.totalItems)) {
      endIndex = this.totalItems ? this.totalItems - 1 : endIndex;
    }
    
    const startPage = Math.floor(startIndex / this.pageSize);
    const endPage = Math.floor(endIndex / this.pageSize);
    
    // If range spans multiple pages, optimize by fetching all pages in parallel
    const pagePromises: Promise<T[]>[] = [];
    for (let i = startPage; i <= endPage; i++) {
      pagePromises.push(this.getPage(i));
    }
    
    const pages = await Promise.all(pagePromises);
    
    // Extract the requested range from the loaded pages
    const startIndexInPage = startIndex % this.pageSize;
    const endIndexInPage = endIndex % this.pageSize;
    
    if (startPage === endPage) {
      // Range is within a single page
      const page = pages[0];
      if (!page) {
        return [];
      }
      return page.slice(startIndexInPage, endIndexInPage + 1);
    } else {
      // Range spans multiple pages
      const result: T[] = [];
      
      // First page (partial)
      if (pages[0]) {
        result.push(...pages[0].slice(startIndexInPage));
      }
      
      // Middle pages (complete)
      for (let i = 1; i < pages.length - 1; i++) {
        const page = pages[i];
        if (page) {
          result.push(...page);
        }
      }
      
      // Last page (partial)
      const lastPage = pages[pages.length - 1];
      if (lastPage) {
        result.push(...lastPage.slice(0, endIndexInPage + 1));
      }
      
      return result;
    }
  }
  
  /**
   * Reset the loader state and clear caches
   */
  reset(): void {
    this.pageCache.clear();
    this.pageAccessOrder = [];
    this.keyToLocationMap.clear();
    this.windowStart = 0;
    this.windowEnd = 0;
    
    this.stats = {
      pageLoads: 0,
      pageEvictions: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
  
  /**
   * Get loader statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * Update the access order of pages (for LRU tracking)
   */
  private updateAccessOrder(pageIndex: number): void {
    // Remove the page from its current position
    this.pageAccessOrder = this.pageAccessOrder.filter(p => p !== pageIndex);
    // Add to the end (most recently used)
    this.pageAccessOrder.push(pageIndex);
  }
  
  /**
   * Ensure the cache doesn't exceed maximum size by evicting pages
   */
  private enforceMaxCacheSize(): void {
    if (this.pageCache.size <= this.maxCachedPages) {
      return;
    }
    
    const numToEvict = this.pageCache.size - this.maxCachedPages;
    
    if (this.cacheStrategy === 'lru') {
      // Evict least recently used pages
      const pagesToEvict = this.pageAccessOrder.slice(0, numToEvict);
      for (const pageIndex of pagesToEvict) {
        this.evictPage(pageIndex);
      }
    } else if (this.cacheStrategy === 'window') {
      // Evict pages outside the current window, prioritizing those furthest from window
      const allPages = Array.from(this.pageCache.keys());
      
      // Calculate distance from window center for each page
      const windowStart = this.windowStart || 0;
      const windowEnd = this.windowEnd || 0;
      const windowCenter = (windowStart + windowEnd) / 2;
      const pagesWithDistance = allPages.map(pageIndex => {
        return {
          pageIndex,
          distance: Math.abs(pageIndex - windowCenter)
        };
      });
      
      // Sort by distance (descending) and evict furthest pages
      pagesWithDistance.sort((a, b) => b.distance - a.distance);
      
      for (let i = 0; i < numToEvict; i++) {
        if (i < pagesWithDistance.length) {
          const pageInfo = pagesWithDistance[i];
          if (pageInfo) {
            this.evictPage(pageInfo.pageIndex);
          }
        }
      }
    }
  }
  
  /**
   * Evict a page from the cache
   */
  private evictPage(pageIndex: number): void {
    // If using keys, remove the key mappings for this page
    if (this.keyFn) {
      const page = this.pageCache.get(pageIndex);
      if (page) {
        page.items.forEach((item, i) => {
          const key = this.keyFn!(item);
          const location = this.keyToLocationMap.get(key);
          if (location && location.pageIndex === pageIndex && location.indexInPage === i) {
            this.keyToLocationMap.delete(key);
          }
        });
      }
    }
    
    // Remove from cache and access order
    this.pageCache.delete(pageIndex);
    this.pageAccessOrder = this.pageAccessOrder.filter(p => p !== pageIndex);
    
    this.stats.pageEvictions++;
  }
  
  /**
   * Fetch items from the data source
   */
  private async fetchItems(offset: number, limit: number): Promise<T[]> {
    try {
      return await this.fetchFn(offset, limit);
    } catch (error) {
      console.error(`Error fetching items (offset: ${offset}, limit: ${limit}):`, error);
      return [];
    }
  }
}
