import { createSignal, onMount } from "solid-js";
import "./App.css";
import browser from "webextension-polyfill";

function App() {
  const [count, setCount] = createSignal(0);
  const [settings, setSettings] = createSignal({
    autoDetect: true,
    notifications: true,
  } as { autoDetect: boolean; notifications: boolean });

  onMount(async () => {
    // Load settings from storage
    const response = await browser.runtime.sendMessage<
      { action: string },
      | {
          autoDetect: boolean;
          notifications: boolean;
        }
      | undefined
    >({
      action: "getSettings",
    });
    if (response) setSettings(response);
  });

  const handleInjectIndicator = async () => {
    const response = await browser.runtime.sendMessage({
      action: "injectIndicator",
    });
    console.log("Indicator injection response:", response);
  };

  const handleToggleSetting = (key: "autoDetect" | "notifications") => {
    const currentSettings = settings();
    const newSettings = { ...currentSettings, [key]: !currentSettings[key] };
    setSettings(newSettings);
    browser.runtime.sendMessage({
      action: "updateSettings",
      settings: newSettings,
    });
  };

  return (
    <div class="popup-container">
      <header class="popup-header">
        <h1>Nostr Bucket</h1>
        <p>Your Nostr-powered browser companion</p>
      </header>

      <main class="popup-main">
        <div class="card">
          <button onClick={() => setCount((count) => count + 1)}>
            Counter: {count()}
          </button>
          <p>Click to increment the counter</p>
        </div>

        <div class="card">
          <button onClick={handleInjectIndicator}>Inject Page Indicator</button>
          <p>Test content script injection</p>
        </div>

        <div class="settings">
          <h3>Settings</h3>
          <label class="setting-item">
            <input
              type="checkbox"
              checked={settings().autoDetect}
              onChange={() => handleToggleSetting("autoDetect")}
            />
            Auto-detect Nostr content
          </label>
          <label class="setting-item">
            <input
              type="checkbox"
              checked={settings().notifications}
              onChange={() => handleToggleSetting("notifications")}
            />
            Enable notifications
          </label>
        </div>
      </main>

      <footer class="popup-footer">
        <p>Built with SolidJS + Vite</p>
      </footer>
    </div>
  );
}

export default App;
