/**
 * FlowDependencyVisualizer
 *
 * Provides optimized visualization tools for flow dependencies and execution performance,
 * helping users identify bottlenecks and optimize multi-flow orchestration.
 */
import { FlowOrchestrator } from './FlowOrchestrator.js';
export interface FlowVisualizationOptions {
    outputPath?: string;
    filename?: string;
    title?: string;
    layout?: 'hierarchical' | 'force' | 'circular';
    colorScheme?: 'status' | 'performance' | 'priority';
    includeMetadata?: boolean;
    optimizationLevel?: 'low' | 'medium' | 'high';
    maxNodeSize?: number;
    groupBy?: 'none' | 'status' | 'priority' | 'metadata';
    groupByMetadataField?: string;
    includeExecutionMetrics?: boolean;
    formatOptions?: {
        useStaticHTML?: boolean;
        compressOutput?: boolean;
        inlineStyles?: boolean;
        enableInteractivity?: boolean;
    };
}
/**
 * Visualizer for flow dependencies and execution performance with optimized rendering.
 */
export declare class FlowDependencyVisualizer {
    private orchestrator;
    private options;
    private nodeCache;
    private edgeCache;
    constructor(orchestrator: FlowOrchestrator, options?: FlowVisualizationOptions);
    /**
     * Generate and save flow dependency visualization with performance optimizations
     */
    visualize(): Promise<string>;
    /**
     * Build optimized graph data from orchestrator state
     */
    private buildGraph;
    /**
     * Format node label with optimized output
     */
    private formatNodeLabel;
    /**
     * Apply styling to nodes based on color scheme and status
     */
    private applyNodeStyling;
    /**
     * Apply styling to edges
     */
    private applyEdgeStyling;
    /**
     * Apply node grouping based on options
     */
    private applyNodeGrouping;
    /**
     * Apply performance optimizations based on optimization level
     */
    private applyOptimizations;
    /**
     * Generate optimized HTML visualization
     */
    private generateVisualizationHtml;
    /**
     * Generate HTML for metrics display
     */
    private generateMetricsHtml;
    /**
     * Get layout options based on configuration
     */
    private getLayoutOptions;
    /**
     * Minify HTML for smaller output file size
     */
    private minifyHtml;
}
//# sourceMappingURL=FlowDependencyVisualizer.d.ts.map