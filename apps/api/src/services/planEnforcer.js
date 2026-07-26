const ForbiddenException = require('../exceptions/ForbiddenException');

/**
 * Enforces plan feature limits.
 * Called from service-layer methods when creating resources.
 */
class PlanEnforcer {
  /**
   * @param {Object} plan - The plan document (from Company.planId)
   * @param {Object} models - Tenant models for counting existing resources
   */
  constructor(plan, models) {
    this.plan = plan || {};
    this.features = plan?.features || {};
    this.models = models;
  }

  /**
   * Check if the tenant has reached the max users limit.
   */
  async checkMaxUsers() {
    const max = this.features.maxUsers;
    if (!max || max === -1) return; // -1 = unlimited, 0/undefined = no limit set

    const count = await this.models.User.countDocuments({ isClient: { $ne: true } });
    if (count >= max) {
      throw new ForbiddenException(
        `Plan limit reached: maximum ${max} users allowed. Upgrade your plan to add more users.`
      );
    }
  }

  /**
   * Check if the tenant has reached the max branches limit.
   */
  async checkMaxBranches() {
    const max = this.features.maxBranches;
    if (!max || max === -1) return;

    const count = await this.models.Branch.countDocuments({ isActive: true });
    if (count >= max) {
      throw new ForbiddenException(
        `Plan limit reached: maximum ${max} branches allowed. Upgrade your plan to add more branches.`
      );
    }
  }

  /**
   * Check if the tenant has reached the max packages per month limit.
   */
  async checkMaxPackagesPerMonth() {
    const max = this.features.maxPackagesPerMonth;
    if (!max || max === -1) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const count = await this.models.Package.countDocuments({
      createdAt: { $gte: monthStart, $lte: monthEnd },
    });
    if (count >= max) {
      throw new ForbiddenException(
        `Plan limit reached: maximum ${max} packages per month allowed. Upgrade your plan to continue.`
      );
    }
  }

  /**
   * Check if multiple branches are allowed at all.
   */
  async checkMultipleBranches() {
    if (!this.features.multipleBranches) {
      const existing = await this.models.Branch.countDocuments();
      if (existing >= 1) {
        throw new ForbiddenException(
          'Your plan does not support multiple branches. Upgrade to add more branches.'
        );
      }
    }
  }

  /**
   * Check if client panel is allowed.
   */
  checkClientPanel() {
    if (!this.features.clientPanel) {
      throw new ForbiddenException(
        'Your plan does not include the client panel. Upgrade to enable this feature.'
      );
    }
  }
}

module.exports = PlanEnforcer;
