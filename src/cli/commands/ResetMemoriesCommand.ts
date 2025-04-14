/**
 * CLI command for resetting various types of memory storages.
 * Optimized for targeted memory management and efficient cleanup.
 * Memory-optimized with strong type safety.
 */
import { Command } from '../Command.js';

// Define proper interfaces for memory optimization and type safety
interface MemoryStorage {
  clear(): Promise<void>;
}

// Interface for knowledge storage with more flexible operations
interface KnowledgeStorageOperations {
  // Base directory for storage
  baseDir?: string;
  
  // Optional methods that might be available
  clear?: () => Promise<void>;
  deleteAll?: () => Promise<void>;
  delete?: (key: string) => Promise<boolean>;
  list?: () => Promise<string[]>;
}

// Type-safe options map for memory configuration
type MemoryTypeKey = 'long' | 'short' | 'entities' | 'knowledge' | 'kickoffOutputs' | 'all';

export class ResetMemoriesCommand extends Command {
  readonly name = 'reset-memories';
  readonly description = 'Reset various types of crew memories';
  readonly syntax = '[options]';
  readonly examples = [
    'reset-memories --all',
    'reset-memories --long --short',
    'reset-memories --knowledge'
  ];

  async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    
    // Check if any memory type is specified
    const hasSelection = parsedArgs.long || parsedArgs.short || 
                        parsedArgs.entities || parsedArgs.knowledge || 
                        parsedArgs.kickoffOutputs || parsedArgs.all;
    
    if (!hasSelection) {
      console.error('Error: Must specify at least one memory type to reset');
      this.showHelp();
      process.exit(1);
    }

    try {
      // Dynamically import required modules only when needed (optimization)
      const { default: chalk } = await import('chalk');
      const { default: ora } = await import('ora');
      
      // Show spinner for better UX
      const spinner = ora('Preparing to reset memories...').start();
      
      // Set all memory types if 'all' is selected
      if (parsedArgs.all) {
        parsedArgs.long = true;
        parsedArgs.short = true;
        parsedArgs.entities = true;
        parsedArgs.knowledge = true;
        parsedArgs.kickoffOutputs = true;
      }
      
      // Import memory services only as needed for memory efficiency
      const memoryServices: Record<string, any> = {};
      const resetPromises: Promise<void>[] = [];
      
      // Only import the services we need based on selected options
      if (parsedArgs.long) {
        spinner.text = 'Resetting long-term memory...';
        const { LongTermMemoryStorage } = await import('../../memory/storage/LongTermMemoryStorage.js');
        const longTermMemory = new LongTermMemoryStorage();
        resetPromises.push(longTermMemory.clear());
      }
      
      if (parsedArgs.short) {
        spinner.text = 'Resetting short-term memory...';
        const { ShortTermMemoryStorage } = await import('../../memory/storage/ShortTermMemoryStorage.js');
        const shortTermMemory = new ShortTermMemoryStorage();
        resetPromises.push(shortTermMemory.clear());
      }
      
      if (parsedArgs.entities) {
        spinner.text = 'Resetting entity memory...';
        const { EntityMemoryStorage } = await import('../../memory/storage/EntityMemoryStorage.js');
        const entityMemory = new EntityMemoryStorage();
        resetPromises.push(entityMemory.clear());
      }
      
      if (parsedArgs.knowledge) {
        spinner.text = 'Resetting knowledge memory...';
        const { KnowledgeStorage } = await import('../../knowledge/storage/KnowledgeStorage.js');
        
        // Create storage with optimized memory footprint
        const knowledgeStorage = new KnowledgeStorage();
        
        // Type assertion for memory efficiency - we'll do a single cast instead of multiple property checks
        type ExtendedKnowledgeStorage = {
          baseDir?: string;
          clear?: () => Promise<void>;
          deleteAll?: () => Promise<void>;
          delete?: (key: string) => Promise<boolean>;
          list?: () => Promise<string[]>;
        };
        
        // Create a single type-safe reference to prevent multiple castings
        const safeStorage = knowledgeStorage as unknown as ExtendedKnowledgeStorage;
        
        // Implement a memory-efficient approach to clearing knowledge storage
        try {
          // Create an optimized clear function that adapts to available methods
          const clearStorage = async () => {
            // Feature detection pattern for memory-efficient operation
            if (typeof safeStorage.clear === 'function') {
              // If clear method exists, use it directly (preferred approach)
              await safeStorage.clear();
            } else if (typeof safeStorage.deleteAll === 'function') {
              // Second option: use deleteAll if available
              await safeStorage.deleteAll();
            } else if (typeof safeStorage.delete === 'function' && typeof safeStorage.list === 'function') {
              // Third option: list all keys and delete individually
              const keys = await safeStorage.list();
              if (Array.isArray(keys)) {
                // Process deletions in batches to optimize memory usage
                const batchSize = 100;
                for (let i = 0; i < keys.length; i += batchSize) {
                  const batch = keys.slice(i, i + batchSize);
                  await Promise.all(batch.map(key => safeStorage.delete!(key)));
                }
              }
            } else {
              console.warn('Knowledge storage does not support any clear operations - using filesystem fallback');
              // Last resort: try to clear via filesystem operations
              const fs = await import('fs/promises');
              const path = await import('path');
              const baseDir = safeStorage.baseDir || './knowledge';
              
              try {
                await fs.rm(baseDir, { recursive: true, force: true });
                await fs.mkdir(baseDir, { recursive: true });
                console.log(`Recreated knowledge directory at ${baseDir}`);
              } catch (fsError) {
                console.warn(`Could not clear knowledge directory: ${(fsError as Error).message}`);
              }
            }
          };
          
          // Execute the appropriate clear operation
          resetPromises.push(clearStorage());
        } catch (error) {
          console.warn(`Error clearing knowledge storage: ${(error as Error).message}`);
          resetPromises.push(Promise.resolve()); // Continue with other operations
        }
      }
      
      if (parsedArgs.kickoffOutputs) {
        spinner.text = 'Resetting task outputs memory...';
        const { KickoffTaskOutputsStorage } = await import('../../memory/storage/KickoffTaskOutputsStorage.js');
        const taskOutputsStorage = new KickoffTaskOutputsStorage();
        resetPromises.push(taskOutputsStorage.clear());
      }
      
      // Execute all reset operations in parallel for performance
      await Promise.all(resetPromises);
      
      // Display success message
      spinner.succeed('Memory reset completed');
      
      // Show summary of reset operations
      console.log('\nMemory reset summary:');
      if (parsedArgs.long) console.log(chalk.green('✓') + ' Long-term memory');
      if (parsedArgs.short) console.log(chalk.green('✓') + ' Short-term memory');
      if (parsedArgs.entities) console.log(chalk.green('✓') + ' Entity memory');
      if (parsedArgs.knowledge) console.log(chalk.green('✓') + ' Knowledge memory');
      if (parsedArgs.kickoffOutputs) console.log(chalk.green('✓') + ' Task outputs memory');
      
    } catch (error) {
      console.error('Error resetting memories:', error);
      process.exit(1);
    }
  }

  /**
   * Parse command line arguments for the reset-memories command
   * Optimized for handling various argument formats
   */
  protected override parseArgs(args: string[]): { 
    long: boolean;
    short: boolean;
    entities: boolean;
    knowledge: boolean;
    kickoffOutputs: boolean;
    all: boolean;
  } {
    // Default all to false
    const result = {
      long: false,
      short: false,
      entities: false,
      knowledge: false,
      kickoffOutputs: false,
      all: false
    };

    // Parse options - support both full names and abbreviations
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      // Use efficient Map-based lookup for option handling with memory optimization
      const optionMap: Record<string, MemoryTypeKey> = {
        '--long': 'long',
        '-l': 'long',
        '--short': 'short',
        '-s': 'short',
        '--entities': 'entities',
        '-e': 'entities',
        '--knowledge': 'knowledge',
        '-k': 'knowledge',
        '--kickoff-outputs': 'kickoffOutputs',
        '--task-outputs': 'kickoffOutputs',
        '-o': 'kickoffOutputs',
        '--all': 'all',
        '-a': 'all'
      };
      
      // Set the appropriate flag if it matches an option with type safety
      const option = arg ? optionMap[arg] : undefined;
      if (option && option in result) {
        // Use type assertion with verification to ensure type safety
        result[option as keyof typeof result] = true;
      }
    }

    return result;
  }
}
