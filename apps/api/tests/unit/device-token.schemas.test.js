/**
 * Unit tests for slice 4 device-token constants + validation schema
 * (client-mobile-app task 4.1, push-notifications spec + design D11):
 * - constants: DEVICE_PLATFORMS (android | ios), PUSH_TOKEN_PATTERN (Expo format)
 * - deviceTokenSchema: accepts {token, platform}; rejects non-Expo tokens (422)
 */
const { DEVICE_PLATFORMS, PUSH_TOKEN_PATTERN } = require('@courier/constants');
const { deviceTokenSchema } = require('@courier/validation');

describe('DEVICE_PLATFORMS constant', () => {
  test('exposes exactly the android | ios platforms', () => {
    expect(DEVICE_PLATFORMS).toEqual(['android', 'ios']);
  });
});

describe('PUSH_TOKEN_PATTERN constant', () => {
  const pattern = new RegExp(PUSH_TOKEN_PATTERN);

  test('matches ExponentPushToken[...] with a base64url-safe payload', () => {
    expect(pattern.test('ExponentPushToken[AbC123_-xYz789]')).toBe(true);
    expect(
      pattern.test(
        'ExponentPushToken[abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-]'
      )
    ).toBe(true);
  });

  test('rejects non-Expo and malformed tokens', () => {
    expect(pattern.test('ExpoPushToken[abc]')).toBe(false); // wrong prefix
    expect(pattern.test('ExponentPushToken[]')).toBe(false); // empty payload
    expect(pattern.test('ExponentPushToken[abc def]')).toBe(false); // space inside
    expect(pattern.test('fcm:APA91bToken123')).toBe(false); // FCM token
    expect(pattern.test('12345')).toBe(false); // arbitrary string
  });
});

describe('deviceTokenSchema', () => {
  const validToken = 'ExponentPushToken[AbC123_-xYz789]';

  test('accepts a valid Expo token on android', () => {
    const result = deviceTokenSchema.safeParse({ token: validToken, platform: 'android' });
    expect(result.success).toBe(true);
  });

  test('accepts a valid Expo token on ios', () => {
    const result = deviceTokenSchema.safeParse({ token: validToken, platform: 'ios' });
    expect(result.success).toBe(true);
  });

  test('rejects a non-Expo token (spec: non-Expo token rejected 422)', () => {
    const result = deviceTokenSchema.safeParse({ token: 'fcm:APA91bToken123', platform: 'android' });
    expect(result.success).toBe(false);
  });

  test('rejects an unknown platform', () => {
    const result = deviceTokenSchema.safeParse({ token: validToken, platform: 'web' });
    expect(result.success).toBe(false);
  });

  test('rejects a missing token or platform', () => {
    expect(deviceTokenSchema.safeParse({ platform: 'android' }).success).toBe(false);
    expect(deviceTokenSchema.safeParse({ token: validToken }).success).toBe(false);
    expect(deviceTokenSchema.safeParse({}).success).toBe(false);
  });
});
