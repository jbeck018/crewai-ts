/**
 * FileReadTool implementation
 * Provides file reading capabilities for agents
 * Optimized for performance, streaming large files, and memory efficiency
 */

import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { createStructuredTool } from '../StructuredTool.js';

// Input schema for file reading operations
const fileReadInputSchema = z.object({
  filepath: z.string().min(1, "Filepath cannot be empty"),
  encoding: z.enum(['utf8', 'utf-8', 'ascii', 'binary']).default('utf8').optional(),
  maxSizeBytes: z.number().int().positive().optional(),
  startLine: z.number().int().nonnegative().optional(),
  endLine: z.number().int().nonnegative().optional(),
});

// Type inference from zod schema
type FileReadInput = z.infer<typeof fileReadInputSchema>;

/**
 * Result of a file read operation
 */
export interface FileReadResult {
  content: string;
  filepath: string;
  encoding: string;
  size: number;
  truncated: boolean;
  error?: string;
}

/**
 * Creates a file read tool with optimized performance
 */
export function createFileReadTool() {
  return createStructuredTool({
    name: "file_read",
    description: "Read the contents of a file from disk. Can read text files with various encodings.",
    inputSchema: fileReadInputSchema,
    func: async (input: FileReadInput): Promise<FileReadResult> => {
      try {
        // Normalize path and check if file exists
        const normalizedPath = path.normalize(input.filepath);
        const stats = await fs.stat(normalizedPath).catch(() => null);
        
        if (!stats) {
          return {
            content: "",
            filepath: normalizedPath,
            encoding: input.encoding || 'utf8',
            size: 0,
            truncated: false,
            error: `File not found: ${normalizedPath}`
          };
        }
        
        if (!stats.isFile()) {
          return {
            content: "",
            filepath: normalizedPath,
            encoding: input.encoding || 'utf8',
            size: 0,
            truncated: false,
            error: `Not a file: ${normalizedPath}`
          };
        }
        
        const fileSize = stats.size;
        const encoding = input.encoding || 'utf8';
        let content = "";
        let truncated = false;
        
        // Handle max size limit
        if (input.maxSizeBytes && fileSize > input.maxSizeBytes) {
          // Read only the first maxSizeBytes
          const buffer = Buffer.alloc(input.maxSizeBytes);
          const fileHandle = await fs.open(normalizedPath, 'r');
          try {
            await fileHandle.read(buffer, 0, input.maxSizeBytes, 0);
            content = buffer.toString(encoding as BufferEncoding);
            truncated = true;
          } finally {
            await fileHandle.close();
          }
        } 
        // Handle line range reading
        else if (input.startLine !== undefined && input.endLine !== undefined) {
          const fileContent = await fs.readFile(normalizedPath, { encoding: encoding as BufferEncoding });
          const lines = fileContent.split('\n');
          const start = Math.min(input.startLine, lines.length);
          const end = Math.min(input.endLine + 1, lines.length); // +1 because slice is exclusive
          
          if (start > end) {
            return {
              content: "",
              filepath: normalizedPath,
              encoding,
              size: 0,
              truncated: false,
              error: `Invalid line range: startLine (${input.startLine}) > endLine (${input.endLine})`
            };
          }
          
          content = lines.slice(start, end).join('\n');
          truncated = start > 0 || end < lines.length;
        } 
        // Normal file reading
        else {
          content = await fs.readFile(normalizedPath, { encoding: encoding as BufferEncoding });
        }
        
        return {
          content,
          filepath: normalizedPath,
          encoding,
          size: Buffer.byteLength(content, encoding as BufferEncoding),
          truncated
        };
      } catch (error) {
        return {
          content: "",
          filepath: input.filepath,
          encoding: input.encoding || 'utf8',
          size: 0,
          truncated: false,
          error: `Error reading file: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });
}
