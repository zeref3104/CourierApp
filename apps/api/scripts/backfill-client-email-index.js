/**
 * One-off backfill: create master-DB ClientEmailIndex entries for EXISTING
 * client accounts so email login (client-email-login) works for accounts that
 * were registered BEFORE the ClientEmailIndex feature shipped.
 *
 * Behavior:
 * - Iterates every company in the master DB (active only unless --include-inactive).
 * - For each tenant, walks Customer documents that have a linked isClient User.
 * - Upserts a ClientEmailIndex {email (lowercased+trimmed), companyId, isActive:true}
 *   per customer — idempotent: entries already present are left untouched and a
 *   second run is a no-op.
 * - Dry-run (--dry-run) prints what WOULD be created without writing anything.
 *
 * Usage:
 *   npm run backfill:client-email-index --workspace @courier/api             (write)
 *   npm run backfill:client-email-index:dry-run --workspace @courier/api     (preview)
 *
 * The core is exported as backfillClientEmailIndex() so the integration suite
 * can run it against throwaway test connections.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectionManager = require('../src/services/tenant/connectionManager');
const logger = require('../src/logs/logger');

/**
 * Run the backfill.
 * @param {Object} opts
 * @param {import('mongoose').Connection} opts.masterConnection - Master connection with
 *   Company + ClientEmailIndex models registered
 * @param {Function} opts.getTenantConnection - (company) => tenant connection with
 *   Customer + User models registered
 * @param {boolean} [opts.dryRun] - Preview mode: log only, never write
 * @param {boolean} [opts.includeInactive] - Also index customers of inactive companies
 * @param {Object} [opts.log] - Logger (defaults to the app winston logger)
 * @returns {Promise<{companies: number, customersSeen: number, entriesCreated: number, entriesSkipped: number}>}
 */
async function backfillClientEmailIndex({
  masterConnection,
  getTenantConnection,
  dryRun = false,
  includeInactive = false,
  log = logger,
}) {
  const Company = masterConnection.model('Company');
  const ClientEmailIndex = masterConnection.model('ClientEmailIndex');

  const stats = { companies: 0, customersSeen: 0, entriesCreated: 0, entriesSkipped: 0 };

  const companyFilter = includeInactive ? {} : { isActive: true };
  const companies = await Company.find(companyFilter).sort({ _id: 1 });

  for (const company of companies) {
    stats.companies += 1;

    let connection;
    try {
      connection = await getTenantConnection(company);
    } catch (err) {
      log.warn(`[${company.slug}] skipping tenant (connection failed: ${err.message})`);
      continue;
    }

    const Customer = connection.model('Customer');
    const User = connection.model('User');

    // Customers that have a linked isClient User (i.e. they registered
    // self-service; staff-created rows without an isClient User are not
    // email-login accounts).
    const customers = await Customer.find({ isActive: true }).lean();
    for (const customer of customers) {
      const user = await User.findOne({ clientId: customer._id, isClient: true }).select('_id').lean();
      if (!user) continue;

      stats.customersSeen += 1;
      const email = String(customer.email || '').trim().toLowerCase();
      if (!email) {
        log.warn(`[${company.slug}] customer ${customer.code} has no email — skipped`);
        continue;
      }

      const exists = await ClientEmailIndex.findOne({ email, companyId: company._id });
      if (exists) {
        stats.entriesSkipped += 1;
        continue;
      }

      stats.entriesCreated += 1;
      log.info(`[${company.slug}] ${customer.code} -> ${email}${dryRun ? ' (dry-run)' : ''}`);
      if (!dryRun) {
        await ClientEmailIndex.create({ email, companyId: company._id, isActive: true });
      }
    }
  }

  return stats;
}

module.exports = { backfillClientEmailIndex };

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  const includeInactive = process.argv.includes('--include-inactive');
  const uri = `${process.env.MONGO_URI}/${process.env.MASTER_DB_NAME || 'courier_master'}`;

  (async () => {
    const masterConnection = await mongoose.createConnection(uri).asPromise();
    masterConnection.model('Company', require('../src/models/master/Company'));
    masterConnection.model('ClientEmailIndex', require('../src/models/master/ClientEmailIndex'));

    const getTenantConnection = (company) =>
      connectionManager.getConnection({ id: company._id, slug: company.slug, dbName: company.databaseName });

    const stats = await backfillClientEmailIndex({ masterConnection, getTenantConnection, dryRun, includeInactive });
    logger.info(
      `Backfill ${dryRun ? 'DRY-RUN (no changes written) ' : ''}complete: ${JSON.stringify(stats)}`
    );
    await connectionManager.closeAll();
    await masterConnection.close();
    process.exit(0);
  })().catch(async (err) => {
    logger.error(`Backfill failed: ${err.message}`, { stack: err.stack });
    await connectionManager.closeAll().catch(() => {});
    process.exit(1);
  });
}
