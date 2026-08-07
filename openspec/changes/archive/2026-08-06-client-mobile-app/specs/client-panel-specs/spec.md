# Delta for client-panel-specs

> Spec 13 (`13-client-panel-specs.md`) was empty; this delta writes the full client panel capability consumed by the mobile app. All content is ADDED.

## ADDED Requirements

### Requirement: Client Dashboard

The system MUST expose `GET /api/v1/client/dashboard` (authenticated client) returning the client's `totalPackages`, `inTransit`, `readyForPickup`, and `delivered` counts, gated by the client panel plan check.

#### Scenario: Dashboard returns four stats
- GIVEN an authenticated client with packages
- WHEN the dashboard endpoint is called
- THEN all four counts MUST be returned

### Requirement: Client Package List

The system MUST expose `GET /api/v1/client/packages` returning the authenticated client's packages, filterable by `status` and paginated.

#### Scenario: List filtered by status
- GIVEN a client with packages in several statuses
- WHEN listing with `status=disponible`
- THEN only `disponible` packages MUST be returned

### Requirement: Client Package Tracking Detail

The system MUST expose `GET /api/v1/client/packages/:tracking` returning the package detail, its `PackageHistory` timeline ordered chronologically, and the populated pickup branch. The happy-path timeline spans the 8 statuses `recibido_miami → almacen_miami → en_transito → llego_rd → almacen_rd → disponible → en_reparto → entregado`; `cancelado`/`extraviado` are terminal.

#### Scenario: Timeline returned in order
- GIVEN a delivered package with full history
- WHEN its tracking detail is requested
- THEN the history MUST be ordered chronologically across the 8 statuses

### Requirement: Amount to Pay at Pickup

When a client's package is in `disponible` status, the package response MUST include the amount to pay (the stored `package.total` = weight × rate + tax, already computed at creation) and the pickup branch info (`id`, `name`, `address`). For any other status, no amount-to-pay MUST be exposed.

#### Scenario: Disponible shows total and branch
- GIVEN a package in `disponible` status
- WHEN its detail is requested
- THEN the response MUST include the amount to pay and the pickup branch

#### Scenario: Non-disponible hides amount
- GIVEN a package in `en_reparto` status
- WHEN its detail is requested
- THEN the response MUST NOT include an amount-to-pay

### Requirement: Client Profile

The system MUST expose `GET /api/v1/client/profile` and `PATCH /api/v1/client/profile` for the authenticated client to read and update their own profile.

#### Scenario: Client updates own profile
- GIVEN an authenticated client
- WHEN they PATCH their profile with valid data
- THEN the updated profile MUST be returned
