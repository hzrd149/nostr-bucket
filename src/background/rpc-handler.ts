import type { Filter, NostrEvent } from "nostr-tools";
import browser from "webextension-polyfill";
import type { BackgroundRequest, BackgroundStreamEvent } from "../common/types";
import { debug } from "../common/debug";
import {
  addEvent,
  countEvents,
  getEvent,
  getEventsByFilters,
  getReplaceableEvent,
  subscribeToEvents,
  getSupportedFeatures,
  setBackend,
  getCurrentBackendType,
  getBackendStatus,
  getBackends,
  reconnectBackends,
  isBackendConnected,
  type BackendType,
} from "./methods";
import type { StreamHandlers } from "../interface";

// Active stream subscriptions
const activeStreams = new Map<
  string,
  {
    method: string;
    params: unknown[];
    tabId: number;
    active: boolean;
    subscription?: { close: () => void };
  }
>();

/**
 * Handle stream subscription for real-time event streaming
 */
async function handleStreamSubscription(
  streamId: string,
  method: string,
  params: unknown[],
  tabId: number,
): Promise<void> {
  debug("[BACKGROUND] Starting stream subscription:", streamId, method, params);

  try {
    let subscription: { close: () => void };

    const handlers: StreamHandlers = {
      event: (event: NostrEvent) => {
        if (!activeStreams.has(streamId)) return; // Stream was closed

        debug("[BACKGROUND] Sending stream event:", event.id);

        const streamEvent: BackgroundStreamEvent = {
          type: "stream",
          streamId,
          event,
        };

        browser.tabs.sendMessage(tabId, streamEvent).catch((error) => {
          debug("[BACKGROUND] Error sending stream event:", error);
        });
      },
      error: (error: Error) => {
        debug("[BACKGROUND] Stream error:", error);

        const errorEvent: BackgroundStreamEvent = {
          type: "stream",
          streamId,
          error: error.message,
        };

        browser.tabs.sendMessage(tabId, errorEvent).catch((sendError) => {
          debug("[BACKGROUND] Error sending stream error event:", sendError);
        });
      },
      complete: () => {
        debug("[BACKGROUND] Stream complete for:", streamId);

        const doneEvent: BackgroundStreamEvent = {
          type: "stream",
          streamId,
          done: true,
        };

        browser.tabs.sendMessage(tabId, doneEvent).catch((error) => {
          debug("[BACKGROUND] Error sending stream done event:", error);
        });

        // Clean up
        activeStreams.delete(streamId);
      },
    };

    switch (method) {
      case "filters": {
        const filters = params[0] as Filter[];
        debug("[BACKGROUND] Creating filters subscription for:", filters);
        subscription = getEventsByFilters(filters, handlers);
        break;
      }
      case "subscribe": {
        const filters = params[0] as Filter[];
        debug("[BACKGROUND] Creating subscribe subscription for:", filters);
        subscription = subscribeToEvents(filters, handlers);
        break;
      }
      default:
        debug("[BACKGROUND] Unknown stream method:", method);
        throw new Error(`Unknown stream method: ${method}`);
    }

    // Store active stream with subscription
    activeStreams.set(streamId, {
      method,
      params,
      tabId,
      active: true,
      subscription,
    });

    debug("[BACKGROUND] Stream subscription created for:", streamId);
  } catch (error) {
    debug("[BACKGROUND] Error in stream subscription:", error);

    // Send error
    const errorEvent: BackgroundStreamEvent = {
      type: "stream",
      streamId,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    try {
      await browser.tabs.sendMessage(tabId, errorEvent);
    } catch (sendError) {
      debug("[BACKGROUND] Error sending stream error event:", sendError);
    }

    // Clean up
    activeStreams.delete(streamId);
    debug("[BACKGROUND] Stream error cleanup complete for:", streamId);
  }
}

/**
 * Handle RPC requests from content scripts and popup
 */
export async function handleRpcRequest(
  request: BackgroundRequest,
  tabId?: number,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  debug("[BACKGROUND] Processing RPC request:", request.method);

  try {
    let result: unknown;

    switch (request.method) {
      case "add": {
        const event = request.params[0] as NostrEvent;
        debug("[BACKGROUND] Adding event:", event.id);
        result = await addEvent(event);
        debug("[BACKGROUND] Add event result:", result);
        break;
      }

      case "event": {
        const id = request.params[0] as string;
        debug("[BACKGROUND] Getting event:", id);
        result = await getEvent(id);
        debug("[BACKGROUND] Get event result:", result ? "found" : "not found");
        break;
      }

      case "replaceable": {
        const kind = request.params[0] as number;
        const author = request.params[1] as string;
        const identifier = request.params[2] as string | undefined;
        debug(
          "[BACKGROUND] Getting replaceable event:",
          kind,
          author,
          identifier,
        );
        result = await getReplaceableEvent(kind, author, identifier);
        debug(
          "[BACKGROUND] Replaceable event result:",
          result ? "found" : "not found",
        );
        break;
      }

      case "count": {
        const filters = request.params[0] as Filter[];
        debug("[BACKGROUND] Counting events with filters:", filters);
        result = await countEvents(filters);
        debug("[BACKGROUND] Count result:", result);
        break;
      }

      case "filters":
      case "subscribe": {
        // Handle stream methods
        debug(
          "[BACKGROUND] Handling stream method:",
          request.method,
          "Stream ID:",
          request.streamId,
        );

        if (!tabId) {
          debug("[BACKGROUND] No tab ID provided");
          return { success: false, error: "No tab ID" };
        }

        if (request.streamId) {
          // Start stream subscription
          debug(
            "[BACKGROUND] Starting stream subscription for:",
            request.streamId,
          );
          handleStreamSubscription(
            request.streamId,
            request.method,
            request.params,
            tabId,
          );
          return { success: true, result: "Stream started" };
        } else {
          debug("[BACKGROUND] Stream ID required for stream methods");
          return {
            success: false,
            error: "Stream ID required for stream methods",
          };
        }
      }

      case "close_stream": {
        const streamId = request.params[0] as string;
        debug("[BACKGROUND] Closing stream:", streamId);
        const stream = activeStreams.get(streamId);
        if (stream?.subscription) {
          stream.subscription.close();
        }
        activeStreams.delete(streamId);
        return { success: true, result: "Stream closed" };
      }

      case "supports": {
        debug("[BACKGROUND] Getting supported features");
        result = await getSupportedFeatures();
        debug("[BACKGROUND] Supported features:", result);
        break;
      }

      case "set_backend": {
        const backendType = request.params[0] as BackendType;
        debug("[BACKGROUND] Setting backend to:", backendType);
        try {
          await setBackend(backendType);
          return {
            success: true,
            result: `Backend switched to ${backendType}`,
          };
        } catch (error) {
          debug("[BACKGROUND] Error switching backend:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }

      case "get_backend": {
        const currentBackend = getCurrentBackendType();
        debug("[BACKGROUND] Current backend:", currentBackend);
        return { success: true, result: currentBackend };
      }

      case "get_backend_status": {
        const status = getBackendStatus();
        debug("[BACKGROUND] Backend status:", status);
        return { success: true, result: status };
      }

      case "get_backends": {
        const backends = getBackends();
        debug("[BACKGROUND] Available backends:", backends);
        return { success: true, result: backends };
      }

      case "reconnect_backends": {
        debug("[BACKGROUND] Reconnecting to all backends...");
        try {
          const connected = await reconnectBackends();
          return {
            success: true,
            result: connected
              ? "Successfully reconnected"
              : "Failed to reconnect to any backend",
          };
        } catch (error) {
          debug("[BACKGROUND] Error reconnecting backends:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }

      case "is_backend_connected": {
        const connected = isBackendConnected();
        debug("[BACKGROUND] Backend connected:", connected);
        return { success: true, result: connected };
      }

      default:
        debug("[BACKGROUND] Unknown method:", request.method);
        return { success: false, error: "Unknown method" };
    }

    debug("[BACKGROUND] Returning result:", result);
    return { success: true, result };
  } catch (error) {
    debug("[BACKGROUND] Error handling RPC request:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Clean up streams when tabs are closed
 */
export function cleanupStreamsForTab(tabId: number): void {
  for (const [streamId, stream] of activeStreams.entries()) {
    if (stream.tabId === tabId) {
      if (stream.subscription) {
        stream.subscription.close();
      }
      activeStreams.delete(streamId);
    }
  }
}
