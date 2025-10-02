import { nip11, Relay } from "nostr-tools";
import type { Filter, NostrEvent } from "nostr-tools";
import type { IBackend } from "../backend-interface";
import {
  type Subscription,
  type StreamHandlers,
  Features,
} from "../../interface";
import { debug } from "../../common/debug";

export class LocalRelayBackend implements IBackend {
  private url: string;
  private relay: Relay | null = null;
  private connected = false;

  private requestId = 0;

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    this.relay = new Relay(this.url);
    await this.relay.connect();
    this.connected = true;
  }

  async close(): Promise<void> {
    if (!this.connected || !this.relay) return;

    await this.relay.close();
    this.relay = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.relay !== null;
  }

  /**
   * Add an event to the relay
   */
  async add(event: NostrEvent): Promise<boolean> {
    if (!this.relay) throw new Error("Relay not connected");

    try {
      await this.relay.publish(event);
      return true;
    } catch (error) {
      console.error("Failed to publish event to relay:", error);
      return false;
    }
  }

  /**
   * Get a single event by its ID
   */
  async event(_id: string): Promise<NostrEvent | undefined> {
    if (!this.relay) throw new Error("Relay not connected");

    // TODO: Implement relay-based event retrieval
    // This would typically involve querying the relay for the specific event
    throw new Error("Relay-based event not yet implemented");
  }

  /**
   * Get the latest replaceable event for a given kind, author, and optional identifier
   */
  async replaceable(
    _kind: number,
    _author: string,
    _identifier?: string,
  ): Promise<NostrEvent | undefined> {
    if (!this.relay) throw new Error("Relay not connected");

    // TODO: Implement relay-based replaceable event retrieval
    throw new Error("Relay-based replaceable not yet implemented");
  }

  /**
   * Count events matching the given filters
   */
  async count(filters: Filter[]): Promise<number> {
    if (!this.relay) throw new Error("Relay not connected");

    return this.relay!.count(filters, { id: String(this.requestId++) });
  }

  /**
   * Get events matching the given filters
   */
  filters(filters: Filter[], handlers?: StreamHandlers): Subscription {
    if (!this.relay) throw new Error("Relay not connected");

    let closed = false;

    const sub = this.relay.subscribe(filters, {
      onevent: (event) => {
        if (!closed && handlers?.event) {
          handlers.event(event);
        }
      },
      oneose: () => {
        if (!closed && handlers?.complete) {
          handlers.complete();
        }
      },
      onclose: () => {
        if (!closed && handlers?.complete) {
          handlers.complete();
        }
      },
    });

    return {
      close: () => {
        closed = true;
        sub.close();
      },
    };
  }

  /**
   * Subscribe to events in the relay based on filters
   */
  subscribe(filters: Filter[], handlers?: StreamHandlers): Subscription {
    return this.filters(filters, handlers);
  }

  /**
   * Check if the database backend supports features
   */
  async supports(): Promise<Features[]> {
    const supportedFeatures: Features[] = [Features.Subscribe]; // Always support subscriptions
    
    try {
      const info = await nip11.fetchRelayInformation(this.url);
      if (info.supported_nips.includes(50)) {
        supportedFeatures.push(Features.Search);
      }
    } catch (error) {
      // If we can't fetch relay info, we still support Subscribe
      debug("[LOCAL_RELAY] Could not fetch relay information:", error);
    }
    
    return supportedFeatures;
  }
}
