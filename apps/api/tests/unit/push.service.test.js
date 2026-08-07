/**
 * Unit tests for push.service.js (client-mobile-app task 4.2, design D12):
 * - no-op for an empty token list (SDK never instantiated, nothing sent)
 * - one ExpoPushMessage per token with {to, title, body, data, sound:'default'}
 * - messages are chunked by PUSH_CHUNK_SIZE (~100) and each chunk sent
 * - per-chunk send failure is counted and tolerated (best-effort, D13)
 *
 * The SDK is injected as the `Expo` option so the tests are deterministic and
 * never hit the real Expo Push Service (network-free unit layer).
 */
const { sendPush, buildPushMessages, chunkMessages } = require('../../src/services/notifications/push.service');
const PUSH_CHUNK_SIZE = 100;

/** Build a controllable fake Expo class that records the batches it sends. */
function makeMockExpo() {
  const instances = [];
  class MockExpo {
    constructor() {
      this.sentBatches = [];
      instances.push(this);
    }
    async sendPushNotificationsAsync(messages) {
      this.sentBatches.push(messages);
      return messages.map((m) => ({ status: 'ok', id: `ticket-${m.to}` }));
    }
  }
  return { MockExpo, instances };
}

const payload = {
  title: 'Paquete disponible',
  body: 'Tu paquete está listo para recoger',
  data: { type: 'package_status', packageId: 'p1', trackingNumber: 'CPR-1', status: 'disponible', companySlug: 'rapid-box' },
};

describe('sendPush', () => {
  test('no-op for an empty token list: returns zeros and never constructs the SDK', async () => {
    const { MockExpo, instances } = makeMockExpo();

    const result = await sendPush([], payload, { Expo: MockExpo });

    expect(result).toEqual({ sent: 0, failed: 0, chunks: 0 });
    expect(instances).toHaveLength(0); // SDK never loaded/constructed
  });

  test('sends one ExpoPushMessage per token with title/body/data/sound', async () => {
    const { MockExpo, instances } = makeMockExpo();

    const result = await sendPush(['ExponentPushToken[a]', 'ExponentPushToken[b]'], payload, {
      Expo: MockExpo,
    });

    expect(result).toEqual({ sent: 2, failed: 0, chunks: 1 });
    expect(instances).toHaveLength(1);
    const batch = instances[0].sentBatches[0];
    expect(batch).toHaveLength(2);
    expect(batch[0]).toEqual({
      to: 'ExponentPushToken[a]',
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: 'default',
    });
  });

  test('chunks 250 tokens into 3 batches of ~100 and counts all sends', async () => {
    const { MockExpo, instances } = makeMockExpo();
    const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[t${i}]`);

    const result = await sendPush(tokens, payload, { Expo: MockExpo });

    expect(result.sent).toBe(250);
    expect(result.failed).toBe(0);
    expect(result.chunks).toBe(3);
    const batchSizes = instances[0].sentBatches.map((b) => b.length);
    expect(batchSizes).toEqual([100, 100, 50]);
  });

  test('tolerates a failing chunk: counts failures, sends the rest, does not throw', async () => {
    let call = 0;
    class FailingExpo {
      constructor() {
        this.sentBatches = [];
      }
      async sendPushNotificationsAsync(messages) {
        call += 1;
        if (call === 1) throw new Error('Expo API unavailable');
        this.sentBatches.push(messages);
        return messages.map(() => ({ status: 'ok', id: 'ticket' }));
      }
    }

    const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[t${i}]`);
    const result = await sendPush(tokens, payload, { Expo: FailingExpo });

    // first chunk (100) failed, the remaining 150 succeeded
    expect(result.sent).toBe(150);
    expect(result.failed).toBe(100);
    expect(result.chunks).toBe(3);
  });
});

describe('pure helpers', () => {
  test('buildPushMessages maps tokens + payload into Expo messages (sound default)', () => {
    const messages = buildPushMessages(['ExponentPushToken[a]', 'ExponentPushToken[b]'], payload);
    expect(messages).toHaveLength(2);
    expect(messages[0].sound).toBe('default');
    expect(messages[0].to).toBe('ExponentPushToken[a]');
    expect(messages[1].to).toBe('ExponentPushToken[b]');
  });

  test('chunkMessages splits by size and returns [] for empty input', () => {
    const items = Array.from({ length: 250 }, (_, i) => ({ to: i }));
    const chunks = chunkMessages(items, PUSH_CHUNK_SIZE);
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50]);

    expect(chunkMessages([], PUSH_CHUNK_SIZE)).toEqual([]);
  });
});