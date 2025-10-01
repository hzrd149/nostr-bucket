import type { Filter, NostrEvent } from "nostr-tools";
import type { IWindowNostrEvents, Subscription } from "../interface";
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

// Stream event queues for async iterators
const streamQueues = new Map<string, NostrEvent[]>();
const streamResolvers = new Map<
  string,
  ((value: IteratorResult<NostrEvent>) => void)[]
>();

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
  debug("[INJECT] Received message:", event.data);

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
  debug("[INJECT] Processing message type:", message.type);

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
  debug(
    "[INJECT] Handling stream message for ID:",
    streamId,
    "Done:",
    message.done,
    "Error:",
    message.error,
  );

  if (message.done) {
    // Stream is complete
    debug("[INJECT] Stream completed for ID:", streamId);
    const resolvers = streamResolvers.get(streamId) || [];
    resolvers.forEach((resolve) => resolve({ done: true, value: undefined }));
    streamResolvers.delete(streamId);
    streamQueues.delete(streamId);
    activeStreams.delete(streamId);
    return;
  }

  if (message.error) {
    // Stream error
    debug("[INJECT] Stream error for ID:", streamId, "Error:", message.error);
    const resolvers = streamResolvers.get(streamId) || [];
    resolvers.forEach((resolve) => resolve({ done: true, value: undefined }));
    streamResolvers.delete(streamId);
    streamQueues.delete(streamId);
    activeStreams.delete(streamId);
    return;
  }

  if (message.event) {
    // Add event to queue
    debug(
      "[INJECT] Adding event to stream queue:",
      streamId,
      "Event ID:",
      message.event.id,
    );
    const queue = streamQueues.get(streamId) || [];
    queue.push(message.event);
    streamQueues.set(streamId, queue);

    // Resolve any waiting iterators
    const resolvers = streamResolvers.get(streamId) || [];
    if (resolvers.length > 0) {
      const resolver = resolvers.shift()!;
      debug("[INJECT] Resolving waiting iterator for stream:", streamId);
      resolver({ done: false, value: message.event });
    }
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

// Create async iterator for streams
function createAsyncIterator(
  streamId: string,
): AsyncIterableIterator<NostrEvent> {
  return {
    async next(): Promise<IteratorResult<NostrEvent>> {
      const queue = streamQueues.get(streamId) || [];

      if (queue.length > 0) {
        const event = queue.shift()!;
        streamQueues.set(streamId, queue);
        return { done: false, value: event };
      }

      // No events in queue, wait for more
      return new Promise((resolve) => {
        const resolvers = streamResolvers.get(streamId) || [];
        resolvers.push(resolve);
        streamResolvers.set(streamId, resolvers);
      });
    },

    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

// Implement the IWindowNostrEvents interface
const nostrEvents: IWindowNostrEvents = {
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

  filters(filters: Filter[]): AsyncIterable<NostrEvent> {
    const id = generateStreamId();
    const message: RequestMessage = {
      id,
      ext: EXTENSION_ID,
      type: "request",
      method: "filters",
      params: [filters],
    };

    // Register stream
    activeStreams.set(id, {
      id,
      method: "filters",
      params: [filters],
      active: true,
    });

    // Initialize queue and resolvers
    streamQueues.set(id, []);
    streamResolvers.set(id, []);

    // Send message
    window.postMessage(message, "*");

    return createAsyncIterator(id);
  },

  search(query: string, filters: Filter[]): AsyncIterable<NostrEvent> {
    const id = generateStreamId();
    const message: RequestMessage = {
      id,
      ext: EXTENSION_ID,
      type: "request",
      method: "search",
      params: [query, filters],
    };

    // Register stream
    activeStreams.set(id, {
      id,
      method: "search",
      params: [query, filters],
      active: true,
    });

    // Initialize queue and resolvers
    streamQueues.set(id, []);
    streamResolvers.set(id, []);

    // Send message
    window.postMessage(message, "*");

    return createAsyncIterator(id);
  },

  subscribe(filters: Filter[]): Subscription {
    const id = generateStreamId();
    const message: RequestMessage = {
      id,
      ext: EXTENSION_ID,
      type: "request",
      method: "subscribe",
      params: [filters],
    };

    // Register stream
    activeStreams.set(id, {
      id,
      method: "subscribe",
      params: [filters],
      active: true,
    });

    // Initialize queue and resolvers
    streamQueues.set(id, []);
    streamResolvers.set(id, []);

    // Send message
    window.postMessage(message, "*");

    const iterator = createAsyncIterator(id);

    return {
      ...iterator,
      close: () => {
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
        streamQueues.delete(id);
        streamResolvers.delete(id);
      },
    };
  },
};

// Expose the interface on window
window.nostrEvents = nostrEvents;
