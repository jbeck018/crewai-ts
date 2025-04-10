/**
 * CLI command for interactive chat with the crew.
 * Optimized for memory efficiency with streaming responses.
 */
import readline from 'readline';
import { Command } from '../Command.js';

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
      const { CrewChatService } = await import('../../services/CrewChatService.js');
      
      // Create chat service with memory-efficient configuration
      const chatService = new CrewChatService({
        model: parsedArgs.model,
        verbose: parsedArgs.verbose,
        maxHistoryLength: 10, // Limit history for memory efficiency
        useTokenCompression: true // Memory optimization for token usage
      });
      
      // Initialize the chat service
      await chatService.initialize();
      
      // Create readline interface for user input
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.green('You: ')
      });
      
      // Custom prompt with proper event handling for memory efficiency
      const promptUser = () => {
        process.stdout.write(chalk.green('You: '));
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
            await chatService.streamResponse(input, (chunk) => {
              // Print chunk without buffering entire response
              process.stdout.write(chunk);
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
        process.exit(0);
      });
      
      // Also handle SIGINT
      process.on('SIGINT', () => {
        rl.close();
      });
      
    } catch (error) {
      console.error('Error in chat session:', error);
      process.exit(1);
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
    // Default values
    const result = {
      model: 'gpt-3.5-turbo',
      verbose: false,
      stream: true // Default to streaming for better UX
    };

    // Parse options with optimized pattern matching
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if ((arg === '-m' || arg === '--model') && i + 1 < args.length) {
        result.model = args[++i];
      } else if (arg === '--verbose' || arg === '-v') {
        result.verbose = true;
      } else if (arg === '--no-stream') {
        result.stream = false;
      }
    }

    return result;
  }
}
