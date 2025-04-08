/**
 * Type declarations for jsdom module.
 * Provides type safety for the DOM manipulation done in FlowVisualizer.
 */

declare module 'jsdom' {
  export class JSDOM {
    constructor(html: string, options?: any);
    window: Window;
    
    /**
     * Indicates if the window object is eligible for garbage collection.
     * @returns True if the window can be garbage collected
     */
    readonly windowNoLongerGettable: boolean;
    
    /**
     * Cleans up the JSDOM instance resources.
     */
    readonly close: () => void;
  }
}
