import type { IWindowNostrEvents } from "./interface";

declare global {
  interface Window {
    nostrEvents: IWindowNostrEvents;
  }
}

export {};
