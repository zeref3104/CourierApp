/**
 * Unit tests for the password-recovery validation schemas (forgot-password
 * spec, tasks 1.1): forgotPasswordSchema, resetPasswordSchema and the shared
 * passwordRules they reuse (weak password must be rejected — AC: weak
 * password -> 422 at the route, enforced by zod here).
 */
const {
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  registerClientSchema,
} = require('@courier/validation');

function expectReject(schema, payload) {
  const result = schema.safeParse(payload);
  expect(result.success).toBe(false);
  return result;
}

function expectAccept(schema, payload) {
  const result = schema.safeParse(payload);
  expect(result.success).toBe(true);
  return result;
}

describe('forgotPasswordSchema', () => {
  test('accepts an email alone', () => {
    expectAccept(forgotPasswordSchema, { email: 'cliente@correo.com' });
  });

  test('accepts the optional lang and global client code', () => {
    expectAccept(forgotPasswordSchema, {
      email: 'cliente@correo.com',
      lang: 'fr',
      code: 'RB-000042',
    });
  });

  test('rejects a malformed email, an unknown lang, or a malformed code', () => {
    expectReject(forgotPasswordSchema, { email: 'not-an-email' });
    expectReject(forgotPasswordSchema, { email: 'cliente@correo.com', lang: 'pt' });
    expectReject(forgotPasswordSchema, { email: 'cliente@correo.com', code: 'lower-123456' });
    expectReject(forgotPasswordSchema, { email: 'cliente@correo.com', code: 'RB-12345' });
  });
});

describe('resetPasswordSchema', () => {
  const valid = {
    email: 'cliente@correo.com',
    otpCode: '123456',
    newPassword: 'Passw0rd!',
  };

  test('accepts a compliant reset payload with an optional client code', () => {
    expectAccept(resetPasswordSchema, valid);
    expectAccept(resetPasswordSchema, { ...valid, code: 'RB-000042' });
  });

  test('rejects a non-6-digit otpCode', () => {
    expectReject(resetPasswordSchema, { ...valid, otpCode: '12345' });
    expectReject(resetPasswordSchema, { ...valid, otpCode: 'abcdef' });
    expectReject(resetPasswordSchema, { ...valid, otpCode: undefined });
  });

  // AC: weak password -> 422 (zod rejects every weak shape before the service runs)
  test('rejects weak passwords: too short, no uppercase, no lowercase, no digit', () => {
    expectReject(resetPasswordSchema, { ...valid, newPassword: 'Pass1!' });
    expectReject(resetPasswordSchema, { ...valid, newPassword: 'passw0rd!' });
    expectReject(resetPasswordSchema, { ...valid, newPassword: 'PASSW0RD!' });
    expectReject(resetPasswordSchema, { ...valid, newPassword: 'Password' });
  });

  test('rejects a malformed email', () => {
    expectReject(resetPasswordSchema, { ...valid, email: 'nope' });
  });
});

describe('shared password rules', () => {
  // passwordRules is shared: the same compliant/weak decisions must hold for
  // every schema that carries a password field.
  test('changePasswordSchema and registerClientSchema agree with resetPasswordSchema', () => {
    for (const schema of [changePasswordSchema, registerClientSchema]) {
      const passwordField = schema.shape.password || schema.shape.newPassword;
      expect(passwordField.safeParse('Passw0rd!').success).toBe(true);
      expect(passwordField.safeParse('weak').success).toBe(false);
    }
    expect(resetPasswordSchema.shape.newPassword.safeParse('Passw0rd!').success).toBe(true);
    expect(resetPasswordSchema.shape.newPassword.safeParse('weak').success).toBe(false);
  });
});
