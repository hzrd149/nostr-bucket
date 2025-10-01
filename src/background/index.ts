import browser from "webextension-polyfill";

// Background service worker for Nostr Bucket extension
console.log("Nostr Bucket background script loaded");

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
browser.runtime.onMessage.addListener(async (request, _sender) => {
  console.log("Background received message:", request);

  switch (request.action) {
    case "getSettings": {
      const result = await browser.storage.sync.get(["nostrBucketSettings"]);
      return result.nostrBucketSettings || {};
    }

    case "updateSettings": {
      await browser.storage.sync.set({ nostrBucketSettings: request.settings });
      return { success: true };
    }

    case "injectIndicator": {
      // Forward to content script
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]?.id) {
        await browser.tabs.sendMessage(tabs[0].id, request);
      }
      return true; // Keep message channel open for async response
    }

    default:
      return { error: "Unknown action" };
  }
});

// Handle tab updates
browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    console.log("Tab updated:", tab.url);
    // Could add logic here to detect Nostr-related content
  }
});
