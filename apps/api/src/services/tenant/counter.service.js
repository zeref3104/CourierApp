/**
 * Atomic per-tenant sequence generator backed by the tenant Counter model.
 * Prevents the count+1 race that caused duplicate-key (11000) errors.
 *
 * On first use for a key, the counter is seeded from the existing data so
 * newly generated values never collide with pre-existing ones (e.g. codes
 * created before this counter existed).
 */

async function nextSequence(models, key, options = {}) {
  const { seedFrom, session } = options;
  const run = (query, update, opts) => {
    const q = models.Counter.findOneAndUpdate(query, update, opts);
    return session ? q.session(session) : q;
  };

  const find = (query) => {
    const q = models.Counter.findOne(query);
    return session ? q.session(session) : q;
  };

  let counter = await find({ key });

  if (!counter) {
    const seed = seedFrom ? await seedFrom(session) : 0;
    try {
      counter = await run({ key }, { $inc: { seq: seed + 1 } }, { upsert: true, new: true });
    } catch (err) {
      if (err.code !== 11000) throw err;
      // Lost the creation race — another process inserted the counter first.
      counter = await run({ key }, { $inc: { seq: 1 } }, { new: true });
    }
  } else {
    counter = await run({ key }, { $inc: { seq: 1 } }, { new: true });
  }

  return counter.seq;
}

module.exports = { nextSequence };
