class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id, options = {}) {
    return this.model.findById(id).select(options.select).populate(options.populate);
  }

  async findAll(query = {}, options = {}) {
    const { page = 1, limit = 20, sort = { createdAt: -1 }, select, populate } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.model.find(query).sort(sort).skip(skip).limit(Number(limit)).select(select).populate(populate),
      this.model.countDocuments(query),
    ]);

    return {
      data,
      meta: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
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