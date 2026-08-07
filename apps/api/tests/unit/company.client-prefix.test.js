/**
 * Unit tests for the Company client code prefix (client-code-identity spec):
 * - @courier/validation: createCompanySchema validates the prefix at the API boundary
 * - apps/api models/master/Company: clientCodePrefix path (optional, sparse unique, ^[A-Z]{2,5}$)
 *
 * Acceptance criteria (spec):
 * - Prefix is 2-5 uppercase letters (^[A-Z]{2,5}$)
 * - Platform-unique via sparse unique index in master DB
 * - Legacy companies without the field remain valid (not required)
 */
const mongoose = require('mongoose');
const companySchema = require('../../src/models/master/Company');
const { createCompanySchema } = require('@courier/validation');

// Temp model for schema-level validation (no DB connection needed)
const TempCompany = mongoose.model('ClientPrefixTestCompany', companySchema);

const BASE_DOC = {
  name: 'Rapid Box',
  slug: 'rapid-box',
  databaseName: 'courier_rapid_box',
  email: 'info@rapidbox.co',
};

describe('createCompanySchema', () => {
  test('accepts the standard provisioning payload', () => {
    const payload = {
      name: 'Rapid Box',
      slug: 'rapid-box',
      email: 'info@rapidbox.co',
      adminEmail: 'admin@rapidbox.co',
      phone: '8095551234',
      planId: '507f1f77bcf86cd799439011',
    };
    expect(createCompanySchema.safeParse(payload).success).toBe(true);
  });

  test('phone and planId are optional', () => {
    const payload = {
      name: 'Rapid Box',
      slug: 'rapid-box',
      email: 'info@rapidbox.co',
      adminEmail: 'admin@rapidbox.co',
    };
    expect(createCompanySchema.safeParse(payload).success).toBe(true);
  });

  test('accepts a valid 2-5 uppercase clientCodePrefix', () => {
    const payload = {
      name: 'Rapid Box',
      slug: 'rapid-box',
      email: 'info@rapidbox.co',
      adminEmail: 'admin@rapidbox.co',
      clientCodePrefix: 'RB',
    };
    expect(createCompanySchema.safeParse(payload).success).toBe(true);
  });

  test('rejects a lowercase clientCodePrefix', () => {
    const result = createCompanySchema.safeParse({
      name: 'Rapid Box',
      slug: 'rapid-box',
      email: 'info@rapidbox.co',
      adminEmail: 'admin@rapidbox.co',
      clientCodePrefix: 'rb',
    });
    expect(result.success).toBe(false);
  });

  test('rejects a 1-character clientCodePrefix', () => {
    const result = createCompanySchema.safeParse({
      name: 'Rapid Box',
      slug: 'rapid-box',
      email: 'info@rapidbox.co',
      adminEmail: 'admin@rapidbox.co',
      clientCodePrefix: 'R',
    });
    expect(result.success).toBe(false);
  });

  test('rejects a 6-character clientCodePrefix', () => {
    const result = createCompanySchema.safeParse({
      name: 'Rapid Box',
      slug: 'rapid-box',
      email: 'info@rapidbox.co',
      adminEmail: 'admin@rapidbox.co',
      clientCodePrefix: 'RAPIDX',
    });
    expect(result.success).toBe(false);
  });

  test('rejects a clientCodePrefix containing digits', () => {
    const result = createCompanySchema.safeParse({
      name: 'Rapid Box',
      slug: 'rapid-box',
      email: 'info@rapidbox.co',
      adminEmail: 'admin@rapidbox.co',
      clientCodePrefix: 'RB2',
    });
    expect(result.success).toBe(false);
  });

  test('rejects an invalid email', () => {
    const result = createCompanySchema.safeParse({
      name: 'Rapid Box',
      slug: 'rapid-box',
      email: 'not-an-email',
      adminEmail: 'admin@rapidbox.co',
    });
    expect(result.success).toBe(false);
  });

  test('rejects a missing company name', () => {
    const result = createCompanySchema.safeParse({
      slug: 'rapid-box',
      email: 'info@rapidbox.co',
      adminEmail: 'admin@rapidbox.co',
    });
    expect(result.success).toBe(false);
  });
});

describe('Company model clientCodePrefix', () => {
  test('declares an optional clientCodePrefix String path', () => {
    const path = companySchema.path('clientCodePrefix');
    expect(path).toBeDefined();
    expect(path.instance).toBe('String');
    expect(path.isRequired).toBeFalsy();
  });

  test('enforces the 2-5 uppercase letters pattern at the model level', () => {
    const validators = companySchema.path('clientCodePrefix').validators;
    const rejectsLowercase = validators.some(
      (v) => v.validator('rb') === false && v.validator('RB') === true
    );
    expect(rejectsLowercase).toBe(true);
  });

  test('registers a sparse unique index for platform-uniqueness', () => {
    const indexes = companySchema.indexes();
    const prefixIndex = indexes.find(([fields]) => Object.prototype.hasOwnProperty.call(fields, 'clientCodePrefix'));
    expect(prefixIndex).toBeDefined();
    const options = prefixIndex[1];
    expect(options.unique).toBe(true);
    expect(options.sparse).toBe(true);
  });

  test('accepts a document with a valid prefix', () => {
    const doc = new TempCompany({ ...BASE_DOC, clientCodePrefix: 'RB' });
    expect(doc.validateSync()).toBeUndefined();
  });

  test('rejects a document with a lowercase prefix', () => {
    const doc = new TempCompany({ ...BASE_DOC, clientCodePrefix: 'rb' });
    const err = doc.validateSync();
    expect(err.errors.clientCodePrefix).toBeDefined();
  });

  test('accepts a legacy document without the prefix', () => {
    const doc = new TempCompany(BASE_DOC);
    expect(doc.validateSync()).toBeUndefined();
  });
});
