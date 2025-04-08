/**
 * Base class for all flow states, ensuring each state has a unique ID.
 */
import { v4 as uuidv4 } from 'uuid';
export class FlowState {
    /**
     * Unique identifier for the flow state
     */
    id;
    /**
     * Creates a new FlowState with a unique ID
     */
    constructor(options = {}) {
        this.id = options.id || uuidv4();
    }
}
//# sourceMappingURL=FlowState.js.map