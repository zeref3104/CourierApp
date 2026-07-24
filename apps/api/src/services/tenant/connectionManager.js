const mongoose = require('mongoose');
const logger = require('../../logs/logger');

class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.MAX_CONNECTIONS = 100;
    this.CONNECTION_TTL_MS = 30 * 60 * 1000;
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
      `${process.env.MONGO_URI}/${tenant.dbName}`,
      {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
      }
    );

    this._loadTenantModels(connection);

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

    return connection;
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

  async closeAll() {
    logger.info(`Closing all connections (${this.connections.size})...`);
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
}

const instance = new ConnectionManager();
Object.freeze(instance);

module.exports = instance;