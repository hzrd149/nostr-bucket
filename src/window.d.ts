import type { IWindowNostrDB } from "./interface";

declare global {
  interface Window {
    nostrdb: IWindowNostrDB;
  }
}

export {};
