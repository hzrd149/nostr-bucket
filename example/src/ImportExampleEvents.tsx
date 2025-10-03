import { createSignal, Show } from "solid-js";
import type { NostrEvent } from "nostr-tools";

type ImportStatus = "idle" | "processing" | "success" | "error";

export default function ImportExampleEvents() {
  const [status, setStatus] = createSignal<ImportStatus>("idle");
  const [progress, setProgress] = createSignal({ current: 0, total: 0 });
  const [error, setError] = createSignal<string | null>(null);

  const handleImportExample = async () => {
    if (status() === "processing") return;

    setStatus("processing");
    setError(null);
    setProgress({ current: 0, total: 0 });

    try {
      // Fetch the example events from the public folder
      const response = await fetch("/events.json");
      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.statusText}`);
      }

      const text = await response.text();
      const lines = text
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      if (lines.length === 0) {
        setError("Example events file is empty");
        setStatus("error");
        return;
      }

      setProgress({ current: 0, total: lines.length });

      // Parse events and validate them
      const events: NostrEvent[] = [];
      for (let i = 0; i < lines.length; i++) {
        try {
          const event = JSON.parse(lines[i]) as NostrEvent;
          // Basic validation
          if (
            event.id &&
            event.pubkey &&
            event.created_at &&
            event.kind &&
            event.content !== undefined
          ) {
            events.push(event);
          }
        } catch (parseError) {
          console.warn(`Skipping invalid JSON on line ${i + 1}:`, parseError);
        }
      }

      if (events.length === 0) {
        setError("No valid Nostr events found in example file");
        setStatus("error");
        return;
      }

      // Process events in batches of 500
      const batchSize = 500;
      const totalBatches = Math.ceil(events.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = Math.min(start + batchSize, events.length);
        const batch = events.slice(start, end);

        // Add events to database
        const promises = batch.map((event) => window.nostrdb.add(event));
        await Promise.all(promises);

        // Update progress
        setProgress({ current: end, total: events.length });

        // Small delay to prevent blocking the UI
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      setStatus("success");
      setProgress({ current: events.length, total: events.length });

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus("idle");
        setProgress({ current: 0, total: 0 });
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to import example events",
      );
      setStatus("error");
    }
  };

  const getButtonText = () => {
    switch (status()) {
      case "idle":
        return "Import Example Events";
      case "processing":
        const { current, total } = progress();
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
        return `Importing... ${current}/${total} (${percentage}%)`;
      case "success":
        return `✅ Imported ${progress().total} example events`;
      case "error":
        return "❌ Import failed";
      default:
        return "Import Example Events";
    }
  };

  const getButtonClass = () => {
    switch (status()) {
      case "idle":
        return "btn btn-outline";
      case "processing":
        return "btn btn-primary loading";
      case "success":
        return "btn btn-success";
      case "error":
        return "btn btn-error";
      default:
        return "btn btn-outline";
    }
  };

  return (
    <div class="flex flex-col gap-2">
      <button
        onClick={handleImportExample}
        disabled={status() === "processing"}
        class={getButtonClass()}
      >
        {getButtonText()}
      </button>

      <Show when={error()}>
        <div class="alert alert-error alert-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="stroke-current shrink-0 h-4 w-4"
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
          <span class="text-xs">{error()}</span>
        </div>
      </Show>
    </div>
  );
}
