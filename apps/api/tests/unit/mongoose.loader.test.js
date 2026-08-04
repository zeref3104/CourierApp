/**
 * Unit test for master connection model registration (task 1.6):
 * initMaster() must register CompanyCounter on the master connection so the
 * counter service can resolve it at runtime.
 */
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return { ...actual, createConnection: jest.fn() };
});

const mongoose = require('mongoose');
const { initMaster } = require('../../src/loaders/mongoose');

describe('initMaster', () => {
  test('registers CompanyCounter on the master connection', async () => {
    const registered = [];
    const fakeConn = {
      model: (name) => {
        registered.push(name);
        return {};
      },
      on: () => {},
      once: () => {},
    };
    mongoose.createConnection.mockResolvedValue(fakeConn);

    await initMaster();

    expect(registered).toContain('CompanyCounter');
  });
});
