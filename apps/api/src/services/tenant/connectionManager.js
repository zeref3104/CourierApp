const mongoose = require('mongoose');
const logger = require('../../logs/logger');
const { buildDbUri } = require('../../utils/mongoUri');

// Interval handles are kept at module scope: the singleton is frozen
// (Object.freeze below) to prevent accidental mutation, but class methods are
// always strict-mode, so assigning this.sweepInterval inside _startSweep would
// throw "Cannot assign to read only property" on the frozen instance.
let sweepInterval = null;

class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.MAX_CONNECTIONS = 100;
    this.CONNECTION_TTL_MS = 30 * 60 * 1000;
    this.CONNECTION_READY_TIMEOUT_MS = 10000;
    this.SWEEP_INTERVAL_MS = 10 * 60 * 1000;
    this.SWEEP_MIN_CONNECTIONS = 20;
    this.cleanupInterval = null;
  }

  async getConnection(tenant) {
    if (this.connections.has(tenant.dbName)) {
      const entry = this.connections.get(tenant.dbName);
      entry.lastUsed = Date.now();
      return entry.connection;
    }

    logger.info(`Creating new connection for tenant: ${tenant.dbName}`);

    const connection = await mongoose.createConnection(
      buildDbUri(process.env.MONGO_URI, tenant.dbName),
      {
        maxPoolSize: 10,
        // minPoolSize 0: with 100 tenants a minPoolSize of 2 would keep ~200
        // sockets open even when those tenants are completely idle.
        minPoolSize: 0,
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
      }
    );

    // Wait for the connection to actually become ready (bounded) so the first
    // query on it never hits the mongoose bufferTimeout. If mongo is down or
    // slow, fail fast and close the half-open connection instead of leaking it.
    let readyTimer;
    try {
      await Promise.race([
        connection.asPromise(),
        new Promise((_, reject) => {
          readyTimer = setTimeout(
            () => reject(new Error(`Timed out waiting for connection to ready (${tenant.dbName})`)),
            this.CONNECTION_READY_TIMEOUT_MS
          );
        }),
      ]);
    } catch (err) {
      clearTimeout(readyTimer);
      await connection.close().catch(() => {});
      throw err;
    } finally {
      // Without this the 10s timer stays alive after a successful connect,
      // keeping the event loop open (leaks in tests and server shutdown).
      clearTimeout(readyTimer);
    }

    this._loadTenantModels(connection);

    // Self-heal known-bad legacy indexes before the connection is reused.
    // Best-effort: a failure must never block tenant connection creation.
    await this._selfHealDeviceTokenIndex(connection);

    this.connections.set(tenant.dbName, {
      connection,
      lastUsed: Date.now(),
      createdAt: Date.now(),
    });

    if (this.connections.size > this.MAX_CONNECTIONS) {
      this._evictLRU();
    }

    connection.on('error', (err) => {
      logger.error(`Connection error for ${tenant.dbName}:`, err);
    });

    this._startSweep();

    return connection;
  }

  _startSweep() {
    if (sweepInterval) return;
    sweepInterval = setInterval(() => this._sweepIdleConnections(), this.SWEEP_INTERVAL_MS);
    // Do not keep the process alive solely for the sweep.
    sweepInterval.unref();
  }

  _sweepIdleConnections() {
    // Conservative pruning: only prune when many tenant connections are pooled.
    // With a small tenant count, closing connections that the auth refresh flow
    // (auth.service _findSession) relies on would only add cold-start latency.
    // Only connections idle past CONNECTION_TTL_MS are closed, so a short-lived
    // in-flight transaction is never interrupted. The master connection lives
    // in app.locals (not in this map), so it is never touched here.
    if (this.connections.size <= this.SWEEP_MIN_CONNECTIONS) return;

    const now = Date.now();
    for (const [dbName, entry] of this.connections) {
      if (now - entry.lastUsed >= this.CONNECTION_TTL_MS) {
        logger.warn(`Closing idle connection (TTL exceeded): ${dbName}`);
        entry.connection.close().catch(() => {});
        this.connections.delete(dbName);
      }
    }
  }

  _loadTenantModels(connection) {
    require('../../models/tenant/User')(connection);
    require('../../models/tenant/Role')(connection);
    require('../../models/tenant/Customer')(connection);
    require('../../models/tenant/Package')(connection);
    require('../../models/tenant/PackageHistory')(connection);
    require('../../models/tenant/Branch')(connection);
    require('../../models/tenant/Payment')(connection);
    require('../../models/tenant/Receipt')(connection);
    require('../../models/tenant/Delivery')(connection);
    require('../../models/tenant/Rate')(connection);
    require('../../models/tenant/Notification')(connection);
    require('../../models/tenant/ActivityLog')(connection);
    require('../../models/tenant/Setting')(connection);
    require('../../models/tenant/Counter')(connection);
  }

  /**
   * Drop a stale UNIQUE index on the embedded `deviceTokens.token` array field
   * (users collection). A unique multikey index on a field inside an embedded
   * array indexes a `null` key for every document with an empty deviceTokens
   * array, so the SECOND user with deviceTokens: [] collides with the first:
   * 11000 duplicate key -> 409 on /auth/client/register. The schema no longer
   * declares this index (app-layer dedup handles token uniqueness); any index
   * still present in an existing tenant DB was created by the old schema and
   * must be dropped once. Idempotent: no index -> no-op. Best-effort: never
   * throws, never blocks connection creation.
   */
  async _selfHealDeviceTokenIndex(connection) {
    try {
      const User = connection.model('User');
      const indexes = await User.collection.indexes();
      for (const index of indexes) {
        if (index.name === 'deviceTokens.token_1' && index.unique) {
          await User.collection.dropIndex('deviceTokens.token_1');
          logger.warn(`Self-healed stale unique index deviceTokens.token_1 on users (blocked client registration with 409)`);
        }
      }
    } catch (err) {
      logger.debug(`Self-heal deviceTokens.token_1 check skipped: ${err.message}`);
    }
  }

  _evictLRU() {
    let oldest = null;
    let oldestKey = null;

    for (const [key, entry] of this.connections) {
      if (!oldest || entry.lastUsed < oldest.lastUsed) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      logger.warn(`Evicting idle connection: ${oldestKey}`);
      oldest.connection.close().catch(() => {});
      this.connections.delete(oldestKey);
    }
  }

  async closeConnection(dbName) {
    if (this.connections.has(dbName)) {
      logger.info(`Closing connection: ${dbName}`);
      await this.connections.get(dbName).connection.close();
      this.connections.delete(dbName);
    }
  }

  async dropDatabase(dbName) {
    // Close existing connection if pooled
    await this.closeConnection(dbName);

    // Create temp connection to drop the DB
    const uri = buildDbUri(process.env.MONGO_URI, dbName);
    const tempConn = await mongoose.createConnection(uri).asPromise();
    await tempConn.dropDatabase();
    await tempConn.close();
    logger.info(`Database dropped: ${dbName}`);
  }

  async closeAll() {
    logger.info(`Closing all connections (${this.connections.size})...`);
    if (sweepInterval) {
      clearInterval(sweepInterval);
      sweepInterval = null;
    }
    const promises = [];
    for (const [name, entry] of this.connections) {
      promises.push(entry.connection.close().catch(() => {}));
    }
    await Promise.all(promises);
    this.connections.clear();
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      maxConnections: this.MAX_CONNECTIONS,
      connections: Array.from(this.connections.entries()).map(([key, entry]) => ({
        dbName: key,
        lastUsed: entry.lastUsed,
        uptimeMs: Date.now() - entry.createdAt,
      })),
    };
  }

  listConnections() {
    return Array.from(this.connections.entries()).map(([dbName, entry]) => ({
      dbName,
      connection: entry.connection,
    }));
  }
}

const instance = new ConnectionManager();
Object.freeze(instance);

module.exports = instance;