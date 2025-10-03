import type { IWindowNostrDB } from "../interface";

/**
 * Common interface for all backend implementations
 * Extends IWindowNostrEvents to maintain consistency with the main interface
 */
export interface IBackend extends IWindowNostrDB {
  /** Connect to the backend */
  connect(): Promise<void>;

  /** Close the backend connection */
  close(): Promise<void>;

  /** Check if the backend is connected */
  isConnected(): boolean;
}

/**
 * Backend configuration for priority-based connection
 */
export interface BackendConfig {
  /** Unique identifier for the backend */
  id: string;

  /** Human-readable name for the backend */
  name: string;

  /** Priority order (lower number = higher priority) */
  priority: number;

  /** Backend instance */
  backend: IBackend;
}
