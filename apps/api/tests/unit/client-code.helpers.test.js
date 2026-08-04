/**
 * Unit tests for the shared client-code identity primitives:
 * - @courier/constants: CLIENT_CODE_PATTERN, CLIENT_CODE_PREFIX_PATTERN
 * - @courier/helpers: suggestClientPrefix, generateClientCode (generateCustomerCode deprecated)
 *
 * Acceptance criteria (client-code-identity spec):
 * - "Rapid Box" → suggestion "RB" (initials of words, 2-5 uppercase chars)
 * - single word → first 2 letters
 * - generateClientCode("CS", 1) → "CS-000001" (zero-padded 6)
 * - generated codes match ^[A-Z]{2,5}-\d{6}$
 */
const {
  suggestClientPrefix,
  generateClientCode,
  generateCustomerCode,
} = require('@courier/helpers');
const {
  CLIENT_CODE_PATTERN,
  CLIENT_CODE_PREFIX_PATTERN,
} = require('@courier/constants');

describe('suggestClientPrefix', () => {
  test('derives initials from multi-word names', () => {
    expect(suggestClientPrefix('Rapid Box')).toBe('RB');
  });

  test('single word falls back to the first 2 letters', () => {
    expect(suggestClientPrefix('Fedex')).toBe('FE');
  });

  test('caps the suggestion at 5 characters', () => {
    expect(suggestClientPrefix('American International Freight Forwarding Corp')).toBe('AIFFC');
  });

  test('returns uppercase letters only', () => {
    expect(suggestClientPrefix('rapid box')).toBe('RB');
  });

  test('ignores non-letter characters in words', () => {
    expect(suggestClientPrefix('S.A. Cargo Line')).toBe('SCL');
  });

  test('every suggestion matches the prefix pattern', () => {
    const names = ['Rapid Box', 'Fedex', 'A B C D E F', 'Correos Dominicanos S.A.', 'X-Press Mail'];
    for (const name of names) {
      const suggestion = suggestClientPrefix(name);
      expect(suggestion).toMatch(new RegExp(CLIENT_CODE_PREFIX_PATTERN));
    }
  });
});

describe('generateClientCode', () => {
  test('zero-pads the sequence to 6 digits', () => {
    expect(generateClientCode('CS', 1)).toBe('CS-000001');
  });

  test('does not truncate sequences above 6 digits', () => {
    expect(generateClientCode('FCG', 1234567)).toBe('FCG-1234567');
  });

  test('produced codes match the global client code pattern', () => {
    const code = generateClientCode('RB', 42);
    expect(code).toMatch(new RegExp(CLIENT_CODE_PATTERN));
  });
});

describe('generateCustomerCode (deprecated)', () => {
  test('still produces the legacy CUS- format for back-compat', () => {
    expect(generateCustomerCode(3)).toBe('CUS-0003');
  });
});
