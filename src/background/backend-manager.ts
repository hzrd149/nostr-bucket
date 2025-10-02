import type { Filter, NostrEvent } from "nostr-tools";
import { debug } from "../common/debug";
import type { IBackend, BackendConfig } from "./backend-interface";
import type { Subscription, StreamHandlers, Features } from "../interface";

/**
 * Manages multiple backends with priority-based connection fallback
 */
export class BackendManager {
  private backends: BackendConfig[] = [];
  private currentBackend: IBackend | null = null;
  private connectionAttempts: Map<string, number> = new Map();
  private maxRetryAttempts = 3;
  private fallbackInProgress = false;
  private healthCheckInterval: number | null = null;
  private healthCheckIntervalMs = 30000; // 30 seconds

  /**
   * Add a backend to the manager
   */
  addBackend(config: BackendConfig): void {
    this.backends.push(config);
    // Sort by priority (lower number = higher priority)
    this.backends.sort((a, b) => a.priority - b.priority);
    debug(
      "[BACKEND_MANAGER] Added backend:",
      config.name,
      "Priority:",
      config.priority,
    );
  }

  /**
   * Remove a backend from the manager
   */
  removeBackend(backendId: string): void {
    const index = this.backends.findIndex((b) => b.id === backendId);
    if (index !== -1) {
      const backend = this.backends[index];
      if (this.currentBackend === backend.backend) {
        this.currentBackend = null;
      }
      this.backends.splice(index, 1);
      debug("[BACKEND_MANAGER] Removed backend:", backend.name);
    }
  }

  /**
   * Attempt to connect to backends in priority order
   */
  async connect(): Promise<boolean> {
    debug("[BACKEND_MANAGER] Attempting to connect to backends...");

    // Close current connection if any
    if (this.currentBackend) {
      try {
        await this.currentBackend.close();
      } catch (error) {
        debug("[BACKEND_MANAGER] Error closing current backend:", error);
      }
      this.currentBackend = null;
    }

    // Try each backend in priority order
    for (const config of this.backends) {
      const attempts = this.connectionAttempts.get(config.id) || 0;
      if (attempts >= this.maxRetryAttempts) {
        debug("[BACKEND_MANAGER] Max retry attempts reached for:", config.name);
        continue;
      }

      debug("[BACKEND_MANAGER] Attempting to connect to:", config.name);

      try {
        await config.backend.connect();

        if (config.backend.isConnected()) {
          this.currentBackend = config.backend;
          this.connectionAttempts.set(config.id, 0); // Reset retry count on success
          debug("[BACKEND_MANAGER] Successfully connected to:", config.name);
          return true;
        } else {
          throw new Error("Backend reported not connected after connect()");
        }
      } catch (error) {
        debug(
          "[BACKEND_MANAGER] Failed to connect to:",
          config.name,
          "Error:",
          error,
        );
        this.connectionAttempts.set(config.id, attempts + 1);

        // Try to close the failed connection
        try {
          await config.backend.close();
        } catch (closeError) {
          debug("[BACKEND_MANAGER] Error closing failed backend:", closeError);
        }
      }
    }

    debug("[BACKEND_MANAGER] Failed to connect to any backend");
    return false;
  }

  /**
   * Close the current backend connection
   */
  async close(): Promise<void> {
    if (this.currentBackend) {
      try {
        await this.currentBackend.close();
        debug("[BACKEND_MANAGER] Closed current backend connection");
      } catch (error) {
        debug("[BACKEND_MANAGER] Error closing backend:", error);
      }
      this.currentBackend = null;
    }
  }

  /**
   * Check if any backend is connected
   */
  isConnected(): boolean {
    return this.currentBackend !== null && this.currentBackend.isConnected();
  }

  /**
   * Get the current backend
   */
  getCurrentBackend(): IBackend | null {
    return this.currentBackend;
  }

  /**
   * Get connection status for all backends
   */
  getConnectionStatus(): Array<{
    id: string;
    name: string;
    connected: boolean;
    attempts: number;
  }> {
    return this.backends.map((config) => ({
      id: config.id,
      name: config.name,
      connected: config.backend.isConnected(),
      attempts: this.connectionAttempts.get(config.id) || 0,
    }));
  }

  /**
   * Get list of all available backends
   */
  getBackends(): Array<{
    id: string;
    name: string;
    priority: number;
    connected: boolean;
    attempts: number;
  }> {
    return this.backends.map((config) => ({
      id: config.id,
      name: config.name,
      priority: config.priority,
      connected: config.backend.isConnected(),
      attempts: this.connectionAttempts.get(config.id) || 0,
    }));
  }

  /**
   * Reset retry attempts for all backends
   */
  resetRetryAttempts(): void {
    this.connectionAttempts.clear();
    debug("[BACKEND_MANAGER] Reset retry attempts for all backends");
  }

  /**
   * Force reconnect by trying all backends again
   */
  async reconnect(): Promise<boolean> {
    debug("[BACKEND_MANAGER] Force reconnecting...");
    this.resetRetryAttempts();
    return await this.connect();
  }

  /**
   * Attempt automatic fallback to next available backend when current one fails
   */
  async attemptFallback(): Promise<boolean> {
    if (this.fallbackInProgress) {
      debug("[BACKEND_MANAGER] Fallback already in progress, skipping");
      return false;
    }

    this.fallbackInProgress = true;
    debug("[BACKEND_MANAGER] Attempting automatic fallback...");

    try {
      // Close current backend if it exists
      if (this.currentBackend) {
        try {
          await this.currentBackend.close();
        } catch (error) {
          debug(
            "[BACKEND_MANAGER] Error closing current backend during fallback:",
            error,
          );
        }
        this.currentBackend = null;
      }

      // Try to connect to any available backend
      const connected = await this.connect();

      if (connected) {
        debug(
          "[BACKEND_MANAGER] Fallback successful, connected to:",
          this.currentBackend ? "backend" : "none",
        );
      } else {
        debug("[BACKEND_MANAGER] Fallback failed, no backends available");
      }

      return connected;
    } finally {
      this.fallbackInProgress = false;
    }
  }

  /**
   * Check if current backend is still healthy and attempt fallback if not
   */
  async ensureConnection(): Promise<boolean> {
    if (!this.currentBackend || !this.currentBackend.isConnected()) {
      debug(
        "[BACKEND_MANAGER] Current backend not connected, attempting fallback",
      );
      return await this.attemptFallback();
    }
    return true;
  }

  /**
   * Start periodic health check monitoring
   */
  startHealthCheck(): void {
    if (this.healthCheckInterval) {
      debug("[BACKEND_MANAGER] Health check already running");
      return;
    }

    debug("[BACKEND_MANAGER] Starting health check monitoring");
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.healthCheckIntervalMs);
  }

  /**
   * Stop periodic health check monitoring
   */
  stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      debug("[BACKEND_MANAGER] Stopping health check monitoring");
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform a health check on the current backend
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.currentBackend) {
      debug("[BACKEND_MANAGER] No current backend, attempting to connect");
      await this.attemptFallback();
      return;
    }

    if (!this.currentBackend.isConnected()) {
      debug(
        "[BACKEND_MANAGER] Health check failed - backend not connected, attempting fallback",
      );
      await this.attemptFallback();
    } else {
      debug("[BACKEND_MANAGER] Health check passed - backend is connected");
    }
  }

  // Delegate methods to current backend with automatic fallback
  async event(id: string): Promise<NostrEvent | undefined> {
    await this.ensureConnection();
    if (!this.currentBackend) throw new Error("No backend connected");

    try {
      return await this.currentBackend.event(id);
    } catch (error) {
      debug(
        "[BACKEND_MANAGER] Backend error in event(), attempting fallback:",
        error,
      );
      const fallbackSuccess = await this.attemptFallback();
      if (!fallbackSuccess || !this.currentBackend) {
        throw new Error("No backend available after fallback");
      }
      return await this.currentBackend.event(id);
    }
  }

  async add(event: NostrEvent): Promise<boolean> {
    await this.ensureConnection();
    if (!this.currentBackend) throw new Error("No backend connected");

    try {
      return await this.currentBackend.add(event);
    } catch (error) {
      debug(
        "[BACKEND_MANAGER] Backend error in add(), attempting fallback:",
        error,
      );
      const fallbackSuccess = await this.attemptFallback();
      if (!fallbackSuccess || !this.currentBackend) {
        throw new Error("No backend available after fallback");
      }
      return await this.currentBackend.add(event);
    }
  }

  async replaceable(
    kind: number,
    author: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined> {
    await this.ensureConnection();
    if (!this.currentBackend) throw new Error("No backend connected");

    try {
      return await this.currentBackend.replaceable(kind, author, identifier);
    } catch (error) {
      debug(
        "[BACKEND_MANAGER] Backend error in replaceable(), attempting fallback:",
        error,
      );
      const fallbackSuccess = await this.attemptFallback();
      if (!fallbackSuccess || !this.currentBackend) {
        throw new Error("No backend available after fallback");
      }
      return await this.currentBackend.replaceable(kind, author, identifier);
    }
  }

  async count(filters: Filter[]): Promise<number> {
    await this.ensureConnection();
    if (!this.currentBackend) throw new Error("No backend connected");

    try {
      return await this.currentBackend.count(filters);
    } catch (error) {
      debug(
        "[BACKEND_MANAGER] Backend error in count(), attempting fallback:",
        error,
      );
      const fallbackSuccess = await this.attemptFallback();
      if (!fallbackSuccess || !this.currentBackend) {
        throw new Error("No backend available after fallback");
      }
      return await this.currentBackend.count(filters);
    }
  }

  filters(filters: Filter[], handlers?: StreamHandlers): Subscription {
    // For streaming methods, we can't easily retry, so just ensure connection
    if (!this.currentBackend || !this.currentBackend.isConnected()) {
      throw new Error("No backend connected");
    }
    return this.currentBackend.filters(filters, handlers);
  }

  subscribe(filters: Filter[], handlers?: StreamHandlers): Subscription {
    // For streaming methods, we can't easily retry, so just ensure connection
    if (!this.currentBackend || !this.currentBackend.isConnected()) {
      throw new Error("No backend connected");
    }
    return this.currentBackend.subscribe(filters, handlers);
  }

  async supports(): Promise<Features[]> {
    await this.ensureConnection();
    if (!this.currentBackend) throw new Error("No backend connected");

    try {
      return await this.currentBackend.supports();
    } catch (error) {
      debug(
        "[BACKEND_MANAGER] Backend error in supports(), attempting fallback:",
        error,
      );
      const fallbackSuccess = await this.attemptFallback();
      if (!fallbackSuccess || !this.currentBackend) {
        throw new Error("No backend available after fallback");
      }
      return await this.currentBackend.supports();
    }
  }
}
