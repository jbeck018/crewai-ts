/**
 * Utilities for flow visualization with optimized performance.
 */
import { Flow } from '../Flow.js';
import { Condition } from '../types.js';
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
/**
 * Calculates the hierarchical level for each node in the flow.
 * Uses memoization for performance optimization.
 *
 * @param flow The flow to analyze
 * @returns Map of method names to their computed levels
 */
export declare function calculateNodeLevels(flow: Flow): Map<string, number>;
/**
 * Computes optimal positions for each node in the flow visualization.
 * Uses memoization and efficient positioning algorithms.
 *
 * @param flow The flow to compute positions for
 * @param levels Precomputed node levels
 * @returns Map of node positions by method name
 */
export declare function computePositions(flow: Flow, levels: Map<string, number>): Map<string, NodePosition>;
/**
 * Extracts all nodes from a flow with their styling information.
 *
 * @param flow The flow to extract nodes from
 * @returns Array of node data objects
 */
export declare function extractNodes(flow: Flow): NodeData[];
/**
 * Extracts all edges from a flow with their styling information.
 *
 * @param flow The flow to extract edges from
 * @returns Array of edge data objects
 */
export declare function extractEdges(flow: Flow): EdgeData[];
/**
 * Adds nodes to a network visualization.
 * Uses optimized batching for performance.
 *
 * @param network The network visualization object
 * @param flow The flow being visualized
 * @param positions Computed node positions
 * @param nodeStyles Style configurations for nodes
 */
export declare function addNodesToNetwork(network: any, // Network type from visualization library
flow: Flow, positions: Map<string, NodePosition>, nodeStyles: any): void;
/**
 * Adds edges to a network visualization.
 * Uses optimized batching for performance.
 *
 * @param network The network visualization object
 * @param flow The flow being visualized
 * @param positions Computed node positions for validation
 * @param colors Color configuration
 */
export declare function addEdgesToNetwork(network: any, // Network type from visualization library
flow: Flow, positions: Map<string, NodePosition>, colors: any): void;
//# sourceMappingURL=utils.d.ts.map