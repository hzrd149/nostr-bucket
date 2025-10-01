import type { NostrEvent, Filter } from "nostr-tools";

export interface RelayInfo {
  url: string;
  name?: string;
  description?: string;
}

export interface TimelineEvent extends NostrEvent {
  author?: {
    name?: string;
    about?: string;
    picture?: string;
  };
}

// Generic type for a subscription
export type Subscription = {
  close: () => void;
} & AsyncIterable<NostrEvent>;

// Main interface for the nostr event store
export interface IWindowNostrEvents {
  /** Add an event to the database */
  add(event: NostrEvent): Promise<boolean>;

  /** Get a single event */
  event(id: string): Promise<NostrEvent | undefined>;

  /** Get the latest version of a replaceable event */
  replaceable(
    kind: number,
    author: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined>;

  /** Count the number of events matching a filter */
  count(filters: Filter[]): Promise<number>;

  /** Get events by filters */
  filters(filters: Filter[]): AsyncIterable<NostrEvent>;

  /** Search for events by query and filters */
  search?: (query: string, filters: Filter[]) => AsyncIterable<NostrEvent>;

  /** Subscribe to events in the database based on filters */
  subscribe(filters: Filter[]): Subscription;
}

// Extend window interface for nostrEvents API
declare global {
  interface Window {
    nostrEvents: IWindowNostrEvents;
  }
}
