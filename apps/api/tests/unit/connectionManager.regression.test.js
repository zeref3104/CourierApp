/**
 * Regression test for verify WARNING 1 (fix f15b18a):
 *
 * connectionManager is an Object.freeze'd singleton, and class methods are
 * always strict-mode — so assigning this.sweepInterval inside _startSweep used
 * to throw "Cannot assign to read only property" and EVERY getConnection()
 * crashed. The fix moved the interval handle to module scope.
 *
 * This test mocks mongoose.createConnection, calls getConnection() for two
 * tenants, and asserts: (a) the promise resolves (no throw on the frozen
 * singleton), and (b) the sweep interval is started exactly once.
 */
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return { ...actual, createConnection: jest.fn() };
});

const mongoose = require('mongoose');
const connectionManager = require('../../src/services/tenant/connectionManager');

function fakeConnection() {
  const conn = {
    asPromise: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    model: jest.fn(),
  };
  conn.asPromise.mockResolvedValue(conn);
  return conn;
}

describe('ConnectionManager frozen-singleton sweep regression', () => {
  let setIntervalSpy;

  beforeAll(() => {
    setIntervalSpy = jest.spyOn(global, 'setInterval');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    setIntervalSpy.mockRestore();
    // Clear the module-scope sweep timer + pooled connections so nothing leaks
    await connectionManager.closeAll();
  });

  test('getConnection resolves and starts the sweep exactly once', async () => {
    const connA = fakeConnection();
    const connB = fakeConnection();
    mongoose.createConnection.mockReturnValueOnce(connA).mockReturnValueOnce(connB);

    await expect(
      connectionManager.getConnection({ id: 'aaa', slug: 'tenant-a', dbName: 'db_a' })
    ).resolves.toBe(connA);

    await expect(
      connectionManager.getConnection({ id: 'bbb', slug: 'tenant-b', dbName: 'db_b' })
    ).resolves.toBe(connB);

    expect(mongoose.createConnection).toHaveBeenCalledTimes(2);
    // The sweep timer must be created once and reused for every tenant —
    // a per-tenant sweep would also be correct but wasteful; a throw on the
    // frozen singleton would fail the resolves assertions above.
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      connectionManager.SWEEP_INTERVAL_MS
    );
  });
});
