/**
 * Flow visualization component with optimized rendering performance.
 * Generates interactive flow diagrams using vis-network.
 */
import fs from 'fs';
import path from 'path';
import { Flow } from '../Flow.js';
import { COLORS, EDGE_STYLES, LAYOUT_CONFIG, NODE_STYLES } from './config.js';
import {
  addEdgesToNetwork,
  addNodesToNetwork,
  calculateNodeLevels,
  computePositions
} from './utils.js';

// Lazy-load vis-network for performance optimization
let visNetworkModule: any = null;

async function loadVisNetwork() {
  if (visNetworkModule) return visNetworkModule;
  
  try {
    // Using dynamic import for tree-shaking benefits
    visNetworkModule = await import('vis-network');
    return visNetworkModule;
  } catch (error) {
    console.error('Failed to load vis-network module:', error);
    throw new Error('vis-network is required for flow visualization. Install it with: npm install vis-network');
  }
}

/**
 * Flow visualization component with optimized rendering performance.
 */
export class FlowVisualizer {
  private flow: Flow;
  private templatePath: string;
  private outputDir: string;
  private nodePositions: Map<string, any> = new Map();
  
  /**
   * Creates a new flow visualizer instance
   * 
   * @param flow The flow to visualize
   * @param options Optional configuration
   */
  constructor(flow: Flow, options: { outputDir?: string } = {}) {
    this.flow = flow;
    this.templatePath = path.join(process.cwd(), 'src', 'flow', 'visualization', 'template.html');
    this.outputDir = options.outputDir || process.cwd();
    
    // Compute node positions early for better performance
    this.precomputePositions();
  }
  
  /**
   * Precomputes node positions for the flow
   * This improves rendering performance by doing the layout calculation upfront
   */
  private precomputePositions(): void {
    try {
      const levels = calculateNodeLevels(this.flow);
      this.nodePositions = computePositions(this.flow, levels);
    } catch (error) {
      console.error('Failed to precompute node positions:', error);
    }
  }
  
  /**
   * Generates the flow visualization and saves it to a file
   * 
   * @param filename Output filename (without extension)
   * @returns Path to the generated HTML file
   */
  async generateVisualization(filename: string = 'flow_visualization'): Promise<string> {
    let network: any;
    
    try {
      const vis = await loadVisNetwork();
      
      // Generate visualization HTML content
      const html = await this.generateHtml(vis);
      
      // Ensure output directory exists
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }
      
      // Save the HTML file
      const outputFilePath = path.join(this.outputDir, `${filename}.html`);
      fs.writeFileSync(outputFilePath, html, 'utf8');
      
      console.log(`Flow visualization saved to: ${outputFilePath}`);
      return outputFilePath;
    } catch (error) {
      console.error('Failed to generate flow visualization:', error);
      throw error;
    }
  }
  
  /**
   * Generates the complete HTML content for the visualization
   * 
   * @param vis The vis-network module
   * @returns Complete HTML content as string
   */
  private async generateHtml(vis: any): Promise<string> {
    try {
      // Create a virtual DOM container for vis-network
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM(`<!DOCTYPE html><div id="network"></div>`);
      const container = dom.window.document.getElementById('network');
      
      // Create a new network instance
      const network = new vis.Network(container, {}, {
        ...LAYOUT_CONFIG,
        physics: { enabled: false } // Disable physics for deterministic layout
      });
      
      // Add nodes and edges to the network
      addNodesToNetwork(network, this.flow, this.nodePositions, NODE_STYLES);
      addEdgesToNetwork(network, this.flow, this.nodePositions, COLORS);
      
      // Extract the network HTML
      const networkHtml = container?.outerHTML || '<div id="network"></div>';
      
      // Generate the complete HTML with template
      return this.generateFinalHtml(networkHtml);
    } catch (error) {
      console.error('Error generating HTML content:', error);
      throw error;
    }
  }
  
  /**
   * Generates the final HTML by combining the network visualization with the template
   * 
   * @param networkHtml The network visualization HTML content
   * @returns Complete HTML document string
   */
  private generateFinalHtml(networkHtml: string): string {
    // Check if template exists, if not generate a default template
    let templateContent: string;
    if (fs.existsSync(this.templatePath)) {
      templateContent = fs.readFileSync(this.templatePath, 'utf8');
    } else {
      templateContent = this.getDefaultTemplate();
    }
    
    // Replace the placeholder with the network content
    return templateContent.replace('{{NETWORK_CONTENT}}', networkHtml);
  }
  
  /**
   * Returns a default HTML template if the template file is not found
   * This ensures the visualization works even without external dependencies
   */
  private getDefaultTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flow Visualization</title>
  <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    }
    
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background-color: ${COLORS.bg};
    }
    
    .header {
      padding: 16px;
      background-color: #263238;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 400;
    }
    
    .main {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    
    #network {
      flex: 1;
      height: 100%;
    }
    
    .legend {
      width: 260px;
      padding: 16px;
      background-color: white;
      border-left: 1px solid #e0e0e0;
      overflow-y: auto;
    }
    
    .legend h2 {
      margin-top: 0;
      margin-bottom: 16px;
      font-size: 18px;
      font-weight: 500;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .legend-color {
      width: 20px;
      height: 20px;
      margin-right: 8px;
      border-radius: 4px;
    }
    
    .legend-label {
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Flow Visualization</h1>
    </div>
    <div class="main">
      <div id="network">{{NETWORK_CONTENT}}</div>
      <div class="legend">
        <h2>Legend</h2>
        
        <h3>Node Types</h3>
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${COLORS.start}"></div>
          <div class="legend-label">Start Method</div>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${COLORS.listener}"></div>
          <div class="legend-label">Listener Method</div>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${COLORS.router}"></div>
          <div class="legend-label">Router Method</div>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${COLORS.mixed}"></div>
          <div class="legend-label">Mixed Type Method</div>
        </div>
        
        <h3>Edge Types</h3>
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${COLORS.edge.default}"></div>
          <div class="legend-label">Simple Connection</div>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${COLORS.edge.and}"></div>
          <div class="legend-label">AND Condition</div>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${COLORS.edge.or}"></div>
          <div class="legend-label">OR Condition</div>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: ${COLORS.edge.function}"></div>
          <div class="legend-label">Function Condition</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    // Initialize vis-network
    document.addEventListener('DOMContentLoaded', function() {
      // The network content is already embedded in the page
      // This is just for additional initialization if needed
    });
  </script>
</body>
</html>`;
  }
}

/**
 * Convenience function to create and save a flow visualization
 * 
 * @param flow Flow instance to visualize
 * @param filename Output filename without extension
 * @param outputDir Directory to save the visualization
 * @returns Path to the generated HTML file
 */
export async function plotFlow(
  flow: Flow,
  filename: string = 'flow_visualization',
  outputDir?: string
): Promise<string> {
  const visualizer = new FlowVisualizer(flow, { outputDir });
  return visualizer.generateVisualization(filename);
}
