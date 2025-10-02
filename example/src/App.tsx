import { createSignal, onCleanup } from "solid-js";
import { NostrClient } from "./nostrClient";
import RelaySelector from "./RelaySelector";
import Timeline from "./Timeline";
import type { TimelineEvent } from "./types";
import "./App.css";

function App() {
  const [events, setEvents] = createSignal<TimelineEvent[]>([]);
  const [isConnected, setIsConnected] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [cacheOnlyMode, setCacheOnlyMode] = createSignal(false);

  let nostrClient: NostrClient | null = null;

  const loadCachedProfilesForEvents = async (
    events: TimelineEvent[],
  ): Promise<TimelineEvent[]> => {
    if (!window.nostrdb) {
      return events;
    }

    const updatedEvents: TimelineEvent[] = [];

    for (const event of events) {
      // If we already have author metadata, keep it
      if (event.author) {
        updatedEvents.push(event);
        continue;
      }

      // Try to get cached profile
      try {
        const cachedProfile = await window.nostrdb.replaceable(0, event.pubkey);
        if (cachedProfile) {
          const metadata = JSON.parse(cachedProfile.content);
          updatedEvents.push({
            ...event,
            author: {
              name: metadata.name,
              about: metadata.about,
              picture: metadata.picture,
            },
          });
        } else {
          updatedEvents.push(event);
        }
      } catch (error) {
        console.error(
          `Failed to load cached profile for ${event.pubkey}:`,
          error,
        );
        updatedEvents.push(event);
      }
    }

    return updatedEvents;
  };

  const loadFromCacheOnly = async () => {
    if (!window.nostrdb) {
      setError("No nostrEvents cache available");
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      setCacheOnlyMode(true);
      setIsConnected(true);

      const cachedEvents: TimelineEvent[] = [];
      for await (const event of window.nostrdb.filters([{ kinds: [1] }])) {
        cachedEvents.push({ ...event });
      }
      cachedEvents.sort((a, b) => b.created_at - a.created_at);

      // Load cached profiles for these events
      const eventsWithProfiles =
        await loadCachedProfilesForEvents(cachedEvents);
      setEvents(eventsWithProfiles);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to load from cache",
      );
      setIsConnected(false);
      setCacheOnlyMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRelaySelect = async (relayUrl: string) => {
    try {
      setError(null);
      setIsLoading(true);
      setCacheOnlyMode(false);

      // Disconnect from previous relay if connected
      if (nostrClient) {
        await nostrClient.disconnect();
      }

      // Create new client and connect
      nostrClient = new NostrClient();
      await nostrClient.connect(relayUrl);
      setIsConnected(true);

      // Load cached events if available
      if (window.nostrdb) {
        const cachedEvents: TimelineEvent[] = [];
        try {
          for await (const event of window.nostrdb.filters([{ kinds: [1] }])) {
            cachedEvents.push({ ...event });
          }
          cachedEvents.sort((a, b) => b.created_at - a.created_at);

          // Load cached profiles for these events
          const eventsWithProfiles =
            await loadCachedProfilesForEvents(cachedEvents);
          setEvents(eventsWithProfiles);
        } catch (error) {
          console.error("Failed to load cached events:", error);
        }
      }

      // Subscribe to new events
      await nostrClient.subscribeToTimeline((event) => {
        setEvents((prev) =>
          [event, ...prev].sort((a, b) => b.created_at - a.created_at),
        );
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect to relay",
      );
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (nostrClient) {
      await nostrClient.disconnect();
      nostrClient = null;
    }
    setIsConnected(false);
    setCacheOnlyMode(false);
    setEvents([]);
  };

  onCleanup(() => {
    if (nostrClient) {
      nostrClient.disconnect();
    }
  });

  return (
    <div class="app">
      <header class="app-header">
        <h1>Nostr Timeline Browser</h1>
        <p>Browse kind 1 events from Nostr relays</p>
      </header>

      <main class="app-main">
        {error() && (
          <div class="error-message">
            <strong>Error:</strong> {error()}
          </div>
        )}

        <RelaySelector
          onRelaySelect={handleRelaySelect}
          onCacheOnly={loadFromCacheOnly}
          isConnected={isConnected()}
          cacheOnlyMode={cacheOnlyMode()}
        />

        {isConnected() && (
          <div class="connection-controls">
            <div class="connection-status">
              <span class="status-indicator connected"></span>
              {cacheOnlyMode()
                ? "Browsing cached events only"
                : `Connected to relay`}
            </div>
            <button onClick={handleDisconnect} class="disconnect-button">
              Disconnect
            </button>
          </div>
        )}

        <Timeline events={events()} isLoading={isLoading()} />
      </main>
    </div>
  );
}

export default App;
