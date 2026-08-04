/**
 * Atomic per-company sequence generator backed by the master CompanyCounter model.
 * Mirrors services/tenant/counter.service.js: a findOneAndUpdate $inc upsert
 * prevents the count+1 race, and a 11000 duplicate-key retry handles concurrent
 * first-time creation for the same company.
 *
 * @param {import('mongoose').Connection} masterConnection - Master DB connection
 * @param {import('mongoose').Types.ObjectId} companyId - Company owning the sequence
 * @returns {Promise<number>} The next sequence number
 */
async function nextSequence(masterConnection, companyId) {
  const CompanyCounter = masterConnection.model('CompanyCounter');
  const run = () =>
    CompanyCounter.findOneAndUpdate(
      { companyId },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );

  try {
    const counter = await run();
    return counter.seq;
  } catch (err) {
    if (err.code !== 11000) throw err;
    // Lost the creation race — another process inserted the counter first.
    const counter = await run();
    return counter.seq;
  }
}

module.exports = { nextSequence };
