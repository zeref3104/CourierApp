const NotFoundException = require('../../exceptions/NotFoundException');
const ConflictException = require('../../exceptions/ConflictException');
const PlanEnforcer = require('../../services/planEnforcer');

class BranchService {
  async create(data, models, plan) {
    // Enforce plan limit
    const enforcer = new PlanEnforcer(plan, models);
    await enforcer.checkMultipleBranches();
    await enforcer.checkMaxBranches();

    const existing = await models.Branch.findOne({ code: data.code });
    if (existing) throw new ConflictException('Branch code already exists');

    if (data.isMainBranch) {
      await models.Branch.updateMany({}, { isMainBranch: false });
    }

    const count = await models.Branch.countDocuments();
    if (count === 0) data.isMainBranch = true;

    return models.Branch.create(data);
  }

  async findAll(models) {
    return models.Branch.find({ isActive: true }).sort({ name: 1 });
  }

  async findById(id, models) {
    const branch = await models.Branch.findById(id).populate('managerId', 'name email');
    if (!branch) throw new NotFoundException('Branch');
    return branch;
  }

  async update(id, data, models) {
    const branch = await models.Branch.findById(id);
    if (!branch) throw new NotFoundException('Branch');

    if (data.code && data.code !== branch.code) {
      // Cannot change code if branch has packages
      const pkgCount = await models.Package.countDocuments({ branchId: id });
      if (pkgCount > 0) throw new ConflictException('Cannot change code: branch has packages');
    }

    // Whitelist updatable fields — never blindly assign arbitrary body keys
    // (prevents setting _id, manager object, etc.)
    const UPDATABLE_FIELDS = ['name', 'code', 'address', 'phone', 'email', 'isActive', 'isMainBranch', 'managerId'];
    const updates = {};
    UPDATABLE_FIELDS.forEach((field) => {
      if (data[field] !== undefined) updates[field] = data[field];
    });

    if (updates.isMainBranch) {
      await models.Branch.updateMany({ _id: { $ne: id } }, { isMainBranch: false });
    }

    Object.assign(branch, updates);
    return branch.save();
  }

  async deactivate(id, models) {
    const branch = await models.Branch.findById(id);
    if (!branch) throw new NotFoundException('Branch');

    const activePackages = await models.Package.countDocuments({ branchId: id, status: { $nin: ['entregado', 'cancelado', 'extraviado'] } });
    if (activePackages > 0) throw new ConflictException('Cannot deactivate: branch has active packages');

    const activeUsers = await models.User.countDocuments({ branchId: id, isActive: true });
    if (activeUsers > 0) throw new ConflictException('Cannot deactivate: branch has active users');

    branch.isActive = false;
    return branch.save();
  }
}

module.exports = new BranchService();