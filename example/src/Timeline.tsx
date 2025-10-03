import { createSignal, createEffect, onCleanup, For, Show } from "solid-js";
import type { NostrEvent, Filter } from "nostr-tools";
import type { Subscription, Features } from "../../src/interface";
import { Features as FeaturesEnum } from "../../src/interface";
import Note from "./Note";
import ImportEvents from "./ImportEvents";
import ImportExampleEvents from "./ImportExampleEvents";
import { insertEventIntoDescendingList } from "nostr-tools/utils";

export default function Timeline() {
  const [events, setEvents] = createSignal<NostrEvent[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [searchTerm, setSearchTerm] = createSignal("");
  const [supportedFeatures, setSupportedFeatures] = createSignal<Features[]>(
    [],
  );
  const [subscription, setSubscription] = createSignal<Subscription | null>(
    null,
  );
  const [isSubscribed, setIsSubscribed] = createSignal(false);

  createEffect(async () => {
    if (!window.nostrdb) return;

    try {
      const features = await window.nostrdb.supports();
      setSupportedFeatures(features);
    } catch (err) {
      console.error("Failed to get supported features:", err);
    }
  });

  const loadEvents = async () => {
    if (!window.nostrdb) return;

    setLoading(true);
    setError(null);
    setEvents([]);

    try {
      const filters: Filter[] = [
        {
          kinds: [1],
          limit: 100,
          ...(searchTerm() && { search: searchTerm() }),
        },
      ];

      const sub = window.nostrdb.filters(filters, {
        event: (event) => {
          setEvents((events) => [...events, event]);
        },
        complete: () => {
          setLoading(false);
        },
        error: (err) => {
          setError(err.message);
          setLoading(false);
        },
      });

      setSubscription(sub);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
      setLoading(false);
    }
  };

  const subscribeToEvents = async () => {
    if (
      !window.nostrdb ||
      !supportedFeatures().includes(FeaturesEnum.Subscribe)
    )
      return;

    setLoading(true);
    setError(null);
    setEvents([]);

    try {
      const filters: Filter[] = [
        {
          kinds: [1],
          limit: 100,
          ...(searchTerm() && { search: searchTerm() }),
        },
      ];

      const sub = window.nostrdb.subscribe(filters, {
        event: (event) => {
          setEvents((events) => [...events, event]);
        },
        error: (err) => {
          setError(err.message);
          setLoading(false);
        },
      });

      setSubscription(sub);
      setIsSubscribed(true);
      setLoading(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to subscribe to events",
      );
      setLoading(false);
    }
  };

  const stopSubscription = () => {
    const sub = subscription();
    if (sub) {
      sub.close();
      setSubscription(null);
      setIsSubscribed(false);
    }
  };

  const handleSearch = () => {
    // Stop current subscription if active
    stopSubscription();

    // Clear current events
    setEvents([]);

    // Start new subscription or load with search term
    if (supportedFeatures().includes(FeaturesEnum.Subscribe)) {
      subscribeToEvents();
    } else {
      loadEvents();
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    stopSubscription();
    setEvents([]);
  };

  onCleanup(() => {
    stopSubscription();
  });

  return (
    <div class="max-w-2xl mx-auto p-4 space-y-4">
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body p-4">
          <h1 class="card-title text-2xl mb-4">Nostr Timeline</h1>

          {/* Search Bar */}
          <Show when={supportedFeatures().includes(FeaturesEnum.Search)}>
            <div class="form-control mb-4">
              <div class="input-group">
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchTerm()}
                  onInput={(e) => setSearchTerm(e.currentTarget.value)}
                  class="input input-bordered flex-1"
                />
                <button
                  onClick={handleSearch}
                  disabled={loading()}
                  class="btn btn-primary"
                >
                  Search
                </button>
                <Show when={searchTerm()}>
                  <button onClick={clearSearch} class="btn btn-outline">
                    Clear
                  </button>
                </Show>
              </div>
            </div>
          </Show>

          {/* Controls */}
          <div class="flex flex-wrap gap-2 mb-4">
            <Show when={supportedFeatures().includes(FeaturesEnum.Subscribe)}>
              <Show
                when={!isSubscribed()}
                fallback={
                  <button
                    onClick={stopSubscription}
                    disabled={loading()}
                    class="btn btn-error"
                  >
                    Stop Live Feed
                  </button>
                }
              >
                <button
                  onClick={subscribeToEvents}
                  disabled={loading()}
                  class="btn btn-success"
                >
                  Start Live Feed
                </button>
              </Show>
            </Show>

            <Show
              when={
                !supportedFeatures().includes(FeaturesEnum.Subscribe) ||
                !isSubscribed()
              }
            >
              <button
                onClick={loadEvents}
                disabled={loading()}
                class="btn btn-primary"
              >
                {loading() ? (
                  <>
                    <span class="loading loading-spinner loading-sm"></span>
                    Loading...
                  </>
                ) : (
                  "Load Events"
                )}
              </button>
            </Show>

            {/* Import Events Button */}
            <ImportEvents />

            {/* Import Example Events Button */}
            <ImportExampleEvents />
          </div>

          {/* Status */}
          <div class="text-sm opacity-70 mb-4">
            <Show when={supportedFeatures().length > 0}>
              <p>Supported features: {supportedFeatures().join(", ")}</p>
            </Show>
            <Show when={isSubscribed()}>
              <div class="flex items-center gap-2">
                <div class="badge badge-error badge-sm"></div>
                <span>Live feed active</span>
              </div>
            </Show>
            <Show when={events().length > 0}>
              <p>Showing {events().length} events</p>
            </Show>
          </div>

          {/* Error Display */}
          <Show when={error()}>
            <div class="alert alert-error mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error()}</span>
            </div>
          </Show>
        </div>
      </div>

      {/* Events List */}
      <div class="space-y-4">
        <Show
          when={events().length > 0}
          fallback={
            <div class="text-center py-8 opacity-70">
              <div class="hero-content text-center">
                <div class="max-w-md">
                  <h2 class="text-2xl font-bold mb-4">No events loaded yet</h2>
                  <p class="mb-4">
                    {supportedFeatures().includes(FeaturesEnum.Subscribe)
                      ? "Click 'Start Live Feed' to begin receiving events."
                      : "Click 'Load Events' to fetch some events."}
                  </p>
                </div>
              </div>
            </div>
          }
        >
          <For each={events()}>{(event) => <Note event={event} />}</For>
        </Show>
      </div>
    </div>
  );
}
