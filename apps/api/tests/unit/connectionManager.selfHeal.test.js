/**
 * Self-heal test: connectionManager drops a stale UNIQUE index on the embedded
 * `deviceTokens.token` array field when opening a tenant connection.
 *
 * A unique multikey index on a field inside an embedded array indexes a `null`
 * key for every document with an empty deviceTokens array, so the SECOND user
 * with deviceTokens: [] collides with the first (11000 duplicate key -> 409 on
 * /auth/client/register). The schema no longer declares it; existing tenant DBs
 * keep the old index until this self-heal drops it.
 */
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return { ...actual, createConnection: jest.fn() };
});

const mongoose = require('mongoose');
const connectionManager = require('../../src/services/tenant/connectionManager');

function fakeConnectionWithUsers(indexes) {
  const dropIndex = jest.fn().mockResolvedValue({ ok: 1 });
  const usersCollection = {
    indexes: jest.fn().mockResolvedValue(indexes),
    dropIndex,
  };
  const userModel = { collection: usersCollection };
  const conn = {
    asPromise: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    model: jest.fn((name) => (name === 'User' ? userModel : undefined)),
  };
  conn.asPromise.mockResolvedValue(conn);
  return { conn, usersCollection, dropIndex };
}

describe('ConnectionManager deviceTokens.token_1 self-heal', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await connectionManager.closeAll();
  });

  test('drops the stale unique deviceTokens.token_1 index when present', async () => {
    const { conn, dropIndex } = fakeConnectionWithUsers([
      { name: '_id_', key: { _id: 1 } },
      { name: 'email_1', key: { email: 1 }, unique: true },
      { name: 'deviceTokens.token_1', key: { 'deviceTokens.token': 1 }, unique: true },
    ]);
    mongoose.createConnection.mockReturnValueOnce(conn);

    await connectionManager.getConnection({ id: 'aaa', slug: 'tenant-a', dbName: 'db_a' });

    expect(dropIndex).toHaveBeenCalledWith('deviceTokens.token_1');
  });

  test('leaves the collection untouched when the stale index is absent', async () => {
    const { conn, dropIndex } = fakeConnectionWithUsers([
      { name: '_id_', key: { _id: 1 } },
      { name: 'email_1', key: { email: 1 }, unique: true },
    ]);
    mongoose.createConnection.mockReturnValueOnce(conn);

    await connectionManager.getConnection({ id: 'bbb', slug: 'tenant-b', dbName: 'db_b' });

    expect(dropIndex).not.toHaveBeenCalled();
  });

  test('never throws when index inspection fails (best-effort)', async () => {
    const { conn } = fakeConnectionWithUsers([]);
    conn.model.mockReturnValue({ collection: { indexes: jest.fn().mockRejectedValue(new Error('no such collection')) } });
    mongoose.createConnection.mockReturnValueOnce(conn);

    await expect(
      connectionManager.getConnection({ id: 'ccc', slug: 'tenant-c', dbName: 'db_c' })
    ).resolves.toBe(conn);
  });
});