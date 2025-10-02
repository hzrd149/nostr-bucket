import browser from "webextension-polyfill";
import type { BackgroundRequest } from "../common/types";
import { debug } from "../common/debug";
import { handleRpcRequest, cleanupStreamsForTab } from "./rpc-handler";
import { initializeBackend } from "./methods";

// Background service worker for Nostr Bucket extension
console.log("Nostr Bucket background script loaded");
debug("[BACKGROUND] Service worker initialized");

// Initialize the default backend
initializeBackend().catch((error) => {
  debug("[BACKGROUND] Failed to initialize backend:", error);
  console.error("Failed to initialize backend:", error);
});

// Handle extension installation
browser.runtime.onInstalled.addListener(async (details) => {
  console.log("Nostr Bucket extension installed:", details.reason);

  // Set default storage values
  const keys = await browser.storage.sync.getKeys();
  if (keys.length === 0) {
    browser.storage.sync.set({
      nostrBucketEnabled: true,
      nostrBucketSettings: {
        autoDetect: true,
        notifications: true,
      },
    });
  }
});

// Handle messages from popup and content scripts
browser.runtime.onMessage.addListener(
  // @ts-expect-error
  async (request: BackgroundRequest, sender) => {
    if (request.type === "rpc") {
      const tabId = sender.tab?.id;
      debug("[BACKGROUND] Processing RPC request:", request.method);

      return await handleRpcRequest(request, tabId);
    }

    // Legacy message handling for popup
    switch (request.action) {
      case "getSettings": {
        const result = await browser.storage.sync.get(["nostrBucketSettings"]);
        return result.nostrBucketSettings || {};
      }

      case "updateSettings": {
        await browser.storage.sync.set({
          nostrBucketSettings: request.settings,
        });
        return { success: true };
      }
    }

    return { error: "Unknown action" };
  },
);

// Clean up streams when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
  cleanupStreamsForTab(tabId);
});
