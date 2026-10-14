# Password Recovery Specification

## Purpose

Client-account (Customer + `isClient` User) self-service password reset via email OTP with a `password_reset` purpose. v1: email-only, clients-only; staff/superadmin get only the generic response; SMS and staff recovery are phase-2.

## Requirements

### Requirement: Anti-enumeration Forgot Response

`POST /auth/forgot-password` (public, pre-tenant) MUST return an identical generic 200 whether or not the email matches a client account; only a unique match sends a `password_reset` OTP email.

#### Scenario: Known email

- GIVEN a client email matching one account
- WHEN forgot-password is requested
- THEN generic 200 and a 6-digit OTP email are sent

#### Scenario: Unknown email

- GIVEN an email matching no account
- WHEN forgot-password is requested
- THEN identical 200 is returned, no email is sent, timing reveals nothing

### Requirement: Client-code Disambiguation

An email matching clients in 2+ companies (`ClientEmailIndex` is per-company unique) MUST yield 409 asking for the client code, mirroring `clientLogin`, with no OTP sent.

#### Scenario: Ambiguous email without code

- GIVEN a client email existing in multiple companies
- WHEN forgot-password is requested with only the email
- THEN 409 asks for the client code; no OTP is sent

#### Scenario: Ambiguous email with valid code

- GIVEN the same ambiguous email
- WHEN forgot-password includes the correct client code
- THEN one account resolves; generic 200 and OTP email follow

### Requirement: OTP Purpose Isolation

Reset codes MUST be keyed by purpose (`email:password_reset`) so they never collide with `register` codes, whose behavior MUST stay unchanged.

#### Scenario: Purpose-scoped keys

- GIVEN an OTP exists for `email:register`
- WHEN a reset OTP is issued for the same email
- THEN a distinct `email:password_reset` record is created; register code untouched

### Requirement: OTP Lifecycle

Reset OTPs MUST follow the existing OTP contract: 6-digit, hashed at rest, 10-min TTL, 60-s resend cooldown (429), 5 failed attempts max, single-use.

#### Scenario: Expired or exhausted code rejected

- GIVEN an OTP past 10 minutes or with 5 failed attempts
- WHEN verification is attempted
- THEN rejected; no account information revealed

#### Scenario: Single-use consumption

- GIVEN an OTP consumed by a successful reset
- WHEN the code is submitted again
- THEN it is rejected as invalid

#### Scenario: Resend cooldown

- GIVEN a code sent 30 seconds ago
- WHEN resend is requested
- THEN 429 is returned until 60 seconds elapse

### Requirement: Password Reset Application

`POST /auth/reset-password` (public, pre-tenant) MUST verify the OTP, save the new password hashed, clear `failedLoginAttempts`/`lockedUntil`, and set `mustChangePassword: false`.

#### Scenario: Successful reset

- GIVEN a valid unconsumed OTP for a client account
- WHEN reset is submitted with a compliant new password
- THEN the password is saved hashed, lockout cleared, `mustChangePassword` false, OTP consumed

### Requirement: Session Revocation on Reset

A successful reset MUST revoke the refresh-token chain by clearing `refreshToken` and `previousRefreshTokenHash`.

#### Scenario: Stolen session dies after reset

- GIVEN a client session known to an attacker
- WHEN the user completes a password reset
- THEN the stolen refresh token is rejected; new login issues a fresh token pair

### Requirement: Rate Limiting and Public Access

Both endpoints MUST sit behind the auth rate limiter (10 req/15 min) and MUST be public routes bypassing tenant resolution.

#### Scenario: Request burst throttled

- GIVEN an IP over the auth limiter budget
- WHEN forgot-password is requested again
- THEN 429 is returned

### Requirement: Web Flow and Localization

Web MUST offer a "Forgot password?" login link and a `/auth/forgot-password` route (email → OTP → new-password, mirroring `RegisterPage`). UI strings and OTP email copy MUST be localized in es, en, fr.

#### Scenario: Complete localized recovery

- GIVEN the login page in the es locale
- WHEN the user follows the link, submits email, enters the OTP, sets a password
- THEN all steps and the OTP email render in Spanish; success redirects to login
