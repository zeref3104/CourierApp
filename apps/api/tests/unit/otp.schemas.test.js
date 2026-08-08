/**
 * Unit tests for the client-registration OTP/register validation schemas
 * (task 2.2, PR 2a): otpSendSchema, otpVerifySchema, registerClientSchema.
 */
const { otpSendSchema, otpVerifySchema, registerClientSchema } = require('@courier/validation');

function expectReject(schema, payload) {
  const result = schema.safeParse(payload);
  expect(result.success).toBe(false);
}

function expectAccept(schema, payload) {
  const result = schema.safeParse(payload);
  expect(result.success).toBe(true);
}

describe('otpSendSchema', () => {
  test('accepts a valid email', () => {
    expectAccept(otpSendSchema, { email: 'cliente@correo.com' });
  });

  test('accepts an optional lang in es|en|fr', () => {
    expectAccept(otpSendSchema, { email: 'cliente@correo.com', lang: 'fr' });
  });

  test('rejects a bad email or unknown lang', () => {
    expectReject(otpSendSchema, { email: 'not-an-email' });
    expectReject(otpSendSchema, { email: 'cliente@correo.com', lang: 'pt' });
  });
});

describe('otpVerifySchema', () => {
  test('accepts email + 6-digit code', () => {
    expectAccept(otpVerifySchema, { email: 'cliente@correo.com', code: '123456' });
  });

  test('rejects a non-6-digit code', () => {
    expectReject(otpVerifySchema, { email: 'cliente@correo.com', code: '12345' });
    expectReject(otpVerifySchema, { email: 'cliente@correo.com', code: '1234567' });
    expectReject(otpVerifySchema, { email: 'cliente@correo.com', code: '12a456' });
    expectReject(otpVerifySchema, { email: 'cliente@correo.com' });
  });
});

describe('registerClientSchema', () => {
  const valid = {
    companyId: '64b0f1a2c3d4e5f6a7b8c9d0',
    branchId: '64b0f1a2c3d4e5f6a7b8c9d1',
    name: 'Ana',
    lastName: 'Perez',
    phone: '8095551234',
    email: 'ana@correo.com',
    password: 'Cliente123',
    otpCode: '123456',
  };

  test('accepts a complete valid payload (document optional)', () => {
    expectAccept(registerClientSchema, valid);
    expectAccept(registerClientSchema, { ...valid, document: '001-1234567-8' });
  });

  test('accepts a payload WITHOUT branchId (backend main-branch fallback)', () => {
    const { branchId, ...noBranch } = valid;
    expectAccept(registerClientSchema, noBranch);
  });

  test('rejects an empty-string branchId when present', () => {
    expectReject(registerClientSchema, { ...valid, branchId: '' });
  });

  test('rejects missing required fields or a weak password', () => {
    expectReject(registerClientSchema, { ...valid, email: 'nope' });
    expectReject(registerClientSchema, { ...valid, password: 'weak' });
    expectReject(registerClientSchema, { ...valid, otpCode: '12345' });
    expectReject(registerClientSchema, { ...valid, companyId: '' });
    expectReject(registerClientSchema, { ...valid, lastName: '' });
    expectReject(registerClientSchema, { ...valid, phone: '123' });
  });
});
