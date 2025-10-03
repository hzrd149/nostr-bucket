import { NostrIDB, openDB } from "nostr-idb";
import type { IBackend } from "../backend-interface";

export class NostrIdbBackend extends NostrIDB implements IBackend {
  private connected = false;

  async connect(): Promise<void> {
    if (this.connected) return;

    const db = await openDB("nostr-bucket");
    // Set the database and start
    this.db = db;
    await this.start();
    this.connected = true;
  }

  async close(): Promise<void> {
    if (!this.connected) return;

    await this.stop();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.running;
  }
}
