/**
 * Configuration for flow visualization.
 * Optimized color scheme and styling for improved UX.
 */
// Color scheme optimized for visibility and accessibility
export const COLORS = {
    // Background color (light neutral for readability)
    bg: '#f5f8fa',
    // Node colors by type
    start: '#4CAF50', // Green for start methods
    listener: '#2196F3', // Blue for listeners
    router: '#FF9800', // Orange for routers
    mixed: '#9C27B0', // Purple for mixed types (e.g., both listener and router)
    // Edge colors by type
    edge: {
        default: '#90A4AE', // Default edge color (neutral gray)
        and: '#01579B', // Dark blue for AND conditions
        or: '#827717', // Olive for OR conditions
        function: '#4A148C' // Dark purple for function conditions
    },
    // Text colors
    text: {
        light: '#FFFFFF', // For dark backgrounds
        dark: '#212121', // For light backgrounds
        muted: '#757575' // For secondary information
    }
};
// Node style configuration for different node types
export const NODE_STYLES = {
    // Start methods
    start: {
        color: COLORS.start,
        borderWidth: 2,
        borderColor: '#388E3C',
        shape: 'box',
        font: { color: COLORS.text.light, size: 14 },
        shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 3 }
    },
    // Listener methods
    listener: {
        color: COLORS.listener,
        borderWidth: 1,
        borderColor: '#1565C0',
        shape: 'ellipse',
        font: { color: COLORS.text.light, size: 14 },
        shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 3 }
    },
    // Router methods
    router: {
        color: COLORS.router,
        borderWidth: 1,
        borderColor: '#E65100',
        shape: 'diamond',
        font: { color: COLORS.text.light, size: 14 },
        shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 3 }
    },
    // Mixed type methods (e.g., both listener and router)
    mixed: {
        color: COLORS.mixed,
        borderWidth: 2,
        borderColor: '#6A1B9A',
        shape: 'hexagon',
        font: { color: COLORS.text.light, size: 14 },
        shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 3 }
    }
};
// Edge style configuration
export const EDGE_STYLES = {
    // Default edge style
    default: {
        color: COLORS.edge.default,
        width: 1,
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        smooth: { type: 'curvedCW', roundness: 0.2 }
    },
    // AND condition edge style
    and: {
        color: COLORS.edge.and,
        width: 2,
        dashes: [5, 5],
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        smooth: { type: 'curvedCW', roundness: 0.2 }
    },
    // OR condition edge style
    or: {
        color: COLORS.edge.or,
        width: 2,
        dashes: [2, 2],
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        smooth: { type: 'curvedCW', roundness: 0.2 }
    },
    // Function condition edge style
    function: {
        color: COLORS.edge.function,
        width: 1.5,
        dashes: [6, 2, 2, 2],
        arrows: { to: { enabled: true, scaleFactor: 0.5 } },
        smooth: { type: 'curvedCW', roundness: 0.2 }
    }
};
// Layout configuration for optimal node positioning
export const LAYOUT_CONFIG = {
    hierarchical: {
        enabled: true,
        levelSeparation: 150,
        nodeSpacing: 120,
        direction: 'UD', // Top to bottom
        sortMethod: 'directed'
    }
};
//# sourceMappingURL=config.js.map