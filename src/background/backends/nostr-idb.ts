import {
  addEvents,
  countEventsForFilters,
  getEventsForFilters,
  getEventsFromAddressPointers,
  openDB,
} from "nostr-idb";
import type { Filter, NostrEvent } from "nostr-tools";
import type { IBackend } from "../backend-interface";
import {
  type Subscription,
  type StreamHandlers,
  Features,
} from "../../interface";

export class NostrIdbBackend implements IBackend {
  private nostrIdb: Awaited<ReturnType<typeof openDB>> | null = null;
  private connected = false;

  async connect(): Promise<void> {
    if (this.connected) return;

    this.nostrIdb = await openDB("nostr-bucket");
    this.connected = true;
  }

  async close(): Promise<void> {
    if (!this.connected || !this.nostrIdb) return;

    this.nostrIdb.close();
    this.nostrIdb = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.nostrIdb !== null;
  }

  async getDb() {
    if (!this.nostrIdb) throw new Error("Database not connected");
    return this.nostrIdb;
  }

  /**
   * Add an event to the database
   */
  async add(event: NostrEvent): Promise<boolean> {
    const nostrIdb = await this.getDb();
    await addEvents(nostrIdb, [event]);
    return true;
  }

  /**
   * Get a single event by its ID
   */
  async event(id: string): Promise<NostrEvent | undefined> {
    const nostrIdb = await this.getDb();
    const tx = nostrIdb.transaction("events", "readonly");
    const store = tx.objectStore("events");
    const result = await store.get(id);
    return result?.event;
  }

  /**
   * Get the latest replaceable event for a given kind, author, and optional identifier
   */
  async replaceable(
    kind: number,
    author: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined> {
    const nostrIdb = await this.getDb();

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
  async count(filters: Filter[]): Promise<number> {
    const nostrIdb = await this.getDb();
    return await countEventsForFilters(nostrIdb, filters);
  }

  /**
   * Get events matching the given filters
   */
  filters(filters: Filter[], handlers?: StreamHandlers): Subscription {
    let closed = false;

    // For IndexedDB, we need to get all events synchronously
    // Since this is a local database, we can process them immediately
    const processEvents = async () => {
      try {
        const nostrIdb = await this.getDb();
        const events = await getEventsForFilters(nostrIdb, filters);

        for (const event of events) {
          if (closed) break;
          if (handlers?.event) {
            handlers.event(event);
          }
        }

        if (!closed && handlers?.complete) {
          handlers.complete();
        }
      } catch (error) {
        if (!closed && handlers?.error) {
          handlers.error(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      }
    };

    // Start processing immediately
    processEvents();

    return {
      close: () => {
        closed = true;
      },
    };
  }

  /**
   * Subscribe to events in the database based on filters
   * For IndexedDB, this is the same as filters since we don't have real-time updates
   */
  subscribe(filters: Filter[], handlers?: StreamHandlers): Subscription {
    return this.filters(filters, handlers);
  }

  /**
   * Check if the database backend supports features
   */
  async supports(): Promise<Features[]> {
    // IndexedDB doesn't support content search or real-time subscriptions
    return [];
  }
}
