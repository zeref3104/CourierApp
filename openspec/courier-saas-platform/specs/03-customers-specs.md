# SDD Specs: Customers

**Change:** `courier-saas-platform`
**Phase:** Specs
**Module:** Customers
**Dependencies:** Branches (exists), Auth (authenticated)

---

## 1. Create Customer

- **Endpoint:** `POST /api/v1/customers`
- **Actor:** Administrador, Recepción
- **Input:**
  - name (string, required, 2-50 chars)
  - lastName (string, required, 2-50 chars)
  - document (string, optional, 6-15 chars)
  - phone (string, required, 10-15 chars)
  - email (string, optional, valid email)
  - address (string, optional, max 200 chars)
  - branchId (ObjectId, optional — defaults to user's branch)
  - notes (string, optional, max 500 chars)
- **Process:**
  1. Validate input with Zod
  2. Auto-generate customer code: `{company.clientCodePrefix}-{seq:6}` (global client code, per client-code-identity; the old `CUS-{4}` format is deprecated and never generated for new customers)
  3. Auto-assign Miami address from branch configuration
  4. Check email uniqueness (if provided) within tenant
  5. Save customer
  6. Emit event `CUSTOMER_CREATED`
  7. Return created customer
- **Response:** Full customer object with generated code

## 2. List Customers

- **Endpoint:** `GET /api/v1/customers`
- **Actor:** All roles
- **Query Params:**
  - page (default: 1)
  - limit (default: 20, max: 100)
  - search (string — searches name, lastName, document, email, code)
  - branchId (filter by branch)
  - isActive (boolean)
  - sortBy (default: createdAt)
  - sortOrder (asc/desc)
- **Response:** Paginated list
  ```json
  {
    "success": true,
    "data": [...],
    "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
  }
  ```

## 3. Get Customer Detail

- **Endpoint:** `GET /api/v1/customers/:id`
- **Actor:** All roles
- **Response:** Full customer + summary stats:
  - totalPackages
  - pendingPackages
  - deliveredPackages
  - totalPaid
  - pendingBalance

## 4. Update Customer

- **Endpoint:** `PATCH /api/v1/customers/:id`
- **Actor:** Administrador, Recepción
- **Input:** Same as create, all fields optional
- **Rules:**
  - Cannot change code
  - Email update triggers uniqueness check
- **Response:** Updated customer

## 5. Delete Customer (Soft)

- **Endpoint:** `DELETE /api/v1/customers/:id`
- **Actor:** Administrador
- **Process:** Set isActive = false
- **Rules:**
  - Cannot soft-delete if customer has active (non-delivered) packages
  - Return 409 Conflict if they have active packages

## 6. Get Customer Packages

- **Endpoint:** `GET /api/v1/customers/:id/packages`
- **Actor:** All roles
- **Query:** status, page, limit, dateFrom, dateTo
- **Response:** Paginated list of customer's packages

## 7. Get Customer Payments

- **Endpoint:** `GET /api/v1/customers/:id/payments`
- **Actor:** Administrador, Caja
- **Query:** page, limit, dateFrom, dateTo
- **Response:** Paginated list of customer's payments with balance info

## 8. Client Code Identity

Global client identity code `{PREFIX}-{SEQ}` (e.g. `CS-000001`) for customers across all tenants. A Company carries a platform-unique `clientCodePrefix` set once at provisioning; the sequential part comes from a master-DB counter per company. Supersedes the per-tenant `CUS-{seq}` generation documented in section 1 above.

### 8.1 Company Client Code Prefix

The Company model MUST store `clientCodePrefix`: a string of 2-5 uppercase letters `[A-Z]`, required for every company, platform-unique (unique index in the master database), and immutable once set at provisioning.

- **Scenarios:**
  - Prefix set at provisioning → company MUST have a `clientCodePrefix` matching `[A-Z]{2,5}`, and no other company MAY share it
  - Duplicate prefix rejected → system MUST reject it with 409 Conflict

### 8.2 Prefix Suggestion and Validation

The system MUST suggest a prefix derived from the company name initials (2-5 uppercase letters) during provisioning; the administrator MAY override the suggestion, and the final value MUST pass charset, length, and platform-uniqueness validation before the company is created.

- **Scenarios:**
  - Suggestion from company name → company named "Rapid Box" → suggestion MUST be `RB` (initials-based)
  - Override to taken prefix → system MUST reject it and keep the company uncreated

### 8.3 Master Sequence Counter Per Company

The system MUST maintain a per-company sequence counter in the MASTER database, keyed by company (`{companyId}:client-seq`), incremented atomically (compare-and-set `$inc`) for every code generation, and formatted zero-padded to 6 digits.

- **Scenarios:**
  - Atomic sequence allocation → two concurrent customer creations for the same company MUST each receive a distinct sequence number
  - First code uses 6-digit sequence → company with prefix `CS` and no codes yet → first customer code MUST be `CS-000001`

### 8.4 Global Customer Code Generation

Every Customer creation (staff-created via `POST /customers` or client self-registration) MUST assign the code `{company.clientCodePrefix}-{seq:6}` at creation time, matching `^[A-Z]{2,5}-\d{6}$`. The code MUST be immutable after creation.

- **Scenarios:**
  - Staff creation gets global code → customer in company with prefix `FCG` MUST follow the `FCG-######` format, and the code MUST NOT be changeable via `PATCH /customers/:id`

### 8.5 Migration of Existing Customer Codes

(Decision: MIGRATE.) When a company's `clientCodePrefix` is assigned at provisioning, the system MUST regenerate every existing per-tenant `CUS-{4}` customer code to the new global format using the master counter, preserving customer identity (same document, code field updated). The migration MUST be idempotent, and the `CUS-` format MUST NOT be generated for any new customer.

- **Scenarios:**
  - Existing codes backfilled → tenant with 3 customers holding `CUS-0001`..`CUS-0003`, prefix `RB` assigned → codes MUST become `RB-000001`, `RB-000002`, `RB-000003`
  - No `CUS-` codes remain active → after the migration has run, no active customer MAY hold a `CUS-` prefixed code