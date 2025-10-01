import {
  addEvents,
  countEventsForFilters,
  getEventsForFilters,
  getEventsFromAddressPointers,
} from "nostr-idb";
import type { Filter, NostrEvent } from "nostr-tools";
import getNostrIdb from "./idb";

/**
 * Get a single event by its ID
 */
export async function getEvent(id: string): Promise<NostrEvent | undefined> {
  const nostrIdb = await getNostrIdb();
  const tx = nostrIdb.transaction("events", "readonly");
  const store = tx.objectStore("events");
  const result = await store.get(id);
  return result?.event;
}

/**
 * Add a single event to the database
 */
export async function addEvent(event: NostrEvent): Promise<boolean> {
  const nostrIdb = await getNostrIdb();
  await addEvents(nostrIdb, [event]);
  return true;
}

/**
 * Get the latest replaceable event for a given kind, author, and optional identifier
 */
export async function getReplaceableEvent(
  kind: number,
  author: string,
  identifier?: string,
): Promise<NostrEvent | undefined> {
  const nostrIdb = await getNostrIdb();

  const events = await getEventsFromAddressPointers(nostrIdb, [
    { kind, pubkey: author, identifier },
  ]);

  // Return the latest event (highest created_at)
  if (events.length === 0) return undefined;
  return events.reduce((a, b) => (b.created_at > a.created_at ? b : a));
}

/**
 * Count events matching the given filters
 */
export async function countEvents(filters: Filter[]): Promise<number> {
  const nostrIdb = await getNostrIdb();

  return await countEventsForFilters(nostrIdb, filters);
}

/**
 * Get events matching the given filters as an async iterator
 */
export async function* getEventsByFilters(
  filters: Filter[],
): AsyncIterableIterator<NostrEvent> {
  const nostrIdb = await getNostrIdb();
  const events = await getEventsForFilters(nostrIdb, filters);

  for (const item of events) yield item;
}

/**
 * Search events by query string and filters as an async iterator
 */
export async function* searchEvents(
  query: string,
  filters: Filter[],
): AsyncIterableIterator<NostrEvent> {
  const searchLower = query.toLowerCase();

  const events = getEventsByFilters(filters);
  for await (let item of events) {
    if (item.content.toLowerCase().includes(searchLower)) yield item;
  }
}
