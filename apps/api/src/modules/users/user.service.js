const NotFoundException = require('../../exceptions/NotFoundException');
const ConflictException = require('../../exceptions/ConflictException');
const PlanEnforcer = require('../../services/planEnforcer');

class UserService {
  async create(data, models, plan) {
    // Enforce plan limit
    const enforcer = new PlanEnforcer(plan, models);
    await enforcer.checkMaxUsers();

    const existing = await models.User.findOne({ email: data.email });
    if (existing) throw new ConflictException('Email already in use');

    const role = await models.Role.findById(data.roleId);
    if (!role) throw new NotFoundException('Role');

    if (data.branchId) {
      const branch = await models.Branch.findById(data.branchId);
      if (!branch) throw new NotFoundException('Branch');
    }

    return models.User.create(data);
  }

  async findAll(query, models) {
    const { page = 1, limit = 20, search, roleId, branchId, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = { isClient: { $ne: true } };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (roleId) filter.roleId = roleId;
    if (branchId) filter.branchId = branchId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [data, total] = await Promise.all([
      models.User.find(filter).sort(sort).skip(skip).limit(Number(limit)).populate('roleId', 'name code').populate('branchId', 'name'),
      models.User.countDocuments(filter),
    ]);

    return {
      data,
      meta: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id, models) {
    const user = await models.User.findById(id)
      .populate('roleId', 'name code')
      .populate('branchId', 'name');
    if (!user) throw new NotFoundException('User');
    return user;
  }

  async update(id, data, models) {
    const user = await models.User.findById(id);
    if (!user) throw new NotFoundException('User');

    if (data.email && data.email !== user.email) {
      const existing = await models.User.findOne({ email: data.email });
      if (existing) throw new ConflictException('Email already in use');
    }

    // Whitelist updatable fields — never blindly assign arbitrary body keys
    // (prevents setting isClient, clientId, _id, refreshToken, etc.)
    const UPDATABLE_FIELDS = ['name', 'lastName', 'email', 'phone', 'roleId', 'branchId', 'isActive'];
    const updates = {};
    UPDATABLE_FIELDS.forEach((field) => {
      if (data[field] !== undefined) updates[field] = data[field];
    });

    Object.assign(user, updates);
    return user.save();
  }

  async deactivate(id, models) {
    const user = await models.User.findById(id);
    if (!user) throw new NotFoundException('User');
    user.isActive = false;
    return user.save();
  }

  async changePassword(userId, currentPassword, newPassword, models) {
    const user = await models.User.findById(userId).select('+password');
    if (!user) throw new NotFoundException('User');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new ConflictException('Current password is incorrect');

    user.password = newPassword;
    return user.save();
  }
}

module.exports = new UserService();