/**
 * EntityMemory implementation
 * Optimized for storing and retrieving information about entities
 */
import { BaseMemory, MemoryItem, MemorySearchParams, MemorySearchResult } from './BaseMemory.js';
/**
 * Entity representation
 */
export interface Entity {
    id: string;
    name: string;
    type: string;
    attributes: Record<string, any>;
    relationships: EntityRelationship[];
    createdAt: number;
    updatedAt: number;
    lastAccessedAt?: number;
    sources?: string[];
}
/**
 * Relationship between entities
 */
export interface EntityRelationship {
    relation: string;
    entityId: string;
    metadata?: Record<string, any>;
    confidence?: number;
}
/**
 * Options for configuring EntityMemory behavior
 */
export interface EntityMemoryOptions {
    /**
     * Maximum number of entities to store in memory
     * @default 10000
     */
    maxEntities?: number;
    /**
     * Whether to use an LRU cache for entity access
     * @default true
     */
    useCache?: boolean;
    /**
     * Size of the LRU cache for entities
     * @default 1000
     */
    cacheSize?: number;
    /**
     * Whether to track the sources of entity information
     * @default true
     */
    trackSources?: boolean;
    /**
     * Whether to store a history of entity changes
     * @default false
     */
    trackHistory?: boolean;
    /**
     * Custom entity recognizer function
     * If provided, this will be used to extract entities from text
     */
    entityRecognizer?: (text: string) => Promise<Array<{
        name: string;
        type: string;
        confidence?: number;
    }>>;
}
/**
 * EntityMemory class for storing and retrieving information about entities
 * Optimized for:
 * - Efficient entity storage and retrieval
 * - Relationship tracking between entities
 * - Entity attribute management
 */
export declare class EntityMemory implements BaseMemory {
    private entities;
    private entityByName;
    private entityByType;
    private maxEntities;
    private useCache;
    private cacheSize;
    private trackSources;
    private trackHistory;
    private entityRecognizer?;
    private cacheOrder;
    constructor(options?: EntityMemoryOptions);
    /**
     * Add a memory item and extract entities from it
     */
    add(content: string, metadata?: Record<string, any>): Promise<MemoryItem>;
    /**
     * Search for memory items based on entities
     */
    search(params: MemorySearchParams): Promise<MemorySearchResult>;
    /**
     * Get a memory item by ID
     * For EntityMemory, this retrieves an entity by ID
     */
    get(id: string): Promise<MemoryItem | null>;
    /**
     * Update a memory item
     * For EntityMemory, this updates an entity
     */
    update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null>;
    /**
     * Remove a memory item
     * For EntityMemory, this removes an entity
     */
    remove(id: string): Promise<boolean>;
    /**
     * Clear all entities from memory
     */
    clear(): Promise<void>;
    /**
     * Reset the memory
     */
    reset(): Promise<void>;
    /**
     * Add or update an entity in the memory
     */
    addOrUpdateEntity(name: string, type: string, attributes?: Record<string, any>): Promise<Entity>;
    /**
     * Get entities by name
     */
    getEntitiesByName(name: string): Entity[];
    /**
     * Get entities by type
     */
    getEntitiesByType(type: string): Entity[];
    /**
     * Add a relationship between entities
     */
    addEntityRelationship(sourceEntityId: string, relation: string, targetEntityId: string, metadata?: Record<string, any>, confidence?: number): boolean;
    /**
     * Get relationships for an entity
     */
    getEntityRelationships(entityId: string, relation?: string): Array<{
        entity: Entity;
        relation: string;
        metadata?: Record<string, any>;
    }>;
    /**
     * Get entity IDs by name
     */
    private getEntityIdsByName;
    /**
     * Extract entities from text
     */
    private extractEntities;
    /**
     * Normalize entity name for consistent lookup
     */
    private normalizeEntityName;
    /**
     * Update entity access time
     */
    private updateEntityAccessTime;
    /**
     * Update the order of entities in cache (LRU tracking)
     */
    private updateCacheOrder;
    /**
     * Evict an entity based on LRU policy
     * Optimized for performance with null safety
     */
    private evictEntity;
    /**
     * Format entity as text content
     */
    private formatEntityAsContent;
}
//# sourceMappingURL=EntityMemory.d.ts.map