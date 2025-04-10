/**
 * Task Evaluator
 * Evaluates task outputs to extract insights and assess quality
 * Optimized for efficient entity extraction and quality assessment
 */

import { BaseAgent } from '../../BaseAgent.js';
import { Task } from '../../../task/Task.js';
import { TaskEvaluation } from '../types/index.js';

/**
 * Entity extraction result
 */
export interface ExtractedEntity {
  name: string;
  type: string;
  description: string;
  relationships: string[];
}

/**
 * Evaluation options
 */
export interface EvaluationOptions {
  /** Maximum number of entities to extract */
  maxEntities?: number;
  /** Custom quality assessment function */
  qualityAssessor?: (text: string, task: Task) => Promise<number>;
  /** Custom suggestion generator */
  suggestionGenerator?: (text: string, task: Task) => Promise<string[]>;
  /** Custom entity extractor */
  entityExtractor?: (text: string) => Promise<ExtractedEntity[]>;
}

/**
 * Evaluates task outputs to extract entities, assess quality, and generate suggestions
 * Optimized for performance and memory efficiency
 */
export class TaskEvaluator {
  private agent: BaseAgent;
  private maxEntities: number;
  private qualityAssessor?: (text: string, task: Task) => Promise<number>;
  private suggestionGenerator?: (text: string, task: Task) => Promise<string[]>;
  private entityExtractor?: (text: string) => Promise<ExtractedEntity[]>;
  
  /**
   * Create a new TaskEvaluator
   * @param agent Agent that executed the task
   * @param options Evaluation options
   */
  constructor(agent: BaseAgent, options: EvaluationOptions = {}) {
    this.agent = agent;
    this.maxEntities = options.maxEntities ?? 10;
    this.qualityAssessor = options.qualityAssessor;
    this.suggestionGenerator = options.suggestionGenerator;
    this.entityExtractor = options.entityExtractor;
  }
  
  /**
   * Evaluate a task output
   * @param task Task that was executed
   * @param outputText Output text to evaluate
   * @returns Evaluation result or null if evaluation failed
   */
  async evaluate(task: Task, outputText: string): Promise<TaskEvaluation | null> {
    try {
      // Run the evaluation components in parallel for better performance
      const [quality, suggestions, entities] = await Promise.all([
        this.assessQuality(outputText, task),
        this.generateSuggestions(outputText, task),
        this.extractEntities(outputText)
      ]);
      
      return {
        quality,
        suggestions,
        entities
      };
    } catch (error) {
      console.error('Evaluation failed:', error);
      return null;
    }
  }
  
  /**
   * Assess the quality of the output
   * @param outputText Output text to assess
   * @param task Task that was executed
   * @returns Quality score between 0 and 1
   */
  private async assessQuality(outputText: string, task: Task): Promise<number> {
    try {
      // If a custom quality assessor is provided, use it
      if (this.qualityAssessor) {
        return await this.qualityAssessor(outputText, task);
      }
      
      // Default quality assessment logic
      // In a real implementation, this would use more sophisticated analysis
      // For now, we'll use a simple heuristic based on text length and keyword matching
      
      // Basic length check (longer answers tend to be more detailed)
      const lengthScore = Math.min(outputText.length / 1000, 0.5);
      
      // Keyword matching (check if output contains key terms from the task)
      const taskKeywords = this.extractKeywords(task.description);
      const matchCount = taskKeywords.filter(keyword => 
        outputText.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      
      const keywordScore = taskKeywords.length > 0 
        ? (matchCount / taskKeywords.length) * 0.5 
        : 0.25;
      
      // Combine scores with a slightly higher weight for keyword matching
      return Math.min(lengthScore + keywordScore, 1.0);
    } catch (error) {
      console.error('Quality assessment failed:', error);
      return 0.5; // Default to middle quality on error
    }
  }
  
  /**
   * Generate suggestions for improving the output
   * @param outputText Output text to generate suggestions for
   * @param task Task that was executed
   * @returns Array of suggestions
   */
  private async generateSuggestions(outputText: string, task: Task): Promise<string[]> {
    try {
      // If a custom suggestion generator is provided, use it
      if (this.suggestionGenerator) {
        return await this.suggestionGenerator(outputText, task);
      }
      
      // Default suggestion generation logic
      // In a real implementation, this would use more sophisticated analysis
      // For now, we'll return generic suggestions
      
      const suggestions: string[] = [];
      
      // Check output length
      if (outputText.length < 100) {
        suggestions.push('Provide a more detailed response');
      }
      
      // Check for task keywords
      const taskKeywords = this.extractKeywords(task.description);
      const missingKeywords = taskKeywords.filter(keyword => 
        !outputText.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (missingKeywords.length > 0) {
        suggestions.push(`Address these key aspects: ${missingKeywords.join(', ')}`);
      }
      
      // If no specific suggestions, provide a generic one
      if (suggestions.length === 0) {
        suggestions.push('Consider adding more context or examples to strengthen your response');
      }
      
      return suggestions;
    } catch (error) {
      console.error('Suggestion generation failed:', error);
      return ['Consider reviewing and expanding your response']; // Generic fallback
    }
  }
  
  /**
   * Extract entities from the output text
   * @param outputText Output text to extract entities from
   * @returns Array of extracted entities
   */
  private async extractEntities(outputText: string): Promise<ExtractedEntity[]> {
    try {
      // If a custom entity extractor is provided, use it
      if (this.entityExtractor) {
        const entities = await this.entityExtractor(outputText);
        return entities.slice(0, this.maxEntities); // Respect max entities limit
      }
      
      // Default entity extraction logic
      // In a real implementation, this would use NLP techniques or LLM calls
      // For now, we'll use a simple regex-based approach for demonstration
      
      const entities: ExtractedEntity[] = [];
      
      // Simple name detection regex (looks for capitalized words that aren't at the start of sentences)
      const nameRegex = /(?<!\.|^|\n)\s([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g;
      const nameMatches = [...outputText.matchAll(nameRegex)];
      
      // Process name matches with deduplication
      const processedNames = new Set<string>();
      
      for (const match of nameMatches) {
        // Add null check to ensure match[1] exists
        if (!match[1]) continue;
        const name = match[1].trim();
        
        // Skip if we've already processed this name or it's too short
        if (processedNames.has(name) || name.length < 3) {
          continue;
        }
        
        processedNames.add(name);
        
        // Find context around the name (100 characters before and after)
        // Safely handle optional property with nullish coalescing
        const matchIndex = match.index !== undefined ? match.index : 0;
        const startIndex = Math.max(0, matchIndex - 100);
        const endIndex = Math.min(outputText.length, matchIndex + 100);
        const context = outputText.substring(startIndex, endIndex);
        
        // Create a simple entity with context as description
        entities.push({
          name,
          type: 'Person', // Default to person for this simple example
          description: `Mentioned in context: "${context}"`,
          relationships: []
        });
        
        // Respect the max entities limit
        if (entities.length >= this.maxEntities) {
          break;
        }
      }
      
      return entities;
    } catch (error) {
      console.error('Entity extraction failed:', error);
      return []; // Return empty array on error
    }
  }
  
  /**
   * Extract keywords from a text
   * @param text Text to extract keywords from
   * @returns Array of keywords
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    // Remove common words and split on spaces
    const commonWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'with', 'by', 'about', 'as', 'of', 'from', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'should', 'could', 'can', 'may', 'might'
    ]);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/) // Split on whitespace
      .filter(word => 
        word.length > 3 && // Only words longer than 3 characters
        !commonWords.has(word) // Exclude common words
      );
    
    // Count word frequency
    const wordCounts: Record<string, number> = {};
    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
    
    // Sort by frequency and take top 10 most frequent words as keywords
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0]);
  }
}
