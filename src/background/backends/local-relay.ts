import type { UpstreamPool } from "applesauce-loaders";
import {
  createAddressLoader,
  createEventLoader,
  type AddressPointerLoader,
  type EventPointerLoader,
} from "applesauce-loaders/loaders";
import { onlyEvents, Relay } from "applesauce-relay";
import type { Filter, NostrEvent } from "nostr-tools";
import { defaultIfEmpty, firstValueFrom, lastValueFrom, scan } from "rxjs";
import { debug } from "../../common/debug";
import {
  Features,
  type StreamHandlers,
  type Subscription,
} from "../../interface";
import type { IBackend } from "../backend-interface";

export class LocalRelayBackend implements IBackend {
  private relay: Relay;
  private eventLoader: EventPointerLoader;
  private addressLoader: AddressPointerLoader;

  connected = false;

  constructor(url: string) {
    this.relay = new Relay(url);

    const upstream: UpstreamPool = (_relays, filters) =>
      this.relay.request(filters);
    this.eventLoader = createEventLoader(upstream, {
      bufferTime: 500,
    });
    this.addressLoader = createAddressLoader(upstream, {
      bufferTime: 500,
    });
  }

  async connect(): Promise<void> {
    // Check if relay in available
    const info = await this.relay.getInformation();
    if (!info) throw new Error("Failed to get relay information");
    console.log("Local relay information:", info);

    this.connected = true;
  }

  async close(): Promise<void> {
    this.relay.close();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /** Add an event to the relay */
  async add(event: NostrEvent): Promise<boolean> {
    const res = await this.relay.publish(event);
    return res.ok;
  }

  /** Get a single event by its ID */
  async event(id: string): Promise<NostrEvent | undefined> {
    return await lastValueFrom(
      this.eventLoader({ id }).pipe(defaultIfEmpty(undefined)),
    );
  }

  /** Get the latest replaceable event for a given kind, author, and optional identifier */
  async replaceable(
    kind: number,
    pubkey: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined> {
    return await firstValueFrom(
      this.addressLoader({ kind, pubkey: pubkey, identifier }).pipe(
        defaultIfEmpty(undefined),
      ),
    );
  }

  /** Count events matching the given filters */
  async count(filters: Filter[]): Promise<number> {
    // TODO: using .request here because applesauce-relay does not support count() yet
    return await lastValueFrom(
      this.relay
        .request(filters)
        .pipe(
          onlyEvents(),
          scan((acc, _e) => acc + 1, 0),
        )
        .pipe(defaultIfEmpty(0)),
    );
  }

  /** Get events matching the given filters */
  filters(filters: Filter[], handlers: StreamHandlers): Subscription {
    const sub = this.relay.request(filters).pipe(onlyEvents()).subscribe({
      next: handlers.event,
      error: handlers.error,
      complete: handlers.complete,
    });
    return { close: () => sub.unsubscribe() };
  }

  /**
   * Subscribe to events in the relay based on filters
   */
  subscribe(filters: Filter[], handlers: StreamHandlers): Subscription {
    const sub = this.relay.subscription(filters).pipe(onlyEvents()).subscribe({
      next: handlers.event,
      error: handlers.error,
      complete: handlers.complete,
    });
    return { close: () => sub.unsubscribe() };
  }

  /**
   * Check if the database backend supports features
   */
  async supports(): Promise<Features[]> {
    const supportedFeatures: Features[] = [Features.Subscribe]; // Always support subscriptions

    try {
      const info = await this.relay.getInformation();
      if (info?.supported_nips.includes(50))
        supportedFeatures.push(Features.Search);
    } catch (error) {
      // If we can't fetch relay info, we still support Subscribe
      debug("[LOCAL_RELAY] Could not fetch relay information:", error);
    }

    return supportedFeatures;
  }
}
