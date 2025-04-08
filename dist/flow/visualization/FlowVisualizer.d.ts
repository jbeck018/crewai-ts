import { Flow } from '../Flow.js';
/**
 * Flow visualization component with optimized rendering performance.
 */
export declare class FlowVisualizer {
    private flow;
    private templatePath;
    private outputDir;
    private nodePositions;
    /**
     * Creates a new flow visualizer instance
     *
     * @param flow The flow to visualize
     * @param options Optional configuration
     */
    constructor(flow: Flow, options?: {
        outputDir?: string;
    });
    /**
     * Precomputes node positions for the flow
     * This improves rendering performance by doing the layout calculation upfront
     */
    private precomputePositions;
    /**
     * Generates the flow visualization and saves it to a file
     *
     * @param filename Output filename (without extension)
     * @returns Path to the generated HTML file
     */
    generateVisualization(filename?: string): Promise<string>;
    /**
     * Generates the complete HTML content for the visualization
     *
     * @param vis The vis-network module
     * @returns Complete HTML content as string
     */
    private generateHtml;
    /**
     * Generates the final HTML by combining the network visualization with the template
     *
     * @param networkHtml The network visualization HTML content
     * @returns Complete HTML document string
     */
    private generateFinalHtml;
    /**
     * Returns a default HTML template if the template file is not found
     * This ensures the visualization works even without external dependencies
     */
    private getDefaultTemplate;
}
/**
 * Convenience function to create and save a flow visualization
 *
 * @param flow Flow instance to visualize
 * @param filename Output filename without extension
 * @param outputDir Directory to save the visualization
 * @returns Path to the generated HTML file
 */
export declare function plotFlow(flow: Flow, filename?: string, outputDir?: string): Promise<string>;
//# sourceMappingURL=FlowVisualizer.d.ts.map