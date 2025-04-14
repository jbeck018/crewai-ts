/**
 * Memory retention policies implementation
 * Provides flexible control over memory retention with various strategies
 */

import { BaseMemory, MemoryItem } from '../BaseMemory.js';

// Extend MemoryItem with optional properties used by retention policies
interface ExtendedMemoryItem extends MemoryItem {
  updatedAt?: number;
  relevance?: number;
}

/**
 * Base interface for memory retention policies
 */
export interface RetentionPolicy {
  /**
   * Determine if a memory item should be retained
   * @param item The memory item to evaluate
   * @returns True if the item should be retained, false if it can be removed
   */
  shouldRetain(item: ExtendedMemoryItem): boolean;
  
  /**
   * Apply the retention policy to a memory store
   * This will evaluate all items and remove those that should not be retained
   * @param memory The memory store to apply the policy to
   */
  applyToMemory(memory: BaseMemory): Promise<number>;
  
  /**
   * Optional name for the policy for identification
   */
  name?: string;
}

/**
 * Options for time-based retention policy
 */
export interface TimeBasedRetentionOptions {
  /**
   * Maximum age in milliseconds for items to be retained
   * Items older than this will be removed
   */
  maxAgeMs: number;
  
  /**
   * Field to use for age calculation
   * - 'createdAt': Use item creation time (default)
   * - 'lastAccessedAt': Use last access time
   * - 'updatedAt': Use last update time
   * @default 'createdAt'
   */
  timeField?: 'createdAt' | 'lastAccessedAt' | 'updatedAt';
  
  /**
   * Name for this policy instance
   */
  name?: string;
}

/**
 * Time-based retention policy
 * Retains items based on their age (creation or access time)
 */
export class TimeBasedRetentionPolicy implements RetentionPolicy {
  private maxAgeMs: number;
  private timeField: 'createdAt' | 'lastAccessedAt' | 'updatedAt';
  name?: string;
  
  constructor(options: TimeBasedRetentionOptions) {
    this.maxAgeMs = options.maxAgeMs;
    this.timeField = options.timeField ?? 'createdAt';
    this.name = options.name;
  }
  
  shouldRetain(item: ExtendedMemoryItem): boolean {
    const now = Date.now();
    let timestamp: number;
    
    switch (this.timeField) {
      case 'lastAccessedAt':
        timestamp = item.lastAccessedAt ?? item.createdAt;
        break;
      case 'updatedAt':
        // Safe access with type casting
        timestamp = (item as ExtendedMemoryItem).updatedAt ?? item.createdAt;
        break;
      case 'createdAt':
      default:
        timestamp = item.createdAt;
    }
    
    return now - timestamp < this.maxAgeMs;
  }
  
  async applyToMemory(memory: BaseMemory): Promise<number> {
    // Get all items
    // This implementation assumes memory has a method to get all items
    // In a real implementation, we would use an internal method or property
    // that efficiently allows us to iterate through items
    
    // For now, we'll implement a simple version that assumes a search method
    // This might not be efficient for large memories
    const allItems = await memory.search({ limit: Number.MAX_SAFE_INTEGER });
    
    let removedCount = 0;
    
    // Check each item and remove if it doesn't meet retention criteria
    for (const item of allItems.items) {
      if (!this.shouldRetain(item)) {
        await memory.remove(item.id);
        removedCount++;
      }
    }
    
    return removedCount;
  }
}

/**
 * Options for count-based retention policy
 */
export interface CountBasedRetentionOptions {
  /**
   * Maximum number of items to retain
   */
  maxItems: number;
  
  /**
   * Strategy for selecting items to remove when maxItems is exceeded
   * - 'oldest': Remove oldest items first (by creation time)
   * - 'leastAccessed': Remove least recently accessed items first
   * @default 'oldest'
   */
  strategy?: 'oldest' | 'leastAccessed';
  
  /**
   * Name for this policy instance
   */
  name?: string;
}

/**
 * Count-based retention policy
 * Retains up to a maximum number of items
 */
export class CountBasedRetentionPolicy implements RetentionPolicy {
  private maxItems: number;
  private strategy: 'oldest' | 'leastAccessed';
  name?: string;
  
  constructor(options: CountBasedRetentionOptions) {
    this.maxItems = options.maxItems;
    this.strategy = options.strategy ?? 'oldest';
    this.name = options.name;
  }
  
  shouldRetain(item: MemoryItem): boolean {
    // This method is not useful for CountBasedRetentionPolicy
    // since retention depends on comparing with other items
    // Always return true to defer the decision to applyToMemory
    return true;
  }
  
  async applyToMemory(memory: BaseMemory): Promise<number> {
    // Get all items
    const allItems = await memory.search({ limit: Number.MAX_SAFE_INTEGER });
    
    // If we're under the limit, do nothing
    if (allItems.items.length <= this.maxItems) {
      return 0;
    }
    
    // Sort based on strategy
    const items = [...allItems.items];
    if (this.strategy === 'oldest') {
      items.sort((a, b) => a.createdAt - b.createdAt);
    } else {
      // leastAccessed strategy
      items.sort((a, b) => {
        const aTime = a.lastAccessedAt ?? a.createdAt;
        const bTime = b.lastAccessedAt ?? b.createdAt;
        return aTime - bTime;
      });
    }
    
    // Calculate how many to remove
    const countToRemove = items.length - this.maxItems;
    
    // Remove excess items
    const itemsToRemove = items.slice(0, countToRemove);
    
    let removedCount = 0;
    for (const item of itemsToRemove) {
      await memory.remove(item.id);
      removedCount++;
    }
    
    return removedCount;
  }
}

/**
 * Options for relevance-based retention policy
 */
export interface RelevanceBasedRetentionOptions {
  /**
   * Relevance threshold between 0 and 1
   * Items with relevance below this threshold will be removed
   */
  threshold: number;
  
  /**
   * Optional relevance function to calculate item relevance
   * If not provided, the item's relevance property will be used
   */
  relevanceFn?: (item: MemoryItem) => number;
  
  /**
   * Name for this policy instance
   */
  name?: string;
}

/**
 * Relevance-based retention policy
 * Retains items based on their calculated relevance score
 */
export class RelevanceBasedRetentionPolicy implements RetentionPolicy {
  private threshold: number;
  private relevanceFn?: (item: MemoryItem) => number;
  name?: string;
  
  constructor(options: RelevanceBasedRetentionOptions) {
    this.threshold = options.threshold;
    this.relevanceFn = options.relevanceFn;
    this.name = options.name;
  }
  
  shouldRetain(item: MemoryItem): boolean {
    // Calculate relevance
    let relevance: number;
    
    if (this.relevanceFn) {
      // Use custom relevance function
      relevance = this.relevanceFn(item);
    } else if ((item as ExtendedMemoryItem).relevance !== undefined) {
      // Use item's relevance property if available with safe type casting
      relevance = (item as ExtendedMemoryItem).relevance || 0;
    } else {
      // Default to high relevance if no method to determine
      return true;
    }
    
    return relevance >= this.threshold;
  }
  
  async applyToMemory(memory: BaseMemory): Promise<number> {
    // Get all items
    const allItems = await memory.search({ limit: Number.MAX_SAFE_INTEGER });
    
    let removedCount = 0;
    
    // Check each item and remove if it doesn't meet relevance threshold
    for (const item of allItems.items) {
      if (!this.shouldRetain(item)) {
        await memory.remove(item.id);
        removedCount++;
      }
    }
    
    return removedCount;
  }
}

/**
 * Options for composite retention policy
 */
export interface CompositeRetentionOptions {
  /**
   * List of retention policies to combine
   */
  policies: RetentionPolicy[];
  
  /**
   * Mode for combining policies
   * - 'all': Item must be retained by all policies (AND)
   * - 'any': Item must be retained by at least one policy (OR)
   * @default 'any'
   */
  mode?: 'all' | 'any';
  
  /**
   * Name for this policy instance
   */
  name?: string;
}

/**
 * Composite retention policy
 * Combines multiple retention policies with AND/OR logic
 */
export class CompositeRetentionPolicy implements RetentionPolicy {
  private policies: RetentionPolicy[];
  private mode: 'all' | 'any';
  name?: string;
  
  constructor(options: CompositeRetentionOptions) {
    this.policies = options.policies;
    this.mode = options.mode ?? 'any';
    this.name = options.name;
  }
  
  shouldRetain(item: MemoryItem): boolean {
    if (this.mode === 'all') {
      // Item must be retained by all policies (AND)
      return this.policies.every(policy => policy.shouldRetain(item));
    } else {
      // Item must be retained by at least one policy (OR)
      return this.policies.some(policy => policy.shouldRetain(item));
    }
  }
  
  async applyToMemory(memory: BaseMemory): Promise<number> {
    // Get all items
    const allItems = await memory.search({ limit: Number.MAX_SAFE_INTEGER });
    
    let removedCount = 0;
    
    // Check each item against the composite policy
    for (const item of allItems.items) {
      if (!this.shouldRetain(item)) {
        await memory.remove(item.id);
        removedCount++;
      }
    }
    
    return removedCount;
  }
}

/**
 * Options for metadata-based retention policy
 */
export interface MetadataBasedRetentionOptions {
  /**
   * Metadata criteria that items must match to be retained
   * If multiple criteria are provided, an item must match all of them (AND logic)
   */
  criteria: Record<string, any>;
  
  /**
   * Whether to invert the matching logic
   * If true, items that match the criteria will be removed instead of retained
   * @default false
   */
  invert?: boolean;
  
  /**
   * Name for this policy instance
   */
  name?: string;
}

/**
 * Metadata-based retention policy
 * Retains items based on their metadata properties
 */
export class MetadataBasedRetentionPolicy implements RetentionPolicy {
  private criteria: Record<string, any>;
  private invert: boolean;
  name?: string;
  
  constructor(options: MetadataBasedRetentionOptions) {
    this.criteria = options.criteria;
    this.invert = options.invert ?? false;
    this.name = options.name;
  }
  
  shouldRetain(item: MemoryItem): boolean {
    // Item must have metadata
    if (!item.metadata) {
      return !this.invert; // If inverted, remove items without metadata
    }
    
    // Check if item matches all criteria
    const matches = Object.entries(this.criteria).every(([key, value]) => {
      return item.metadata?.[key] === value;
    });
    
    // Apply inversion if needed
    return this.invert ? !matches : matches;
  }
  
  async applyToMemory(memory: BaseMemory): Promise<number> {
    // Get all items
    const allItems = await memory.search({ limit: Number.MAX_SAFE_INTEGER });
    
    let removedCount = 0;
    
    // Check each item against metadata criteria
    for (const item of allItems.items) {
      if (!this.shouldRetain(item)) {
        await memory.remove(item.id);
        removedCount++;
      }
    }
    
    return removedCount;
  }
}

/**
 * Retention policy factory with common policy creation methods
 */
export class RetentionPolicyFactory {
  /**
   * Create a policy that retains items based on age
   */
  static createTimeBasedPolicy(maxAgeMs: number, timeField: 'createdAt' | 'lastAccessedAt' | 'updatedAt' = 'createdAt'): RetentionPolicy {
    return new TimeBasedRetentionPolicy({
      maxAgeMs,
      timeField,
      name: `TimeBasedRetention(${timeField}, ${maxAgeMs}ms)`
    });
  }
  
  /**
   * Create a policy that retains a maximum number of items
   */
  static createCountBasedPolicy(maxItems: number, strategy: 'oldest' | 'leastAccessed' = 'oldest'): RetentionPolicy {
    return new CountBasedRetentionPolicy({
      maxItems,
      strategy,
      name: `CountBasedRetention(${maxItems}, ${strategy})`
    });
  }
  
  /**
   * Create a policy that retains items based on relevance score
   */
  static createRelevanceBasedPolicy(threshold: number, relevanceFn?: (item: MemoryItem) => number): RetentionPolicy {
    return new RelevanceBasedRetentionPolicy({
      threshold,
      relevanceFn,
      name: `RelevanceBasedRetention(${threshold})`
    });
  }
  
  /**
   * Create a policy that combines multiple policies
   */
  static createCompositePolicy(policies: RetentionPolicy[], mode: 'all' | 'any' = 'any'): RetentionPolicy {
    const policyNames = policies.map(p => p.name || 'unnamed').join(',');
    return new CompositeRetentionPolicy({
      policies,
      mode,
      name: `CompositeRetention(${mode}, [${policyNames}])`
    });
  }
  
  /**
   * Create a policy that retains items based on metadata
   */
  static createMetadataBasedPolicy(criteria: Record<string, any>, invert: boolean = false): RetentionPolicy {
    const criteriaStr = JSON.stringify(criteria).slice(0, 50) + (JSON.stringify(criteria).length > 50 ? '...' : '');
    return new MetadataBasedRetentionPolicy({
      criteria,
      invert,
      name: `MetadataBasedRetention(${criteriaStr}, invert=${invert})`
    });
  }
}
