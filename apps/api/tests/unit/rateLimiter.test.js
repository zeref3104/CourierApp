/**
 * Rate limiter regression tests.
 *
 * Background: the production budget was 100 requests / 15 min keyed by IP and
 * counted CORS preflights. A single package status change costs several reads,
 * so changing ~6-7 statuses exhausted the window and the API answered 429 to
 * everything (including preflights, which browsers surface as opaque network
 * errors) for 15 minutes. These tests pin the fixed behaviour:
 *
 *   - OPTIONS preflights never consume budget;
 *   - the bucket is per authenticated user, not per shared NAT IP;
 *   - mutations and reads have independent buckets;
 *   - session refresh no longer shares the strict credential bucket.
 */

// Set before requiring config (dotenv never overrides an existing env var).
process.env.RATE_LIMIT_MAX = '10';
process.env.RATE_LIMIT_MUTATION_MAX = '2';
process.env.RATE_LIMIT_REFRESH_MAX = '5';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const config = require('../../src/config');
const {
  globalLimiter,
  mutationLimiter,
  refreshLimiter,
} = require('../../src/middlewares/rateLimiter');

function tokenFor(sub) {
  return `Bearer ${jwt.sign({ sub }, config.jwt.secret)}`;
}

function buildApp() {
  const app = express();
  app.use('/api/', globalLimiter);
  app.use('/api/', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return mutationLimiter(req, res, next);
    }
    next();
  });

  app.get('/api/ping', (_req, res) => res.json({ ok: true }));
  app.patch('/api/thing', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rate limiter', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    globalLimiter.resetKey('ip:::1');
    globalLimiter.resetKey('ip:127.0.0.1');
    globalLimiter.resetKey('ip:::ffff:127.0.0.1');
    globalLimiter.resetKey('user:user-a');
    globalLimiter.resetKey('user:user-b');
    mutationLimiter.resetKey('mut:user:user-a');
    mutationLimiter.resetKey('mut:ip:::1');
    mutationLimiter.resetKey('mut:ip:127.0.0.1');
    mutationLimiter.resetKey('mut:ip:::ffff:127.0.0.1');
    refreshLimiter.resetKey('ip:::1');
    refreshLimiter.resetKey('ip:127.0.0.1');
    refreshLimiter.resetKey('ip:::ffff:127.0.0.1');
  });

  test('OPTIONS preflights are never counted against the budget', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app).options('/api/ping');
      expect(res.status).not.toBe(429);
    }

    // Budget (3) untouched by the preflights above.
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).get('/api/ping').set('Authorization', tokenFor('user-a'));
      expect(res.status).toBe(200);
    }
  });

  test('blocks with 429 + RATE_LIMIT payload once the read budget is spent', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app).get('/api/ping').set('Authorization', tokenFor('user-a'));
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).get('/api/ping').set('Authorization', tokenFor('user-a'));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMIT');
  });

  test('each authenticated user gets an independent bucket (shared-NAT fix)', async () => {
    for (let i = 0; i < 10; i += 1) {
      await request(app).get('/api/ping').set('Authorization', tokenFor('user-a'));
    }
    const blockedA = await request(app).get('/api/ping').set('Authorization', tokenFor('user-a'));
    expect(blockedA.status).toBe(429);

    // Same IP, different user — must still be allowed.
    const userB = await request(app).get('/api/ping').set('Authorization', tokenFor('user-b'));
    expect(userB.status).toBe(200);
  });

  test('writes have their own bucket and do not consume the read budget', async () => {
    for (let i = 0; i < 2; i += 1) {
      const res = await request(app).patch('/api/thing').set('Authorization', tokenFor('user-a')).send({});
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).patch('/api/thing').set('Authorization', tokenFor('user-a')).send({});
    expect(blocked.status).toBe(429);

    // Reads for the same user are unaffected by exhausted writes.
    const read = await request(app).get('/api/ping').set('Authorization', tokenFor('user-a'));
    expect(read.status).toBe(200);
  });

  test('session refresh uses its own budget, independent from credential attempts', async () => {
    // Refresh lives behind its own limiter (not the strict auth bucket and not
    // the mutation bucket), so its ceiling is the only thing in play here.
    const refreshApp = express();
    refreshApp.post('/api/refresh', refreshLimiter, (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 5; i += 1) {
      const res = await request(refreshApp).post('/api/refresh');
      expect(res.status).toBe(200);
    }

    const blocked = await request(refreshApp).post('/api/refresh');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMIT');
  });

  test('a token with an invalid signature cannot mint a fresh bucket', async () => {
    // Exhaust the anonymous (IP) bucket with 10 plain reads.
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app).get('/api/ping');
      expect(res.status).toBe(200);
    }

    // Signed with a different secret: must NOT be trusted as `user:user-a`
    // (which would hand the caller a fresh, empty bucket).
    const forged = `Bearer ${jwt.sign({ sub: 'user-a' }, 'not-the-real-secret')}`;
    const res = await request(app).get('/api/ping').set('Authorization', forged);
    expect(res.status).toBe(429);
  });
});
