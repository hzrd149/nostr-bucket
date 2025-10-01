import browser from "webextension-polyfill";

// Content script for Nostr Bucket extension
console.log("Nostr Bucket content script loaded");

// Example: Inject a small indicator on pages
function injectNostrIndicator() {
  const indicator = document.createElement("div");
  indicator.id = "nostr-bucket-indicator";
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #ff6b6b;
    color: white;
    padding: 5px 10px;
    border-radius: 5px;
    font-size: 12px;
    z-index: 10000;
    font-family: Arial, sans-serif;
  `;
  indicator.textContent = "Nostr Bucket Active";

  document.body.appendChild(indicator);

  // Remove after 3 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }, 3000);
}

// Listen for messages from popup/background
browser.runtime.onMessage.addListener(
  (request: { action: string }, _sender, sendResponse) => {
    if (request.action === "injectIndicator") {
      injectNostrIndicator();
      sendResponse({ success: true });
    }
    return true; // Indicate we will handle the response asynchronously
  },
);

// Auto-inject indicator on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectNostrIndicator);
} else {
  injectNostrIndicator();
}
