# Client Code Login Specification

## Purpose

Client authentication keyed by the GLOBAL client code `{PREFIX}-{SEQ}` + password, with tenant resolution derived from the code (no email, no company selector). Adds a cookie-free in-body refresh variant for React Native. Staff email login (auth-specs §1.1) is unchanged.

## Requirements

### Requirement: Code-Based Client Login

The system MUST authenticate clients via `POST /api/v1/auth/client/login` accepting ONLY `code` and `password`. The tenant MUST be resolved from the code: parse the prefix, look up the company by `clientCodePrefix` in the master database, then resolve the tenant database; the Customer MUST be found by full code in that tenant and its linked `isClient` User MUST be verified with bcrypt. A valid login MUST issue a client-scoped access token (`/api/v1/client/*`) plus a client refresh token.

#### Scenario: Login with global code
- GIVEN a client with code `CS-000001` and a valid password
- WHEN `POST /auth/client/login` is called with `{ code: "CS-000001", password }`
- THEN the client MUST be authenticated
- AND the response MUST include the access token and limited client profile

#### Scenario: Unknown prefix rejected
- GIVEN a code whose prefix matches no company
- WHEN login is attempted
- THEN the system MUST return 404
- AND no token MUST be issued

#### Scenario: Wrong password rejected
- GIVEN a valid code but an incorrect password
- WHEN login is attempted
- THEN the system MUST return 401

### Requirement: Inactive Company Rejection

The system MUST reject login for codes whose company is inactive or whose license is not active, returning 401/403 without issuing tokens.

#### Scenario: Inactive company blocks login
- GIVEN a client whose company is deactivated
- WHEN login is attempted
- THEN the system MUST refuse authentication

### Requirement: Client Refresh Without Cookies

The system MUST provide `POST /api/v1/auth/client/refresh` accepting `refreshToken` in the request BODY and returning the new access token AND new refresh token in the body (no HTTP-only cookie dependency). Refresh MUST rotate tokens (hash stored), and a reused refresh token MUST revoke all of the client's tokens (replay protection).

#### Scenario: Body refresh rotates tokens
- GIVEN a client holding a valid refresh token
- WHEN `POST /auth/client/refresh` is called with the token in the body
- THEN new access and refresh tokens MUST be returned in the body
- AND the old refresh token MUST be revoked

#### Scenario: Replay of refresh token
- GIVEN a refresh token that was already used
- WHEN it is submitted again
- THEN ALL of the client's tokens MUST be revoked
- AND the client MUST be forced to re-login

### Requirement: Staff Email Login Preserved

The system MUST keep `POST /api/v1/auth/login` (staff) keyed by email + password exactly as documented in auth-specs §1.1. Client login MUST NOT require email, subdomain, or tenant header.

#### Scenario: Staff login unchanged
- GIVEN a staff user with valid email and password
- WHEN `POST /auth/login` is called
- THEN authentication MUST behave exactly as before this change
