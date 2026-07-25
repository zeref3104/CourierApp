# Delta for auth-specs

## ADDED Requirements

### Requirement: Password Change Endpoint

The system MUST provide `PATCH /api/v1/auth/password` for authenticated users to change their password.

- **Auth**: Bearer token (authenticated user)
- **Input**:
  - `currentPassword` (string, required)
  - `newPassword` (string, required, must meet password rules)
  - `confirmPassword` (string, required, must match newPassword)
- **Validation**: Use existing `changePasswordSchema` from auth validators
- **Process**:
  1. Verify current password against stored bcrypt hash
  2. Validate new password against password rules
  3. Hash new password with bcrypt (salt rounds: 12)
  4. Save new password hash and set `mustChangePassword: false`
  5. Return success response
- **Response**: `{ "success": true, "message": "Password changed successfully" }`
- **Error Cases**:
  - 401: Current password is incorrect
  - 422: New password fails validation rules

#### Scenario: Password changed successfully
- GIVEN the user is authenticated and has `mustChangePassword: true`
- WHEN submitting correct current password and a valid new password
- THEN the password MUST be updated
- AND `mustChangePassword` MUST be set to `false`

#### Scenario: Wrong current password
- GIVEN the user is authenticated
- WHEN submitting an incorrect current password
- THEN the system MUST return 401
- AND the password MUST NOT be changed

## MODIFIED Requirements

### Requirement: Login (Section 1.1)

- **Endpoint:** `POST /api/v1/auth/login`
- **Input:**
  - email (string, required, valid email)
  - password (string, required, min 6 chars)
- **Process:**
  1. Tenant resolver identifies company (subdomain/header)
  2. Find user by email in tenant DB
  3. Compare password with bcrypt hash
  4. If match: generate access token (15min) + refresh token (7 days)
  5. Hash refresh token, save in user document
  6. Set refresh token as HTTP-only cookie (secure, sameSite=strict, path=/api/v1/auth)
  7. Emit event `USER_LOGIN`
  8. Read `mustChangePassword` from user document and include in response
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJ...",
      "mustChangePassword": false,
      "user": {
        "id": "...",
        "name": "...",
        "email": "...",
        "role": "admin",
        "permissions": ["packages.*", "customers.*", "..."]
      }
    }
  }
  ```
- **Error Cases:**
  - 401: Invalid credentials
  - 401: Inactive user
  - 404: Tenant not found

(Previously: Login response did not include `mustChangePassword` field.)

#### Scenario: Login with mustChangePassword flag
- GIVEN a user has `mustChangePassword: true` in the database
- WHEN logging in with valid credentials
- THEN the response MUST include `mustChangePassword: true`
- AND a valid access token MUST be issued

#### Scenario: Login without mustChangePassword
- GIVEN a user has `mustChangePassword: false` or unset
- WHEN logging in with valid credentials
- THEN the response MUST include `mustChangePassword: false`
