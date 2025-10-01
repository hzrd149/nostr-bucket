import { openDB } from "nostr-idb";

// Create an indexed db for events
let nostrIdb: Awaited<ReturnType<typeof openDB>> | null = null;

/** Get the nostr idb instance */
export async function getNostrIdb() {
  if (!nostrIdb) {
    nostrIdb = await openDB("nostr-bucket");
  }
  return nostrIdb;
}

export default getNostrIdb;
