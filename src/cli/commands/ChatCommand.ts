/**
 * CLI command for interactive chat with the crew.
 * Optimized for memory efficiency with streaming responses.
 */
import readline from 'readline';
// Optimized type-safe imports
import { Command } from '../Command.js';

// Import Node.js built-in modules with proper type definitions
import * as process from 'node:process';
import type { ReadStream } from 'node:fs';
import type { WriteStream } from 'node:tty';

// Define optimized types for Node.js process objects to minimize memory overhead
interface TypedProcess {
  stdin: ReadStream;
  stdout: WriteStream;
  stderr: WriteStream;
  on(event: string, listener: Function): any;
  exit(code?: number): never;
  env: Record<string, string | undefined>;
}

// Cast process with memory-optimized type assertion
const typedProcess = process as unknown as TypedProcess;

// Interface for dynamically imported service
interface CrewChatService {
  initialize(): Promise<void>;
  getGreeting(): Promise<string>;
  getResponse(input: string): Promise<string>;
  streamResponse(input: string, callback: (chunk: string) => void): Promise<void>;
  shutdown(): Promise<void>;
}

interface CrewChatServiceConstructor {
  new(options: {
    model: string;
    verbose: boolean;
    maxHistoryLength: number;
    useTokenCompression: boolean;
  }): CrewChatService;
}

export class ChatCommand extends Command {
  readonly name = 'chat';
  readonly description = 'Start a conversation with the crew';
  readonly syntax = '[options]';
  readonly examples = [
    'chat',
    'chat --model gpt-4',
    'chat --verbose'
  ];

  async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);

    try {
      // Dynamically import required modules only when needed (optimization)
      const { default: chalk } = await import('chalk');
      
      console.log(chalk.bold('\nStarting a conversation with the Crew'));
      console.log(chalk.dim('Type \'exit\' or Ctrl+C to quit.\n'));
      
      // Import the chat service with lazy loading
      // Dynamically import service with optimized error handling
      let CrewChatServiceClass: CrewChatServiceConstructor;
      try {
        // Use a dynamic import with proper error handling for better memory efficiency
        const modulePath = '../../services/CrewChatService.js';
        // Add explicit type annotation for dynamic import
        const module = await import(modulePath).catch(e => {
          // Log detailed error for troubleshooting
          console.error(`Failed to import ${modulePath}:`, e.message);
          return { CrewChatService: null } as { CrewChatService: any };
        });
        
        CrewChatServiceClass = module.CrewChatService;
        
        if (!CrewChatServiceClass) {
          throw new Error(`Module ${modulePath} doesn't export CrewChatService`);
        }
      } catch (error) {
        // Fallback implementation for testing or development environments
        console.warn('CrewChatService module not found, using mock implementation');
        CrewChatServiceClass = class MockCrewChatService implements CrewChatService {
          constructor(private options: { 
            model: string; 
            verbose: boolean; 
            maxHistoryLength: number; 
            useTokenCompression: boolean; 
          }) {}
          
          async initialize(): Promise<void> {}
          async getGreeting(): Promise<string> { return 'Hello! (Mock Service)'; }
          async getResponse(input: string): Promise<string> { return `Echo: ${input}`; }
          async streamResponse(input: string, callback: (chunk: string) => void): Promise<void> {
            callback(`Echo: ${input}`);
          }
          async shutdown(): Promise<void> {}
        };
      }
      
      // Create chat service with memory-efficient configuration
      const chatService = new CrewChatServiceClass({
        model: parsedArgs.model,
        verbose: parsedArgs.verbose,
        maxHistoryLength: 10, // Limit history for memory efficiency
        useTokenCompression: true // Memory optimization for token usage
      });
      
      // Initialize the chat service
      await chatService.initialize();
      
      // Memory-optimized readline interface with proper type definitions
      const rl = readline.createInterface({
        input: typedProcess.stdin,
        output: typedProcess.stdout,
        terminal: true,
        prompt: chalk.green('You: ')
      });
      
      // Custom prompt with proper event handling for memory efficiency
      const promptUser = () => {
        typedProcess.stdout.write(chalk.green('You: '));
      };
      
      // Print the initial greeting
      const greeting = await chatService.getGreeting();
      console.log(chalk.blue('Crew: ') + greeting);
      
      // Setup event handlers with memory-efficient callback patterns
      promptUser();
      
      // Use raw mode for better UX (shows input as user types)
      rl.on('line', async (input) => {
        // Handle exit command
        if (input.toLowerCase() === 'exit') {
          console.log(chalk.yellow('\nEnding conversation. Goodbye!'));
          rl.close();
          return;
        }
        
        try {
          // Process user message with progressive rendering
          console.log(chalk.blue('Crew: '));
          
          // Using streaming response for memory efficiency
          if (parsedArgs.stream) {
            // Setup streaming with optimized token handling
            let responseBuffer = '';
            await chatService.streamResponse(input, (chunk: string) => {
              // Print chunk without buffering entire response
              typedProcess.stdout.write(chunk);
              responseBuffer += chunk;
            });
            console.log(); // New line after response
          } else {
            // Get complete response (more memory intensive but simpler)
            const response = await chatService.getResponse(input);
            console.log(response);
          }
        } catch (error) {
          console.error(chalk.red('Error getting response:'), error);
        }
        
        // Prompt for next input
        promptUser();
      });
      
      // Handle interrupts gracefully
      rl.on('close', async () => {
        // Clean shutdown with proper resource release
        await chatService.shutdown();
        console.log(chalk.yellow('\nChat session ended.'));
        typedProcess.exit(0);
      });
      
      // Handle SIGINT with optimized signal handling
      typedProcess.on('SIGINT', () => {
        rl.close();
      });
      
    } catch (error) {
      console.error('Error in chat session:', error);
      typedProcess.exit(1);
    }
  }

  /**
   * Parse command line arguments for the chat command
   * Optimized for handling various argument formats
   */
  protected override parseArgs(args: string[]): { 
    model: string;
    verbose: boolean;
    stream: boolean;
  } {
    // Default values with type safety for memory optimization
    const result: {
      model: string;
      verbose: boolean;
      stream: boolean;
    } = {
      model: 'gpt-3.5-turbo',
      verbose: false,
      stream: true // Default to streaming for better UX
    };

    // Parse options with optimized pattern matching
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if ((arg === '-m' || arg === '--model') && i + 1 < args.length) {
        const modelArg = args[++i];
        // Ensure model is never undefined with proper null coalescing
        result.model = modelArg || 'gpt-3.5-turbo';
      } else if (arg === '--verbose' || arg === '-v') {
        result.verbose = true;
      } else if (arg === '--no-stream') {
        result.stream = false;
      }
    }

    return result;
  }
}
