/**
 * FileWriteTool implementation
 * Provides file writing capabilities for agents
 * Optimized for performance, streaming large content, and memory efficiency
 */

import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { createStructuredTool } from '../StructuredTool.js';

// Input schema for file writing operations
const fileWriteInputSchema = z.object({
  filepath: z.string().min(1, "Filepath cannot be empty"),
  content: z.string().or(z.instanceof(Buffer)).or(z.instanceof(Uint8Array)),
  encoding: z.enum(['utf8', 'utf-8', 'ascii', 'binary']).default('utf8').optional(),
  append: z.boolean().default(false).optional(),
  createDirectories: z.boolean().default(true).optional(),
});

// Type inference from zod schema
type FileWriteInput = z.infer<typeof fileWriteInputSchema>;

/**
 * Result of a file write operation
 */
export interface FileWriteResult {
  success: boolean;
  filepath: string;
  bytesWritten: number;
  error?: string;
}

/**
 * Ensures directory exists, creating it if necessary and requested
 */
async function ensureDirectoryExists(filePath: string, create: boolean): Promise<boolean> {
  const dirname = path.dirname(filePath);
  
  try {
    const stats = await fs.stat(dirname).catch((): null => null);
    
    // Directory exists
    if (stats && stats.isDirectory()) {
      return true;
    }
    
    // Directory doesn't exist but we're allowed to create it
    if (create) {
      await fs.mkdir(dirname, { recursive: true });
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Creates a file write tool with optimized performance
 */
export function createFileWriteTool() {
  return createStructuredTool({
    name: "file_write",
    description: "Write content to a file. Can create directories if they don't exist.",
    inputSchema: fileWriteInputSchema,
    func: async (input: FileWriteInput): Promise<FileWriteResult> => {
      try {
        // Normalize path
        const normalizedPath = path.normalize(input.filepath);
        
        // Make sure directory exists if requested
        const dirExists = await ensureDirectoryExists(
          normalizedPath, 
          input.createDirectories ?? true
        );
        
        if (!dirExists) {
          return {
            success: false,
            filepath: normalizedPath,
            bytesWritten: 0,
            error: `Directory does not exist: ${path.dirname(normalizedPath)}`
          };
        }
        
        let content: string | Buffer;
        let bytesWritten: number;
        
        // Handle different content types
        if (typeof input.content === 'string') {
          content = input.content;
          bytesWritten = Buffer.byteLength(content, input.encoding as BufferEncoding);
        } else {
          content = Buffer.from(input.content);
          bytesWritten = content.length;
        }
        
        // Write to file
        if (input.append) {
          // Append mode - optimized for log files or incremental writes
          await fs.appendFile(normalizedPath, content, { 
            encoding: typeof input.content === 'string' ? input.encoding as BufferEncoding : undefined 
          });
        } else {
          // Write mode - optimized for complete file writes
          await fs.writeFile(normalizedPath, content, { 
            encoding: typeof input.content === 'string' ? input.encoding as BufferEncoding : undefined 
          });
        }
        
        return {
          success: true,
          filepath: normalizedPath,
          bytesWritten
        };
      } catch (error) {
        return {
          success: false,
          filepath: input.filepath,
          bytesWritten: 0,
          error: `Error writing file: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });
}
