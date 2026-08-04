/**
 * Unit tests for the master CompanyCounter (client-code-identity spec, D3):
 * - Model: { companyId unique, seq } with a unique index on companyId
 * - Service: masterCounter.nextSequence(masterConnection, companyId) is atomic
 *   ($inc upsert) and retries on the 11000 creation race, mirroring the tenant
 *   counter pattern.
 */
const mongoose = require('mongoose');
const companyCounterSchema = require('../../src/models/master/CompanyCounter');
const { nextSequence } = require('../../src/services/master/counter.service');

describe('CompanyCounter model', () => {
  test('declares a required ObjectId companyId path', () => {
    const path = companyCounterSchema.path('companyId');
    expect(path).toBeDefined();
    expect(path.instance).toBe('ObjectId');
    expect(path.isRequired).toBeTruthy();
  });

  test('declares a seq Number path defaulting to 0', () => {
    const path = companyCounterSchema.path('seq');
    expect(path).toBeDefined();
    expect(path.instance).toBe('Number');
    expect(path.defaultValue).toBe(0);
  });

  test('registers a unique index on companyId', () => {
    const indexes = companyCounterSchema.indexes();
    const idx = indexes.find(([fields]) =>
      Object.prototype.hasOwnProperty.call(fields, 'companyId')
    );
    expect(idx).toBeDefined();
    expect(idx[1].unique).toBe(true);
  });
});

describe('masterCounter.nextSequence', () => {
  const COMPANY_ID = '507f1f77bcf86cd799439011';

  test('increments via findOneAndUpdate $inc upsert and returns the sequence', async () => {
    const findOneAndUpdate = jest.fn().mockResolvedValue({ seq: 7 });
    const masterConnection = { model: jest.fn(() => ({ findOneAndUpdate })) };

    const seq = await nextSequence(masterConnection, COMPANY_ID);

    expect(masterConnection.model).toHaveBeenCalledWith('CompanyCounter');
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { companyId: COMPANY_ID },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    expect(seq).toBe(7);
  });

  test('retries the $inc upsert when the creation race throws 11000', async () => {
    const findOneAndUpdate = jest
      .fn()
      .mockRejectedValueOnce({ code: 11000 })
      .mockResolvedValueOnce({ seq: 3 });
    const masterConnection = { model: jest.fn(() => ({ findOneAndUpdate })) };

    const seq = await nextSequence(masterConnection, COMPANY_ID);

    expect(seq).toBe(3);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(findOneAndUpdate).toHaveBeenLastCalledWith(
      { companyId: COMPANY_ID },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
  });

  test('propagates non-11000 errors', async () => {
    const findOneAndUpdate = jest.fn().mockRejectedValue({ code: 5000 });
    const masterConnection = { model: jest.fn(() => ({ findOneAndUpdate })) };

    await expect(nextSequence(masterConnection, COMPANY_ID)).rejects.toEqual({ code: 5000 });
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
