import { useEffect, useRef } from 'react';
import { onSocketEvent, type SocketEventName } from '../services/socketEvents';

/**
 * Refetch a page's data whenever the given real-time event fires.
 * Uses a ref so the latest refetch callback is always called without
 * re-subscribing on every render.
 *
 * Events are coalesced over `debounceMs`: a single status change creates
 * several notifications plus the package event, and operators often change
 * statuses back to back. Without coalescing every raw event became its own
 * round of HTTP requests, which is what exhausted the API rate-limit budget.
 */
export function useLiveRefresh(eventName: SocketEventName, refetch: () => void, debounceMs = 300) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = onSocketEvent(eventName, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        refetchRef.current();
      }, debounceMs);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [eventName, debounceMs]);
}
