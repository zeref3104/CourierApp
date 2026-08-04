/**
 * Unit tests for the slice-3 client login/refresh validation schemas
 * (client-mobile-app task 3.1): clientCodeLoginSchema, clientRefreshSchema.
 *
 * Spec (client-code-login): login accepts ONLY `code` (global client code
 * `{PREFIX}-{SEQ}`) + `password`; an email MUST be rejected as the login
 * identifier (422). Refresh accepts the refresh token in the request body.
 */
const { clientCodeLoginSchema, clientRefreshSchema } = require('@courier/validation');

function expectReject(schema, payload) {
  const result = schema.safeParse(payload);
  expect(result.success).toBe(false);
}

function expectAccept(schema, payload) {
  const result = schema.safeParse(payload);
  expect(result.success).toBe(true);
}

describe('clientCodeLoginSchema', () => {
  test('accepts a valid global client code + password', () => {
    expectAccept(clientCodeLoginSchema, { code: 'CS-000001', password: 'Passw0rd!' });
  });

  test('accepts any prefix length in the 2-5 uppercase range', () => {
    expectAccept(clientCodeLoginSchema, { code: 'RB-000123', password: 'Passw0rd!' });
    expectAccept(clientCodeLoginSchema, { code: 'RAPID-000123', password: 'Passw0rd!' });
  });

  test('rejects an email as the login identifier (spec: email no longer accepted)', () => {
    expectReject(clientCodeLoginSchema, { code: 'cliente@example.com', password: 'Passw0rd!' });
  });

  test('rejects malformed codes', () => {
    // wrong separator, short prefix, lowercase prefix, non-digit seq, missing password
    expectReject(clientCodeLoginSchema, { code: 'CS_000001', password: 'Passw0rd!' });
    expectReject(clientCodeLoginSchema, { code: 'C-000001', password: 'Passw0rd!' });
    expectReject(clientCodeLoginSchema, { code: 'cs-000001', password: 'Passw0rd!' });
    expectReject(clientCodeLoginSchema, { code: 'CS-00000A', password: 'Passw0rd!' });
    expectReject(clientCodeLoginSchema, { code: 'CS-000001' });
    expectReject(clientCodeLoginSchema, { code: 'CS-000001', password: '' });
  });
});

describe('clientRefreshSchema', () => {
  test('accepts a refresh token in the body', () => {
    expectAccept(clientRefreshSchema, { refreshToken: 'a'.repeat(80) });
  });

  test('rejects a missing or empty refresh token', () => {
    expectReject(clientRefreshSchema, {});
    expectReject(clientRefreshSchema, { refreshToken: '' });
  });
});
