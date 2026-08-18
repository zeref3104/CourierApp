const NotFoundException = require('../../exceptions/NotFoundException');
const PackageService = require('../packages/package.service');
const { invalidateSettingsCache } = require('../../events/handlers/notificationHandler');

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
      // Invalidate this tenant's cache entry for the setting key
      PackageService.invalidateCache(models.Setting.db.name, key);
      // Also clear the notificationHandler cache (separate Map) so emails and
      // pushes pick up the new setting immediately (language, etc.).
      invalidateSettingsCache(models.Setting.db.name, key);
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