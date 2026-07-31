import { useEffect, useRef } from 'react';
import { onSocketEvent, type SocketEventName } from '../services/socketEvents';

/**
 * Refetch a page's data whenever the given real-time event fires.
 * Uses a ref so the latest refetch callback is always called without
 * re-subscribing on every render.
 */
export function useLiveRefresh(eventName: SocketEventName, refetch: () => void) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    return onSocketEvent(eventName, () => refetchRef.current());
  }, [eventName]);
}
