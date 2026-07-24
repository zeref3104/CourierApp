const HttpException = require('./HttpException');

class TenantNotFoundException extends HttpException {
  constructor(slug, message = null) {
    super(404, message || `Tenant "${slug}" not found or inactive`, 'TENANT_NOT_FOUND');
    this.slug = slug;
  }
}

module.exports = TenantNotFoundException;