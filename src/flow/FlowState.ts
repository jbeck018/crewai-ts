/**
 * Base class for all flow states, ensuring each state has a unique ID.
 */
import { v4 as uuidv4 } from 'uuid';

export interface FlowStateOptions {
  id?: string;
}

export class FlowState {
  /**
   * Unique identifier for the flow state
   */
  id: string;

  /**
   * Creates a new FlowState with a unique ID
   */
  constructor(options: FlowStateOptions = {}) {
    this.id = options.id || uuidv4();
  }
}
