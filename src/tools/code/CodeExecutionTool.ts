/**
 * CodeExecutionTool implementation
 * Provides safe and controlled execution of code
 * Performance optimized for both safety and execution speed
 */

import { z } from 'zod';
import * as crypto from 'crypto';
import { createStructuredTool } from '../StructuredTool.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Schema for code execution
const CodeExecutionSchema = z.object({
  code: z.string().describe('The code to execute'),
  language: z.enum(['javascript', 'typescript', 'python', 'bash', 'shell']),
  timeout: z.number().optional().default(30000).describe('Execution timeout in milliseconds')
});

/**
 * Languages and their execution commands
 */
const LANGUAGE_CONFIGS = {
  javascript: {
    extension: 'js',
    command: 'node'
  },
  typescript: {
    extension: 'ts',
    command: 'npx ts-node'
  },
  python: {
    extension: 'py',
    command: 'python',
    altCommand: 'python3' // Fallback command
  },
  bash: {
    extension: 'sh',
    command: 'bash'
  },
  shell: {
    extension: 'sh',
    command: 'sh'
  }
};

/**
 * Configuration options for CodeExecutionTool
 */
export interface CodeExecutionConfig {
  /** Whether to allow potentially unsafe code execution */
  unsafeMode?: boolean;
  /** Maximum execution time in milliseconds */
  defaultTimeout?: number;
  /** Directory to use for temporary files */
  workingDirectory?: string;
  /** Whether to validate Docker is available (for containerized execution) */
  validateDocker?: boolean;
  /** Whether to use Docker for execution isolation */
  useDocker?: boolean;
}

/**
 * Creates a code execution tool with safety precautions
 * @param config Configuration options
 */
export function createCodeExecutionTool(config: CodeExecutionConfig = {}) {
  const {
    unsafeMode = false,
    defaultTimeout = 30000,
    workingDirectory = os.tmpdir(),
    validateDocker = true,
    useDocker = false
  } = config;
  
  // If Docker validation is requested, check Docker installation
  if (validateDocker && useDocker) {
    validateDockerInstallation();
  }
  
  return createStructuredTool({
    name: 'execute_code',
    description: 'Execute code in a controlled environment',
    inputSchema: CodeExecutionSchema,
    func: async ({ code, language, timeout = defaultTimeout }) => {
      // Security check - don't allow unsafe code if unsafeMode is false
      if (!unsafeMode) {
        const securityCheck = checkCodeSecurity(code, language);
        if (!securityCheck.safe) {
          return {
            success: false,
            error: `Security check failed: ${securityCheck.reason}`,
            stdout: '',
            stderr: ''
          };
        }
      }
      
      try {
        // Define the language configuration
        const langConfig = LANGUAGE_CONFIGS[language];
        
        // Generate a unique identifier for this execution
        const execId = crypto.randomBytes(8).toString('hex');
        const tempFilePath = path.join(
          workingDirectory, 
          `code_exec_${execId}.${langConfig.extension}`
        );
        
        // Write code to temporary file
        fs.writeFileSync(tempFilePath, code, 'utf8');
        
        let result;
        if (useDocker) {
          // Execute in Docker container for isolation
          result = executeInDocker(tempFilePath, langConfig, timeout);
        } else {
          // Execute directly
          result = executeLocally(tempFilePath, langConfig, timeout);
        }
        
        // Clean up the temporary file
        try {
          fs.unlinkSync(tempFilePath);
        } catch (error) {
          console.error('Failed to clean up temporary file:', error);
        }
        
        return result;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          stdout: '',
          stderr: ''
        };
      }
    },
    timeout: defaultTimeout + 5000, // Add buffer to the tool timeout
    cacheResults: false, // Don't cache code execution results
  });
}

/**
 * Helper function to validate Docker installation
 */
function validateDockerInstallation(): void {
  try {
    // Check if Docker is installed
    execSync('docker --version', { stdio: 'ignore' });
    
    // Check if Docker is running
    execSync('docker info', { stdio: 'ignore' });
  } catch (error) {
    throw new Error('Docker is not installed or running. Please install and start Docker to use containerized code execution.');
  }
}

/**
 * Check if code is safe to execute
 */
function checkCodeSecurity(code: string, language: string): { safe: boolean; reason?: string } {
  // Basic security checks
  const securityChecks = [
    // File system operations that might be destructive
    { pattern: /rm\s+-rf|unlink(?!Sync)|deleteFile|fs\.rmdir|fs\.rm|fs\.unlink/i, reason: 'Destructive file operations' },
    // System/shell execution (except in bash/shell scripts)
    ...(['javascript', 'typescript', 'python'].includes(language) ? 
      [{ pattern: /child_process|spawn|exec|system|subprocess|os\.system|eval\(/i, reason: 'System command execution' }] : 
      []),
    // Network access that might be malicious
    { pattern: /fetch\(|http\.request|axios|request\(|urllib|socket\.connect|net\.createConnection/i, reason: 'Network operations' },
    // Import or require of potentially dangerous modules
    { pattern: /import\s+os|from\s+os\s+import|require\(['"]child_process['"]\)|require\(['"]fs['"]\)/i, reason: 'System module imports' },
  ];
  
  // Check against security patterns
  for (const check of securityChecks) {
    if (check.pattern.test(code)) {
      return { safe: false, reason: check.reason };
    }
  }
  
  return { safe: true };
}

/**
 * Execute code locally
 */
function executeLocally(filePath: string, langConfig: typeof LANGUAGE_CONFIGS[keyof typeof LANGUAGE_CONFIGS], timeout: number) {
  try {
    // Determine the command to execute
    const command = `${langConfig.command} "${filePath}"`;
    
    // Execute with timeout
    const stdout = execSync(command, { 
      timeout,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    return {
      success: true,
      stdout,
      stderr: '',
      error: null
    };
  } catch (error: any) {
    return {
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      error: error.message
    };
  }
}

/**
 * Execute code in a Docker container for isolation
 */
function executeInDocker(filePath: string, langConfig: typeof LANGUAGE_CONFIGS[keyof typeof LANGUAGE_CONFIGS], timeout: number) {
  try {
    // Determine appropriate Docker image for the language
    let dockerImage = 'node:latest';
    if (langConfig.extension === 'py') {
      dockerImage = 'python:3.9-slim';
    } else if (langConfig.extension === 'sh') {
      dockerImage = 'alpine:latest';
    }
    
    // Create Docker command
    const dockerCommand = `docker run --rm -v "${path.dirname(filePath)}:/code" \
      --network none \
      --name code_exec_${path.basename(filePath)} \
      --memory=512m --cpus=1 \
      ${dockerImage} \
      ${langConfig.command} /code/${path.basename(filePath)}`;
    
    // Execute with timeout
    const stdout = execSync(dockerCommand, { 
      timeout,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    return {
      success: true,
      stdout,
      stderr: '',
      error: null
    };
  } catch (error: any) {
    return {
      success: false,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      error: error.message
    };
  }
}
