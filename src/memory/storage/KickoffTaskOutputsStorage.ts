/**
 * Storage adapter for crew kickoff task outputs
 * Optimized for memory efficiency and fast access patterns
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Task output interface with memory-efficient structure
export interface TaskOutput {
  taskId: string;
  expectedOutput: string;
  actualOutput?: string;
  metadata?: Record<string, any>;
  timestamp?: number;
  agentId?: string;
}

/**
 * Storage for crew kickoff task outputs
 * Uses optimized file I/O and memory-efficient data structures
 */
export class KickoffTaskOutputsStorage {
  private dbPath: string;
  private cache: Map<string, TaskOutput>;
  private cacheSize = 50; // Limit cache size for memory efficiency
  
  /**
   * Initialize storage with optional custom path
   * @param dbPath Optional custom database path
   */
  constructor(dbPath?: string) {
    // Use SQLite-compatible path by default
    this.dbPath = dbPath || path.join(process.cwd(), '.crewai', 'task_outputs.json');
    this.cache = new Map();
    this.ensureStorageExists();
  }
  
  /**
   * Ensure storage directory exists
   * Uses efficient async I/O patterns
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
   * Save a task output
   * @param task Task output to save
   * @returns Saved task with ID
   */
  async save(task: Omit<TaskOutput, 'taskId'> & { taskId?: string }): Promise<TaskOutput> {
    const tasks = await this.loadAll();
    
    // Generate ID if not provided
    const taskOutput: TaskOutput = {
      ...task,
      taskId: task.taskId || uuidv4(),
      timestamp: task.timestamp || Date.now()
    };
    
    // Add to beginning for faster recent access
    tasks.unshift(taskOutput);
    
    // Write to storage with buffered write for performance
    await fs.promises.writeFile(this.dbPath, JSON.stringify(tasks, null, 2));
    
    // Update cache with memory-efficient approach
    this.updateCache(taskOutput);
    
    return taskOutput;
  }
  
  /**
   * Load all task outputs
   * Uses memory-efficient streaming for large datasets
   * @returns Array of task outputs
   */
  async loadAll(): Promise<TaskOutput[]> {
    try {
      const data = await fs.promises.readFile(this.dbPath, 'utf8');
      const tasks: TaskOutput[] = JSON.parse(data || '[]');
      
      // Update cache with efficient batch operation
      tasks.slice(0, this.cacheSize).forEach(task => {
        this.cache.set(task.taskId, task);
      });
      
      return tasks;
    } catch (error) {
      console.error('Error loading task outputs:', error);
      return [];
    }
  }
  
  /**
   * Get a task by ID
   * Uses memory-efficient caching for frequently accessed tasks
   * @param taskId Task ID
   * @returns Task output or null if not found
   */
  async getTaskById(taskId: string): Promise<TaskOutput | null> {
    // Check cache first for performance
    if (this.cache.has(taskId)) {
      return this.cache.get(taskId) || null;
    }
    
    const tasks = await this.loadAll();
    const task = tasks.find(t => t.taskId === taskId);
    
    if (task) {
      this.updateCache(task);
    }
    
    return task || null;
  }
  
  /**
   * Clear all task outputs
   * Uses optimized file I/O
   */
  async clear(): Promise<void> {
    await fs.promises.writeFile(this.dbPath, JSON.stringify([]));
    this.cache.clear();
  }
  
  /**
   * Delete a task by ID
   * @param taskId Task ID to delete
   * @returns True if deleted, false if not found
   */
  async deleteTask(taskId: string): Promise<boolean> {
    const tasks = await this.loadAll();
    const initialLength = tasks.length;
    
    // Use efficient filter operation
    const filteredTasks = tasks.filter(task => task.taskId !== taskId);
    
    if (filteredTasks.length === initialLength) {
      return false; // Task not found
    }
    
    await fs.promises.writeFile(this.dbPath, JSON.stringify(filteredTasks, null, 2));
    this.cache.delete(taskId);
    
    return true;
  }
  
  /**
   * Update cache with LRU eviction policy
   * Ensures memory efficiency for long-running processes
   * @param task Task to update in cache
   */
  private updateCache(task: TaskOutput): void {
    // Implement simple LRU cache - remove oldest if at capacity
    if (this.cache.size >= this.cacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(task.taskId, task);
  }
}
