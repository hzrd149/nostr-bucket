# Nostr Bucket - Browser Extension

A Nostr-powered browser extension that exposes a `window.nostrEvents` interface for interacting with Nostr events stored locally in the browser.

## Architecture

The extension consists of three main components:

### 1. Injected Script (`src/inject/index.ts`)

- Runs in the page context and exposes `window.nostrEvents`
- Implements the `IWindowNostrEvents` interface
- Communicates with content script via `window.postMessage`
- Handles both async methods and stream subscriptions
- Manages async iterators and event queues for streams

### 2. Content Script (`src/content/index.ts`)

- Runs in the content script context
- Relays messages between injected script and background script
- Uses `browser.runtime.sendMessage` to communicate with background
- Manages stream subscriptions and cleanup

### 3. Background Script (`src/background/index.ts`)

- Runs as a service worker
- Handles all database operations using IndexedDB
- Implements RPC methods for async operations
- Manages stream subscriptions and sends events back to content script
- Uses `nostr-idb` for Nostr event storage

## API

The extension exposes `window.nostrEvents` with the following interface:

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
  search(query: string, filters: Filter[]): AsyncIterable<NostrEvent>;
  subscribe(filters: Filter[]): Subscription;
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

## Project Structure

```
src/
├── App.tsx          # Main popup component
├── popup.tsx        # Popup entry point
├── content.ts       # Content script
├── background.ts    # Background service worker
└── App.css          # Popup styles

public/
└── manifest.json    # Extension manifest

popup.html           # Popup HTML template
```

## Extension Components

### Popup (`src/App.tsx`)

- Counter functionality
- Settings management
- Content script injection testing
- Chrome storage integration

### Content Script (`src/content.ts`)

- Page indicator injection
- Message handling from popup/background
- Auto-injection on page load

### Background Script (`src/background.ts`)

- Extension installation handling
- Settings storage management
- Message routing between components
- Tab update monitoring

## Development Notes

- The extension uses Manifest V3 (Chrome) / Manifest V2 (Firefox compatible)
- All Chrome APIs are properly typed with `@types/chrome`
- The popup is sized at 350x500px for optimal UX
- Content scripts run on all URLs (`<all_urls>`)
- Settings are stored using Chrome's sync storage API

## Building for Production

The build process:

1. Compiles TypeScript
2. Bundles with Vite
3. Copies manifest.json to dist folder
4. Creates separate entry points for popup, content, and background scripts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test in both Chrome and Firefox
5. Submit a pull request

## License

MIT License - see LICENSE file for details
