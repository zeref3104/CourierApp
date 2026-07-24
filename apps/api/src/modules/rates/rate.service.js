const NotFoundException = require('../../exceptions/NotFoundException');

class RateService {
  async create(data, models) {
    return models.Rate.create(data);
  }

  async findAll(models) {
    return models.Rate.find().sort({ name: 1 });
  }

  async findById(id, models) {
    const rate = await models.Rate.findById(id);
    if (!rate) throw new NotFoundException('Rate');
    return rate;
  }

  async update(id, data, models) {
    const rate = await models.Rate.findByIdAndUpdate(id, data, { new: true });
    if (!rate) throw new NotFoundException('Rate');
    return rate;
  }

  async getActive(models) {
    return models.Rate.findOne({ isActive: true });
  }
}

module.exports = new RateService();