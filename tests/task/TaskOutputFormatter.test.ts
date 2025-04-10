/**
 * Tests for TaskOutputFormatter
 * Focuses on performance and memory efficiency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { TaskOutputFormatter, ZodOutputSchema, InterfaceOutputSchema } from '../../src/task/TaskOutputFormatter';

describe('TaskOutputFormatter', () => {
  // Types for schema validation
  type SimpleSchema = { name: string; age: number };

  // Define test schemas with explicit output type
  const simpleSchema = z.object({
    name: z.string(),
    age: z.number()
  }).strict().transform(data => data as SimpleSchema); // Explicitly transform to SimpleSchema type

  // Create typed schema instances for testing

  describe('ZodOutputSchema', () => {
    let schema: ZodOutputSchema<SimpleSchema>;

    beforeEach(() => {
      // Use type assertion to ensure the schema is correctly typed
      schema = new ZodOutputSchema(simpleSchema as z.ZodType<SimpleSchema>);
    });

    it('should validate correct data', () => {
      const data = { name: 'Test', age: 30 };
      expect(schema.validate(data)).toEqual(data);
    });

    it('should throw on invalid data', () => {
      const data = { name: 'Test', age: 'invalid' };
      expect(() => schema.validate(data)).toThrow();
    });

    it('should provide safe parsing with errors', () => {
      const result = schema.safeParse({ name: 'Test', age: 'invalid' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle performance efficiently for multiple validations', () => {
      const data = { name: 'Test', age: 30 };
      const startTime = performance.now();
      
      // Perform 1000 validations
      for (let i = 0; i < 1000; i++) {
        schema.validate(data);
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // This is a loose threshold - adjust if necessary based on actual performance
      expect(executionTime).toBeLessThan(500); // Should take less than 500ms for 1000 validations
    });
  });

  describe('InterfaceOutputSchema', () => {
    let schema: InterfaceOutputSchema<SimpleSchema>;

    beforeEach(() => {
      schema = new InterfaceOutputSchema<SimpleSchema>();
    });

    it('should pass through data without validation in runtime', () => {
      const data = { name: 'Test', age: 'invalid' };
      // This would fail with Zod, but InterfaceOutputSchema just passes it through
      expect(schema.validate(data as any)).toEqual(data);
    });

    it('should have minimal overhead compared to ZodOutputSchema', () => {
      const data = { name: 'Test', age: 30 };
      const zodSchema = new ZodOutputSchema(simpleSchema);
      
      // Measure InterfaceOutputSchema performance
      const interfaceStart = performance.now();
      for (let i = 0; i < 10000; i++) {
        schema.validate(data);
      }
      const interfaceEnd = performance.now();
      const interfaceTime = interfaceEnd - interfaceStart;
      
      // Measure ZodOutputSchema performance
      const zodStart = performance.now();
      for (let i = 0; i < 10000; i++) {
        zodSchema.validate(data);
      }
      const zodEnd = performance.now();
      const zodTime = zodEnd - zodStart;
      
      // InterfaceOutputSchema should be significantly faster
      // Previous tests showed ~4.8x performance improvement, so we use 4x as a conservative threshold
      expect(interfaceTime).toBeLessThan(zodTime / 4); // Updated threshold based on actual performance characteristics
    });
  });

  describe('TaskOutputFormatter', () => {
    it('should format JSON string correctly', () => {
      const formatter = TaskOutputFormatter.fromZodSchema(simpleSchema);
      const jsonString = '{"name":"Test","age":30}';
      
      const result = formatter.format(jsonString);
      expect(result).toEqual({ name: 'Test', age: 30 });
    });

    it('should handle plain text with interface schema', () => {
      const formatter = TaskOutputFormatter.fromInterface<string>();
      const plainText = 'This is a test';
      
      const result = formatter.format(plainText);
      expect(result).toBe(plainText);
    });

    it('should provide safe formatting with error handling', () => {
      const formatter = TaskOutputFormatter.fromZodSchema(simpleSchema);
      const invalidJson = '{"name":"Test","age":"invalid"}';
      
      const result = formatter.safeFormat(invalidJson);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid JSON gracefully', () => {
      const formatter = TaskOutputFormatter.fromInterface<string>();
      const invalidJson = 'This is not JSON';
      
      // Should not throw when formatting invalid JSON
      const result = formatter.safeFormat(invalidJson);
      expect(result.success).toBe(true);
      expect(result.data).toBe(invalidJson);
    });

    it('should create formatter with convenience function', () => {
      const { createOutputFormatter } = require('../../src/task/TaskOutputFormatter');
      const formatter = createOutputFormatter(simpleSchema);
      const validJson = '{"name":"Test","age":30}';
      
      const result = formatter.format(validJson);
      expect(result).toEqual({ name: 'Test', age: 30 });
    });

    it('should handle complex nested schemas', () => {
      const complexSchema = z.object({
        user: z.object({
          name: z.string(),
          profile: z.object({
            age: z.number(),
            interests: z.array(z.string())
          })
        }),
        metadata: z.object({
          createdAt: z.string(),
          version: z.number()
        })
      });

      const formatter = TaskOutputFormatter.fromZodSchema(complexSchema);
      const complexJson = JSON.stringify({
        user: {
          name: 'Test User',
          profile: {
            age: 25,
            interests: ['coding', 'testing']
          }
        },
        metadata: {
          createdAt: '2025-04-09',
          version: 1.0
        }
      });

      const result = formatter.format(complexJson);
      expect(result.user.name).toBe('Test User');
      expect(result.user.profile.interests).toContain('coding');
      expect(result.metadata.version).toBe(1.0);
    });
  });
});
