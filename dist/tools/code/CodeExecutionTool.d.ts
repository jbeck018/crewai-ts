/**
 * CodeExecutionTool implementation
 * Provides safe and controlled execution of code
 * Performance optimized for both safety and execution speed
 */
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
export declare function createCodeExecutionTool(config?: CodeExecutionConfig): import("../StructuredTool.js").StructuredTool<{
    code: string;
    language: "javascript" | "typescript" | "python" | "bash" | "shell";
    timeout?: number | undefined;
}, {
    success: boolean;
    stdout: any;
    stderr: any;
    error: any;
}>;
//# sourceMappingURL=CodeExecutionTool.d.ts.map