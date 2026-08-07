# Client Code Identity Specification

## Purpose

Defines the GLOBAL client identity code `{PREFIX}-{SEQ}` (e.g. `CS-000001`) for customers across all tenants. A Company carries a platform-unique `clientCodePrefix` set once at provisioning; the sequential part comes from a master-DB counter per company. This supersedes the per-tenant `CUS-{seq}` generation documented in customers-specs §1.2.

## Requirements

### Requirement: Company Client Code Prefix

The Company model MUST store `clientCodePrefix`: a string of 2-5 uppercase letters `[A-Z]`, required for every company, platform-unique (unique index in the master database), and immutable once set at provisioning.

#### Scenario: Prefix set at provisioning
- GIVEN a company is being created
- WHEN the provisioning process completes
- THEN the company MUST have a `clientCodePrefix` matching `[A-Z]{2,5}`
- AND no other company MAY share that prefix

#### Scenario: Duplicate prefix rejected
- GIVEN a company prefix that another company already uses
- WHEN the prefix is submitted
- THEN the system MUST reject it with 409 Conflict

### Requirement: Prefix Suggestion and Validation

The system MUST suggest a prefix derived from the company name initials (2-5 uppercase letters) during provisioning; the administrator MAY override the suggestion, and the final value MUST pass charset, length, and platform-uniqueness validation before the company is created.

#### Scenario: Suggestion from company name
- GIVEN a company named "Rapid Box"
- WHEN provisioning suggests a prefix
- THEN the suggestion MUST be `RB` (initials-based)

#### Scenario: Override to taken prefix
- GIVEN the administrator overrides the suggestion
- WHEN the override matches an existing company prefix
- THEN the system MUST reject it and keep the company uncreated

### Requirement: Master Sequence Counter Per Company

The system MUST maintain a per-company sequence counter in the MASTER database, keyed by company (`{companyId}:client-seq`), incremented atomically (compare-and-set `$inc`) for every code generation, and formatted zero-padded to 6 digits.

#### Scenario: Atomic sequence allocation
- GIVEN two concurrent customer creations for the same company
- WHEN both request a client code
- THEN each MUST receive a distinct sequence number

#### Scenario: First code uses 6-digit sequence
- GIVEN a company with prefix `CS` and no codes yet
- WHEN the first customer is created
- THEN the code MUST be `CS-000001`

### Requirement: Global Customer Code Generation

Every Customer creation (staff-created via `POST /customers` or client self-registration) MUST assign the code `{company.clientCodePrefix}-{seq:6}` at creation time, matching `^[A-Z]{2,5}-\d{6}$`. The code MUST be immutable after creation.

#### Scenario: Staff creation gets global code
- GIVEN a staff user creates a customer in a company with prefix `FCG`
- WHEN the customer is saved
- THEN the code MUST follow the `FCG-######` format
- AND the code MUST NOT be changeable via `PATCH /customers/:id`

### Requirement: Migration of Existing Customer Codes

(Decision: MIGRATE.) When a company's `clientCodePrefix` is assigned at provisioning, the system MUST regenerate every existing per-tenant `CUS-{4}` customer code to the new global format using the master counter, preserving customer identity (same document, code field updated). The migration MUST be idempotent, and the `CUS-` format MUST NOT be generated for any new customer.

#### Scenario: Existing codes backfilled
- GIVEN a tenant with 3 customers holding `CUS-0001`..`CUS-0003`
- WHEN the prefix `RB` is assigned
- THEN the codes MUST become `RB-000001`, `RB-000002`, `RB-000003`

#### Scenario: No CUS- codes remain active
- GIVEN the migration has run
- WHEN any customer code is queried
- THEN no active customer MAY hold a `CUS-` prefixed code
