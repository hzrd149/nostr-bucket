import browser from "webextension-polyfill";

// inject the script that will provide window.nostr
let script = document.createElement("script");
script.setAttribute("async", "false");
script.setAttribute("type", "text/javascript");
script.setAttribute("src", browser.runtime.getURL("inject.js"));
document.head.appendChild(script);

// listen for messages from that script
self.addEventListener("message", async (message) => {
  if (message.source !== window) return;
  if (!message.data) return;
  if (!message.data.params) return;
  if (message.data.ext !== "nostr-bucket") return;

  // pass on to background
  var response;
  try {
    response = await browser.runtime.sendMessage({
      type: message.data.type,
      params: message.data.params,
      host: location.host,
    });
  } catch (error) {
    response = { error };
  }

  // return response
  window.postMessage(
    { id: message.data.id, ext: "nostr-bucket", response },
    message.origin,
  );
});
