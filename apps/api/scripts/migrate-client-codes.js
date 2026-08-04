/**
 * One-off migration: backfill Company.clientCodePrefix + CompanyCounter and
 * rewrite legacy per-tenant CUS-{4} customer codes to the global format
 * {PREFIX}-{SEQ:6} (client-code-identity spec "Migration of Existing Customer
 * Codes", design Migration/Rollout §2).
 *
 * Behavior:
 * - Assigns a suggested prefix (deterministic X collision suffix) to any
 *   company missing one.
 * - Seeds a CompanyCounter (seq 0) per company so newly generated codes never
 *   collide with the migrated ones.
 * - Rewrites every customer code matching /^CUS-\d+$/ to {PREFIX}-{SEQ} using
 *   the master counter, sorted by createdAt (stable order).
 * - Idempotent: codes already matching the global pattern are skipped; a second
 *   run is a no-op. No CUS- code remains afterwards.
 * - Dry-run (--dry-run) reports what WOULD change without writing anything and
 *   without consuming real sequence numbers.
 *
 * Usage:
 *   npm run migrate:client-codes --workspace @courier/api            (write)
 *   npm run migrate:client-codes:dry-run --workspace @courier/api    (preview)
 *
 * The core is exported as migrateClientCodes() so the integration suite can run
 * it against throwaway test connections.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectionManager = require('../src/services/tenant/connectionManager');
const { suggestClientPrefix, generateClientCode } = require('@courier/helpers');
const masterNextSequence = require('../src/services/master/counter.service').nextSequence;
const logger = require('../src/logs/logger');

const LEGACY_CODE_PATTERN = /^CUS-\d+$/;
const GLOBAL_CODE_PATTERN = /^[A-Z]{2,5}-\d{6}$/;

/**
 * Deterministic collision suffix for a suggested prefix.
 * Tries base, then base+X, base+XX, base+XXX (never exceeding 5 chars).
 * @param {string} base - Suggested prefix (2-5 uppercase letters)
 * @param {string[]} takenPrefixes - Prefixes already in use
 * @returns {string} A free prefix
 * @throws When every candidate is taken (operator must assign one manually)
 */
function resolveUniquePrefix(base, takenPrefixes) {
  const taken = new Set(takenPrefixes);
  if (!taken.has(base)) return base;
  for (let i = 1; i <= 3; i += 1) {
    const candidate = base.slice(0, 5 - i) + 'X'.repeat(i);
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`No free client code prefix found near "${base}" — assign one manually`);
}

/**
 * Run the migration.
 * @param {Object} opts
 * @param {import('mongoose').Connection} opts.masterConnection - Master connection with
 *   Company + CompanyCounter models registered
 * @param {Function} opts.getTenantConnection - (company) => tenant connection with a
 *   Customer model registered
 * @param {boolean} [opts.dryRun] - Preview mode: log only, never write or consume seqs
 * @param {Object} [opts.log] - Logger (defaults to the app winston logger)
 * @returns {Promise<{companies: number, prefixesAssigned: number, countersSeeded: number, codesRewritten: number}>}
 */
async function migrateClientCodes({ masterConnection, getTenantConnection, dryRun = false, log = logger }) {
  const Company = masterConnection.model('Company');
  const CompanyCounter = masterConnection.model('CompanyCounter');

  const stats = { companies: 0, prefixesAssigned: 0, countersSeeded: 0, codesRewritten: 0 };

  const companies = await Company.find({}).sort({ _id: 1 });

  for (const company of companies) {
    stats.companies += 1;

    // 1. Prefix backfill (deterministic, collision-safe)
    let prefix = company.clientCodePrefix;
    if (!prefix) {
      const base = suggestClientPrefix(company.name);
      if (base.length < 2) {
        throw new Error(
          `Cannot suggest a client code prefix for company "${company.slug}" (name: "${company.name}"); set clientCodePrefix manually`
        );
      }
      const existing = await Company.find({ clientCodePrefix: { $exists: true, $ne: null } }).select('clientCodePrefix');
      prefix = resolveUniquePrefix(base, existing.map((c) => c.clientCodePrefix));
      stats.prefixesAssigned += 1;
      if (!dryRun) {
        company.clientCodePrefix = prefix;
        await company.save();
      }
      log.info(`[${company.slug}] assigned clientCodePrefix ${prefix}${dryRun ? ' (dry-run)' : ''}`);
    }

    // 2. Seed the master counter (nextSequence would create it lazily anyway;
    //    explicit seeding keeps the migration self-contained and idempotent).
    const counter = await CompanyCounter.findOne({ companyId: company._id });
    if (!counter) {
      stats.countersSeeded += 1;
      if (!dryRun) {
        await CompanyCounter.create({ companyId: company._id, seq: 0 });
      }
    }

    // 3. Rewrite legacy CUS- codes, oldest first, using the master counter.
    //    Dry-run simulates the sequence locally so no real numbers are consumed.
    const connection = await getTenantConnection(company);
    const Customer = connection.model('Customer');
    const legacyCustomers = await Customer.find({ code: LEGACY_CODE_PATTERN }).sort({ createdAt: 1 });
    let nextSeq = counter ? counter.seq : 0;
    for (const customer of legacyCustomers) {
      nextSeq += 1;
      const newCode = generateClientCode(prefix, nextSeq);
      stats.codesRewritten += 1;
      log.info(`[${company.slug}] ${customer.code} -> ${newCode}${dryRun ? ' (dry-run)' : ''}`);
      if (!dryRun) {
        const seq = await masterNextSequence(masterConnection, company._id);
        customer.code = generateClientCode(prefix, seq);
        await customer.save();
      }
    }
  }

  return stats;
}

module.exports = { migrateClientCodes, resolveUniquePrefix, LEGACY_CODE_PATTERN, GLOBAL_CODE_PATTERN };

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  const uri = `${process.env.MONGO_URI}/${process.env.MASTER_DB_NAME || 'courier_master'}`;

  (async () => {
    const masterConnection = await mongoose.createConnection(uri).asPromise();
    masterConnection.model('Company', require('../src/models/master/Company'));
    masterConnection.model('CompanyCounter', require('../src/models/master/CompanyCounter'));
    masterConnection.model('Plan', require('../src/models/master/Plan'));
    masterConnection.model('License', require('../src/models/master/License'));
    masterConnection.model('TenantUserIndex', require('../src/models/master/TenantUserIndex'));

    const getTenantConnection = (company) =>
      connectionManager.getConnection({ id: company._id, slug: company.slug, dbName: company.databaseName });

    const stats = await migrateClientCodes({ masterConnection, getTenantConnection, dryRun });
    logger.info(
      `Migration ${dryRun ? 'DRY-RUN (no changes written) ' : ''}complete: ${JSON.stringify(stats)}`
    );
    await connectionManager.closeAll();
    await masterConnection.close();
    process.exit(0);
  })().catch(async (err) => {
    logger.error(`Migration failed: ${err.message}`, { stack: err.stack });
    await connectionManager.closeAll().catch(() => {});
    process.exit(1);
  });
}
