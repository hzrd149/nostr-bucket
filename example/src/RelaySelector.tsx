import { createSignal } from "solid-js";
import type { RelayInfo } from "./types";

interface RelaySelectorProps {
  onRelaySelect: (relayUrl: string) => void;
  onCacheOnly: () => void;
  isConnected: boolean;
  cacheOnlyMode: boolean;
}

const COMMON_RELAYS: RelayInfo[] = [
  { url: "wss://relay.damus.io", name: "Damus" },
  { url: "wss://nos.lol", name: "Nos.lol" },
  { url: "wss://relay.snort.social", name: "Snort" },
  { url: "wss://relay.nostr.band", name: "Nostr Band" },
  { url: "wss://purplepag.es", name: "Purple Pages" },
];

export default function RelaySelector(props: RelaySelectorProps) {
  const [customRelay, setCustomRelay] = createSignal("");
  const [selectedRelay, setSelectedRelay] = createSignal("");

  const handleRelaySelect = (relayUrl: string) => {
    setSelectedRelay(relayUrl);
    props.onRelaySelect(relayUrl);
  };

  const handleCustomRelaySubmit = () => {
    const url = customRelay().trim();
    if (url) {
      handleRelaySelect(url);
    }
  };

  return (
    <div class="relay-selector">
      <h2>Select a Nostr Relay</h2>

      <div class="cache-only-section">
        <button
          class={`cache-only-button ${props.cacheOnlyMode ? "selected" : ""}`}
          onClick={props.onCacheOnly}
          disabled={props.isConnected && !props.cacheOnlyMode}
        >
          <div class="cache-only-title">📦 Browse Cache Only</div>
          <div class="cache-only-description">
            View only cached events (offline mode)
          </div>
        </button>
      </div>

      <div class="relay-grid">
        {COMMON_RELAYS.map((relay) => (
          <button
            class={`relay-button ${selectedRelay() === relay.url ? "selected" : ""}`}
            onClick={() => handleRelaySelect(relay.url)}
            disabled={props.isConnected}
          >
            <div class="relay-name">{relay.name}</div>
            <div class="relay-url">{relay.url}</div>
          </button>
        ))}
      </div>

      <div class="custom-relay">
        <h3>Or enter a custom relay:</h3>
        <div class="input-group">
          <input
            type="text"
            placeholder="wss://your-relay.com"
            value={customRelay()}
            onInput={(e) => setCustomRelay(e.currentTarget.value)}
            disabled={props.isConnected}
          />
          <button
            onClick={handleCustomRelaySubmit}
            disabled={props.isConnected || !customRelay().trim()}
          >
            Connect
          </button>
        </div>
      </div>

      {props.isConnected && (
        <div class="connection-status">
          <span class="status-indicator connected"></span>
          Connected to {selectedRelay()}
        </div>
      )}
    </div>
  );
}
