import type { Filter, NostrEvent } from "nostr-tools";
import type {
  IWindowNostrDB,
  Subscription,
  StreamHandlers,
  Features,
} from "../interface";
import type {
  RequestMessage,
  ResponseMessage,
  StreamMessage,
  StreamSubscription,
} from "../common/types";
import { EXTENSION_ID } from "../common/const";
import { debug } from "../common/debug";

// Generate unique IDs for requests and streams
let requestId = 0;
let streamId = 0;

function generateId(): string {
  return `req_${++requestId}_${Date.now()}`;
}

function generateStreamId(): string {
  return `stream_${++streamId}_${Date.now()}`;
}

// Active stream subscriptions
const activeStreams = new Map<string, StreamSubscription>();

// Stream handlers for each active stream
const streamHandlers = new Map<string, StreamHandlers>();

// Internal response handlers - not attached to window
const pendingResponses = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }
>();

// Message handler for responses from content script
window.addEventListener("message", (event) => {
  if (event.source !== window) {
    debug("[INJECT] Ignoring message from different source");
    return;
  }

  if (!event.data || event.data.ext !== EXTENSION_ID) {
    debug(
      "[INJECT] Ignoring message with wrong extension ID:",
      event.data?.ext,
    );
    return;
  }

  const message = event.data;
  if (message.type === "response") {
    handleResponse(message);
  } else if (message.type === "stream") {
    handleStreamMessage(message);
  }
});

function handleResponse(message: ResponseMessage) {
  debug(
    "[INJECT] Handling response for ID:",
    message.id,
    "Success:",
    message.success,
  );

  // Resolve pending response handlers
  const pendingResponse = pendingResponses.get(message.id);
  if (pendingResponse) {
    pendingResponses.delete(message.id);
    if (message.success) {
      debug("[INJECT] Resolving response with result:", message.result);
      pendingResponse.resolve(message.result);
    } else {
      debug("[INJECT] Rejecting response with error:", message.error);
      pendingResponse.reject(new Error(message.error || "Unknown error"));
    }
  } else {
    debug("[INJECT] No pending response found for ID:", message.id);
  }
}

function handleStreamMessage(message: StreamMessage) {
  const streamId = message.streamId;
  const handlers = streamHandlers.get(streamId);

  if (message.done) {
    // Stream is complete
    debug("[INJECT] Stream completed for ID:", streamId);

    // Call completion handler if provided
    if (handlers?.complete) {
      debug("[INJECT] Calling completion handler for stream:", streamId);
      try {
        handlers.complete();
      } catch (error) {
        debug("[INJECT] Error in completion handler:", error);
      }
    }

    // Clean up stream tracking
    debug(
      "[INJECT] Cleaning up stream tracking for completed stream:",
      streamId,
    );
    activeStreams.delete(streamId);
    streamHandlers.delete(streamId);
    return;
  }

  if (message.error) {
    // Stream error
    debug("[INJECT] Stream error for ID:", streamId, "Error:", message.error);

    // Call error handler if provided
    if (handlers?.error) {
      try {
        handlers.error(new Error(message.error));
      } catch (error) {
        debug("[INJECT] Error in error handler:", error);
      }
    } else debug("[INJECT] No error handler registered for stream:", streamId);

    // Clean up stream tracking
    debug("[INJECT] Cleaning up stream tracking for errored stream:", streamId);
    activeStreams.delete(streamId);
    streamHandlers.delete(streamId);
    return;
  }

  if (message.event) {
    debug(
      "[INJECT] Processing event for stream:",
      streamId,
      "Event ID:",
      message.event.id,
    );

    // Call event handler if provided
    if (handlers?.event) {
      try {
        handlers.event(message.event);
      } catch (error) {
        debug("[INJECT] Error in event handler:", error);
      }
    } else debug("[INJECT] No event handler registered for stream:", streamId);
  }
}

// Send message to content script
function sendMessage(message: RequestMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = message.id;
    debug("[INJECT] Sending message:", message.method, "ID:", id);

    // Store the resolve/reject handlers internally
    pendingResponses.set(id, { resolve, reject });

    // Set up timeout to clean up if no response
    setTimeout(() => {
      const pendingResponse = pendingResponses.get(id);
      if (pendingResponse) {
        debug("[INJECT] Request timeout for ID:", id);
        pendingResponses.delete(id);
        reject(new Error("Request timeout"));
      }
    }, 30000); // 30 second timeout

    // Send message
    window.postMessage(message, "*");
  });
}

// Implement the IWindowNostrEvents interface
const nostrdb: IWindowNostrDB = {
  async add(event: NostrEvent): Promise<boolean> {
    const id = generateId();
    const message: RequestMessage = {
      id,
      ext: EXTENSION_ID,
      type: "request",
      method: "add",
      params: [event],
    };

    const result = await sendMessage(message);
    return Boolean(result);
  },

  async event(id: string): Promise<NostrEvent | undefined> {
    const requestId = generateId();
    const message: RequestMessage = {
      id: requestId,
      ext: EXTENSION_ID,
      type: "request",
      method: "event",
      params: [id],
    };

    const result = await sendMessage(message);
    return result as NostrEvent | undefined;
  },

  async replaceable(
    kind: number,
    author: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined> {
    const requestId = generateId();
    const message: RequestMessage = {
      id: requestId,
      ext: EXTENSION_ID,
      type: "request",
      method: "replaceable",
      params: [kind, author, identifier],
    };

    const result = await sendMessage(message);
    return result as NostrEvent | undefined;
  },

  async count(filters: Filter[]): Promise<number> {
    const requestId = generateId();
    const message: RequestMessage = {
      id: requestId,
      ext: EXTENSION_ID,
      type: "request",
      method: "count",
      params: [filters],
    };

    const result = await sendMessage(message);
    return Number(result) || 0;
  },

  filters(filters: Filter[], handlers?: StreamHandlers): Subscription {
    const id = generateStreamId();
    const message: RequestMessage = {
      id,
      ext: EXTENSION_ID,
      type: "request",
      method: "filters",
      params: [filters],
    };

    debug("[INJECT] Creating filters stream:", id, "Filters:", filters.length);

    // Register stream
    activeStreams.set(id, {
      id,
      method: "filters",
      params: [filters],
      active: true,
    });

    // Store handlers if provided
    if (handlers) {
      debug("[INJECT] Storing StreamHandlers for filters stream:", id);
      streamHandlers.set(id, handlers);
    }

    // Send message
    debug("[INJECT] Sending filters request for stream:", id);
    window.postMessage(message, "*");

    return {
      close: () => {
        debug("[INJECT] Closing filters stream:", id);
        // Send close message
        const closeMessage: RequestMessage = {
          id: generateId(),
          ext: EXTENSION_ID,
          type: "request",
          method: "close_stream",
          params: [id],
        };
        window.postMessage(closeMessage, "*");

        // Clean up
        activeStreams.delete(id);
        streamHandlers.delete(id);
      },
    };
  },

  subscribe(filters: Filter[], handlers?: StreamHandlers): Subscription {
    const id = generateStreamId();
    const message: RequestMessage = {
      id,
      ext: EXTENSION_ID,
      type: "request",
      method: "subscribe",
      params: [filters],
    };

    debug(
      "[INJECT] Creating subscribe stream:",
      id,
      "Filters:",
      filters.length,
    );

    // Register stream
    activeStreams.set(id, {
      id,
      method: "subscribe",
      params: [filters],
      active: true,
    });

    // Store handlers if provided
    if (handlers) {
      debug("[INJECT] Storing StreamHandlers for subscribe stream:", id);
      streamHandlers.set(id, handlers);
    }

    // Send message
    debug("[INJECT] Sending subscribe request for stream:", id);
    window.postMessage(message, "*");

    return {
      close: () => {
        debug("[INJECT] Closing subscribe stream:", id);
        // Send close message
        const closeMessage: RequestMessage = {
          id: generateId(),
          ext: EXTENSION_ID,
          type: "request",
          method: "close_stream",
          params: [id],
        };
        window.postMessage(closeMessage, "*");

        // Clean up
        activeStreams.delete(id);
        streamHandlers.delete(id);
      },
    };
  },

  async supports(feature: Features): Promise<boolean> {
    const requestId = generateId();
    const message: RequestMessage = {
      id: requestId,
      ext: EXTENSION_ID,
      type: "request",
      method: "supports",
      params: [feature],
    };

    const result = await sendMessage(message);
    return Boolean(result);
  },
};

// Expose the interface on window
window.nostrdb = nostrdb;
