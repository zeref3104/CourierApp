const NotFoundException = require('../../exceptions/NotFoundException');
const ConflictException = require('../../exceptions/ConflictException');

class RoleService {
  async create(data, models) {
    const existing = await models.Role.findOne({ code: data.code });
    if (existing) throw new ConflictException('Role code already exists');
    return models.Role.create(data);
  }

  async findAll(models) {
    return models.Role.find().sort({ name: 1 });
  }

  async update(id, data, models) {
    const role = await models.Role.findById(id);
    if (!role) throw new NotFoundException('Role');

    if (role.isSystem && data.code && data.code !== role.code) {
      throw new ConflictException('Cannot change code of system role');
    }

    // Whitelist updatable fields — never blindly assign arbitrary body keys
    // (prevents callers from setting isSystem, _id, etc.)
    const UPDATABLE_FIELDS = ['name', 'code', 'description', 'permissions'];
    const updates = {};
    UPDATABLE_FIELDS.forEach((field) => {
      if (data[field] !== undefined) updates[field] = data[field];
    });

    Object.assign(role, updates);
    return role.save();
  }

  async delete(id, models) {
    const role = await models.Role.findById(id);
    if (!role) throw new NotFoundException('Role');
    if (role.isSystem) throw new ConflictException('Cannot delete system role');

    const userCount = await models.User.countDocuments({ roleId: id });
    if (userCount > 0) throw new ConflictException('Cannot delete role with active users');

    return models.Role.findByIdAndDelete(id);
  }
}

module.exports = new RoleService();