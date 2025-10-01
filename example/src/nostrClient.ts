import { Relay, type NostrEvent } from "nostr-tools";
import type { TimelineEvent } from "./types";

export class NostrClient {
  private relay: Relay | null = null;
  private isConnected = false;

  async connect(relayUrl: string): Promise<void> {
    try {
      this.relay = new Relay(relayUrl);
      await this.relay.connect();
      this.isConnected = true;
    } catch (error) {
      console.error("Failed to connect to relay:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.relay && this.isConnected) {
      this.relay.close();
      this.relay = null;
      this.isConnected = false;
    }
  }

  async subscribeToTimeline(
    callback: (event: TimelineEvent) => void,
  ): Promise<void> {
    if (!this.relay || !this.isConnected) {
      throw new Error("Not connected to relay");
    }

    this.relay.subscribe(
      [
        {
          kinds: [1], // Kind 1 events (text notes)
          limit: 100,
        },
      ],
      {
        onevent: async (event: NostrEvent) => {
          // Cache the event using window.nostrEvents API
          if (window.nostrEvents) {
            await window.nostrEvents.add(event);
          }

          // Try to get author metadata if available
          const timelineEvent: TimelineEvent = {
            ...event,
            author: await this.getAuthorMetadata(event.pubkey),
          };

          callback(timelineEvent);
        },
        oneose: () => {
          console.log("End of stored events");
        },
      },
    );
  }

  private async getAuthorMetadata(
    pubkey: string,
  ): Promise<TimelineEvent["author"]> {
    // First try to get from cache
    if (window.nostrEvents) {
      try {
        const cachedProfile = await window.nostrEvents.replaceable(0, pubkey);
        if (cachedProfile) {
          try {
            const metadata = JSON.parse(cachedProfile.content);
            return {
              name: metadata.name,
              about: metadata.about,
              picture: metadata.picture,
            };
          } catch (error) {
            console.error("Failed to parse cached metadata:", error);
          }
        }
      } catch (error) {
        console.error("Failed to get cached profile:", error);
      }
    }

    // If not in cache or cache failed, fetch from relay
    if (!this.relay || !this.isConnected) {
      return undefined;
    }

    try {
      return new Promise((resolve) => {
        const events: NostrEvent[] = [];

        this.relay!.subscribe(
          [
            {
              kinds: [0], // Kind 0 events (metadata)
              authors: [pubkey],
              limit: 1,
            },
          ],
          {
            onevent: async (event: NostrEvent) => {
              events.push(event);

              // Cache the profile event
              if (window.nostrEvents) {
                try {
                  await window.nostrEvents.add(event);
                } catch (error) {
                  console.error("Failed to cache profile event:", error);
                }
              }
            },
            oneose: () => {
              if (events.length > 0) {
                try {
                  const metadata = JSON.parse(events[0].content);
                  resolve({
                    name: metadata.name,
                    about: metadata.about,
                    picture: metadata.picture,
                  });
                } catch (error) {
                  console.error("Failed to parse metadata:", error);
                  resolve(undefined);
                }
              } else {
                resolve(undefined);
              }
            },
          },
        );
      });
    } catch (error) {
      console.error("Failed to fetch author metadata:", error);
      return undefined;
    }
  }

  async loadCachedProfilesForEvents(
    events: TimelineEvent[],
  ): Promise<TimelineEvent[]> {
    if (!window.nostrEvents) {
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
        const cachedProfile = await window.nostrEvents.replaceable(
          0,
          event.pubkey,
        );
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
  }

  isConnectedToRelay(): boolean {
    return this.isConnected;
  }
}
