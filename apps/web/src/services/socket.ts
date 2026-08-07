import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Resolve the Socket.io server origin.
 *
 * VITE_API_URL is the REST base (e.g. "/api/v1" same-origin, or an absolute
 * API origin like "https://api.example.com"). Socket.io never mounts under the
 * REST `/api/v1` prefix — it lives at `/socket.io`. So:
 *   - relative VITE_API_URL ("/api/v1") -> same-origin socket at "/socket.io"
 *   - absolute URL ("https://api.example.com/api/v1") -> origin + "/socket.io"
 * Falls back to same-origin (empty string) when no API URL is configured.
 */
function resolveSocketUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  try {
    const url = new URL(apiUrl, window.location.origin);
    return url.origin;
  } catch {
    return '';
  }
}

/**
 * Connect to the Socket.io server.
 * If already connected, returns the existing socket.
 * Uses the API origin with the dedicated "/socket.io" path (not /api/v1),
 * which the Vite dev proxy and the production same-origin rewrite route
 * correctly.
 */
export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    // Already connected — no-op
    return socket;
  }

  // Clean up stale listeners before creating a new connection
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  const url = resolveSocketUrl();

  // --- Boot diagnostics (temporary) ---
  console.log('[socket] connecting to:', url || '(same-origin)', '| path: /socket.io');

  socket = io(url, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.debug('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.debug('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return socket;
}

/**
 * Disconnect and clean up the socket.
 * Call on logout or when no longer needed.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/**
 * Reconnect with a new token (e.g. after refresh).
 * Disconnects current socket and creates a new one with the fresh token.
 */
export function reconnectSocket(token: string): Socket | null {
  disconnectSocket();
  return connectSocket(token);
}

/**
 * Get the current socket instance (may be null if not connected).
 */
export function getSocket(): Socket | null {
  return socket;
}
