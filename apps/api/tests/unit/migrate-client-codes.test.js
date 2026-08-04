/**
 * Unit tests for the client code migration script (client-code-identity spec,
 * task 1.13):
 * - resolveUniquePrefix: deterministic collision suffix when a suggested prefix
 *   is already taken (never exceeds 5 chars, throws when nothing is free).
 * - The script module loads without side effects (no DB connect at require time);
 *   the full migration flow is covered by the integration suite (task 1.14).
 */
const { resolveUniquePrefix } = require('../../scripts/migrate-client-codes');

describe('resolveUniquePrefix', () => {
  test('returns the base prefix when it is free', () => {
    expect(resolveUniquePrefix('RB', [])).toBe('RB');
    expect(resolveUniquePrefix('RB', ['CS'])).toBe('RB');
  });

  test('appends deterministic X suffixes when the base is taken', () => {
    expect(resolveUniquePrefix('RB', ['RB'])).toBe('RBX');
    expect(resolveUniquePrefix('RB', ['RB', 'RBX', 'RBXX'])).toBe('RBXXX');
  });

  test('never exceeds 5 characters even for a 5-char base', () => {
    expect(resolveUniquePrefix('AIFFC', ['AIFFC'])).toBe('AIFFX');
  });

  test('throws when every candidate is taken', () => {
    expect(() => resolveUniquePrefix('RB', ['RB', 'RBX', 'RBXX', 'RBXXX'])).toThrow();
  });
});
