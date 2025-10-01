import { MessageBusProvider } from "../common/bus";
import type { WindowRpcMethods } from "../interface";

// Create the typed message bus
const client = new MessageBusProvider<WindowRpcMethods>();

// Set the injected interface on the window object
window.nostrEvents = {
  event(id) {
    return client.call("event", id);
  },
  replaceable(kind, author, identifier) {
    return client.call("replaceable", kind, author, identifier);
  },
  count(filters) {
    return client.call("count", filters);
  },
  add(event) {
    return client.call("add", event);
  },
};
