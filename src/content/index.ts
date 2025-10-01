import browser from "webextension-polyfill";
import type { NostrEvent } from "nostr-tools";
import type {
  RequestMessage,
  ResponseMessage,
  StreamMessage,
} from "../common/types";
import { EXTENSION_ID } from "../common/const";
import { debug } from "../common/debug";

// inject the script that will provide window.nostrEvents
debug("[CONTENT] Injecting script...");
let script = document.createElement("script");
script.setAttribute("async", "false");
script.setAttribute("type", "text/javascript");
script.setAttribute("src", browser.runtime.getURL("inject.js"));
document.head.appendChild(script);
debug("[CONTENT] Script injected successfully");

// Active stream subscriptions for this tab
const activeStreams = new Map<
  string,
  {
    method: string;
    params: unknown[];
    active: boolean;
  }
>();

// listen for messages from the injected script
self.addEventListener("message", async (event) => {
  debug("[CONTENT] Received message:", event.data);

  if (event.source !== window) {
    debug("[CONTENT] Ignoring message from different source");
    return;
  }

  if (!event.data) {
    debug("[CONTENT] Ignoring message with no data");
    return;
  }

  if (event.data.ext !== EXTENSION_ID) {
    debug(
      "[CONTENT] Ignoring message with wrong extension ID:",
      event.data.ext,
    );
    return;
  }

  const message: RequestMessage = event.data;
  debug("[CONTENT] Processing request:", message.method, "ID:", message.id);

  if (message.type === "request") {
    await handleRequest(message);
  }
});

async function handleRequest(message: RequestMessage) {
  try {
    // Check if this is a stream method
    const isStreamMethod = ["filters", "search", "subscribe"].includes(
      message.method,
    );

    debug(
      "[CONTENT] Handling request:",
      message.method,
      "Is stream:",
      isStreamMethod,
    );

    if (isStreamMethod) {
      // Handle stream methods
      await handleStreamRequest(message);
    } else {
      // Handle regular async methods
      await handleAsyncRequest(message);
    }
  } catch (error) {
    debug("[CONTENT] Error handling request:", error);
    console.error("Error handling request:", error);

    // Send error response
    const errorResponse: ResponseMessage = {
      id: message.id,
      ext: EXTENSION_ID,
      type: "response",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    debug("[CONTENT] Sending error response:", errorResponse);
    window.postMessage(errorResponse, "*");
  }
}

async function handleAsyncRequest(message: RequestMessage) {
  try {
    const response = (await browser.runtime.sendMessage({
      type: "rpc",
      method: message.method,
      params: message.params,
      host: location.host,
    })) as { success: boolean; result?: any; error?: string };

    const responseMessage: ResponseMessage = {
      id: message.id,
      ext: EXTENSION_ID,
      type: "response",
      success: response.success,
      result: response.result,
      error: response.error,
    };

    window.postMessage(responseMessage, "*");
  } catch (error) {
    const errorResponse: ResponseMessage = {
      id: message.id,
      ext: EXTENSION_ID,
      type: "response",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    window.postMessage(errorResponse, "*");
  }
}

async function handleStreamRequest(message: RequestMessage) {
  try {
    // Send stream request to background
    const response = (await browser.runtime.sendMessage({
      type: "rpc",
      method: message.method,
      params: message.params,
      streamId: message.id,
      host: location.host,
    })) as { success: boolean; result?: any; error?: string };

    if (response.success) {
      // Store stream subscription
      activeStreams.set(message.id, {
        method: message.method,
        params: message.params,
        active: true,
      });

      // Set up stream listener
      setupStreamListener(message.id);
    } else {
      // Send error response
      const errorResponse: ResponseMessage = {
        id: message.id,
        ext: EXTENSION_ID,
        type: "response",
        success: false,
        error: response.error,
      };

      window.postMessage(errorResponse, "*");
    }
  } catch (error) {
    const errorResponse: ResponseMessage = {
      id: message.id,
      ext: EXTENSION_ID,
      type: "response",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    window.postMessage(errorResponse, "*");
  }
}

function setupStreamListener(streamId: string) {
  // Listen for stream events from background
  const listener = (message: unknown) => {
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "stream" &&
      "streamId" in message &&
      message.streamId === streamId
    ) {
      const streamEvent = message as {
        type: "stream";
        streamId: string;
        event?: NostrEvent;
        done?: boolean;
        error?: string;
      };

      const streamMessage: StreamMessage = {
        id: streamId,
        ext: EXTENSION_ID,
        type: "stream",
        streamId: streamEvent.streamId,
        event: streamEvent.event,
        done: streamEvent.done,
        error: streamEvent.error,
      };

      window.postMessage(streamMessage, "*");

      // Clean up if stream is done or errored
      if (streamEvent.done || streamEvent.error) {
        activeStreams.delete(streamId);
        browser.runtime.onMessage.removeListener(listener);
      }
    }
  };

  browser.runtime.onMessage.addListener(listener);
}

// Handle stream close requests
self.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  if (!event.data) return;
  if (event.data.ext !== "nostr-bucket") return;

  const message = event.data;

  if (message.type === "request" && message.method === "close_stream") {
    const streamId = message.params[0];

    try {
      await browser.runtime.sendMessage({
        type: "close_stream",
        streamId: streamId,
        host: location.host,
      });

      // Clean up local state
      activeStreams.delete(streamId);
    } catch (error) {
      console.error("Error closing stream:", error);
    }
  }
});
