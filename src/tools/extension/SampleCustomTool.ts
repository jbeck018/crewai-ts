/**
 * Sample Custom Tool Implementation
 * A demonstration of how to create custom tools using the extension framework
 */

import { z } from 'zod';
import { createCustomTool } from './CustomToolFactory.js';

// Example of a custom translation tool
export function createTranslationTool() {
  // Define input validation schema
  const translationSchema = z.object({
    text: z.string().min(1, "Text to translate cannot be empty"),
    sourceLanguage: z.string().default("auto").optional(),
    targetLanguage: z.string().min(2, "Target language code required")
  });

  // Type inference from schema
  type TranslationInput = z.infer<typeof translationSchema>;

  // Output type
  interface TranslationOutput {
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    originalText: string;
    confidence?: number;
  }

  // Create and return the custom tool with optimization options
  return createCustomTool<TranslationInput, TranslationOutput>({
    name: "translate",
    description: "Translates text from one language to another",
    inputSchema: translationSchema,
    
    // Main execution function
    execute: async (input: TranslationInput): Promise<TranslationOutput> => {
      // This would typically call an external API
      // For this example, we'll simulate a translation
      
      // Simulated API call with memory efficient processing
      const translatedText = await simulateTranslation(
        input.text, 
        input.sourceLanguage || "auto", 
        input.targetLanguage
      );
      
      return {
        translatedText,
        sourceLanguage: input.sourceLanguage || "en", // Default to English for demo
        targetLanguage: input.targetLanguage,
        originalText: input.text,
        confidence: 0.92 // Simulated confidence score
      };
    },
    
    // Custom error handler
    handleError: async (error, input) => {
      console.error(`Translation error: ${error.message}`);
      return {
        translatedText: input.text, // Return original text on error
        sourceLanguage: input.sourceLanguage || "auto",
        targetLanguage: input.targetLanguage,
        originalText: input.text,
        confidence: 0
      };
    },
    
    // Enable caching for better performance
    cache: {
      enabled: true,
      maxSize: 100, // Store up to 100 translations
      ttlMs: 3600000, // Cache for 1 hour
      keyGenerator: (input) => {
        // Custom key generator for better cache efficiency
        return `${input.text}:${input.sourceLanguage || 'auto'}:${input.targetLanguage}`;
      }
    },
    
    // Configure retry behavior for resilience
    retry: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 5000,
      isRetryable: (error) => {
        // Only retry network errors, not validation errors
        return error.message.includes('network') || 
               error.message.includes('timeout');
      }
    },
    
    // Enable performance tracking
    tracking: {
      enabled: true,
      metrics: ['latency', 'memory', 'success_rate'],
      processMetrics: (metrics) => {
        // Optional callback to process metrics
        // Example: could send to monitoring system
        console.debug(`Translation metrics:`, metrics);
      }
    }
  });
}

/**
 * Simulated translation function
 * In a real implementation, this would call an external API
 */
async function simulateTranslation(
  text: string, 
  sourceLanguage: string, 
  targetLanguage: string
): Promise<string> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Very simple simulation for demo purposes
  if (targetLanguage === 'es') {
    // English to Spanish
    return text
      .replace(/Hello/gi, 'Hola')
      .replace(/World/gi, 'Mundo')
      .replace(/Thank you/gi, 'Gracias')
      .replace(/Good morning/gi, 'Buenos días')
      .replace(/How are you/gi, 'Cómo estás');
  } else if (targetLanguage === 'fr') {
    // English to French
    return text
      .replace(/Hello/gi, 'Bonjour')
      .replace(/World/gi, 'Monde')
      .replace(/Thank you/gi, 'Merci')
      .replace(/Good morning/gi, 'Bonjour')
      .replace(/How are you/gi, 'Comment allez-vous');
  } else if (targetLanguage === 'de') {
    // English to German
    return text
      .replace(/Hello/gi, 'Hallo')
      .replace(/World/gi, 'Welt')
      .replace(/Thank you/gi, 'Danke')
      .replace(/Good morning/gi, 'Guten Morgen')
      .replace(/How are you/gi, 'Wie geht es dir');
  }
  
  // Default behavior: return original text if language not supported
  return `[${targetLanguage}] ${text}`;
}
