const logger = require('../../logs/logger');

/**
 * Push notification service (push-notifications spec, design D12/D13).
 *
 * Sends push notifications through the Expo Push Service via `expo-server-sdk`.
 * The SDK is v6+, which is ESM-only; this API is CommonJS, so the module is
 * loaded with a DYNAMIC `import()` inside the send path instead of `require()`
 * (a top-level require would throw ERR_REQUIRE_ESM). The Expo class can also
 * be injected as an option for deterministic unit testing.
 *
 * Delivery is best-effort: a failing chunk is logged and counted, never
 * rethrown, so a push outage can never fail the package/notification flow.
 */

/** Expo accepts ~100 messages per request; chunking keeps every send legal. */
const PUSH_CHUNK_SIZE = 100;

/** Resolve the ESM-only expo-server-sdk via dynamic import() (CJS-safe, D12). */
async function loadExpo() {
  const mod = await import('expo-server-sdk');
  return mod.default || mod;
}

/**
 * Map tokens + payload into ExpoPushMessage objects. Pure.
 * Payload shape follows the push-notifications spec:
 * { to, title, body, data, sound: 'default' } under the 4 KB data limit.
 */
function buildPushMessages(tokens, { title, body, data } = {}) {
  return tokens.map((to) => ({ to, title, body, data, sound: 'default' }));
}

/** Split items into chunks of `size`. Pure. */
function chunkMessages(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Send a push notification to the given tokens.
 *
 * @param {string[]} tokens - Expo push tokens (ExponentPushToken[...]).
 * @param {{title?: string, body?: string, data?: object}} payload
 * @param {{Expo?: Function}} [options] - injectable Expo class (tests) or the
 *   real one resolved from the SDK via dynamic import().
 * @returns {Promise<{sent: number, failed: number, chunks: number}>}
 */
async function sendPush(tokens, payload = {}, options = {}) {
  const tokensArray = Array.isArray(tokens) ? tokens : [];
  if (tokensArray.length === 0) {
    // No-op: never load the SDK, never touch the network (spec: no tokens -> no push).
    return { sent: 0, failed: 0, chunks: 0 };
  }

  const ExpoClient = options.Expo || (await loadExpo());
  const client = new ExpoClient();
  const messages = buildPushMessages(tokensArray, payload);
  const chunks = chunkMessages(messages, PUSH_CHUNK_SIZE);

  let sent = 0;
  let failed = 0;

  for (const batch of chunks) {
    try {
      const tickets = await client.sendPushNotificationsAsync(batch);
      for (const ticket of tickets || []) {
        if (ticket && ticket.status === 'ok') sent += 1;
        else failed += 1;
      }
    } catch (err) {
      // Best-effort (D13): one bad chunk must not kill the flow or the rest.
      failed += batch.length;
      logger.error('Push chunk send failed (%d messages): %s', batch.length, err.message);
    }
  }

  return { sent, failed, chunks: chunks.length };
}

module.exports = { sendPush, loadExpo, buildPushMessages, chunkMessages, PUSH_CHUNK_SIZE };
