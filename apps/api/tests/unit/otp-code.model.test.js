/**
 * Unit tests for the master OtpCode model (client-registration spec, design D5):
 * - key: unique `${email}:register` identifier (single OTP per email+purpose)
 * - codeHash: sha256 hex of the plaintext code (never stored plaintext)
 * - expiresAt: TTL index (Mongo deletes the doc once the code expires)
 * - attempts: failed-verify counter, defaults to 0
 * - cooldownUntil / verifiedAt / consumedAt: resend + single-use markers
 */
const mongoose = require('mongoose');
const otpCodeSchema = require('../../src/models/master/OtpCode');

describe('OtpCode model', () => {
  test('declares a required unique key path (email:purpose)', () => {
    const key = otpCodeSchema.path('key');
    expect(key).toBeDefined();
    expect(key.instance).toBe('String');
    expect(key.isRequired).toBeTruthy();
  });

  test('registers a unique index on key', () => {
    const indexes = otpCodeSchema.indexes();
    const idx = indexes.find(([fields]) =>
      Object.prototype.hasOwnProperty.call(fields, 'key')
    );
    expect(idx).toBeDefined();
    expect(idx[1].unique).toBe(true);
  });

  test('declares a required codeHash String path (sha256)', () => {
    const codeHash = otpCodeSchema.path('codeHash');
    expect(codeHash).toBeDefined();
    expect(codeHash.instance).toBe('String');
    expect(codeHash.isRequired).toBeTruthy();
  });

  test('declares an expiresAt Date path with a TTL index', () => {
    const expiresAt = otpCodeSchema.path('expiresAt');
    expect(expiresAt).toBeDefined();
    expect(expiresAt.instance).toBe('Date');
    expect(expiresAt.isRequired).toBeTruthy();

    const indexes = otpCodeSchema.indexes();
    const idx = indexes.find(([fields]) =>
      Object.prototype.hasOwnProperty.call(fields, 'expiresAt')
    );
    expect(idx).toBeDefined();
    expect(idx[1].expireAfterSeconds).toBe(0);
  });

  test('declares an attempts Number path defaulting to 0', () => {
    const attempts = otpCodeSchema.path('attempts');
    expect(attempts).toBeDefined();
    expect(attempts.instance).toBe('Number');
    expect(attempts.defaultValue).toBe(0);
  });

  test('declares cooldownUntil, verifiedAt and consumedAt Date paths', () => {
    for (const pathName of ['cooldownUntil', 'verifiedAt', 'consumedAt']) {
      const path = otpCodeSchema.path(pathName);
      expect(path).toBeDefined();
      expect(path.instance).toBe('Date');
    }
  });
});
