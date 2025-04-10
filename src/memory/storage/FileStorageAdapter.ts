/**
 * FileStorageAdapter
 * 
 * A file-based implementation of the StorageAdapter interface
 * Optimized for persistence in Node.js environments
 */

import fs from 'fs/promises';
import path from 'path';
import { BaseStorageAdapter, StorageAdapterOptions } from './StorageAdapter.js';

/**
 * FileStorageAdapter Options
 */
export interface FileStorageOptions extends StorageAdapterOptions {
  /**
   * Directory path where files will be stored
   */
  directory: string;
  
  /**
   * Whether to use a single file for all data or separate files per key
   * Single file mode is faster for small datasets, separate files for large datasets
   */
  singleFile?: boolean;
  
  /**
   * How often to sync data to disk (in milliseconds)
   * Only used in single file mode
   */
  syncIntervalMs?: number;
  
  /**
   * Whether to create a backup before writing
   */
  createBackups?: boolean;
  
  /**
   * Maximum backup files to keep
   */
  maxBackups?: number;
}

/**
 * FileStorageAdapter implements the StorageAdapter interface
 * using the filesystem for persistent storage with optimizations
 * for both small and large datasets
 */
export class FileStorageAdapter extends BaseStorageAdapter {
  private directory: string;
  private singleFile: boolean;
  private singleFileData: Map<string, { value: any; timestamp: number }>;
  private syncInterval: number;
  private syncTimeout: NodeJS.Timeout | null = null;
  private dirtyKeys: Set<string>;
  private initialized = false;
  private createBackups: boolean;
  private maxBackups: number;
  
  constructor(options: FileStorageOptions) {
    super(options);
    
    this.directory = path.resolve(options.directory);
    this.singleFile = options.singleFile ?? true;
    this.syncInterval = options.syncIntervalMs || 1000;
    this.createBackups = options.createBackups ?? false;
    this.maxBackups = options.maxBackups || 5;
    
    // For single file mode
    this.singleFileData = new Map();
    this.dirtyKeys = new Set();
    
    // Initialize storage
    this.init();
  }
  
  /**
   * Initialize the storage adapter
   */
  private async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(this.directory, { recursive: true });
      
      // Load data in single file mode
      if (this.singleFile) {
        await this.loadSingleFileData();
      }
      
      this.initialized = true;
    } catch (error) {
      if (this.options.debug) {
        console.error('Error initializing FileStorageAdapter:', error);
      }
      throw error;
    }
  }
  
  /**
   * Ensure initialization is complete
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }
  
  /**
   * Save a value with efficient file handling
   */
  async save(key: string, value: any): Promise<void> {
    await this.ensureInitialized();
    
    const namespacedKey = this.getNamespacedKey(key);
    const timestamp = Date.now();
    
    if (this.singleFile) {
      // In single file mode, update in-memory map and schedule sync
      this.singleFileData.set(namespacedKey, { value, timestamp });
      this.dirtyKeys.add(namespacedKey);
      this.scheduleSyncToFile();
    } else {
      // In multi-file mode, write directly to individual file
      const filePath = this.getFilePath(namespacedKey);
      const dataToWrite = this.serialize({
        value,
        timestamp
      });
      
      try {
        // Create backup if enabled
        if (this.createBackups && await this.fileExists(filePath)) {
          await this.createBackup(filePath);
        }
        
        // Write to file
        await fs.writeFile(filePath, dataToWrite, 'utf8');
      } catch (error) {
        if (this.options.debug) {
          console.error(`Error saving key ${key}:`, error);
        }
        throw error;
      }
    }
  }
  
  /**
   * Load a value with efficient file handling
   */
  async load(key: string): Promise<any | null> {
    await this.ensureInitialized();
    
    const namespacedKey = this.getNamespacedKey(key);
    
    if (this.singleFile) {
      // In single file mode, read from in-memory map
      const item = this.singleFileData.get(namespacedKey);
      
      if (!item) return null;
      
      // Check for expiration
      if (this.isExpired(item.timestamp)) {
        await this.delete(key);
        return null;
      }
      
      return item.value;
    } else {
      // In multi-file mode, read from individual file
      const filePath = this.getFilePath(namespacedKey);
      
      try {
        // Check if file exists
        if (!await this.fileExists(filePath)) {
          return null;
        }
        
        // Read and parse file
        const fileContent = await fs.readFile(filePath, 'utf8');
        const item = this.deserialize(fileContent);
        
        // Check for expiration
        if (this.isExpired(item.timestamp)) {
          await this.delete(key);
          return null;
        }
        
        return item.value;
      } catch (error) {
        if (this.options.debug) {
          console.error(`Error loading key ${key}:`, error);
        }
        return null;
      }
    }
  }
  
  /**
   * Delete a value with cleanup
   */
  async delete(key: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const namespacedKey = this.getNamespacedKey(key);
    
    if (this.singleFile) {
      // In single file mode, remove from in-memory map and schedule sync
      const deleted = this.singleFileData.delete(namespacedKey);
      
      if (deleted) {
        this.dirtyKeys.add(namespacedKey); // Mark as dirty for sync
        this.scheduleSyncToFile();
      }
      
      return deleted;
    } else {
      // In multi-file mode, delete individual file
      const filePath = this.getFilePath(namespacedKey);
      
      try {
        // Check if file exists
        if (!await this.fileExists(filePath)) {
          return false;
        }
        
        // Create backup if enabled
        if (this.createBackups) {
          await this.createBackup(filePath);
        }
        
        // Delete file
        await fs.unlink(filePath);
        return true;
      } catch (error) {
        if (this.options.debug) {
          console.error(`Error deleting key ${key}:`, error);
        }
        return false;
      }
    }
  }
  
  /**
   * Clear all values with efficient cleanup
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();
    
    if (this.singleFile) {
      // In single file mode, clear in-memory map and sync to file
      this.singleFileData.clear();
      this.dirtyKeys.clear();
      
      try {
        const filePath = this.getSingleFilePath();
        
        // Create backup if enabled
        if (this.createBackups && await this.fileExists(filePath)) {
          await this.createBackup(filePath);
        }
        
        // Write empty object to file
        await fs.writeFile(filePath, '{}', 'utf8');
      } catch (error) {
        if (this.options.debug) {
          console.error('Error clearing storage:', error);
        }
      }
    } else {
      // In multi-file mode, read directory and delete all files
      try {
        const prefix = `${this.options.namespace}-`;
        const files = await fs.readdir(this.directory);
        
        for (const file of files) {
          if (file.startsWith(prefix)) {
            const filePath = path.join(this.directory, file);
            
            // Create backup if enabled
            if (this.createBackups) {
              await this.createBackup(filePath);
            }
            
            await fs.unlink(filePath);
          }
        }
      } catch (error) {
        if (this.options.debug) {
          console.error('Error clearing storage:', error);
        }
        throw error;
      }
    }
  }
  
  /**
   * Get all keys with namespace handling
   */
  async keys(): Promise<string[]> {
    await this.ensureInitialized();
    
    const prefix = `${this.options.namespace}:`;
    
    if (this.singleFile) {
      // In single file mode, get keys from in-memory map
      return Array.from(this.singleFileData.keys())
        .filter(key => key.startsWith(prefix))
        .map(key => key.substring(prefix.length));
    } else {
      // In multi-file mode, read directory and extract keys from filenames
      try {
        const filePrefix = `${this.options.namespace}-`;
        const files = await fs.readdir(this.directory);
        const keys: string[] = [];
        
        for (const file of files) {
          if (file.startsWith(filePrefix)) {
            // Remove prefix and extension
            const encodedKey = file.substring(filePrefix.length, file.length - 5); // Remove .json
            const key = decodeURIComponent(encodedKey);
            
            // Skip expired items
            const filePath = path.join(this.directory, file);
            try {
              const fileContent = await fs.readFile(filePath, 'utf8');
              const item = this.deserialize(fileContent);
              
              if (!this.isExpired(item.timestamp)) {
                keys.push(key);
              } else {
                // Clean up expired items
                await fs.unlink(filePath);
              }
            } catch (e) {
              // Skip files that can't be read
              if (this.options.debug) {
                console.warn(`Skipping unreadable file: ${file}`);
              }
            }
          }
        }
        
        return keys;
      } catch (error) {
        if (this.options.debug) {
          console.error('Error listing keys:', error);
        }
        return [];
      }
    }
  }
  
  /**
   * Force an immediate sync to disk
   */
  async sync(): Promise<void> {
    if (!this.singleFile || this.dirtyKeys.size === 0) return;
    
    // Clear the sync timeout
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    
    await this.syncToFile();
  }
  
  /**
   * Close the storage adapter and release resources
   */
  async close(): Promise<void> {
    // Sync any pending changes
    await this.sync();
    
    // Clear timeout
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
  }
  
  /**
   * Helper: Schedule a sync to file
   */
  private scheduleSyncToFile(): void {
    if (this.syncTimeout) return; // Already scheduled
    
    this.syncTimeout = setTimeout(async () => {
      await this.syncToFile();
      this.syncTimeout = null;
    }, this.syncInterval);
  }
  
  /**
   * Helper: Sync changes to file
   */
  private async syncToFile(): Promise<void> {
    if (!this.singleFile || this.dirtyKeys.size === 0) return;
    
    try {
      const filePath = this.getSingleFilePath();
      
      // Create backup if enabled
      if (this.createBackups && await this.fileExists(filePath)) {
        await this.createBackup(filePath);
      }
      
      // Create serializable data structure
      const data: Record<string, { value: any; timestamp: number }> = {};
      for (const [key, item] of this.singleFileData.entries()) {
        data[key] = item;
      }
      
      // Write to file
      await fs.writeFile(filePath, JSON.stringify(data), 'utf8');
      
      // Clear dirty keys
      this.dirtyKeys.clear();
    } catch (error) {
      if (this.options.debug) {
        console.error('Error syncing to file:', error);
      }
    }
  }
  
  /**
   * Helper: Load data from single file
   */
  private async loadSingleFileData(): Promise<void> {
    const filePath = this.getSingleFilePath();
    
    try {
      // Check if file exists
      if (!await this.fileExists(filePath)) {
        return;
      }
      
      // Read and parse file
      const fileContent = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(fileContent) as Record<string, { value: any; timestamp: number }>;
      
      // Load into memory and filter expired items
      for (const [key, item] of Object.entries(data)) {
        if (!this.isExpired(item.timestamp)) {
          this.singleFileData.set(key, item);
        }
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('Error loading data from file:', error);
      }
      // Initialize with empty data on error
      this.singleFileData = new Map();
    }
  }
  
  /**
   * Helper: Create a backup of a file
   */
  private async createBackup(filePath: string): Promise<void> {
    try {
      const timestamp = Date.now();
      const backupPath = `${filePath}.${timestamp}.bak`;
      
      // Copy file to backup
      await fs.copyFile(filePath, backupPath);
      
      // Cleanup old backups
      await this.cleanupBackups(filePath);
    } catch (error) {
      if (this.options.debug) {
        console.error('Error creating backup:', error);
      }
      // Non-fatal error, continue
    }
  }
  
  /**
   * Helper: Clean up old backups
   */
  private async cleanupBackups(filePath: string): Promise<void> {
    try {
      const dirPath = path.dirname(filePath);
      const baseName = path.basename(filePath);
      const files = await fs.readdir(dirPath);
      
      // Find all backups of this file
      const backups = files
        .filter(file => file.startsWith(`${baseName}.`) && file.endsWith('.bak'))
        .map(file => ({
          name: file,
          path: path.join(dirPath, file),
          timestamp: parseInt(file.split('.')[1], 10)
        }))
        .sort((a, b) => b.timestamp - a.timestamp); // Sort newest first
      
      // Keep only the newest maxBackups
      if (backups.length > this.maxBackups) {
        for (let i = this.maxBackups; i < backups.length; i++) {
          await fs.unlink(backups[i].path);
        }
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('Error cleaning up backups:', error);
      }
      // Non-fatal error, continue
    }
  }
  
  /**
   * Helper: Get the file path for a single file storage
   */
  private getSingleFilePath(): string {
    return path.join(this.directory, `${this.options.namespace}.json`);
  }
  
  /**
   * Helper: Get the file path for a multi-file key
   */
  private getFilePath(key: string): string {
    // Encode key to prevent invalid filesystem characters
    const encodedKey = encodeURIComponent(key);
    return path.join(this.directory, `${this.options.namespace}-${encodedKey}.json`);
  }
  
  /**
   * Helper: Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
