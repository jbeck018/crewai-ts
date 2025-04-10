/**
 * Storage Adapters Index
 * 
 * Exports all storage adapter implementations for simplified imports
 * Optimized for memory-efficient loading
 */

// Base storage adapter interface and implementation
export * from './StorageAdapter.js';

// Concrete storage adapter implementations
export * from './InMemoryStorageAdapter.js';
export * from './FileStorageAdapter.js';
export * from './SQLiteStorageAdapter.js';
export * from './RedisStorageAdapter.js';
export * from './MongoDBStorageAdapter.js';

// CLI-specific storage implementations
export * from './KickoffTaskOutputsStorage.js';
export * from './LongTermMemoryStorage.js';
export * from './ShortTermMemoryStorage.js';
export * from './EntityMemoryStorage.js';
