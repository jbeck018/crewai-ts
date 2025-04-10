/**
 * Storage adapter for entity memory
 * Optimized for memory efficiency and fast entity lookups
 */
import fs from 'fs';
import path from 'path';

// Entity interface with memory-efficient structure
export interface Entity {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, any>;
  timestamp: number;
  lastAccessed?: number;
}

/**
 * Entity memory storage implementation
 * Uses efficient indexing for fast entity retrieval
 */
export class EntityMemoryStorage {
  private dbPath: string;
  private cache: Map<string, Entity>;
  private nameIndex: Map<string, string[]>; // name -> [id1, id2, ...]
  private typeIndex: Map<string, string[]>; // type -> [id1, id2, ...]
  
  /**
   * Initialize storage with optimized indexing
   * @param dbPath Optional custom database path
   */
  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), '.crewai', 'entity_memory.json');
    this.cache = new Map<string, Entity>();
    this.nameIndex = new Map<string, string[]>();
    this.typeIndex = new Map<string, string[]>();
    
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
   * Save an entity
   * @param entity Entity to save (with or without ID and timestamp)
   * @returns Saved entity with ID and timestamps
   */
  async save(entity: Omit<Entity, 'id' | 'timestamp'> & { id?: string, timestamp?: number }): Promise<Entity> {
    const entities = await this.getAll();
    
    // Create complete entity with required fields
    const now = Date.now();
    const completeEntity: Entity = {
      id: entity.id || `ent_${now}_${Math.floor(Math.random() * 10000)}`,
      name: entity.name,
      type: entity.type,
      attributes: entity.attributes,
      timestamp: entity.timestamp || now,
      lastAccessed: now
    };
    
    // Check if entity already exists
    const existingIndex = completeEntity.id ? entities.findIndex(e => e.id === completeEntity.id) : -1;
    
    if (existingIndex >= 0) {
      // Update existing entity
      entities[existingIndex] = completeEntity;
    } else {
      // Add new entity
      entities.push(completeEntity);
    }
    
    // Write to storage with optimized I/O
    await fs.promises.writeFile(this.dbPath, JSON.stringify(entities, null, 2));
    
    // Update cache and indices
    this.updateCacheAndIndices(completeEntity);
    
    return completeEntity;
  }
  
  /**
   * Get all entities
   * @returns Array of entities
   */
  async getAll(): Promise<Entity[]> {
    try {
      const data = await fs.promises.readFile(this.dbPath, 'utf8');
      const entities: Entity[] = JSON.parse(data || '[]');
      
      // Rebuild cache and indices for efficient lookup
      this.rebuildIndices(entities);
      
      return entities;
    } catch (error) {
      console.error('Error loading entities:', error);
      return [];
    }
  }
  
  /**
   * Get an entity by ID
   * Uses efficient caching for performance
   * @param id Entity ID
   * @returns Entity or null if not found
   */
  async getById(id: string): Promise<Entity | null> {
    // Check cache first for performance
    if (this.cache.has(id)) {
      const entity = this.cache.get(id);
      if (entity) {
        // Update last accessed timestamp
        entity.lastAccessed = Date.now();
        return entity;
      }
    }
    
    const entities = await this.getAll();
    const entity = entities.find(e => e.id === id);
    
    if (entity) {
      // Update last accessed timestamp
      entity.lastAccessed = Date.now();
      this.updateCacheAndIndices(entity);
      
      // Save the updated timestamp
      const updatedEntities = entities.map(e => e.id === id ? entity : e);
      await fs.promises.writeFile(this.dbPath, JSON.stringify(updatedEntities, null, 2));
    }
    
    return entity || null;
  }
  
  /**
   * Get entities by name
   * Uses efficient name indexing
   * @param name Entity name
   * @returns Array of matching entities
   */
  async getByName(name: string): Promise<Entity[]> {
    const normalizedName = name.toLowerCase();
    
    // Use name index for faster lookup
    if (this.nameIndex.has(normalizedName)) {
      const ids = this.nameIndex.get(normalizedName) || [];
      const entities: Entity[] = [];
      
      for (const id of ids) {
        const entity = this.cache.get(id);
        if (entity) {
          // Update last accessed timestamp
          entity.lastAccessed = Date.now();
          entities.push(entity);
        }
      }
      
      if (entities.length > 0) {
        return entities;
      }
    }
    
    // Fall back to full scan if not in index
    const entities = await this.getAll();
    const matchingEntities = entities.filter(e => e.name.toLowerCase() === normalizedName);
    
    // Update last accessed timestamp
    const now = Date.now();
    matchingEntities.forEach(entity => {
      entity.lastAccessed = now;
      this.updateCacheAndIndices(entity);
    });
    
    // Save the updated timestamps if any matches
    if (matchingEntities.length > 0) {
      const updatedEntities = entities.map(e => {
        const matching = matchingEntities.find(me => me.id === e.id);
        return matching || e;
      });
      
      await fs.promises.writeFile(this.dbPath, JSON.stringify(updatedEntities, null, 2));
    }
    
    return matchingEntities;
  }
  
  /**
   * Get entities by type
   * Uses efficient type indexing
   * @param type Entity type
   * @returns Array of matching entities
   */
  async getByType(type: string): Promise<Entity[]> {
    const normalizedType = type.toLowerCase();
    
    // Use type index for faster lookup
    if (this.typeIndex.has(normalizedType)) {
      const ids = this.typeIndex.get(normalizedType) || [];
      const entities: Entity[] = [];
      
      for (const id of ids) {
        const entity = this.cache.get(id);
        if (entity) {
          // Update last accessed timestamp
          entity.lastAccessed = Date.now();
          entities.push(entity);
        }
      }
      
      if (entities.length > 0) {
        return entities;
      }
    }
    
    // Fall back to full scan if not in index
    const entities = await this.getAll();
    const matchingEntities = entities.filter(e => e.type.toLowerCase() === normalizedType);
    
    // Update last accessed timestamp
    const now = Date.now();
    matchingEntities.forEach(entity => {
      entity.lastAccessed = now;
    });
    
    // Save the updated timestamps if any matches
    if (matchingEntities.length > 0) {
      const updatedEntities = entities.map(e => {
        const matching = matchingEntities.find(me => me.id === e.id);
        return matching || e;
      });
      
      await fs.promises.writeFile(this.dbPath, JSON.stringify(updatedEntities, null, 2));
    }
    
    return matchingEntities;
  }
  
  /**
   * Delete an entity by ID
   * @param id Entity ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const entities = await this.getAll();
    const initialLength = entities.length;
    
    const filteredEntities = entities.filter(entity => entity.id !== id);
    
    if (filteredEntities.length === initialLength) {
      return false; // Entity not found
    }
    
    await fs.promises.writeFile(this.dbPath, JSON.stringify(filteredEntities, null, 2));
    
    // Remove from cache and indices
    const entity = this.cache.get(id);
    if (entity) {
      this.removeFromIndices(entity);
    }
    this.cache.delete(id);
    
    return true;
  }
  
  /**
   * Clear all entities
   */
  async clear(): Promise<void> {
    await fs.promises.writeFile(this.dbPath, JSON.stringify([]));
    this.cache.clear();
    this.nameIndex.clear();
    this.typeIndex.clear();
  }
  
  /**
   * Rebuild indices for efficient lookup
   * @param entities Array of entities
   */
  private rebuildIndices(entities: Entity[]): void {
    this.cache.clear();
    this.nameIndex.clear();
    this.typeIndex.clear();
    
    entities.forEach(entity => {
      this.updateCacheAndIndices(entity);
    });
  }
  
  /**
   * Update cache and indices with an entity
   * @param entity Entity to update in cache and indices
   */
  private updateCacheAndIndices(entity: Entity): void {
    // Update cache
    this.cache.set(entity.id, entity);
    
    // Update name index
    const normalizedName = entity.name.toLowerCase();
    if (!this.nameIndex.has(normalizedName)) {
      this.nameIndex.set(normalizedName, []);
    }
    const nameIds = this.nameIndex.get(normalizedName);
    if (nameIds && !nameIds.includes(entity.id)) {
      nameIds.push(entity.id);
    }
    
    // Update type index
    const normalizedType = entity.type.toLowerCase();
    if (!this.typeIndex.has(normalizedType)) {
      this.typeIndex.set(normalizedType, []);
    }
    const typeIds = this.typeIndex.get(normalizedType);
    if (typeIds && !typeIds.includes(entity.id)) {
      typeIds.push(entity.id);
    }
  }
  
  /**
   * Remove entity from indices
   * @param entity Entity to remove from indices
   */
  private removeFromIndices(entity: Entity): void {
    // Remove from name index
    const normalizedName = entity.name.toLowerCase();
    if (this.nameIndex.has(normalizedName)) {
      const nameIds = this.nameIndex.get(normalizedName);
      if (nameIds) {
        const nameIndex = nameIds.indexOf(entity.id);
        if (nameIndex >= 0) {
          nameIds.splice(nameIndex, 1);
          
          // Remove empty arrays
          if (nameIds.length === 0) {
            this.nameIndex.delete(normalizedName);
          }
        }
      }
    }
    
    // Remove from type index
    const normalizedType = entity.type.toLowerCase();
    if (this.typeIndex.has(normalizedType)) {
      const typeIds = this.typeIndex.get(normalizedType);
      if (typeIds) {
        const typeIndex = typeIds.indexOf(entity.id);
        if (typeIndex >= 0) {
          typeIds.splice(typeIndex, 1);
          
          // Remove empty arrays
          if (typeIds.length === 0) {
            this.typeIndex.delete(normalizedType);
          }
        }
      }
    }
  }
}
