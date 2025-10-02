# Nostr Bucket - Browser Extension

A Nostr-powered browser extension that implements the [NIP-DB specification](nip.md) by injecting a `window.nostrdb` interface into every browser tab, allowing web applications to interact with Nostr events stored locally in the browser.

## NIP-DB Implementation

This extension implements the NIP-DB specification, providing a standardized interface for browser-based Nostr event storage. The specification defines a common API that browser extensions can implement to provide Nostr event storage services to web applications.

## Injected Interface

The extension automatically injects the `IWindowNostrDB` interface (defined in `src/interface.ts`) into every browser tab, making it available as `window.nostrdb`. This interface provides a complete Nostr event store API that web applications can use directly.

## API Reference

The injected `window.nostrdb` interface provides the following methods:

```typescript
interface IWindowNostrDB {
  /** Add an event to the database */
  add(event: NostrEvent): Promise<boolean>;

  /** Get a single event */
  event(id: string): Promise<NostrEvent | undefined>;

  /** Get the latest version of a replaceable event */
  replaceable(
    kind: number,
    author: string,
    identifier?: string,
  ): Promise<NostrEvent | undefined>;

  /** Count the number of events matching a filter */
  count(filters: Filter[]): Promise<number>;

  /** Check if the database backend supports features */
  supports(): Promise<Features[]>;

  /** Get events by filters */
  filters(filters: Filter[], handlers?: StreamHandlers): Subscription;

  /** Subscribe to events in the database based on filters */
  subscribe(filters: Filter[], handlers?: StreamHandlers): Subscription;
}
```

### Supporting Types

```typescript
/** Generic type for a subscription */
type Subscription = {
  close: () => void;
};

type StreamHandlers = {
  event?: (event: NostrEvent) => void;
  error?: (error: Error) => void;
  complete?: () => void;
};

/** Standard enums for feature checks */
enum Features {
  Search = "search",
  Subscribe = "subscribe",
}
```

### Feature Detection

The `supports()` method allows web applications to check for optional features:

- `"search"` - NIP-50 full-text search capabilities
- `"subscribe"` - Real-time subscription support

### Usage Examples

#### Basic Event Operations

```javascript
// Add an event
const success = await window.nostrdb.add(nostrEvent);

// Get a specific event
const event = await window.nostrdb.event(eventId);

// Get latest replaceable event
const profile = await window.nostrdb.replaceable(0, pubkey);

// Count events
const count = await window.nostrdb.count([{ kinds: [1] }]);
```

#### Streaming Events

```javascript
// Stream events with handlers
const subscription = window.nostrdb.filters([{ kinds: [1] }], {
  event: (event) => console.log("New event:", event),
  error: (error) => console.error("Stream error:", error),
  complete: () => console.log("Stream complete"),
});

// Clean up subscription
subscription.close();
```

#### Feature Detection

```javascript
// Get all supported features
const supportedFeatures = await window.nostrdb.supports();

// Check for search support
if (supportedFeatures.includes("search")) {
  // Use search functionality
}

// Check for subscription support
if (supportedFeatures.includes("subscribe")) {
  // Use real-time subscriptions
}
```

## Features

- ✅ NIP-DB specification compliant
- ✅ Async methods (add, event, replaceable, count)
- ✅ Stream methods with handler-based subscriptions (filters, subscribe)
- ✅ Feature detection via supports() method
- ✅ Proper error handling and cleanup
- ✅ TypeScript support
- ✅ IndexedDB storage using nostr-idb
- ✅ Cross-tab communication
- ✅ Stream subscription management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure compliance with the [NIP-DB specification](nip.md)
5. Test in both Chrome and Firefox
6. Submit a pull request

## License

MIT License - see LICENSE file for details
