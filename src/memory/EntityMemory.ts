/**
 * EntityMemory implementation
 * Optimized for storing and retrieving information about entities
 */

import { v4 as uuidv4 } from 'uuid';
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
  entityRecognizer?: (text: string) => Promise<Array<{ name: string; type: string; confidence?: number }>>;
}

/**
 * EntityMemory class for storing and retrieving information about entities
 * Optimized for:
 * - Efficient entity storage and retrieval
 * - Relationship tracking between entities
 * - Entity attribute management
 */
export class EntityMemory implements BaseMemory {
  private entities = new Map<string, Entity>();
  private entityByName = new Map<string, Set<string>>(); // Maps normalized names to entity IDs
  private entityByType = new Map<string, Set<string>>(); // Maps types to entity IDs
  private maxEntities: number;
  private useCache: boolean;
  private cacheSize: number;
  private trackSources: boolean;
  private trackHistory: boolean;
  private entityRecognizer?: (text: string) => Promise<Array<{ name: string; type: string; confidence?: number }>>;
  
  // LRU cache for entities
  private cacheOrder: string[] = [];
  
  constructor(options: EntityMemoryOptions = {}) {
    this.maxEntities = options.maxEntities ?? 10000;
    this.useCache = options.useCache ?? true;
    this.cacheSize = options.cacheSize ?? 1000;
    this.trackSources = options.trackSources ?? true;
    this.trackHistory = options.trackHistory ?? false;
    this.entityRecognizer = options.entityRecognizer;
  }
  
  /**
   * Add a memory item and extract entities from it
   */
  async add(content: string, metadata?: Record<string, any>): Promise<MemoryItem> {
    // Create a memory item
    const item: MemoryItem = {
      id: uuidv4(),
      content,
      metadata,
      createdAt: Date.now()
    };
    
    // Extract entities from the content
    const extractedEntities = await this.extractEntities(content);
    
    // Add or update entities
    for (const entity of extractedEntities) {
      await this.addOrUpdateEntity(entity.name, entity.type, {
        source: item.id
      });
    }
    
    return item;
  }
  
  /**
   * Search for memory items based on entities
   */
  async search(params: MemorySearchParams): Promise<MemorySearchResult> {
    const { query, metadata, limit = 10, offset = 0 } = params;
    
    // If query contains entity mentions, prioritize those
    let entities: Entity[] = [];
    
    if (query) {
      // Extract entities from the query
      const extractedEntities = await this.extractEntities(query);
      
      // Get the full entity objects for each extracted entity
      for (const extractedEntity of extractedEntities) {
        const entityIds = this.getEntityIdsByName(extractedEntity.name);
        
        for (const id of entityIds) {
          const entity = this.entities.get(id);
          if (entity && (!extractedEntity.type || entity.type === extractedEntity.type)) {
            entities.push(entity);
          }
        }
      }
      
      // If we didn't find any entities by name, try to find by type
      if (entities.length === 0) {
        // Try to find entities by type if the query looks like a type
        const possibleType = query.toLowerCase().trim();
        const typeEntityIds = this.entityByType.get(possibleType);
        
        if (typeEntityIds) {
          for (const id of typeEntityIds) {
            const entity = this.entities.get(id);
            if (entity) {
              entities.push(entity);
            }
          }
        }
      }
    }
    
    // If we still don't have any entities, return most recently accessed entities
    if (entities.length === 0) {
      entities = Array.from(this.entities.values())
        .sort((a, b) => (b.lastAccessedAt || b.updatedAt) - (a.lastAccessedAt || a.updatedAt));
    }
    
    // Apply metadata filtering if provided
    if (metadata) {
      entities = entities.filter(entity => {
        for (const [key, value] of Object.entries(metadata)) {
          if (entity.attributes[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }
    
    // Paginate results
    const paginatedEntities = entities.slice(offset, offset + limit);
    
    // Convert entities to memory items
    const items: MemoryItem[] = paginatedEntities.map(entity => ({
      id: entity.id,
      content: this.formatEntityAsContent(entity),
      metadata: {
        entityName: entity.name,
        entityType: entity.type,
        ...entity.attributes
      },
      createdAt: entity.createdAt,
      lastAccessedAt: entity.lastAccessedAt || entity.updatedAt,
      relevanceScore: 1.0 // All direct entity matches are highly relevant
    }));
    
    // Update access time for retrieved entities
    for (const entity of paginatedEntities) {
      this.updateEntityAccessTime(entity.id);
    }
    
    return {
      items,
      total: entities.length
    };
  }
  
  /**
   * Get a memory item by ID
   * For EntityMemory, this retrieves an entity by ID
   */
  async get(id: string): Promise<MemoryItem | null> {
    const entity = this.entities.get(id);
    
    if (!entity) {
      return null;
    }
    
    // Update access time
    this.updateEntityAccessTime(id);
    
    // Convert entity to a memory item
    return {
      id: entity.id,
      content: this.formatEntityAsContent(entity),
      metadata: {
        entityName: entity.name,
        entityType: entity.type,
        ...entity.attributes
      },
      createdAt: entity.createdAt,
      lastAccessedAt: entity.lastAccessedAt || entity.updatedAt
    };
  }
  
  /**
   * Update a memory item
   * For EntityMemory, this updates an entity
   */
  async update(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): Promise<MemoryItem | null> {
    const entity = this.entities.get(id);
    
    if (!entity) {
      return null;
    }
    
    // Extract entity details from the update content if provided
    if (updates.content) {
      const extractedEntities = await this.extractEntities(updates.content);
      const matchingEntity = extractedEntities.find(e => 
        this.normalizeEntityName(e.name) === this.normalizeEntityName(entity.name) ||
        e.type === entity.type
      );
      
      if (matchingEntity) {
        // Update entity attributes based on new content
        // (In a real implementation, this would use NLP to extract attributes)
        entity.name = matchingEntity.name; // Update name if it changed
      }
    }
    
    // Update metadata as attributes
    if (updates.metadata) {
      for (const [key, value] of Object.entries(updates.metadata)) {
        if (key !== 'entityName' && key !== 'entityType') {
          entity.attributes[key] = value;
        }
      }
    }
    
    // Update entity
    entity.updatedAt = Date.now();
    entity.lastAccessedAt = Date.now();
    
    // Update indexes if name changed
    if (updates.metadata?.entityName && updates.metadata.entityName !== entity.name) {
      // Remove from old name index
      const oldNormalizedName = this.normalizeEntityName(entity.name);
      const oldNameSet = this.entityByName.get(oldNormalizedName);
      if (oldNameSet) {
        oldNameSet.delete(id);
        if (oldNameSet.size === 0) {
          this.entityByName.delete(oldNormalizedName);
        }
      }
      
      // Update entity name
      entity.name = updates.metadata.entityName as string;
      
      // Add to new name index
      const newNormalizedName = this.normalizeEntityName(entity.name);
      const newNameSet = this.entityByName.get(newNormalizedName) || new Set<string>();
      newNameSet.add(id);
      this.entityByName.set(newNormalizedName, newNameSet);
    }
    
    // Update type index if type changed
    if (updates.metadata?.entityType && updates.metadata.entityType !== entity.type) {
      // Remove from old type index
      const oldTypeSet = this.entityByType.get(entity.type);
      if (oldTypeSet) {
        oldTypeSet.delete(id);
        if (oldTypeSet.size === 0) {
          this.entityByType.delete(entity.type);
        }
      }
      
      // Update entity type
      entity.type = updates.metadata.entityType as string;
      
      // Add to new type index
      const newTypeSet = this.entityByType.get(entity.type) || new Set<string>();
      newTypeSet.add(id);
      this.entityByType.set(entity.type, newTypeSet);
    }
    
    // Update entity in storage
    this.entities.set(id, entity);
    
    // Update cache order if using cache
    if (this.useCache) {
      this.updateCacheOrder(id);
    }
    
    // Convert updated entity to memory item
    return {
      id: entity.id,
      content: this.formatEntityAsContent(entity),
      metadata: {
        entityName: entity.name,
        entityType: entity.type,
        ...entity.attributes
      },
      createdAt: entity.createdAt,
      lastAccessedAt: entity.lastAccessedAt
    };
  }
  
  /**
   * Remove a memory item
   * For EntityMemory, this removes an entity
   */
  async remove(id: string): Promise<boolean> {
    const entity = this.entities.get(id);
    
    if (!entity) {
      return false;
    }
    
    // Remove from name index
    const normalizedName = this.normalizeEntityName(entity.name);
    const nameSet = this.entityByName.get(normalizedName);
    if (nameSet) {
      nameSet.delete(id);
      if (nameSet.size === 0) {
        this.entityByName.delete(normalizedName);
      }
    }
    
    // Remove from type index
    const typeSet = this.entityByType.get(entity.type);
    if (typeSet) {
      typeSet.delete(id);
      if (typeSet.size === 0) {
        this.entityByType.delete(entity.type);
      }
    }
    
    // Remove entity
    this.entities.delete(id);
    
    // Remove from cache if using cache
    if (this.useCache) {
      this.cacheOrder = this.cacheOrder.filter(entityId => entityId !== id);
    }
    
    return true;
  }
  
  /**
   * Clear all entities from memory
   */
  async clear(): Promise<void> {
    this.entities.clear();
    this.entityByName.clear();
    this.entityByType.clear();
    this.cacheOrder = [];
  }
  
  /**
   * Reset the memory
   */
  async reset(): Promise<void> {
    await this.clear();
  }
  
  /**
   * Add or update an entity in the memory
   */
  async addOrUpdateEntity(
    name: string,
    type: string,
    attributes: Record<string, any> = {}
  ): Promise<Entity> {
    // Check if entity already exists
    const normalizedName = this.normalizeEntityName(name);
    const existingIds = this.entityByName.get(normalizedName) || new Set<string>();
    let existingId: string | undefined;
    
    // Find an existing entity with matching name and type
    for (const id of existingIds) {
      const entity = this.entities.get(id);
      if (entity && entity.type === type) {
        existingId = id;
        break;
      }
    }
    
    if (existingId) {
      // Update existing entity
      const entity = this.entities.get(existingId)!;
      
      // Update attributes
      for (const [key, value] of Object.entries(attributes)) {
        if (key === 'source' && this.trackSources) {
          // Add to sources if not already present
          entity.sources = entity.sources || [];
          if (!entity.sources.includes(value)) {
            entity.sources.push(value);
          }
        } else {
          entity.attributes[key] = value;
        }
      }
      
      // Update timestamps
      entity.updatedAt = Date.now();
      entity.lastAccessedAt = Date.now();
      
      // Update in storage
      this.entities.set(existingId, entity);
      
      // Update cache order if using cache
      if (this.useCache) {
        this.updateCacheOrder(existingId);
      }
      
      return entity;
    } else {
      // Create new entity
      const id = uuidv4();
      const now = Date.now();
      
      const entity: Entity = {
        id,
        name,
        type,
        attributes: {},
        relationships: [],
        createdAt: now,
        updatedAt: now,
        lastAccessedAt: now
      };
      
      // Set attributes
      for (const [key, value] of Object.entries(attributes)) {
        if (key === 'source' && this.trackSources) {
          entity.sources = [value];
        } else {
          entity.attributes[key] = value;
        }
      }
      
      // Check if we need to make room for the new entity
      if (this.entities.size >= this.maxEntities) {
        this.evictEntity();
      }
      
      // Add to storage
      this.entities.set(id, entity);
      
      // Add to indexes
      // Name index
      const nameSet = this.entityByName.get(normalizedName) || new Set<string>();
      nameSet.add(id);
      this.entityByName.set(normalizedName, nameSet);
      
      // Type index
      const typeSet = this.entityByType.get(type) || new Set<string>();
      typeSet.add(id);
      this.entityByType.set(type, typeSet);
      
      // Add to cache if using cache
      if (this.useCache) {
        this.updateCacheOrder(id);
      }
      
      return entity;
    }
  }
  
  /**
   * Get entities by name
   */
  getEntitiesByName(name: string): Entity[] {
    const normalizedName = this.normalizeEntityName(name);
    const ids = this.entityByName.get(normalizedName) || new Set<string>();
    const entities: Entity[] = [];
    
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity) {
        entities.push(entity);
        this.updateEntityAccessTime(id);
      }
    }
    
    return entities;
  }
  
  /**
   * Get entities by type
   */
  getEntitiesByType(type: string): Entity[] {
    const ids = this.entityByType.get(type) || new Set<string>();
    const entities: Entity[] = [];
    
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity) {
        entities.push(entity);
        this.updateEntityAccessTime(id);
      }
    }
    
    return entities;
  }
  
  /**
   * Add a relationship between entities
   */
  addEntityRelationship(
    sourceEntityId: string,
    relation: string,
    targetEntityId: string,
    metadata?: Record<string, any>,
    confidence = 1.0
  ): boolean {
    const sourceEntity = this.entities.get(sourceEntityId);
    const targetEntity = this.entities.get(targetEntityId);
    
    if (!sourceEntity || !targetEntity) {
      return false;
    }
    
    // Check if relationship already exists
    const existingRelationship = sourceEntity.relationships.find(
      r => r.relation === relation && r.entityId === targetEntityId
    );
    
    if (existingRelationship) {
      // Update existing relationship
      existingRelationship.metadata = metadata;
      existingRelationship.confidence = confidence;
    } else {
      // Add new relationship
      sourceEntity.relationships.push({
        relation,
        entityId: targetEntityId,
        metadata,
        confidence
      });
    }
    
    // Update entity
    sourceEntity.updatedAt = Date.now();
    this.entities.set(sourceEntityId, sourceEntity);
    
    return true;
  }
  
  /**
   * Get relationships for an entity
   */
  getEntityRelationships(entityId: string, relation?: string): Array<{ entity: Entity; relation: string; metadata?: Record<string, any> }> {
    const entity = this.entities.get(entityId);
    
    if (!entity) {
      return [];
    }
    
    // Update access time
    this.updateEntityAccessTime(entityId);
    
    // Filter relationships by relation if provided
    const relationships = relation
      ? entity.relationships.filter(r => r.relation === relation)
      : entity.relationships;
    
    // Get related entities
    const result: Array<{ entity: Entity; relation: string; metadata?: Record<string, any> }> = [];
    
    for (const relationship of relationships) {
      const relatedEntity = this.entities.get(relationship.entityId);
      
      if (relatedEntity) {
        result.push({
          entity: relatedEntity,
          relation: relationship.relation,
          metadata: relationship.metadata
        });
        
        // Update access time for related entity
        this.updateEntityAccessTime(relationship.entityId);
      }
    }
    
    return result;
  }
  
  /**
   * Get entity IDs by name
   */
  private getEntityIdsByName(name: string): Set<string> {
    const normalizedName = this.normalizeEntityName(name);
    return this.entityByName.get(normalizedName) || new Set<string>();
  }
  
  /**
   * Extract entities from text
   */
  private async extractEntities(text: string): Promise<Array<{ name: string; type: string; confidence?: number }>> {
    // If a custom entity recognizer is provided, use it
    if (this.entityRecognizer) {
      return this.entityRecognizer(text);
    }
    
    // Simple entity extraction using patterns (in a real implementation, this would use NLP)
    const entities: Array<{ name: string; type: string; confidence?: number }> = [];
    
    // Simple person detection
    const personRegex = /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)\b/g;
    let match;
    while ((match = personRegex.exec(text)) !== null) {
      entities.push({
        name: match[1],
        type: 'person',
        confidence: 0.8
      });
    }
    
    // Simple location detection
    const locationRegex = /\b(?:in|at|from|to) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)\b/g;
    while ((match = locationRegex.exec(text)) !== null) {
      entities.push({
        name: match[1],
        type: 'location',
        confidence: 0.6
      });
    }
    
    // Simple organization detection
    const orgRegex = /\b(?:The|A) ([A-Z][a-z]+(?: [A-Z][a-z]+)*) (?:Company|Corporation|Inc\.|Organization|Foundation)\b/g;
    while ((match = orgRegex.exec(text)) !== null) {
      entities.push({
        name: match[0],
        type: 'organization',
        confidence: 0.7
      });
    }
    
    return entities;
  }
  
  /**
   * Normalize entity name for consistent lookup
   */
  private normalizeEntityName(name: string): string {
    return name.toLowerCase().trim();
  }
  
  /**
   * Update entity access time
   */
  private updateEntityAccessTime(id: string): void {
    const entity = this.entities.get(id);
    
    if (entity) {
      entity.lastAccessedAt = Date.now();
      this.entities.set(id, entity);
      
      // Update cache order if using cache
      if (this.useCache) {
        this.updateCacheOrder(id);
      }
    }
  }
  
  /**
   * Update the order of entities in cache (LRU tracking)
   */
  private updateCacheOrder(id: string): void {
    // Remove from current position
    this.cacheOrder = this.cacheOrder.filter(entityId => entityId !== id);
    
    // Add to the end (most recently used)
    this.cacheOrder.push(id);
    
    // If cache exceeds size, remove oldest items
    while (this.cacheOrder.length > this.cacheSize) {
      this.cacheOrder.shift();
    }
  }
  
  /**
   * Evict an entity based on LRU policy
   */
  private evictEntity(): void {
    // If using cache, evict the least recently used entity
    if (this.useCache && this.cacheOrder.length > 0) {
      const idToRemove = this.cacheOrder.shift();
      if (idToRemove) {
        const entity = this.entities.get(idToRemove);
        
        if (entity) {
          // Remove from name index
          const normalizedName = this.normalizeEntityName(entity.name);
          const nameSet = this.entityByName.get(normalizedName);
          if (nameSet) {
            nameSet.delete(idToRemove);
            if (nameSet.size === 0) {
              this.entityByName.delete(normalizedName);
            }
          }
          
          // Remove from type index
          const typeSet = this.entityByType.get(entity.type);
          if (typeSet) {
            typeSet.delete(idToRemove);
            if (typeSet.size === 0) {
              this.entityByType.delete(entity.type);
            }
          }
          
          // Remove entity
          this.entities.delete(idToRemove);
        }
      }
    } else {
      // If not using cache, remove a random entity
      const keys = Array.from(this.entities.keys());
      if (keys.length > 0) {
        const randomIndex = Math.floor(Math.random() * keys.length);
        const idToRemove = keys[randomIndex];
        const entity = this.entities.get(idToRemove);
        
        if (entity) {
          // Remove from name index
          const normalizedName = this.normalizeEntityName(entity.name);
          const nameSet = this.entityByName.get(normalizedName);
          if (nameSet) {
            nameSet.delete(idToRemove);
            if (nameSet.size === 0) {
              this.entityByName.delete(normalizedName);
            }
          }
          
          // Remove from type index
          const typeSet = this.entityByType.get(entity.type);
          if (typeSet) {
            typeSet.delete(idToRemove);
            if (typeSet.size === 0) {
              this.entityByType.delete(entity.type);
            }
          }
          
          // Remove entity
          this.entities.delete(idToRemove);
        }
      }
    }
  }
  
  /**
   * Format entity as text content
   */
  private formatEntityAsContent(entity: Entity): string {
    const lines: string[] = [
      `Entity: ${entity.name}`,
      `Type: ${entity.type}`
    ];
    
    // Add attributes
    if (Object.keys(entity.attributes).length > 0) {
      lines.push('Attributes:');
      for (const [key, value] of Object.entries(entity.attributes)) {
        lines.push(`  ${key}: ${value}`);
      }
    }
    
    // Add relationships
    if (entity.relationships.length > 0) {
      lines.push('Relationships:');
      for (const relationship of entity.relationships) {
        const relatedEntity = this.entities.get(relationship.entityId);
        if (relatedEntity) {
          lines.push(`  ${relationship.relation} ${relatedEntity.name}`);
        }
      }
    }
    
    return lines.join('\n');
  }
}
