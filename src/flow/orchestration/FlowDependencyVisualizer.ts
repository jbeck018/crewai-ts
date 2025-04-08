/**
 * FlowDependencyVisualizer
 * 
 * Provides optimized visualization tools for flow dependencies and execution performance,
 * helping users identify bottlenecks and optimize multi-flow orchestration.
 */

import { FlowOrchestrator } from './FlowOrchestrator.js';
import * as fs from 'fs/promises';
import path from 'path';

// Optimized graph data structures
interface GraphNode {
  id: string;
  label: string;
  status?: string;
  executionTime?: number;
  priority?: number;
  group?: string;
  shape?: string;
  color?: string;
  borderWidth?: number;
  borderColor?: string;
  size?: number;
  font?: {
    size?: number;
    color?: string;
    face?: string;
    bold?: boolean;
  };
  metadata?: Record<string, any>;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  color?: string;
  width?: number;
  dashes?: boolean;
  arrows?: {
    to?: boolean;
    from?: boolean;
  };
  metadata?: Record<string, any>;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Visualization options with performance tuning parameters
export interface FlowVisualizationOptions {
  outputPath?: string;
  filename?: string;
  title?: string;
  layout?: 'hierarchical' | 'force' | 'circular';
  colorScheme?: 'status' | 'performance' | 'priority';
  includeMetadata?: boolean;
  optimizationLevel?: 'low' | 'medium' | 'high';
  maxNodeSize?: number; // For performance optimization
  groupBy?: 'none' | 'status' | 'priority' | 'metadata';
  groupByMetadataField?: string; // Used when groupBy is 'metadata'
  includeExecutionMetrics?: boolean;
  formatOptions?: {
    useStaticHTML?: boolean; // Whether to use static HTML (true) or dynamic vis.js (false)
    compressOutput?: boolean; // Whether to minify HTML/JS for smaller output
    inlineStyles?: boolean; // Whether to inline all styles (better for sharing)
    enableInteractivity?: boolean; // Whether to enable interactive features
  };
}

/**
 * Visualizer for flow dependencies and execution performance with optimized rendering.
 */
export class FlowDependencyVisualizer {
  private orchestrator: FlowOrchestrator;
  private options: FlowVisualizationOptions;
  
  // Cache for performance optimization
  private nodeCache = new Map<string, GraphNode>();
  private edgeCache = new Map<string, GraphEdge>();
  
  constructor(orchestrator: FlowOrchestrator, options: FlowVisualizationOptions = {}) {
    this.orchestrator = orchestrator;
    
    // Apply default options with performance optimizations
    this.options = {
      outputPath: './visualizations',
      filename: `flow-dependencies-${Date.now()}`,
      title: 'Flow Dependencies',
      layout: 'hierarchical',
      colorScheme: 'status',
      includeMetadata: true,
      optimizationLevel: 'medium',
      maxNodeSize: 100, // Limit for performance
      groupBy: 'none',
      includeExecutionMetrics: true,
      formatOptions: {
        useStaticHTML: true,
        compressOutput: true,
        inlineStyles: true,
        enableInteractivity: true
      },
      ...options
    };
  }
  
  /**
   * Generate and save flow dependency visualization with performance optimizations
   */
  async visualize(): Promise<string> {
    // Get graph data from orchestrator with optimized structure
    const graphData = this.buildGraph();
    
    // Apply performance optimizations based on optimization level
    this.applyOptimizations(graphData);
    
    // Generate HTML visualization
    const html = this.generateVisualizationHtml(graphData);
    
    // Ensure output directory exists
    await fs.mkdir(this.options.outputPath!, { recursive: true })
      .catch(err => {
        if (err.code !== 'EEXIST') throw err;
      });
    
    // Write visualization to file
    const outputPath = path.join(
      this.options.outputPath!,
      `${this.options.filename!}.html`
    );
    
    await fs.writeFile(outputPath, html);
    
    return outputPath;
  }
  
  /**
   * Build optimized graph data from orchestrator state
   */
  private buildGraph(): GraphData {
    // Get flow graph data from orchestrator
    const orchestratorGraph = this.orchestrator.getFlowGraph();
    const executionMetrics = this.options.includeExecutionMetrics 
      ? this.orchestrator.getExecutionMetrics() 
      : null;
    
    // Create nodes and edges with performance-optimized data structures
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    // Performance optimization: pre-allocate arrays when size is known
    nodes.length = orchestratorGraph.nodes.length;
    edges.length = orchestratorGraph.edges.length;
    
    // Process nodes with optimized attribute handling
    for (let i = 0; i < orchestratorGraph.nodes.length; i++) {
      const node = orchestratorGraph.nodes[i];
      
      // Use cache for unchanged nodes
      const cacheKey = `${node.id}_${node.status}_${node.executionTime}`;
      if (this.nodeCache.has(cacheKey)) {
        nodes[i] = this.nodeCache.get(cacheKey)!;
        continue;
      }
      
      // Create new node with styling based on status and performance
      const graphNode: GraphNode = {
        id: node.id,
        label: this.formatNodeLabel(node),
        status: node.status,
        executionTime: node.executionTime,
        priority: node.priority,
        metadata: this.options.includeMetadata ? node.metadata : undefined
      };
      
      // Apply styling based on color scheme
      this.applyNodeStyling(graphNode);
      
      // Apply grouping if enabled
      if (this.options.groupBy !== 'none') {
        this.applyNodeGrouping(graphNode);
      }
      
      // Store in cache and result
      this.nodeCache.set(cacheKey, graphNode);
      nodes[i] = graphNode;
    }
    
    // Process edges with optimized attribute handling
    for (let i = 0; i < orchestratorGraph.edges.length; i++) {
      const edge = orchestratorGraph.edges[i];
      
      // Use cache for unchanged edges
      const cacheKey = `${edge.from}_${edge.to}_${edge.hasCondition}_${edge.hasDataMapping}`;
      if (this.edgeCache.has(cacheKey)) {
        edges[i] = this.edgeCache.get(cacheKey)!;
        continue;
      }
      
      // Create new edge with styling
      const graphEdge: GraphEdge = {
        id: `${edge.from}_to_${edge.to}`,
        from: edge.from,
        to: edge.to,
        label: edge.hasCondition ? 'conditional' : (edge.hasDataMapping ? 'data' : undefined),
        arrows: { to: true },
        dashes: edge.hasCondition
      };
      
      // Apply edge styling
      this.applyEdgeStyling(graphEdge);
      
      // Store in cache and result
      this.edgeCache.set(cacheKey, graphEdge);
      edges[i] = graphEdge;
    }
    
    return { nodes, edges };
  }
  
  /**
   * Format node label with optimized output
   */
  private formatNodeLabel(node: any): string {
    const parts = [node.id];
    
    if (node.status) {
      parts.push(`[${node.status}]`);
    }
    
    if (node.executionTime !== undefined) {
      parts.push(`${node.executionTime.toFixed(2)}ms`);
    }
    
    return parts.join('\n');
  }
  
  /**
   * Apply styling to nodes based on color scheme and status
   */
  private applyNodeStyling(node: GraphNode): void {
    // Default styling
    node.shape = 'box';
    node.borderWidth = 1;
    
    // Apply color based on scheme
    switch (this.options.colorScheme) {
      case 'status':
        // Status-based coloring
        switch (node.status) {
          case 'pending':
            node.color = '#E0E0E0';
            node.borderColor = '#9E9E9E';
            break;
          case 'running':
            node.color = '#FFF59D';
            node.borderColor = '#FBC02D';
            break;
          case 'completed':
            node.color = '#A5D6A7';
            node.borderColor = '#4CAF50';
            break;
          case 'failed':
            node.color = '#EF9A9A';
            node.borderColor = '#F44336';
            break;
          default:
            node.color = '#E1F5FE';
            node.borderColor = '#03A9F4';
        }
        break;
        
      case 'performance':
        // Performance-based coloring (gradient from green to red)
        if (node.executionTime !== undefined) {
          // Calculate color based on execution time
          // Green (fast) to red (slow)
          const normalized = Math.min(1, node.executionTime / 1000); // Normalize to 0-1 range (1 second max)
          const r = Math.floor(normalized * 255);
          const g = Math.floor((1 - normalized) * 255);
          node.color = `rgb(${r}, ${g}, 0)`;
          node.borderColor = `rgb(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, 40)`;
        } else {
          // No execution time data
          node.color = '#E0E0E0';
          node.borderColor = '#9E9E9E';
        }
        break;
        
      case 'priority':
        // Priority-based coloring
        if (node.priority !== undefined) {
          // Higher priority = deeper color
          const priority = Math.max(0, Math.min(10, node.priority)); // Clamp to 0-10 range
          const intensity = 55 + (priority * 20); // 55-255 range
          node.color = `rgb(${intensity}, ${intensity}, 255)`;
          node.borderColor = `rgb(0, 0, 200)`;
        } else {
          // No priority data
          node.color = '#E0E0E0';
          node.borderColor = '#9E9E9E';
        }
        break;
    }
    
    // Set size based on priority if available
    if (node.priority !== undefined) {
      const baseFontSize = 14;
      const baseSize = 30;
      node.size = baseSize + (node.priority * 2);
      node.font = {
        size: baseFontSize + (node.priority > 5 ? 2 : 0),
        bold: node.priority > 7
      };
    }
  }
  
  /**
   * Apply styling to edges
   */
  private applyEdgeStyling(edge: GraphEdge): void {
    // Default styling
    edge.width = 1;
    
    // Conditional edges
    if (edge.dashes) {
      edge.color = '#FF9800'; // Orange for conditional
    } else if (edge.label === 'data') {
      edge.color = '#2196F3'; // Blue for data mapping
      edge.width = 2;
    } else {
      edge.color = '#9E9E9E'; // Gray for regular
    }
  }
  
  /**
   * Apply node grouping based on options
   */
  private applyNodeGrouping(node: GraphNode): void {
    switch (this.options.groupBy) {
      case 'status':
        node.group = node.status || 'unknown';
        break;
      case 'priority':
        if (node.priority !== undefined) {
          // Group by priority ranges
          if (node.priority >= 8) {
            node.group = 'high-priority';
          } else if (node.priority >= 4) {
            node.group = 'medium-priority';
          } else {
            node.group = 'low-priority';
          }
        } else {
          node.group = 'no-priority';
        }
        break;
      case 'metadata':
        if (node.metadata && this.options.groupByMetadataField) {
          node.group = String(node.metadata[this.options.groupByMetadataField] || 'unknown');
        } else {
          node.group = 'unknown';
        }
        break;
    }
  }
  
  /**
   * Apply performance optimizations based on optimization level
   */
  private applyOptimizations(graphData: GraphData): void {
    const { optimizationLevel, maxNodeSize } = this.options;
    
    // Limit the total number of nodes for performance
    if (graphData.nodes.length > maxNodeSize!) {
      console.warn(`Limiting visualization to ${maxNodeSize} nodes for performance reasons`);
      graphData.nodes = graphData.nodes.slice(0, maxNodeSize);
      
      // Filter edges to only include connections between remaining nodes
      const nodeIds = new Set(graphData.nodes.map(n => n.id));
      graphData.edges = graphData.edges.filter(
        e => nodeIds.has(e.from) && nodeIds.has(e.to)
      );
    }
    
    // Apply additional optimizations based on level
    switch (optimizationLevel) {
      case 'high':
        // Maximum optimization (minimal details)
        graphData.nodes.forEach(node => {
          // Remove metadata to reduce size
          delete node.metadata;
          // Simplify labels
          node.label = node.id;
        });
        
        // Remove edge labels
        graphData.edges.forEach(edge => {
          delete edge.label;
        });
        
        break;
        
      case 'medium':
        // Balanced optimization
        graphData.nodes.forEach(node => {
          // Keep only essential metadata
          if (node.metadata) {
            const essentialKeys = ['type', 'category', 'owner'];
            const essentialMetadata: Record<string, any> = {};
            
            essentialKeys.forEach(key => {
              if (node.metadata![key] !== undefined) {
                essentialMetadata[key] = node.metadata![key];
              }
            });
            
            node.metadata = essentialMetadata;
          }
        });
        break;
        
      case 'low':
        // Minimal optimization (keep most details)
        // No additional optimizations needed
        break;
    }
  }
  
  /**
   * Generate optimized HTML visualization
   */
  private generateVisualizationHtml(graphData: GraphData): string {
    const { formatOptions, title, layout } = this.options;
    
    // Get execution metrics if enabled
    const executionMetrics = this.options.includeExecutionMetrics 
      ? this.orchestrator.getExecutionMetrics() 
      : null;
    
    // Convert graph data to JSON with minimal whitespace
    const nodesJson = formatOptions?.compressOutput 
      ? JSON.stringify(graphData.nodes) 
      : JSON.stringify(graphData.nodes, null, 2);
      
    const edgesJson = formatOptions?.compressOutput 
      ? JSON.stringify(graphData.edges) 
      : JSON.stringify(graphData.edges, null, 2);
    
    // Determine layout options
    const layoutOptions = this.getLayoutOptions();
    
    // Generate metrics HTML if enabled
    const metricsHtml = executionMetrics 
      ? this.generateMetricsHtml(executionMetrics) 
      : '';
    
    // Generate HTML
    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
  <style type="text/css">
    body, html {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    
    header {
      padding: 10px;
      background-color: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    h1 {
      margin: 0;
      font-size: 18px;
    }
    
    #container {
      display: flex;
      width: 100%;
      height: calc(100% - 50px);
    }
    
    #network-container {
      flex: 3;
      height: 100%;
    }
    
    #metrics-panel {
      flex: 1;
      padding: 15px;
      overflow-y: auto;
      background-color: #fafafa;
      border-left: 1px solid #e0e0e0;
      max-width: 350px;
    }
    
    .metric-card {
      background: white;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
      margin-bottom: 15px;
      padding: 10px;
    }
    
    .metric-title {
      font-weight: bold;
      margin-bottom: 8px;
      color: #333;
      font-size: 14px;
    }
    
    .metric-value {
      font-size: 22px;
      color: #2196F3;
      font-weight: 300;
    }
    
    .metric-subtitle {
      font-size: 12px;
      color: #757575;
      margin-top: 3px;
    }
    
    .flow-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 10px;
    }
    
    .flow-table th {
      text-align: left;
      background-color: #f5f5f5;
      padding: 5px 8px;
    }
    
    .flow-table td {
      padding: 5px 8px;
      border-top: 1px solid #eeeeee;
    }
    
    .flow-status {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 5px;
    }
    
    .status-completed {
      background-color: #4CAF50;
    }
    
    .status-failed {
      background-color: #F44336;
    }
    
    .status-running {
      background-color: #FBC02D;
    }
    
    .status-pending {
      background-color: #9E9E9E;
    }
    
    .legend {
      display: flex;
      gap: 10px;
      margin: 0;
      font-size: 12px;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
    }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    <div class="legend">
      <div class="legend-item"><span class="flow-status status-pending"></span> Pending</div>
      <div class="legend-item"><span class="flow-status status-running"></span> Running</div>
      <div class="legend-item"><span class="flow-status status-completed"></span> Completed</div>
      <div class="legend-item"><span class="flow-status status-failed"></span> Failed</div>
    </div>
  </header>
  
  <div id="container">
    <div id="network-container"></div>
    ${executionMetrics ? '<div id="metrics-panel">' + metricsHtml + '</div>' : ''}
  </div>
  
  <script type="text/javascript">
    // Create a network
    const container = document.getElementById('network-container');
    
    // Provide the data in the vis format
    const nodes = new vis.DataSet(${nodesJson});
    const edges = new vis.DataSet(${edgesJson});
    const data = { nodes, edges };
    
    // Options
    const options = {
      nodes: {
        shape: 'box',
        margin: 10,
        font: {
          multi: true,
          size: 14
        }
      },
      edges: {
        smooth: true,
        arrows: {
          to: { enabled: true, scaleFactor: 1 }
        }
      },
      physics: {
        enabled: true,
        stabilization: {
          iterations: 100
        }
      },
      layout: ${JSON.stringify(layoutOptions)},
      groups: {
        'completed': { color: { background: '#A5D6A7', border: '#4CAF50' } },
        'running': { color: { background: '#FFF59D', border: '#FBC02D' } },
        'pending': { color: { background: '#E0E0E0', border: '#9E9E9E' } },
        'failed': { color: { background: '#EF9A9A', border: '#F44336' } },
        'high-priority': { color: { background: '#D1C4E9', border: '#673AB7' } },
        'medium-priority': { color: { background: '#BBDEFB', border: '#2196F3' } },
        'low-priority': { color: { background: '#E1F5FE', border: '#03A9F4' } }
      },
      interaction: {
        tooltipDelay: 200,
        hover: true,
        navigationButtons: true,
        keyboard: true,
        ${formatOptions?.enableInteractivity === false ? 'dragNodes: false, zoomView: false,' : ''}
      }
    };
    
    // Initialize network
    const network = new vis.Network(container, data, options);
    
    // Add event handlers
    network.on("click", function(params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.get(nodeId);
        console.log('Selected node:', node);
      }
    });
    
    // Optional: Export network as image
    window.exportNetwork = function() {
      const dataUrl = network.canvas.frame.canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = '${this.options.filename}.png';
      link.href = dataUrl;
      link.click();
    };
  </script>
</body>
</html>
`;
    
    // Apply compression if needed
    if (formatOptions?.compressOutput) {
      html = this.minifyHtml(html);
    }
    
    return html;
  }
  
  /**
   * Generate HTML for metrics display
   */
  private generateMetricsHtml(metrics: any): string {
    const formatTime = (ms: number) => {
      if (ms < 1000) return `${ms.toFixed(2)}ms`;
      if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
      return `${(ms / 60000).toFixed(2)}m`;
    };
    
    // Format flow execution times table
    let flowTimesHtml = '';
    
    if (metrics.flowExecutionTimes && Object.keys(metrics.flowExecutionTimes).length > 0) {
      // Sort flows by execution time (descending)
      const flowTimes = Object.entries(metrics.flowExecutionTimes)
        .map(([id, time]) => ({ id, time: time as number }))
        .sort((a, b) => b.time - a.time);
      
      flowTimesHtml = `
      <div class="metric-card">
        <div class="metric-title">Flow Execution Times</div>
        <table class="flow-table">
          <thead>
            <tr>
              <th>Flow</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            ${flowTimes.map(({ id, time }) => `
            <tr>
              <td>${id}</td>
              <td>${formatTime(time)}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      `;
    }
    
    return `
    <div class="metric-card">
      <div class="metric-title">Total Execution Time</div>
      <div class="metric-value">${formatTime(metrics.totalExecutionTime)}</div>
    </div>
    
    <div class="metric-card">
      <div class="metric-title">Flow Status</div>
      <table class="flow-table">
        <tr>
          <td><span class="flow-status status-completed"></span> Completed</td>
          <td>${metrics.completedFlows || 0}</td>
        </tr>
        <tr>
          <td><span class="flow-status status-failed"></span> Failed</td>
          <td>${metrics.failedFlows || 0}</td>
        </tr>
        <tr>
          <td>Total Flows</td>
          <td>${metrics.flowCount || 0}</td>
        </tr>
      </table>
    </div>
    
    <div class="metric-card">
      <div class="metric-title">Average Flow Time</div>
      <div class="metric-value">${formatTime(metrics.averageFlowExecutionTime || 0)}</div>
      <div class="metric-subtitle">Average execution time per flow</div>
    </div>
    
    ${flowTimesHtml}
    `;
  }
  
  /**
   * Get layout options based on configuration
   */
  private getLayoutOptions(): any {
    switch (this.options.layout) {
      case 'hierarchical':
        return {
          hierarchical: {
            direction: 'UD',
            sortMethod: 'directed',
            nodeSpacing: 150,
            levelSeparation: 150
          }
        };
      case 'force':
        return {
          // Force-directed layout
          randomSeed: 2 // For consistent layouts
        };
      case 'circular':
        return {
          // Circular layout
          improvedLayout: true,
          randomSeed: 42
        };
      default:
        return {
          hierarchical: {
            direction: 'UD',
            sortMethod: 'directed',
            nodeSpacing: 150,
            levelSeparation: 150
          }
        };
    }
  }
  
  /**
   * Minify HTML for smaller output file size
   */
  private minifyHtml(html: string): string {
    // Basic HTML minification
    return html
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\s+</g, '<') // Remove spaces before opening tags
      .replace(/>\s+/g, '>') // Remove spaces after closing tags
      .replace(/<!--.*?-->/g, '') // Remove comments
      .replace(/\s+\{/g, '{') // Remove spaces before opening braces
      .replace(/\}\s+/g, '}') // Remove spaces after closing braces
      .trim();
  }
}
