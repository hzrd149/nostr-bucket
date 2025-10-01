# Nostr Bucket - Browser Extension

A Nostr-powered browser extension built with SolidJS and Vite, compatible with both Chrome and Firefox.

## Features

- **Popup Interface**: Clean, modern popup UI built with SolidJS
- **Content Script**: Injects indicators and interacts with web pages
- **Background Service Worker**: Handles extension lifecycle and messaging
- **Settings Storage**: Persistent settings using Chrome storage API
- **Cross-Browser**: Compatible with Chrome and Firefox

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
