/**
 * ChatService for interactive conversations with crews
 * Optimized for memory efficiency and streaming responses
 */
import { Agent, Crew } from '../types/index.js';
import { MemoryManager, MemoryType } from '../memory/MemoryManager.js';
import { Telemetry } from '../telemetry/Telemetry.js';
import { TelemetryEventType } from '../telemetry/types.js';

export interface ChatOptions {
  verbose?: boolean;
  maxContextLength?: number;
  storeHistory?: boolean;
  useMemory?: boolean;
  streaming?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  agentId?: string;
  crewId?: string;
  startTime: number;
  lastMessageTime?: number;
}

export interface StreamingHandler {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Service for interactive conversations with crews
 * Optimized for memory efficiency, streaming responses, and context management
 */
// Type guards for Crew and Agent interfaces
function isCrew(obj: Crew | Agent): obj is Crew {
  return 'agents' in obj && Array.isArray(obj.agents);
}

function isAgent(obj: Crew | Agent): obj is Agent {
  return 'role' in obj && typeof obj.role === 'string';
}

export class ChatService {
  private sessions: Map<string, ChatSession> = new Map();
  private memoryManager: MemoryManager | null = null;
  private telemetry: Telemetry | null = null;
  
  /**
   * Create a new ChatService instance
   * @param options Chat options
   */
  constructor(private options: ChatOptions = {}) {
    this.options = {
      verbose: options.verbose ?? false,
      maxContextLength: options.maxContextLength ?? 4000,
      storeHistory: options.storeHistory ?? true,
      useMemory: options.useMemory ?? true,
      streaming: options.streaming ?? true,
      maxTokens: options.maxTokens ?? 1000,
      temperature: options.temperature ?? 0.7
    };
  }
  
  /**
   * Create a new chat session
   * @param crewOrAgent Crew or Agent to chat with
   * @returns Session ID
   */
  createSession(crewOrAgent: Crew | Agent): string {
    const sessionId = `chat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const session: ChatSession = {
      id: sessionId,
      messages: [],
      startTime: Date.now(),
      crewId: isCrew(crewOrAgent) ? crewOrAgent.id : undefined,
      agentId: isAgent(crewOrAgent) ? crewOrAgent.id : undefined
    };
    
    this.sessions.set(sessionId, session);
    
    // Initialize system message with context
    let systemMessage = '';
    
    if (isCrew(crewOrAgent)) {
      systemMessage = `You are a crew named "${crewOrAgent.name || 'Crew'}". `;
      
      if ('description' in crewOrAgent && crewOrAgent.description) {
        systemMessage += `${crewOrAgent.description} `;
      }
      
      systemMessage += `The crew has the following agents with specific roles:\n`;
      
      crewOrAgent.agents.forEach((agent: Agent) => {
        systemMessage += `- ${agent.name}: ${agent.role}. ${agent.goal ? `Goal: ${agent.goal}` : ''}\n`;
      });
    } else if (isAgent(crewOrAgent)) {
      systemMessage = `You are ${crewOrAgent.name}, ${crewOrAgent.role}. `;
      
      if (crewOrAgent.goal) {
        systemMessage += `Your goal is to ${crewOrAgent.goal}. `;
      }
      
      if ('backstory' in crewOrAgent && crewOrAgent.backstory) {
        systemMessage += `Backstory: ${crewOrAgent.backstory}`;
      }
    }
    
    // Add system message to the session
    this.addMessage(sessionId, {
      role: 'system',
      content: systemMessage,
      timestamp: Date.now()
    });
    
    this.logVerbose(`Created chat session ${sessionId}`);
    
    return sessionId;
  }
  
  /**
   * Add a message to a chat session
   * @param sessionId Session ID
   * @param message Message to add
   */
  addMessage(sessionId: string, message: ChatMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Chat session ${sessionId} not found`);
    }
    
    // Add timestamp if not present
    const completeMessage = {
      ...message,
      timestamp: message.timestamp || Date.now()
    };
    
    session.messages.push(completeMessage);
    session.lastMessageTime = completeMessage.timestamp;
    
    // Limit context length for memory efficiency
    this.pruneSessionHistory(session);
    
    // If configured, store message in memory
    if (this.options.storeHistory && this.options.useMemory) {
      this.storeMessageInMemory(sessionId, completeMessage);
    }
  }
  
  /**
   * Send a message to the crew or agent and get a response
   * @param sessionId Session ID
   * @param message User message
   * @param crewOrAgent Crew or Agent to respond
   * @param streamingHandler Optional handler for streaming response
   * @returns Response message
   */
  async sendMessage(
    sessionId: string,
    message: string,
    crewOrAgent: Crew | Agent,
    streamingHandler?: StreamingHandler
  ): Promise<ChatMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Chat session ${sessionId} not found`);
    }
    
    // Add the user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now()
    };
    this.addMessage(sessionId, userMessage);
    
    // Initialize telemetry
    await this.initializeTelemetry();
    
    // Track message event
    this.trackEvent('chat_message_sent', {
      sessionId,
      crewId: session.crewId,
      agentId: session.agentId,
      messageLength: message.length
    });
    
    try {
      // Get response from crew or agent
      let responseContent = '';
      const startTime = Date.now();
      
      if (streamingHandler?.onStart) {
        streamingHandler.onStart();
      }
      
      if (isCrew(crewOrAgent)) {
        // For a crew, we need to determine which agent should respond
        // In a real implementation, you might have more sophisticated routing
        const primaryAgent = crewOrAgent.agents.length > 0 ? crewOrAgent.agents[0] : null;
        
        if (!primaryAgent) {
          throw new Error('Crew has no agents to respond');
        }
        
        // Get chat history as context
        const context = this.formatChatHistoryForAgent(session);
        
        // Get response from the primary agent
        if (this.options.streaming && streamingHandler?.onToken) {
          // Use streaming API if available
          responseContent = await primaryAgent.getResponseAsStream(
            message,
            context,
            (token: string) => streamingHandler.onToken?.(token)
          );
        } else {
          // Use regular response API
          responseContent = await primaryAgent.getResponse(message, {
            additionalContext: context,
            maxTokens: this.options.maxTokens,
            temperature: this.options.temperature
          });
        }
        
      } else if (isAgent(crewOrAgent)) {
        // Direct agent response
        // Get chat history as context
        const context = this.formatChatHistoryForAgent(session);
        
        // Get response from the agent
        if (this.options.streaming && streamingHandler?.onToken) {
          // Use streaming API if available
          responseContent = await crewOrAgent.getResponseAsStream(
            message,
            context,
            (token: string) => streamingHandler.onToken?.(token)
          );
        } else {
          // Use regular response API
          responseContent = await crewOrAgent.getResponse(message, {
            additionalContext: context,
            maxTokens: this.options.maxTokens,
            temperature: this.options.temperature
          });
        }
      }
      
      // Create response message
      const responseMessage: ChatMessage = {
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now(),
        metadata: {
          responseDuration: Date.now() - startTime
        }
      };
      
      // Add to session
      this.addMessage(sessionId, responseMessage);
      
      // Call completion handler if streaming
      if (streamingHandler?.onComplete) {
        streamingHandler.onComplete(responseContent);
      }
      
      // Track response event
      this.trackEvent('chat_response_received', {
        sessionId,
        crewId: session.crewId,
        agentId: session.agentId,
        responseLength: responseContent.length,
        responseDuration: Date.now() - startTime
      });
      
      return responseMessage;
      
    } catch (error) {
      // Handle errors
      if (streamingHandler?.onError) {
        streamingHandler.onError(error instanceof Error ? error : new Error(String(error)));
      }
      
      // Track error event
      this.trackEvent('chat_response_error', {
        sessionId,
        crewId: session.crewId,
        agentId: session.agentId,
        error: String(error)
      });
      
      // Return error message
      return {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        metadata: {
          error: true
        }
      };
    }
  }
  
  /**
   * Get all messages in a session
   * @param sessionId Session ID
   * @returns Array of messages
   */
  getMessages(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Chat session ${sessionId} not found`);
    }
    
    return [...session.messages];
  }
  
  /**
   * Get all active sessions
   * @returns Map of session IDs to sessions
   */
  getSessions(): Map<string, ChatSession> {
    return new Map(this.sessions);
  }
  
  /**
   * Delete a chat session
   * @param sessionId Session ID
   * @returns True if deleted, false if not found
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    // Track session end
    this.trackEvent('chat_session_ended', {
      sessionId,
      crewId: session.crewId,
      agentId: session.agentId,
      messageCount: session.messages.length,
      duration: Date.now() - session.startTime
    });
    
    return this.sessions.delete(sessionId);
  }
  
  /**
   * Prune session history to limit context length
   * Optimized for memory efficiency
   * @param session Session to prune
   */
  private pruneSessionHistory(session: ChatSession): void {
    if (!this.options.maxContextLength) return;
    
    // Calculate current context length
    let totalLength = 0;
    for (const message of session.messages) {
      totalLength += message.content.length;
    }
    
    // If within limits, no need to prune
    if (totalLength <= this.options.maxContextLength) return;
    
    // Keep system messages and recent messages, remove older messages
    const systemMessages = session.messages.filter(msg => msg.role === 'system');
    const nonSystemMessages = session.messages.filter(msg => msg.role !== 'system');
    
    // Always keep the most recent messages
    while (nonSystemMessages.length > 2 && totalLength > this.options.maxContextLength) {
      // Remove the oldest non-system message
      const oldestMessage = nonSystemMessages.shift();
      if (oldestMessage) {
        totalLength -= oldestMessage.content.length;
      }
    }
    
    // Update session with pruned messages
    session.messages = [...systemMessages, ...nonSystemMessages];
  }
  
  /**
   * Format chat history as context for agent
   * @param session Chat session
   * @returns Formatted chat history
   */
  private formatChatHistoryForAgent(session: ChatSession): string {
    // Skip system messages in the formatted history
    const relevantMessages = session.messages.filter(msg => msg.role !== 'system');
    
    if (relevantMessages.length === 0) {
      return '';
    }
    
    // Format as a conversation
    let formattedHistory = 'Chat History:\n';
    
    relevantMessages.forEach(message => {
      const role = message.role === 'user' ? 'User' : 'Assistant';
      formattedHistory += `${role}: ${message.content}\n`;
    });
    
    return formattedHistory;
  }
  
  /**
   * Store message in memory system
   * @param sessionId Session ID
   * @param message Message to store
   */
  private async storeMessageInMemory(sessionId: string, message: ChatMessage): Promise<void> {
    if (!this.options.useMemory) return;
    
    // Lazy initialize memory manager
    if (!this.memoryManager) {
      try {
        this.memoryManager = new MemoryManager();
        this.memoryManager.createStandardMemories();
      } catch (error) {
        console.error('Error initializing memory manager:', error);
        return;
      }
    }
    
    try {
      // Get short-term memory
      const shortTermMemory = this.memoryManager.getMemory('short');
      if (!shortTermMemory) return;
      
      // Store message content
      // Using any here for BaseMemory as a workaround for the 'store' method not being in the type
      await (shortTermMemory as any).store({
        content: `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`,
        metadata: {
          sessionId,
          timestamp: message.timestamp,
          role: message.role
        }
      });
      
    } catch (error) {
      console.error('Error storing message in memory:', error);
    }
  }
  
  /**
   * Initialize telemetry
   * Lazily loads Telemetry to optimize memory usage
   */
  private async initializeTelemetry(): Promise<void> {
    if (!this.telemetry) {
      try {
        this.telemetry = Telemetry.getInstance({
          enabled: true,
          samplingRate: 0.5 // Memory-efficient sampling rate
        });
      } catch (error) {
        console.error('Error initializing telemetry:', error);
      }
    }
  }
  
  /**
   * Track telemetry event
   * @param type Event type
   * @param data Event data
   */
  private trackEvent(type: string, data: Record<string, any>): void {
    if (this.telemetry) {
      try {
        this.telemetry.track(type as TelemetryEventType, data);
      } catch (error) {
        // Silently handle telemetry errors
      }
    }
  }
  
  /**
   * Log verbose messages if verbose mode is enabled
   * @param message Message to log
   * @param data Optional data to log
   */
  private logVerbose(message: string, data?: any): void {
    if (this.options.verbose) {
      if (data) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }
}
