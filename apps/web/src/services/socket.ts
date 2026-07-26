import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Connect to the Socket.io server.
 * If already connected, returns the existing socket.
 * Use the same URL as the API (Vite proxy handles routing in dev).
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

  const url = import.meta.env.VITE_API_URL || '';

  socket = io(url, {
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
