/**
 * Storage Adapters Unit Tests
 * 
 * Tests all storage adapter implementations to ensure they conform to
 * the StorageAdapter interface and work correctly with optimization features
 */

import { expect } from 'chai';
import { nanoid } from 'nanoid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import all storage adapters
import { 
  StorageAdapter,
  InMemoryStorageAdapter,
  FileStorageAdapter, 
  // Only test these conditionally as they require external dependencies
  // SQLiteStorageAdapter,
  // RedisStorageAdapter
} from '../storage/index.js';

// Test values
interface TestItem {
  id: string;
  text: string;
  number: number;
  nested: {
    value: string;
    array: number[];
  };
}

/**
 * Shared tests for all storage adapters
 */
function runStorageAdapterTests(name: string, createAdapter: () => StorageAdapter) {
  describe(`${name} storage adapter`, () => {
    let adapter: StorageAdapter;
    
    // Setup
    beforeEach(() => {
      adapter = createAdapter();
    });
    
    // Teardown
    afterEach(async () => {
      // Clean up
      if (adapter) {
        // Clear storage
        await adapter.clear();
        
        // Close connection if adapter has close method
        if ('close' in adapter && typeof (adapter as any).close === 'function') {
          await (adapter as any).close();
        }
      }
    });
    
    // Basic CRUD tests
    describe('Basic CRUD operations', () => {
      it('should save and load a value', async () => {
        const key = `test-${nanoid()}`;
        const value = { testValue: 'hello', num: 123 };
        
        await adapter.save(key, value);
        const loaded = await adapter.load(key);
        
        expect(loaded).to.deep.equal(value);
      });
      
      it('should return null for non-existent keys', async () => {
        const key = `nonexistent-${nanoid()}`;
        const loaded = await adapter.load(key);
        
        expect(loaded).to.be.null;
      });
      
      it('should correctly delete a value', async () => {
        const key = `test-${nanoid()}`;
        const value = { testValue: 'hello' };
        
        await adapter.save(key, value);
        const loadedBefore = await adapter.load(key);
        expect(loadedBefore).to.deep.equal(value);
        
        const deleteResult = await adapter.delete(key);
        expect(deleteResult).to.be.true;
        
        const loadedAfter = await adapter.load(key);
        expect(loadedAfter).to.be.null;
      });
      
      it('should handle delete for non-existent keys', async () => {
        const key = `nonexistent-${nanoid()}`;
        const deleteResult = await adapter.delete(key);
        
        expect(deleteResult).to.be.false;
      });
      
      it('should clear all values', async () => {
        // Save multiple values
        await adapter.save('test1', { value: 1 });
        await adapter.save('test2', { value: 2 });
        await adapter.save('test3', { value: 3 });
        
        // Check they exist
        expect(await adapter.load('test1')).to.deep.equal({ value: 1 });
        expect(await adapter.load('test2')).to.deep.equal({ value: 2 });
        expect(await adapter.load('test3')).to.deep.equal({ value: 3 });
        
        // Clear all
        await adapter.clear();
        
        // Check they're gone
        expect(await adapter.load('test1')).to.be.null;
        expect(await adapter.load('test2')).to.be.null;
        expect(await adapter.load('test3')).to.be.null;
      });
      
      it('should list all keys', async () => {
        // Save multiple values
        await adapter.save('test1', { value: 1 });
        await adapter.save('test2', { value: 2 });
        await adapter.save('test3', { value: 3 });
        
        // Get keys
        const keys = await adapter.keys();
        
        // Check keys
        expect(keys).to.include('test1');
        expect(keys).to.include('test2');
        expect(keys).to.include('test3');
        expect(keys.length).to.be.at.least(3); // May have more from other tests
      });
    });
    
    // Complex data tests
    describe('Complex data handling', () => {
      it('should handle complex nested objects', async () => {
        const key = `complex-${nanoid()}`;
        const complexValue: TestItem = {
          id: nanoid(),
          text: 'Test text with special chars: !@#$%^&*()_+',
          number: 12345.6789,
          nested: {
            value: 'Nested value',
            array: [1, 2, 3, 4, 5]
          }
        };
        
        await adapter.save(key, complexValue);
        const loaded = await adapter.load(key);
        
        expect(loaded).to.deep.equal(complexValue);
      });
      
      it('should handle arrays', async () => {
        const key = `array-${nanoid()}`;
        const arrayValue = [1, 2, 3, { test: 'value' }, [4, 5, 6]];
        
        await adapter.save(key, arrayValue);
        const loaded = await adapter.load(key);
        
        expect(loaded).to.deep.equal(arrayValue);
      });
      
      it('should handle null and undefined values', async () => {
        const key = `null-${nanoid()}`;
        const nullValue = { 
          nullProp: null, 
          undefinedProp: undefined,
          text: 'Valid text' 
        };
        
        await adapter.save(key, nullValue);
        const loaded = await adapter.load(key);
        
        // Note: JSON serialization loses undefined, so it becomes null or is removed
        expect(loaded).to.deep.equal({
          nullProp: null,
          text: 'Valid text'
        });
      });
      
      it('should handle large strings', async () => {
        const key = `large-${nanoid()}`;
        // Create a large string (100KB)
        const largeString = 'a'.repeat(100 * 1024);
        
        await adapter.save(key, { large: largeString });
        const loaded = await adapter.load(key);
        
        expect(loaded).to.have.property('large');
        expect(loaded.large).to.have.length(100 * 1024);
        expect(loaded.large).to.equal(largeString);
      });
    });
    
    // Namespacing tests
    describe('Namespace handling', () => {
      it('should keep data separate between namespaces', async () => {
        // Create a second adapter with different namespace
        const otherAdapter = createAdapter();
        (otherAdapter as any).options.namespace = 'other-namespace';
        
        // Save same key to both adapters
        const key = `shared-${nanoid()}`;
        await adapter.save(key, { namespace: 'default' });
        await otherAdapter.save(key, { namespace: 'other' });
        
        // Check that each adapter only sees its own value
        const defaultValue = await adapter.load(key);
        const otherValue = await otherAdapter.load(key);
        
        expect(defaultValue).to.deep.equal({ namespace: 'default' });
        expect(otherValue).to.deep.equal({ namespace: 'other' });
        
        // Cleanup
        await otherAdapter.clear();
        if ('close' in otherAdapter && typeof (otherAdapter as any).close === 'function') {
          await (otherAdapter as any).close();
        }
      });
      
      it('should only list keys in the current namespace', async () => {
        // Create a second adapter with different namespace
        const otherAdapter = createAdapter();
        (otherAdapter as any).options.namespace = 'other-namespace';
        
        // Save keys to both adapters
        await adapter.save('test1', { value: 1 });
        await otherAdapter.save('test2', { value: 2 });
        
        // Get keys from both adapters
        const defaultKeys = await adapter.keys();
        const otherKeys = await otherAdapter.keys();
        
        // Default namespace should only see its own keys
        expect(defaultKeys).to.include('test1');
        expect(defaultKeys).to.not.include('test2');
        
        // Other namespace should only see its own keys
        expect(otherKeys).to.include('test2');
        expect(otherKeys).to.not.include('test1');
        
        // Cleanup
        await otherAdapter.clear();
        if ('close' in otherAdapter && typeof (otherAdapter as any).close === 'function') {
          await (otherAdapter as any).close();
        }
      });
    });
    
    // Expiration tests
    describe('Expiration handling', () => {
      it('should expire items based on TTL', async () => {
        // Create adapter with short TTL
        const shortTTLAdapter = createAdapter();
        (shortTTLAdapter as any).options.ttl = 50; // 50ms TTL
        
        // Save value
        const key = `expiring-${nanoid()}`;
        await shortTTLAdapter.save(key, { value: 'expires-soon' });
        
        // Should be available immediately
        const loadedBefore = await shortTTLAdapter.load(key);
        expect(loadedBefore).to.deep.equal({ value: 'expires-soon' });
        
        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Should be expired now
        const loadedAfter = await shortTTLAdapter.load(key);
        expect(loadedAfter).to.be.null;
        
        // Cleanup
        await shortTTLAdapter.clear();
        if ('close' in shortTTLAdapter && typeof (shortTTLAdapter as any).close === 'function') {
          await (shortTTLAdapter as any).close();
        }
      });
    });
    
    // Performance tests
    describe('Performance benchmarks', function() {
      // These tests might take longer
      this.timeout(10000);
      
      it('should handle multiple sequential operations efficiently', async () => {
        const iterations = 100;
        const keys: string[] = [];
        
        // Generate keys
        for (let i = 0; i < iterations; i++) {
          keys.push(`perf-${nanoid()}`);
        }
        
        // Measure save performance
        const saveStart = Date.now();
        for (let i = 0; i < iterations; i++) {
          await adapter.save(keys[i], { index: i, value: `test-${i}` });
        }
        const saveDuration = Date.now() - saveStart;
        
        // Measure load performance
        const loadStart = Date.now();
        for (let i = 0; i < iterations; i++) {
          await adapter.load(keys[i]);
        }
        const loadDuration = Date.now() - loadStart;
        
        // Measure delete performance
        const deleteStart = Date.now();
        for (let i = 0; i < iterations; i++) {
          await adapter.delete(keys[i]);
        }
        const deleteDuration = Date.now() - deleteStart;
        
        // Log performance metrics (optional)
        // console.log(`${name} performance (ms):`, { 
        //   save: saveDuration, 
        //   load: loadDuration, 
        //   delete: deleteDuration,
        //   total: saveDuration + loadDuration + deleteDuration
        // });
        
        // No specific assertions, just make sure it completes
        expect(saveDuration).to.be.a('number');
        expect(loadDuration).to.be.a('number');
        expect(deleteDuration).to.be.a('number');
      });
      
      it('should handle concurrent operations', async () => {
        const concurrency = 10;
        const promises: Promise<void>[] = [];
        
        // Run concurrent save operations
        for (let i = 0; i < concurrency; i++) {
          const key = `concurrent-${nanoid()}`;
          promises.push(
            (async () => {
              await adapter.save(key, { index: i, value: `concurrent-${i}` });
              const loaded = await adapter.load(key);
              expect(loaded).to.deep.equal({ index: i, value: `concurrent-${i}` });
              await adapter.delete(key);
            })()
          );
        }
        
        // All operations should complete without errors
        await Promise.all(promises);
      });
    });
  });
}

/**
 * Create temporary directory for file-based tests
 */
function createTempDir(): string {
  const tempDir = path.join(os.tmpdir(), `storage-adapter-tests-${nanoid()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

// Run the tests for each adapter
describe('Storage Adapters', () => {
  // InMemoryStorageAdapter tests
  runStorageAdapterTests('InMemory', () => {
    return new InMemoryStorageAdapter({
      namespace: `test-${nanoid()}`,
      debug: false,
      maxItems: 1000
    });
  });
  
  // FileStorageAdapter tests
  runStorageAdapterTests('File', () => {
    const tempDir = createTempDir();
    
    // Register cleanup
    after(() => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.warn('Failed to clean up temp directory:', e);
      }
    });
    
    return new FileStorageAdapter({
      namespace: `test-${nanoid()}`,
      directory: tempDir,
      debug: false,
      singleFile: true,
      syncIntervalMs: 50 // Speed up tests with faster sync
    });
  });
  
  // Add conditional tests for adapters that require external dependencies
  // We check if the required packages are installed before running these tests
  
  // SQLite adapter tests (conditional)
  try {
    // Try to require better-sqlite3
    require('better-sqlite3');
    
    // Only import and test if the package is available
    const { SQLiteStorageAdapter } = require('../storage/index.js');
    
    runStorageAdapterTests('SQLite', () => {
      const tempDir = createTempDir();
      const dbPath = path.join(tempDir, `test-${nanoid()}.db`);
      
      // Register cleanup
      after(() => {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
          console.warn('Failed to clean up SQLite database:', e);
        }
      });
      
      return new SQLiteStorageAdapter({
        namespace: `test-${nanoid()}`,
        dbPath,
        debug: false,
        enableWAL: true, // Enable WAL for better performance
        enableQueryCache: true
      });
    });
  } catch (e) {
    it.skip('SQLite tests (better-sqlite3 not installed)', () => {});
    console.log('Skipping SQLite tests as better-sqlite3 is not installed');
  }
  
  // Redis adapter tests (conditional)
  try {
    // Try to require redis
    require('redis');
    
    // Check if Redis is available by attempting a connection
    const isRedisAvailable = async () => {
      try {
        const redis = require('redis');
        const client = redis.createClient();
        await client.connect();
        await client.ping();
        await client.quit();
        return true;
      } catch (e) {
        return false;
      }
    };
    
    before(async function() {
      // Skip Redis tests if Redis is not available
      if (!await isRedisAvailable()) {
        console.log('Skipping Redis tests as Redis server is not available');
        this.skip();
      }
    });
    
    // Only import and test if the package is available
    const { RedisStorageAdapter } = require('../storage/index.js');
    
    runStorageAdapterTests('Redis', () => {
      return new RedisStorageAdapter({
        namespace: `test-${nanoid()}`,
        debug: false,
        keyPrefix: 'test-', // Use a prefix to avoid conflicts
        enableCache: true
      });
    });
  } catch (e) {
    it.skip('Redis tests (redis package not installed)', () => {});
    console.log('Skipping Redis tests as redis package is not installed');
  }
});
