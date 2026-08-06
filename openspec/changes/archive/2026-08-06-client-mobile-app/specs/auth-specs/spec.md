# Delta for auth-specs

## ADDED Requirements

### Requirement: Client Registration OTP Verification

The system MUST provide `POST /api/v1/auth/client/otp/send` (`email`) and `POST /api/v1/auth/client/otp/verify` (`email`, `code`) to verify the registration email BEFORE account creation. The code MUST be 6 digits, expire after 10 minutes, be single-use, allow at most 5 failed verify attempts (after which the code MUST be invalidated), and resend MUST be blocked by a 60-second cooldown. The OTP email MUST use the existing 3-language (es/en/fr) template convention.

#### Scenario: OTP sent and verified
- GIVEN a client submits a registration email
- WHEN they request an OTP and then verify it
- THEN a 6-digit code MUST be emailed with a 10-minute expiry
- AND verification MUST succeed exactly once

#### Scenario: Five failed attempts invalidate the code
- GIVEN a client has made 5 failed verify attempts
- WHEN they submit the correct code as a 6th attempt
- THEN the code MUST be rejected as invalidated

#### Scenario: Resend blocked by cooldown
- GIVEN an OTP was sent less than 60 seconds ago
- WHEN a resend is requested
- THEN the system MUST reject it (429)

### Requirement: Client Refresh Token in Body

The system MUST provide `POST /api/v1/auth/client/refresh` accepting the refresh token in the request BODY and returning the new access token AND new refresh token in the body, for React Native clients that cannot use HTTP-only cookies. Rotation and replay protection MUST match the web refresh contract (spec §1.2).

#### Scenario: Body-based refresh
- GIVEN a client with a valid refresh token
- WHEN they call the client refresh endpoint with the token in the body
- THEN new tokens MUST be returned in the body
- AND the old refresh token MUST be revoked

## MODIFIED Requirements

### Requirement: Client Login (Section 2.1)

- **Endpoint:** `POST /api/v1/auth/client/login`
- **Input:** `code` (global client code `{PREFIX}-{SEQ}`, e.g. `CS-000001`), `password`
- **Process:**
  1. Resolve tenant from the code: parse the prefix, look up the company by `clientCodePrefix` in the master DB, resolve the tenant database
  2. Find the Customer by full code in the tenant DB
  3. Find the linked User (`isClient: true`) and compare password with bcrypt
  4. If match: generate client access token (restricted scope) + client refresh token
  5. Return limited profile (name, customerCode, clientId)
- **Access Scope:** Clients can only access `/api/v1/client/*` routes
- **Error Cases:**
  - 401: Invalid credentials / inactive user
  - 404: Unknown code (prefix or code not found)
  - 401/403: Company inactive or license not active

(Previously: client login was keyed by email + password; no tenant resolution from code.)

#### Scenario: Login with global code and password
- GIVEN a client with code `CS-000001` and a valid password
- WHEN submitting `{ code: "CS-000001", password }`
- THEN the client MUST be authenticated
- AND the response MUST include the access token and limited profile

#### Scenario: Unknown code rejected
- GIVEN a code that resolves to no company or customer
- WHEN submitting it
- THEN the system MUST return 404 with no token

#### Scenario: Email no longer accepted
- GIVEN a client submitting an email as the login identifier
- WHEN attempting client login
- THEN the system MUST reject the request (email is not a valid client login identifier)

### Requirement: Client Register (Section 2.2)

- **Endpoint:** `POST /api/v1/auth/client/register`
- **Input:** `companyId`, `branchId`, `name`, `lastName`, `phone`, `document` (optional), `email`, `password`, `otpCode`
- **Process:**
  1. Validate that the OTP was verified for the email (per Client Registration OTP Verification)
  2. Validate the company is active and the branch belongs to it and is active
  3. Validate email uniqueness within the tenant and password rules (spec §5)
  4. In a single transaction: create the Customer with a global client code (per client-code-identity) AND create the User with `isClient: true` linked via `clientId`
  5. On success: return access token + client refresh token in the body (auto-login)
- **Error Cases:**
  - 409: Email already registered in the tenant
  - 422: Invalid or expired OTP, or invalid payload
  - 400/404: Inactive or unknown company/branch

(Previously: documented but NEVER implemented — no company/branch selection, no OTP verification, no transactional guarantee. This replaces the unimplemented contract with the implemented one.)

#### Scenario: Registration completes with auto-login
- GIVEN a verified OTP, an active company and branch, and a unique email
- WHEN the register request is submitted
- THEN a Customer and a linked `isClient` User MUST be created atomically
- AND the response MUST include access and refresh tokens

#### Scenario: Invalid OTP prevents account creation
- GIVEN a register request with an expired or wrong OTP
- WHEN it is processed
- THEN the system MUST reject with 422
- AND no Customer or User MUST be created

#### Scenario: Duplicate email rejected
- GIVEN an email already registered in the target tenant
- WHEN the register request is submitted
- THEN the system MUST return 409
