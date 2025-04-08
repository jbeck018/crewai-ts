/**
 * Configuration for flow visualization.
 * Optimized color scheme and styling for improved UX.
 */
export declare const COLORS: {
    bg: string;
    start: string;
    listener: string;
    router: string;
    mixed: string;
    edge: {
        default: string;
        and: string;
        or: string;
        function: string;
    };
    text: {
        light: string;
        dark: string;
        muted: string;
    };
};
export declare const NODE_STYLES: {
    start: {
        color: string;
        borderWidth: number;
        borderColor: string;
        shape: string;
        font: {
            color: string;
            size: number;
        };
        shadow: {
            enabled: boolean;
            color: string;
            size: number;
        };
    };
    listener: {
        color: string;
        borderWidth: number;
        borderColor: string;
        shape: string;
        font: {
            color: string;
            size: number;
        };
        shadow: {
            enabled: boolean;
            color: string;
            size: number;
        };
    };
    router: {
        color: string;
        borderWidth: number;
        borderColor: string;
        shape: string;
        font: {
            color: string;
            size: number;
        };
        shadow: {
            enabled: boolean;
            color: string;
            size: number;
        };
    };
    mixed: {
        color: string;
        borderWidth: number;
        borderColor: string;
        shape: string;
        font: {
            color: string;
            size: number;
        };
        shadow: {
            enabled: boolean;
            color: string;
            size: number;
        };
    };
};
export declare const EDGE_STYLES: {
    default: {
        color: string;
        width: number;
        arrows: {
            to: {
                enabled: boolean;
                scaleFactor: number;
            };
        };
        smooth: {
            type: string;
            roundness: number;
        };
    };
    and: {
        color: string;
        width: number;
        dashes: number[];
        arrows: {
            to: {
                enabled: boolean;
                scaleFactor: number;
            };
        };
        smooth: {
            type: string;
            roundness: number;
        };
    };
    or: {
        color: string;
        width: number;
        dashes: number[];
        arrows: {
            to: {
                enabled: boolean;
                scaleFactor: number;
            };
        };
        smooth: {
            type: string;
            roundness: number;
        };
    };
    function: {
        color: string;
        width: number;
        dashes: number[];
        arrows: {
            to: {
                enabled: boolean;
                scaleFactor: number;
            };
        };
        smooth: {
            type: string;
            roundness: number;
        };
    };
};
export declare const LAYOUT_CONFIG: {
    hierarchical: {
        enabled: boolean;
        levelSeparation: number;
        nodeSpacing: number;
        direction: string;
        sortMethod: string;
    };
};
//# sourceMappingURL=config.d.ts.map