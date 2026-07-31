export type SocketEventName =
  | 'socket:packages-changed'
  | 'socket:payments-changed'
  | 'socket:deliveries-changed'
  | 'socket:notifications-changed';

/**
 * Emit a real-time data-change event. useSocket() translates raw socket.io
 * events into these app-level events; pages subscribe with onSocketEvent
 * while mounted and refetch their current view.
 */
export function emitSocketEvent(name: SocketEventName, detail?: unknown): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/**
 * Subscribe to a data-change event. Returns an unsubscribe function for
 * useEffect cleanup.
 */
export function onSocketEvent(name: SocketEventName, handler: (detail?: any) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
