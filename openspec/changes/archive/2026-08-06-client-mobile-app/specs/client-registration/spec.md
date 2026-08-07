# Client Registration Specification

## Purpose

Self-service client registration: public company → active branch selectors, a registration form, email OTP verification BEFORE account creation, and atomic creation of a Customer (with global client code) plus a linked `isClient` User, ending in auto-login. Reconciles spec 02 §2.2, which documented `POST /auth/client/register` but was never implemented.

## Requirements

### Requirement: Public Company Lookup for Registration

The system MUST expose `GET /api/v1/public/companies` returning ONLY active companies with minimal fields (`id`, `slug`, `name`). It MUST NOT expose license, plan, pricing, or any internal company data. Companies with inactive license MUST be excluded.

#### Scenario: Active companies listed
- GIVEN two companies, one active and one inactive
- WHEN the public companies endpoint is called
- THEN only the active company MUST appear
- AND each entry MUST contain only `id`, `slug`, `name`

#### Scenario: No license or plan leakage
- GIVEN a company with a trial license and plan `basic`
- WHEN the public companies endpoint is called
- THEN the response MUST NOT contain license or plan fields

### Requirement: Public Branch Lookup for Registration

The system MUST expose `GET /api/v1/public/companies/:id/branches` returning only ACTIVE branches (`id`, `name`, `address`) of an active company. Inactive or unknown companies MUST return 404 with no branch data.

#### Scenario: Active branches returned
- GIVEN an active company with one active and one inactive branch
- WHEN its public branches endpoint is called
- THEN only the active branch MUST be returned

### Requirement: Registration OTP Preconditions

The system MUST verify the email via OTP BEFORE creating any account. Registration MUST NOT create a Customer or User until the submitted OTP is valid, and the OTP MUST be single-use, bound to the submitted email, with the send/verify contracts defined in the auth-specs delta (6 digits, 10-minute expiry, 5 verify attempts, resend cooldown).

#### Scenario: Account not created before verification
- GIVEN a user requests an OTP but never verifies it
- WHEN no valid OTP is submitted with the register call
- THEN no Customer and no User MUST be created
- AND the system MUST respond with an OTP error

### Requirement: Self-Service Registration

The system MUST provide `POST /api/v1/auth/client/register` accepting `companyId`, `branchId`, `name`, `lastName`, `phone`, `document` (optional), `email`, `password`, and `otpCode`. It MUST validate that the company is active, the branch belongs to that company and is active, the OTP is valid for the email, and the email is not already registered in that tenant.

#### Scenario: Registration with OTP succeeds
- GIVEN a valid company, branch, unique email, and a verified OTP
- WHEN the register request is submitted
- THEN a Customer with a global client code MUST be created
- AND a linked `isClient` User MUST be created in the same transaction
- AND the response MUST include access and refresh tokens (auto-login)

#### Scenario: Duplicate email rejected
- GIVEN an email already registered in the target tenant
- WHEN the register request is submitted
- THEN the system MUST return 409 Conflict
- AND no account MUST be created

#### Scenario: Invalid OTP aborts registration
- GIVEN a register request with an expired or wrong OTP
- WHEN the request is processed
- THEN the system MUST reject it
- AND no Customer or User MUST be created

### Requirement: Atomic Client Creation

The system MUST create the Customer and its linked `isClient` User in a single transaction: a failure in either step MUST roll back both and return an error.

#### Scenario: User creation failure rolls back customer
- GIVEN a register request passes validation
- WHEN the `isClient` User creation fails
- THEN the Customer MUST NOT persist
- AND the caller MUST receive a failure response
