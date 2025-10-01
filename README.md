# Nostr Bucket - Browser Extension

A Nostr-powered browser extension that injects a `window.nostrEvents` interface into every browser tab, allowing web applications to interact with Nostr events stored locally in the browser.

## Injected Interface

The extension automatically injects the `IWindowNostrEvents` interface (defined in `src/interface.ts`) into every browser tab, making it available as `window.nostrEvents`. This interface provides a complete Nostr event store API that web applications can use directly.

## API Reference

The injected `window.nostrEvents` interface provides the following methods:

```typescript
interface IWindowNostrEvents {
  // Async methods
  add(event: NostrEvent): Promise<boolean>;
  event(id: string): Promise<NostrEvent | undefined>;
  replaceable(
    kind: number,
    author: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined>;
  count(filters: Filter[]): Promise<number>;

  // Stream methods
  filters(filters: Filter[]): AsyncIterable<NostrEvent>;
  search?(query: string, filters: Filter[]): AsyncIterable<NostrEvent>;
  subscribe?(filters: Filter[]): Subscription;
}
```

**Note**: The `search` and `subscribe` methods are optional and may not be available depending on the underlying database's capabilities. Always check for their presence before using them.

### Usage Example

```javascript
// Add an event to the store
await window.nostrEvents.add(nostrEvent);

// Get a specific event
const event = await window.nostrEvents.event(eventId);

// Stream events matching filters
for await (const event of window.nostrEvents.filters([{ kinds: [1] }])) {
  console.log("New note:", event);
}

// Subscribe to real-time updates (if available)
if (window.nostrEvents.subscribe) {
  const subscription = window.nostrEvents.subscribe([{ kinds: [1] }]);
  for await (const event of subscription) {
    console.log("Live note:", event);
  }
}

// Search events (if available)
if (window.nostrEvents.search) {
  for await (const event of window.nostrEvents.search("bitcoin", [
    { kinds: [1] },
  ])) {
    console.log("Search result:", event);
  }
}
```

## Features

- ✅ Async methods (add, event, replaceable, count)
- ✅ Stream methods (filters, search, subscribe)
- ✅ Proper error handling and cleanup
- ✅ TypeScript support
- ✅ IndexedDB storage using nostr-idb
- ✅ Cross-tab communication
- ✅ Stream subscription management

## Development

### Prerequisites

- Node.js (v16 or higher)
- pnpm (recommended) or npm

### Setup

1. Install dependencies:

```bash
pnpm install
```

2. Start development server:

```bash
pnpm dev
```

3. Build the extension:

```bash
pnpm build:extension
```

## Installation

### Chrome

1. Build the extension:

```bash
pnpm build:extension
```

2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `dist` folder
5. The extension should now appear in your extensions list

### Firefox

1. Build the extension:

```bash
pnpm build:extension
```

2. Open Firefox and go to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from the `dist` folder

### Package for Distribution

Create distribution packages:

```bash
# For Chrome Web Store
pnpm package:chrome

# For Firefox Add-ons
pnpm package:firefox
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test in both Chrome and Firefox
5. Submit a pull request

## License

MIT License - see LICENSE file for details
