import type { Filter, NostrEvent } from "nostr-tools";
import { NostrIdbBackend } from "./backends/nostr-idb";
import { LocalRelayBackend } from "./backends/local-relay";
import { BackendManager } from "./backend-manager";
import { debug } from "../common/debug";
import type { Subscription, StreamHandlers, Features } from "../interface";

// Backend type definition
export type BackendType = "idb" | "relay";

// Backend manager instance
const backendManager = new BackendManager();

// Initialize backends with priority order
const nostrIdbBackend = new NostrIdbBackend();
const localRelayBackend = new LocalRelayBackend("ws://localhost:4869");

// Add backends to manager with priority (lower number = higher priority)
backendManager.addBackend({
  id: "relay",
  name: "Local Relay",
  priority: 1,
  backend: localRelayBackend,
});
backendManager.addBackend({
  id: "idb",
  name: "IndexedDB",
  priority: 2,
  backend: nostrIdbBackend,
});

/**
 * Set the backend type and manage connections with fallback
 */
export async function setBackend(backendType: BackendType): Promise<void> {
  debug("[METHODS] Setting backend to:", backendType);

  // Stop current health check
  backendManager.stopHealthCheck();

  // Try to connect to the requested backend first, then fallback to others
  const connected = await backendManager.connect();
  if (!connected) {
    debug("[METHODS] Failed to connect to any backend");
    throw new Error(`Failed to connect to any backend`);
  }

  debug("[METHODS] Successfully connected to backend");

  // Restart health check monitoring
  backendManager.startHealthCheck();
}

/**
 * Get the current backend instance
 */
function getCurrentBackend() {
  const backend = backendManager.getCurrentBackend();
  if (!backend) {
    throw new Error("No backend is currently connected");
  }
  return backend;
}

/**
 * Get a single event by its ID
 */
export async function getEvent(id: string): Promise<NostrEvent | undefined> {
  const backend = getCurrentBackend();
  return await backend.event(id);
}

/**
 * Add a single event to the database
 */
export async function addEvent(event: NostrEvent): Promise<boolean> {
  const backend = getCurrentBackend();
  return await backend.add(event);
}

/**
 * Get the latest replaceable event for a given kind, author, and optional identifier
 */
export async function getReplaceableEvent(
  kind: number,
  author: string,
  identifier?: string,
): Promise<NostrEvent | undefined> {
  const backend = getCurrentBackend();
  return await backend.replaceable(kind, author, identifier);
}

/**
 * Count events matching the given filters
 */
export async function countEvents(filters: Filter[]): Promise<number> {
  const backend = getCurrentBackend();
  return await backend.count(filters);
}

/**
 * Get events matching the given filters
 */
export function getEventsByFilters(
  filters: Filter[],
  handlers: StreamHandlers,
): Subscription {
  const backend = getCurrentBackend();
  return backend.filters(filters, handlers);
}

/**
 * Subscribe to events based on filters
 */
export function subscribeToEvents(
  filters: Filter[],
  handlers: StreamHandlers,
): Subscription {
  const backend = getCurrentBackend();
  return backend.subscribe(filters, handlers);
}

/**
 * Get all supported features from the current backend
 */
export async function getSupportedFeatures(): Promise<Features[]> {
  const backend = getCurrentBackend();
  return await backend.supports();
}

/**
 * Initialize backends with priority-based connection and fallback
 */
export async function initializeBackend(): Promise<void> {
  debug("[METHODS] Initializing backends with priority-based connection...");

  const connected = await backendManager.connect();
  if (!connected) {
    debug("[METHODS] Failed to connect to any backend during initialization");
    throw new Error("Failed to connect to any backend");
  }

  const currentBackend = backendManager.getCurrentBackend();
  debug(
    "[METHODS] Successfully connected to backend:",
    currentBackend ? "connected" : "none",
  );

  // Start health check monitoring to ensure continuous connection
  backendManager.startHealthCheck();
}

/**
 * Get the current backend type
 */
export function getCurrentBackendType(): BackendType | null {
  const currentBackend = backendManager.getCurrentBackend();
  if (!currentBackend) return null;

  // Determine backend type based on the current backend instance
  // We need to check the constructor name or use a different approach
  if (currentBackend.constructor.name === "NostrIdbBackend") return "idb";
  if (currentBackend.constructor.name === "LocalRelayBackend") return "relay";
  return null;
}

/**
 * Get connection status for all backends
 */
export function getBackendStatus() {
  return backendManager.getConnectionStatus();
}

/**
 * Get list of all available backends
 */
export function getBackends() {
  return backendManager.getBackends();
}

/**
 * Force reconnect to all backends
 */
export async function reconnectBackends(): Promise<boolean> {
  debug("[METHODS] Force reconnecting to all backends...");
  return await backendManager.reconnect();
}

/**
 * Check if any backend is connected
 */
export function isBackendConnected(): boolean {
  return backendManager.isConnected();
}
