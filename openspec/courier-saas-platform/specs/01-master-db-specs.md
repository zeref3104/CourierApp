# SDD Specs: Master Database Module

**Change:** `courier-saas-platform`
**Phase:** Specs
**Module:** Master Database & Tenant Management
**Dependencies:** None (Foundation)

---

## 1. Companies Module

### 1.1 Create Company
- **Actor:** SuperAdmin
- **Endpoint:** `POST /api/v1/superadmin/companies`
- **Input:**
  - name (string, required): Company name
  - slug (string, required): Unique subdomain identifier
  - email (string, required): Company email
  - phone (string, optional)
  - address (string, optional)
  - planId (ObjectId, required): Reference to a Plan
  - clientCodePrefix (string, optional, `[A-Z]{2,5}`): Platform-unique prefix for the global client code; server-suggested from company name initials, administrator MAY override
- **Process:**
  1. Validate input with Zod schema
  2. Check slug uniqueness in `companies` collection
  3. Check `clientCodePrefix` uniqueness in `companies` collection (409 if taken; company uncreated)
  4. Generate unique `databaseName` as `courier_{slug}`
  5. Create the tenant MongoDB database
  6. Create default collections and indexes in tenant DB
  7. Seed default roles (Administrador, Caja, Recepción, Almacén, Repartidor) plus the canonical `client` role (isSystem, permissions `[]`)
  8. Seed default settings (prices, company info)
  9. Create first admin user (provided in request)
  10. Create License record with startDate = now, status = "trial"
  11. Create the master-DB `CompanyCounter` record (per-company client sequence, zero-padded 6)
  12. Return created company
- **Validation Rules:**
  - slug: only lowercase letters, numbers, hyphens. 3-30 chars
  - email: valid email format
  - name: 2-100 chars
  - clientCodePrefix: 2-5 uppercase letters, platform-unique, immutable after creation
- **Response:** Created company object
- **Error Cases:**
  - 409: Slug already exists
  - 409: clientCodePrefix already exists
  - 404: Plan not found
  - 400: Validation errors

### 1.2 List Companies
- **Actor:** SuperAdmin
- **Endpoint:** `GET /api/v1/superadmin/companies`
- **Query Params:** page, limit, search, status, sortBy, sortOrder
- **Response:** Paginated list of companies with plan and license info
- **Business Rules:**
  - Search matches name, slug, email (case-insensitive)
  - Default sort by createdAt descending
  - Include license status and plan name in response

### 1.3 Get Company
- **Actor:** SuperAdmin
- **Endpoint:** `GET /api/v1/superadmin/companies/:id`
- **Response:** Full company details including license, plan, stats (total users, packages, etc.)

### 1.4 Update Company
- **Actor:** SuperAdmin
- **Endpoint:** `PATCH /api/v1/superadmin/companies/:id`
- **Rules:**
  - Cannot change slug if company has data
  - Cannot change databaseName
  - Changing planId updates the License
- **Response:** Updated company

### 1.5 Deactivate Company
- **Actor:** SuperAdmin
- **Endpoint:** `DELETE /api/v1/superadmin/companies/:id`
- **Process:**
  1. Set isActive = false
  2. Expire current license
  3. All users from that tenant lose access on next request (tenant resolver rejects inactive)
- **Restore:** PATCH to set isActive = true, creates new license

---

## 2. Plans Module

### 2.1 Create Plan
- **Actor:** SuperAdmin
- **Endpoint:** `POST /api/v1/superadmin/plans`
- **Input:**
  - name, code, description, price
  - features: maxUsers, maxBranches, maxPackagesPerMonth, storageGB, apiAccess, reports, multipleBranches, clientPanel, whatsappNotifications
- **Rules:**
  - code must be unique
  - System plans cannot be deleted

### 2.2 List Plans
- **Actor:** SuperAdmin
- **Endpoint:** `GET /api/v1/superadmin/plans`
- **Response:** All active plans

### 2.3 Update Plan
- **Actor:** SuperAdmin
- **Endpoint:** `PATCH /api/v1/superadmin/plans/:id`
- **Rules:** Changing features does not affect existing companies until license renewal

---

## 3. Licenses Module

### 3.1 Auto-creation
- When a company is created, a license is auto-created with status "trial" for 14 days

### 3.2 License Management
- **Endpoint:** `GET /api/v1/superadmin/licenses?companyId=:id`
- **Actor:** SuperAdmin
- **Actions:** Extend, cancel, change plan

---

## 4. Tenant Database Creation

### 4.1 Collections Created on Tenant Provisioning

When a new company is created, the system must provision a new MongoDB database with:

1. **Collections:** users, roles, permissions, customers, packages, packagehistories, branches, payments, receipts, deliveries, rates, notifications, activitylogs, settings
2. **Indexes:** As defined in proposal schema
3. **Seed Data:**
   - Default roles (5):
     - Administrador: all permissions
     - Caja: payments.*, customers.read, packages.read
     - Recepción: packages.*, customers.*
     - Almacén: packages.read, packages.update (status)
     - Repartidor: deliveries.*, packages.read
   - Default settings:
     - price_per_lb: 0
     - minimum_price: 0
     - company_name: (from company data)
     - currency: DOP
     - tax_rate: 18
   - Default branch: "Sucursal Principal" (isMainBranch: true)
   - First admin user

### 4.2 Connection Pool Defaults
- **maxPoolSize:** 10 per tenant connection
- **minPoolSize:** 2 per tenant connection
- **serverSelectionTimeoutMS:** 5000
- **heartbeatFrequencyMS:** 10000
- **Max cached connections:** 100 (LRU eviction)
- **Idle connection timeout:** 30 minutes