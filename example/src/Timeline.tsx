import { createSignal, createEffect, For } from "solid-js";
import type { TimelineEvent } from "./types";

interface TimelineProps {
  events: TimelineEvent[];
  isLoading: boolean;
}

export default function Timeline(props: TimelineProps) {
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatContent = (content: string): string => {
    // Simple URL detection and formatting
    return content
      .replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
      )
      .replace(/\n/g, "<br>");
  };

  return (
    <div class="timeline">
      <h2>Timeline</h2>

      {props.isLoading && (
        <div class="loading">
          <div class="spinner"></div>
          <span>Loading events...</span>
        </div>
      )}

      {!props.isLoading && props.events.length === 0 && (
        <div class="empty-timeline">
          <p>No events found. Try connecting to a different relay.</p>
        </div>
      )}

      <div class="events-list">
        <For each={props.events}>
          {(event) => (
            <div class="event-card">
              <div class="event-header">
                <div class="author-info">
                  {event.author?.picture && (
                    <img
                      src={event.author.picture}
                      alt="Author avatar"
                      class="author-avatar"
                    />
                  )}
                  <div class="author-details">
                    <div class="author-name">
                      {event.author?.name ||
                        `User ${event.pubkey.slice(0, 8)}...`}
                    </div>
                    <div class="event-timestamp">
                      {formatDate(event.created_at)}
                    </div>
                  </div>
                </div>
                <div class="event-id">{event.id.slice(0, 8)}...</div>
              </div>

              <div
                class="event-content"
                innerHTML={formatContent(event.content)}
              />

              {event.author?.about && (
                <div class="author-about">{event.author.about}</div>
              )}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
