/**
 * Unit test for master connection model registration (tasks 1.6, 2.1):
 * initMaster() must register CompanyCounter and OtpCode on the master
 * connection so the counter/OTP services can resolve them at runtime.
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

  test('registers OtpCode on the master connection', async () => {
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

    expect(registered).toContain('OtpCode');
  });
});
