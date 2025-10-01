import browser from "webextension-polyfill";
import type { NostrEvent } from "nostr-tools";
import getNostrIdb from "./idb";
import { addEvents } from "nostr-idb";

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

// Event database operations
async function getEvent(id: string): Promise<NostrEvent | undefined> {
  try {
    const nostrIdb = await getNostrIdb();
    const tx = nostrIdb.transaction("events", "readonly");
    const store = tx.objectStore("events");
    const result = await store.get(id);
    return result?.event;
  } catch (error) {
    console.error("Error getting event:", error);
    return undefined;
  }
}

async function addEvent(event: NostrEvent): Promise<boolean> {
  try {
    const nostrIdb = await getNostrIdb();
    await addEvents(nostrIdb, [event]);
    return true;
  } catch (error) {
    console.error("Error adding event:", error);
    return false;
  }
}

async function getReplaceableEvent(
  kind: number,
  author: string,
  identifier?: string,
): Promise<NostrEvent | undefined> {
  try {
    const nostrIdb = await getNostrIdb();
    const tx = nostrIdb.transaction("events", "readonly");
    const store = tx.objectStore("events");
    const index = store.index("kind");

    // Get all events of this kind
    const events = await index.getAll(kind);

    // Filter by author and identifier
    const matchingEvents = events.filter((item) => {
      const event = item.event;
      if (event.pubkey !== author) return false;

      if (identifier) {
        // For replaceable events with identifier, check d-tag
        const dTag = event.tags.find((tag) => tag[0] === "d");
        return dTag && dTag[1] === identifier;
      }

      return true;
    });

    // Return the latest event (highest created_at)
    if (matchingEvents.length === 0) return undefined;

    const latestEvent = matchingEvents.reduce((latest, current) =>
      current.event.created_at > latest.event.created_at ? current : latest,
    );

    return latestEvent.event;
  } catch (error) {
    console.error("Error getting replaceable event:", error);
    return undefined;
  }
}

async function getSupportedNips(): Promise<number[]> {
  // Return the NIPs that this implementation supports
  // This could be made configurable or dynamic in the future
  return [1];
}

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

    case "getEvent": {
      const event = await getEvent(request.id);
      return { event };
    }

    case "addEvent": {
      const success = await addEvent(request.event);
      return { success };
    }

    case "getReplaceableEvent": {
      const event = await getReplaceableEvent(
        request.kind,
        request.author,
        request.identifier,
      );
      return { event };
    }

    case "getSupports": {
      const supportedNips = await getSupportedNips();
      return { supportedNips };
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
