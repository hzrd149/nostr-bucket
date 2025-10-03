import { createSignal, createEffect, Show } from "solid-js";
import type { NostrEvent } from "nostr-tools";
import Profile from "./Profile";

interface NoteProps {
  event: NostrEvent;
}

export default function Note(props: NoteProps) {
  const [expanded, setExpanded] = createSignal(false);
  const [timeAgo, setTimeAgo] = createSignal("");

  createEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    const eventTime = props.event.created_at;
    const diff = now - eventTime;

    if (diff < 60) {
      setTimeAgo("just now");
    } else if (diff < 3600) {
      setTimeAgo(`${Math.floor(diff / 60)}m ago`);
    } else if (diff < 86400) {
      setTimeAgo(`${Math.floor(diff / 3600)}h ago`);
    } else {
      setTimeAgo(`${Math.floor(diff / 86400)}d ago`);
    }
  });

  const formatContent = (content: string) => {
    // Simple URL detection and formatting
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.replace(
      urlRegex,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="link link-primary">$1</a>',
    );
  };

  const shouldTruncate = () => props.event.content.length > 200;

  return (
    <div class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow">
      <div class="card-body p-4">
        <div class="space-y-3">
          {/* Profile at the top */}
          <Profile pubkey={props.event.pubkey} />

          {/* Timestamp and metadata */}
          <div class="flex items-center space-x-2 text-xs opacity-70">
            <span>{timeAgo()}</span>
            <span>•</span>
            <span>Kind {props.event.kind}</span>
          </div>

          {/* Content */}
          <div class="prose prose-sm max-w-none">
            <Show
              when={!shouldTruncate() || expanded()}
              fallback={
                <div>
                  <div
                    innerHTML={formatContent(props.event.content.slice(0, 200))}
                  />
                  <button
                    onClick={() => setExpanded(true)}
                    class="btn btn-link btn-sm p-0 h-auto min-h-0 mt-1"
                  >
                    ...read more
                  </button>
                </div>
              }
            >
              <div innerHTML={formatContent(props.event.content)} />
              <Show when={expanded() && shouldTruncate()}>
                <button
                  onClick={() => setExpanded(false)}
                  class="btn btn-link btn-sm p-0 h-auto min-h-0 mt-1"
                >
                  show less
                </button>
              </Show>
            </Show>
          </div>

          {/* Event metadata at the bottom */}
          <div class="flex items-center space-x-4 text-xs opacity-70">
            <span>ID: {props.event.id.slice(0, 8)}...</span>
            <span>Tags: {props.event.tags.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
