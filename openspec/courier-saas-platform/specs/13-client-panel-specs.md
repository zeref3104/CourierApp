# SDD Specs: Client Panel

**Change:** `courier-saas-platform`
**Phase:** Specs
**Module:** Client Panel API
**Dependencies:** Auth (client tokens), Customers, Packages, Branches

---

## 1. Client Dashboard

- **Endpoint:** `GET /api/v1/client/dashboard` (authenticated client)
- **Response:** client's `totalPackages`, `inTransit`, `readyForPickup`, and `delivered` counts, gated by the client panel plan check.
- **Scenarios:**
  - Dashboard returns four stats → authenticated client with packages calls the endpoint → all four counts MUST be returned

## 2. Client Package List

- **Endpoint:** `GET /api/v1/client/packages` (authenticated client)
- **Query:** `status` filter, pagination
- **Scenarios:**
  - List filtered by status → client with packages in several statuses lists with `status=disponible` → only `disponible` packages MUST be returned

## 3. Client Package Tracking Detail

- **Endpoint:** `GET /api/v1/client/packages/:tracking` (authenticated client)
- **Response:** package detail, its `PackageHistory` timeline ordered chronologically, and the populated pickup branch.
- **Timeline:** happy-path spans the 8 statuses `recibido_miami → almacen_miami → en_transito → llego_rd → almacen_rd → disponible → en_reparto → entregado`; `cancelado`/`extraviado` are terminal.
- **Scenarios:**
  - Timeline returned in order → delivered package with full history, tracking detail requested → history MUST be ordered chronologically across the 8 statuses

## 4. Amount to Pay at Pickup

When a client's package is in `disponible` status, the package response MUST include the amount to pay (the stored `package.total` = weight × rate + tax, already computed at creation) and the pickup branch info (`id`, `name`, `address`). For any other status, no amount-to-pay MUST be exposed.

- **Scenarios:**
  - Disponible shows total and branch → package in `disponible` status, detail requested → response MUST include the amount to pay and the pickup branch
  - Non-disponible hides amount → package in `en_reparto` status, detail requested → response MUST NOT include an amount-to-pay

## 5. Client Profile

- **Endpoints:** `GET /api/v1/client/profile` and `PATCH /api/v1/client/profile` (authenticated client)
- **Scenarios:**
  - Client updates own profile → authenticated client PATCHes their profile with valid data → the updated profile MUST be returned
