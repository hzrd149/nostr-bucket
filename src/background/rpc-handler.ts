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
  searchEvents,
} from "./methods";

// Active stream subscriptions
const activeStreams = new Map<
  string,
  {
    method: string;
    params: unknown[];
    tabId: number;
    active: boolean;
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
    let iterator: AsyncIterableIterator<NostrEvent>;

    switch (method) {
      case "filters": {
        const filters = params[0] as Filter[];
        debug("[BACKGROUND] Creating filters iterator for:", filters);
        iterator = getEventsByFilters(filters);
        break;
      }
      case "search": {
        const query = params[0] as string;
        const filters = params[1] as Filter[];
        debug("[BACKGROUND] Creating search iterator for:", query, filters);
        iterator = searchEvents(query, filters);
        break;
      }
      case "subscribe": {
        // For subscribe, we'll implement a real-time subscription later
        // For now, just return existing events
        const filters = params[0] as Filter[];
        debug("[BACKGROUND] Creating subscribe iterator for:", filters);
        iterator = getEventsByFilters(filters);
        break;
      }
      default:
        debug("[BACKGROUND] Unknown stream method:", method);
        throw new Error(`Unknown stream method: ${method}`);
    }

    // Store active stream
    activeStreams.set(streamId, {
      method,
      params,
      tabId,
      active: true,
    });
    debug("[BACKGROUND] Stream stored, processing events...");

    // Process stream
    let eventCount = 0;
    for await (const event of iterator) {
      if (!activeStreams.has(streamId)) {
        debug("[BACKGROUND] Stream was closed, breaking loop");
        break; // Stream was closed
      }

      eventCount++;
      debug(
        "[BACKGROUND] Sending stream event:",
        eventCount,
        "Event ID:",
        event.id,
      );

      const streamEvent: BackgroundStreamEvent = {
        type: "stream",
        streamId,
        event,
      };

      try {
        await browser.tabs.sendMessage(tabId, streamEvent);
      } catch (error) {
        debug("[BACKGROUND] Error sending stream event:", error);
        console.error("Error sending stream event:", error);
        break;
      }
    }

    // Send done signal
    debug(
      "[BACKGROUND] Stream complete, sending done signal. Total events:",
      eventCount,
    );
    const doneEvent: BackgroundStreamEvent = {
      type: "stream",
      streamId,
      done: true,
    };

    try {
      await browser.tabs.sendMessage(tabId, doneEvent);
    } catch (error) {
      debug("[BACKGROUND] Error sending stream done event:", error);
      console.error("Error sending stream done event:", error);
    }

    // Clean up
    activeStreams.delete(streamId);
    debug("[BACKGROUND] Stream cleanup complete for:", streamId);
  } catch (error) {
    debug("[BACKGROUND] Error in stream subscription:", error);
    console.error("Error in stream subscription:", error);

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
      console.error("Error sending stream error event:", sendError);
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
  tabId: number,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  debug(
    "[BACKGROUND] Processing RPC request:",
    request.method,
    "Tab ID:",
    tabId,
  );

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
      case "search":
      case "subscribe": {
        // Handle stream methods
        debug(
          "[BACKGROUND] Handling stream method:",
          request.method,
          "Stream ID:",
          request.streamId,
        );

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
        activeStreams.delete(streamId);
        return { success: true, result: "Stream closed" };
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
      activeStreams.delete(streamId);
    }
  }
}
