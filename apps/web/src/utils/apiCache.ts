/**
 * Shared purge for the service worker's authenticated API cache.
 *
 * Workbox caches GET /api/* responses in `api-cache` keyed by URL only — it
 * does NOT vary on the Authorization header — so entries written during one
 * user's session would be replayed to the next user while offline. Every
 * logout path calls clearApiCache() to delete them.
 *
 * API_CACHE_NAME must match the `cacheName` of the API runtime route in
 * apps/web/vite.config.ts (Workbox would otherwise derive its own name).
 */
export const API_CACHE_NAME = 'api-cache';

export function clearApiCache(): void {
  // CacheStorage is only exposed in secure contexts (HTTPS/localhost) and in
  // browser-like environments; guard so non-secure or non-DOM runs no-op.
  if (typeof caches === 'undefined') return;
  // Best-effort: a pending navigation (logout -> /login) can interrupt the
  // promise callbacks, but the deletion is issued before the page unloads.
  void caches.delete(API_CACHE_NAME);
}
