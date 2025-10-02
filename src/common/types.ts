import type { Filter, NostrEvent } from "nostr-tools";

// RPC method parameter types
export type AddParams = [NostrEvent];
export type EventParams = [string];
export type ReplaceableParams = [number, string, string?];
export type CountParams = [Filter[]];
export type FiltersParams = [Filter[]];
export type SearchParams = [string, Filter[]];
export type SubscribeParams = [Filter[]];
export type CloseStreamParams = [string];
export type SetBackendParams = ["idb" | "relay"];
export type GetBackendParams = [];
export type GetBackendStatusParams = [];
export type ReconnectBackendsParams = [];
export type IsBackendConnectedParams = [];
export type GetBackendsParams = [];
export type SupportsParams = [string];

// Union type for all possible parameter arrays
export type RpcParams =
  | AddParams
  | EventParams
  | ReplaceableParams
  | CountParams
  | FiltersParams
  | SearchParams
  | SubscribeParams
  | CloseStreamParams
  | SetBackendParams
  | GetBackendParams
  | GetBackendStatusParams
  | ReconnectBackendsParams
  | IsBackendConnectedParams
  | GetBackendsParams
  | SupportsParams;

// Message types for communication between scripts
export interface BaseMessage {
  id: string;
  ext: "nostr-bucket";
}

export interface RequestMessage extends BaseMessage {
  type: "request";
  method: string;
  params: RpcParams;
}

export interface ResponseMessage extends BaseMessage {
  type: "response";
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface StreamMessage extends BaseMessage {
  type: "stream";
  streamId: string;
  event?: NostrEvent;
  done?: boolean;
  error?: string;
}

// RPC method names
export type RpcMethod =
  | "add"
  | "event"
  | "replaceable"
  | "count"
  | "filters"
  | "search"
  | "subscribe"
  | "close_stream"
  | "set_backend"
  | "get_backend"
  | "get_backend_status"
  | "reconnect_backends"
  | "is_backend_connected"
  | "get_backends"
  | "supports";

// Stream subscription management
export interface StreamSubscription {
  id: string;
  method: "filters" | "search" | "subscribe";
  params: FiltersParams | SearchParams | SubscribeParams;
  active: boolean;
}

// Background script message types
export interface BackgroundRequest {
  type: "rpc";
  method: RpcMethod;
  params: RpcParams;
  streamId?: string;
  host: string;
  // Legacy fields for popup
  action?: string;
  settings?: Record<string, unknown>;
}

export interface BackgroundResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface BackgroundStreamEvent {
  type: "stream";
  streamId: string;
  event?: NostrEvent;
  done?: boolean;
  error?: string;
}
