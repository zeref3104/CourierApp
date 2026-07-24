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
  2. Auto-generate customer code: `CUS-{sequential 4-digit}`
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