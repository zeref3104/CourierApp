/**
 * Integration tests for the registration OTP endpoints at the HTTP level
 * (client-mobile-app task 2.9 / auth-specs delta + client-registration spec):
 * - POST /auth/client/otp/send    -> 200 (code generated, hashed, emailed),
 *   429 when a resend lands inside the 60s cooldown
 * - POST /auth/client/otp/verify  -> 200 correct code (single-use),
 *   422 wrong code (attempt counter increments), 422 lockout after the 5th
 *   failed attempt, 422 expired code
 *
 * OTP lives on the MASTER DB only (design D5), so this file uses a single
 * dedicated database courier_test_otp_master (distinct from every other
 * integration file so parallel workers never collide), dropped on setup and
 * torn down on exit.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const express = require('express');
const supertest = require('supertest');

// Capture the emailed OTP code so tests can submit the REAL code to verify.
let mockLastOtpCode = null;
jest.mock('../../src/services/notifications/email.service', () => ({
  sendOtpCode: jest.fn(async (email, code) => {
    mockLastOtpCode = code;
    return { messageId: 'captured' };
  }),
}));

const errorHandler = require('../../src/middlewares/errorHandler');
const authRoutes = require('../../src/modules/auth/auth.routes');

const TEST_MASTER_DB = 'courier_test_otp_master';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

let masterConnection;
let app;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Insert a fresh OTP doc directly with deterministic values (bypasses the
 *  60s send cooldown and the random code generator). Upserts so the
 *  previously-consumed doc for the same email is replaced. */
async function seedOtp(email, code, overrides = {}) {
  const OtpCode = masterConnection.model('OtpCode');
  return OtpCode.findOneAndUpdate(
    { key: `${email}:register` },
    {
      $set: {
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        cooldownUntil: new Date(Date.now() - 1000),
        verifiedAt: null,
        consumedAt: null,
        ...overrides,
      },
    },
    { upsert: true, new: true }
  );
}

beforeAll(async () => {
  masterConnection = await mongoose.createConnection(`${MONGO_URI}/${TEST_MASTER_DB}`).asPromise();

  await masterConnection.dropDatabase();

  masterConnection.model('OtpCode', require('../../src/models/master/OtpCode'));
  await masterConnection.model('OtpCode').init();

  app = express();
  app.use(express.json());
  app.locals.masterConnection = masterConnection;
  app.use('/auth', authRoutes);
  app.use(errorHandler);
});

beforeEach(async () => {
  mockLastOtpCode = null;
  await masterConnection.model('OtpCode').deleteMany({});
});

afterAll(async () => {
  await masterConnection.dropDatabase();
  await masterConnection.close();
});

describe('POST /auth/client/otp/send', () => {
  test('200: generates a 6-digit code, stores only its sha256 hash and emails it', async () => {
    const res = await supertest(app)
      .post('/auth/client/otp/send')
      .send({ email: 'otp-send@example.com', lang: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ sent: true, resendAfter: 60 });
    expect(mockLastOtpCode).toMatch(/^\d{6}$/);

    const otp = await masterConnection.model('OtpCode').findOne({ key: 'otp-send@example.com:register' });
    expect(otp).not.toBeNull();
    // Only the hash is persisted, never the plaintext code
    expect(otp.codeHash).toBe(sha256(mockLastOtpCode));
    expect(otp.codeHash).not.toBe(mockLastOtpCode);
    expect(otp.attempts).toBe(0);
  });

  test('429: a resend inside the 60s cooldown is rejected with TOO_MANY_REQUESTS', async () => {
    const first = await supertest(app)
      .post('/auth/client/otp/send')
      .send({ email: 'cooldown@example.com' });
    expect(first.status).toBe(200);

    const second = await supertest(app)
      .post('/auth/client/otp/send')
      .send({ email: 'cooldown@example.com' });

    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('POST /auth/client/otp/verify', () => {
  test('200: the correct code verifies and becomes single-use (verifiedAt)', async () => {
    await seedOtp('verify-ok@example.com', '123456');

    const res = await supertest(app)
      .post('/auth/client/otp/verify')
      .send({ email: 'verify-ok@example.com', code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ verified: true });

    const otp = await masterConnection.model('OtpCode').findOne({ key: 'verify-ok@example.com:register' });
    expect(otp.verifiedAt).toBeInstanceOf(Date);

    // Single-use: a second verify with the same code is rejected
    const again = await supertest(app)
      .post('/auth/client/otp/verify')
      .send({ email: 'verify-ok@example.com', code: '123456' });
    expect(again.status).toBe(422);
  });

  test('422: a wrong code increments the attempt counter and does not verify', async () => {
    await seedOtp('verify-wrong@example.com', '123456');

    const res = await supertest(app)
      .post('/auth/client/otp/verify')
      .send({ email: 'verify-wrong@example.com', code: '000000' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');

    const otp = await masterConnection.model('OtpCode').findOne({ key: 'verify-wrong@example.com:register' });
    expect(otp.attempts).toBe(1);
    expect(otp.verifiedAt).toBeNull();

    // The code itself is still valid — the correct code verifies afterwards
    const correct = await supertest(app)
      .post('/auth/client/otp/verify')
      .send({ email: 'verify-wrong@example.com', code: '123456' });
    expect(correct.status).toBe(200);
  });

  test('422: the 5th failed attempt invalidates the code (lockout)', async () => {
    // 4 failed attempts already on record
    await seedOtp('verify-locked@example.com', '123456', { attempts: 4 });

    const fifth = await supertest(app)
      .post('/auth/client/otp/verify')
      .send({ email: 'verify-locked@example.com', code: '000000' });
    expect(fifth.status).toBe(422);

    const otp = await masterConnection.model('OtpCode').findOne({ key: 'verify-locked@example.com:register' });
    expect(otp.attempts).toBe(5);

    // Even the CORRECT code is rejected after the lockout
    const afterLock = await supertest(app)
      .post('/auth/client/otp/verify')
      .send({ email: 'verify-locked@example.com', code: '123456' });
    expect(afterLock.status).toBe(422);
  });

  test('422: an expired code is rejected', async () => {
    await seedOtp('verify-expired@example.com', '123456', {
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await supertest(app)
      .post('/auth/client/otp/verify')
      .send({ email: 'verify-expired@example.com', code: '123456' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });
});
