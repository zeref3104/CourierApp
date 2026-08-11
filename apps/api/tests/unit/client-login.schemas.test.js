/**
 * Unit tests for the slice-3/4 client login validation schemas
 * (client-mobile-app tasks 3.1/4.1): clientCodeLoginSchema, clientRefreshSchema.
 *
 * Spec: login accepts a GLOBAL client code `{PREFIX}-{SEQ}` OR an email as the
 * identifier (client-email-login), plus password. Exactly one of code|email is
 * required: providing both or neither is rejected (422). Refresh accepts the
 * refresh token in the request body.
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

  test('accepts an email as the login identifier (client-email-login)', () => {
    expectAccept(clientCodeLoginSchema, { email: 'cliente@example.com', password: 'Passw0rd!' });
  });

  test('rejects payloads carrying BOTH code and email (exactly one identifier)', () => {
    expectReject(clientCodeLoginSchema, { code: 'CS-000001', email: 'cliente@example.com', password: 'Passw0rd!' });
  });

  test('rejects payloads carrying NEITHER code nor email', () => {
    expectReject(clientCodeLoginSchema, { password: 'Passw0rd!' });
  });

  test('rejects a code identifier if it is malformed or empty', () => {
    expectReject(clientCodeLoginSchema, { code: '', password: 'Passw0rd!' });
    expectReject(clientCodeLoginSchema, { code: 'CS_000001', password: 'Passw0rd!' });
    expectReject(clientCodeLoginSchema, { code: 'C-000001', password: 'Passw0rd!' });
    expectReject(clientCodeLoginSchema, { code: 'cs-000001', password: 'Passw0rd!' });
    expectReject(clientCodeLoginSchema, { code: 'CS-00000A', password: 'Passw0rd!' });
  });

  test('rejects an email identifier if it is malformed', () => {
    expectReject(clientCodeLoginSchema, { email: 'not-an-email', password: 'Passw0rd!' });
    expectReject(clientCodeLoginSchema, { email: 'a@b', password: 'Passw0rd!' });
  });

  test('rejects a missing or empty password', () => {
    expectReject(clientCodeLoginSchema, { code: 'CS-000001' });
    expectReject(clientCodeLoginSchema, { code: 'CS-000001', password: '' });
    expectReject(clientCodeLoginSchema, { email: 'cliente@example.com', password: '' });
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
