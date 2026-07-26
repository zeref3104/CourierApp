const NotFoundException = require('../../exceptions/NotFoundException');
const PackageService = require('../packages/package.service');

class SettingService {
  async findAll(models) {
    const settings = await models.Setting.find().sort({ key: 1 });
    const result = {};
    settings.forEach((s) => { result[s.key] = s.value; });
    return result;
  }

  async update(data, userId, models) {
    const keys = Object.keys(data);
    const promises = keys.map(async (key) => {
      await models.Setting.findOneAndUpdate(
        { key },
        { value: data[key], updatedById: userId },
        { upsert: true, new: true }
      );
      // Invalidate cache for this setting key
      PackageService.invalidateCache(key);
    });
    await Promise.all(promises);
    return this.findAll(models);
  }

  async uploadLogo(file, models) {
    if (!file) throw new NotFoundException('File');
    // Cloudinary upload handled by multer middleware
    await models.Setting.findOneAndUpdate(
      { key: 'logo_url' },
      { value: file.path, updatedById: null },
      { upsert: true }
    );
    return file.path;
  }

  async getPublic(models) {
    const settings = await models.Setting.find({
      key: { $in: ['price_per_lb', 'minimum_price', 'currency', 'company_name', 'logo_url', 'company_phone', 'company_email', 'company_address'] },
    });
    const result = {};
    settings.forEach((s) => { result[s.key] = s.value; });
    return result;
  }
}

module.exports = new SettingService();