import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { connectSocket, disconnectSocket, reconnectSocket } from '../services/socket';
import { setSocketConnected } from '../store/slices/uiSlice';
import { incrementUnread } from '../store/slices/notificationSlice';
import { emitSocketEvent } from '../services/socketEvents';

/**
 * Socket lifecycle hook.
 *
 * Connects to Socket.io when authenticated, disconnects on logout,
 * and reconnects when the access token is refreshed.
 *
 * Listens for real-time events and dispatches Redux actions accordingly.
 * Place this once at a layout or App level — do NOT call it in every page.
 */
export function useSocket() {
  const dispatch = useDispatch();
  const { isAuthenticated, accessToken, user } = useSelector(
    (state: RootState) => state.auth
  );
  const prevToken = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      // Not authenticated — ensure we're disconnected
      if (prevToken.current) {
        disconnectSocket();
        dispatch(setSocketConnected(false));
        prevToken.current = null;
      }
      return;
    }

    // Token changed or first connect
    if (accessToken !== prevToken.current) {
      prevToken.current = accessToken;

      if (accessToken) {
        const socket = reconnectSocket(accessToken);

        if (socket) {
          socket.on('connect', () => {
            dispatch(setSocketConnected(true));
          });

          socket.on('disconnect', () => {
            dispatch(setSocketConnected(false));
          });

          // --- Package events ---
          socket.on('package:created', (data) => {
            console.debug('[Socket] package:created', data);
            emitSocketEvent('socket:packages-changed');
          });

          socket.on('package:status_changed', (data) => {
            console.debug('[Socket] package:status_changed', data);
            emitSocketEvent('socket:packages-changed');
          });

          // --- Payment events ---
          socket.on('payment:received', (data) => {
            console.debug('[Socket] payment:received', data);
            emitSocketEvent('socket:payments-changed');
          });

          // --- Delivery events ---
          socket.on('delivery:completed', (data) => {
            console.debug('[Socket] delivery:completed', data);
            emitSocketEvent('socket:deliveries-changed');
          });

          // --- Notification events (from server push) ---
          socket.on('notification:new', (data) => {
            console.debug('[Socket] notification:new', data);
            dispatch(incrementUnread());
            emitSocketEvent('socket:notifications-changed');
          });
        }
      }
    }

    return () => {
      // Don't disconnect on cleanup — the hook may remount.
      // Disconnect only when isAuthenticated becomes false (logout).
    };
  }, [isAuthenticated, accessToken, dispatch, user?.role]);
}
