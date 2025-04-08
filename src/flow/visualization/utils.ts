/**
 * Utilities for flow visualization with optimized performance.
 */
import { Flow } from '../Flow.js';
import { Condition, ComplexCondition } from '../types.js';
import { COLORS, EDGE_STYLES, NODE_STYLES } from './config.js';

// Types for visualization
export interface NodePosition {
  id: string;
  x: number;
  y: number;
  level: number;
}

export interface NodeData {
  id: string;
  label: string;
  level: number;
  type: 'start' | 'listener' | 'router' | 'mixed';
}

export interface EdgeData {
  from: string;
  to: string;
  condition: Condition;
  label?: string;
}

// Cache for computed node levels with WeakMap for memory efficiency
const nodeLevelCache = new WeakMap<Flow, Map<string, number>>();

/**
 * Calculates the hierarchical level for each node in the flow.
 * Uses memoization for performance optimization.
 * 
 * @param flow The flow to analyze
 * @returns Map of method names to their computed levels
 */
export function calculateNodeLevels(flow: Flow): Map<string, number> {
  // Check cache first
  if (nodeLevelCache.has(flow)) {
    return nodeLevelCache.get(flow)!;
  }
  
  // Initialize levels
  const levels = new Map<string, number>();
  const startMethods = flow['_startMethods'] as Set<string>;
  const listeners = flow['_listeners'] as Map<string, Map<string, Condition>>;
  const methods = flow['_methods'] as Map<string, Function>;
  
  // Helper to determine dependencies between methods
  const getDependencies = (methodName: string): string[] => {
    const dependencies: string[] = [];
    
    // Check each method to see if it listens to the current method
    for (const [trigger, listenerMap] of listeners.entries()) {
      for (const [listener, condition] of listenerMap.entries()) {
        // Simple string condition
        if (typeof condition === 'string' && condition === methodName) {
          dependencies.push(listener);
        }
        // Complex condition (AND/OR)
        else if (typeof condition === 'object' && 'methods' in condition) {
          const complexCondition = condition as ComplexCondition;
          if (complexCondition.methods.includes(methodName)) {
            dependencies.push(listener);
          }
        }
      }
    }
    
    return dependencies;
  };
  
  // Start with level 0 for start methods
  for (const methodName of startMethods) {
    levels.set(methodName, 0);
  }
  
  // Spread levels through dependencies (breadth-first approach)
  let changed = true;
  let maxIterations = methods.size * 2; // Safety limit
  
  while (changed && maxIterations > 0) {
    changed = false;
    maxIterations--;
    
    // Process current levels
    for (const [methodName, level] of levels.entries()) {
      const dependencies = getDependencies(methodName);
      
      for (const dep of dependencies) {
        const currentLevel = levels.get(dep) ?? -1;
        const newLevel = level + 1;
        
        if (currentLevel < newLevel) {
          levels.set(dep, newLevel);
          changed = true;
        }
      }
    }
  }
  
  // Set default level 0 for any remaining methods
  for (const methodName of methods.keys()) {
    if (!levels.has(methodName)) {
      levels.set(methodName, 0);
    }
  }
  
  // Cache the result
  nodeLevelCache.set(flow, levels);
  
  return levels;
}

// Cache for computed node positions
const nodePositionCache = new WeakMap<Flow, Map<string, NodePosition>>();

/**
 * Computes optimal positions for each node in the flow visualization.
 * Uses memoization and efficient positioning algorithms.
 * 
 * @param flow The flow to compute positions for
 * @param levels Precomputed node levels
 * @returns Map of node positions by method name
 */
export function computePositions(
  flow: Flow, 
  levels: Map<string, number>
): Map<string, NodePosition> {
  // Check cache first
  const cacheKey = flow;
  if (nodePositionCache.has(cacheKey)) {
    return nodePositionCache.get(cacheKey)!;
  }
  
  // Count nodes per level for positioning
  const nodesByLevel = new Map<number, string[]>();
  for (const [methodName, level] of levels.entries()) {
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(methodName);
  }
  
  // Initialize positions map
  const positions = new Map<string, NodePosition>();
  
  // Compute positions level by level
  const maxLevel = Math.max(...levels.values());
  const levelHeight = 150; // Vertical spacing between levels
  
  for (let level = 0; level <= maxLevel; level++) {
    const nodesInLevel = nodesByLevel.get(level) || [];
    const nodeWidth = 250; // Horizontal spacing between nodes
    
    // Center nodes in each level
    const totalWidth = nodeWidth * nodesInLevel.length;
    const startX = -totalWidth / 2 + nodeWidth / 2;
    
    // Position nodes within level
    nodesInLevel.forEach((methodName, index) => {
      positions.set(methodName, {
        id: methodName,
        x: startX + index * nodeWidth,
        y: level * levelHeight,
        level
      });
    });
  }
  
  // Cache the computed positions
  nodePositionCache.set(cacheKey, positions);
  
  return positions;
}

/**
 * Extracts all nodes from a flow with their styling information.
 * 
 * @param flow The flow to extract nodes from
 * @returns Array of node data objects
 */
export function extractNodes(flow: Flow): NodeData[] {
  const startMethods = flow['_startMethods'] as Set<string>;
  const listeners = flow['_listeners'] as Map<string, Map<string, Condition>>;
  const routers = flow['_routers'] as Map<string, Condition>;
  const methods = flow['_methods'] as Map<string, Function>;
  
  // Get unique listener method names (values in the listener maps)
  const listenerMethods = new Set<string>();
  for (const listenerMap of listeners.values()) {
    for (const listenerName of listenerMap.keys()) {
      listenerMethods.add(listenerName);
    }
  }
  
  // Create nodes for all methods
  return Array.from(methods.keys()).map(methodName => {
    // Determine node type
    let type: NodeData['type'] = 'listener';
    
    const isStart = startMethods.has(methodName);
    const isListener = listenerMethods.has(methodName);
    const isRouter = routers.has(methodName);
    
    if (isStart) {
      type = 'start';
    } else if (isRouter && isListener) {
      type = 'mixed';
    } else if (isRouter) {
      type = 'router';
    }
    
    return {
      id: methodName,
      label: methodName,
      level: 0, // Will be set later
      type
    };
  });
}

/**
 * Extracts all edges from a flow with their styling information.
 * 
 * @param flow The flow to extract edges from
 * @returns Array of edge data objects
 */
export function extractEdges(flow: Flow): EdgeData[] {
  const listeners = flow['_listeners'] as Map<string, Map<string, Condition>>;
  const edges: EdgeData[] = [];
  
  // Process all listeners to create edges
  for (const [triggerMethod, listenerMap] of listeners.entries()) {
    for (const [listenerMethod, condition] of listenerMap.entries()) {
      // Create edge from trigger to listener
      edges.push({
        from: triggerMethod,
        to: listenerMethod,
        condition,
        label: getEdgeLabel(condition)
      });
    }
  }
  
  return edges;
}

/**
 * Generates a label for an edge based on its condition.
 * 
 * @param condition The edge condition
 * @returns Label string or undefined
 */
function getEdgeLabel(condition: Condition): string | undefined {
  if (typeof condition === 'string') {
    return undefined; // Simple conditions don't need labels
  }
  
  if (typeof condition === 'object' && 'type' in condition) {
    const { type, methods } = condition as ComplexCondition;
    return type === 'AND' ? 'AND' : 'OR';
  }
  
  if (typeof condition === 'function') {
    return 'fn()';
  }
  
  return undefined;
}

/**
 * Adds nodes to a network visualization.
 * Uses optimized batching for performance.
 * 
 * @param network The network visualization object
 * @param flow The flow being visualized
 * @param positions Computed node positions
 * @param nodeStyles Style configurations for nodes
 */
export function addNodesToNetwork(
  network: any, // Network type from visualization library
  flow: Flow,
  positions: Map<string, NodePosition>,
  nodeStyles: any
): void {
  const nodes = extractNodes(flow);
  
  // Prepare batch of nodes for efficient addition
  const nodesBatch = nodes.map(node => {
    const position = positions.get(node.id);
    if (!position) return null;
    
    // Get style based on node type
    const style = nodeStyles[node.type];
    
    return {
      id: node.id,
      label: node.label,
      x: position.x,
      y: position.y,
      level: position.level,
      ...style, // Spread all style properties
    };
  }).filter(Boolean); // Remove any nulls
  
  // Add all nodes at once for better performance
  network.add({ nodes: nodesBatch });
}

/**
 * Adds edges to a network visualization.
 * Uses optimized batching for performance.
 * 
 * @param network The network visualization object
 * @param flow The flow being visualized
 * @param positions Computed node positions for validation
 * @param colors Color configuration
 */
export function addEdgesToNetwork(
  network: any, // Network type from visualization library
  flow: Flow,
  positions: Map<string, NodePosition>,
  colors: any
): void {
  const edges = extractEdges(flow);
  
  // Prepare batch of edges for efficient addition
  const edgesBatch = edges.map(edge => {
    // Skip edges for missing nodes
    if (!positions.has(edge.from) || !positions.has(edge.to)) {
      return null;
    }
    
    // Determine edge style based on condition
    let style = EDGE_STYLES.default;
    
    if (typeof edge.condition === 'object' && 'type' in edge.condition) {
      const { type } = edge.condition as ComplexCondition;
      style = type === 'AND' ? EDGE_STYLES.and : EDGE_STYLES.or;
    } else if (typeof edge.condition === 'function') {
      style = EDGE_STYLES.function;
    }
    
    return {
      from: edge.from,
      to: edge.to,
      label: edge.label,
      ...style, // Spread all style properties
    };
  }).filter(Boolean); // Remove any nulls
  
  // Add all edges at once for better performance
  network.add({ edges: edgesBatch });
}
