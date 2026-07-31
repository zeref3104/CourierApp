class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id, options = {}) {
    return this.model.findById(id).select(options.select).populate(options.populate);
  }

  async findAll(query = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 }, select, populate } = options;
    // Clamp pagination: page >= 1 and limit <= 100 so a single request can
    // never force an unbounded scan of a tenant collection.
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      this.model.find(query).sort(sort).skip(skip).limit(safeLimit).select(select).populate(populate),
      this.model.countDocuments(query),
    ]);

    return {
      data,
      meta: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
    };
  }

  async create(data) {
    return this.model.create(data);
  }

  async updateById(id, data, options = { new: true }) {
    return this.model.findByIdAndUpdate(id, data, options);
  }

  async softDelete(id) {
    return this.model.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }

  async count(query = {}) {
    return this.model.countDocuments(query);
  }

  async exists(query) {
    return this.model.exists(query);
  }
}

module.exports = BaseRepository;