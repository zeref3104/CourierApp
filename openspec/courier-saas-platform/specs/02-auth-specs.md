# SDD Specs: Authentication & Authorization

**Change:** `courier-saas-platform`
**Phase:** Specs
**Module:** Auth & RBAC
**Dependencies:** Master DB (companies), Tenant DB (users, roles)

---

## 1. Tenant User Authentication

### 1.1 Login
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
  8. Return access token + user profile
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJ...",
      "user": {
        "id": "...",
        "name": "...",
        "email": "...",
        "role": "admin",
        "permissions": ["packages.*", "customers.*", ...]
      }
    }
  }
  ```
- **Error Cases:**
  - 401: Invalid credentials
  - 401: Inactive user
  - 404: Tenant not found

### 1.2 Refresh Token
- **Endpoint:** `POST /api/v1/auth/refresh`
- **Process:**
  1. Read refresh token from HTTP-only cookie
  2. Find user by comparing hashed token
  3. Verify token not expired (check user.refreshToken, rotation)
  4. If valid: revoke old refresh token, generate new pair
  5. If old token was already used (replay detection): revoke ALL tokens for user, force re-login
  6. Return new access token + set new refresh cookie
- **Security:** Rotation on every refresh prevents token replay attacks

### 1.3 Logout
- **Endpoint:** `POST /api/v1/auth/logout`
- **Process:**
  1. Clear refresh token in DB
  2. Clear refresh cookie
  3. Invalidate any server-side sessions (if any)

### 1.4 Get Current User
- **Endpoint:** `GET /api/v1/auth/me`
- **Headers:** Authorization: Bearer <accessToken>
- **Response:** User profile with role, permissions, branch info

---

## 2. Client Authentication

### 2.1 Client Login
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
- **Note:** Client login is keyed by the global client code + password only; email is NOT a valid client login identifier. Staff email login (`POST /api/v1/auth/login`, section 1.1) is unchanged.
- **Scenarios:**
  - Login with global code and password → client MUST be authenticated, response includes access token and limited profile
  - Unknown prefix rejected → 404, no token issued
  - Wrong password rejected → 401
  - Inactive company blocks login → 401/403, no token issued

### 2.2 Client Register
- **Endpoint:** `POST /api/v1/auth/client/register`
- **Input:** companyId, branchId, name, lastName, phone, document (optional), email, password, otpCode
- **Process:**
  1. Validate that the OTP was verified for the email (per section 2.3)
  2. Validate the company is active and the branch belongs to it and is active
  3. Validate email uniqueness within the tenant and password rules (section 5)
  4. In a single transaction: create the Customer with a global client code (per client-code-identity) AND create the User with `isClient: true` linked via `clientId`
  5. On success: return access token + client refresh token in the body (auto-login)
- **Error Cases:**
  - 409: Email already registered in the tenant
  - 422: Invalid or expired OTP, or invalid payload
  - 400/404: Inactive or unknown company/branch
- **Scenarios:**
  - Registration with OTP succeeds → Customer with global code + linked `isClient` User created in the same transaction, tokens returned
  - Duplicate email rejected → 409, no account created
  - Invalid OTP aborts registration → rejected, no Customer or User created
  - User creation failure rolls back customer → Customer MUST NOT persist

### 2.3 Client Registration OTP Verification
- **Endpoints:** `POST /api/v1/auth/client/otp/send` (`email`), `POST /api/v1/auth/client/otp/verify` (`email`, `code`)
- **Contract:** code is 6 digits, expires after 10 minutes, single-use, at most 5 failed verify attempts (after which the code MUST be invalidated), resend blocked by a 60-second cooldown (429). The OTP email MUST use the existing 3-language (es/en/fr) template convention.
- **Scenarios:**
  - OTP sent and verified → 6-digit code emailed with 10-minute expiry, verification succeeds exactly once
  - Five failed attempts invalidate the code → correct code on the 6th attempt MUST be rejected
  - Resend blocked by cooldown → 429

### 2.4 Client Refresh Token in Body
- **Endpoint:** `POST /api/v1/auth/client/refresh`
- **Process:**
  1. Accept the refresh token in the request BODY (React Native clients cannot use HTTP-only cookies)
  2. Rotate tokens (hash stored); revoke old refresh token
  3. If old token was already used (replay detection): revoke ALL of the client's tokens, force re-login
  4. Return new access token AND new refresh token in the body
- **Security:** Rotation and replay protection MUST match the web refresh contract (section 1.2)
- **Scenarios:**
  - Body refresh rotates tokens → new access + refresh tokens returned in the body, old refresh token revoked
  - Replay of refresh token → all of the client's tokens revoked, forced re-login

### 2.5 Public Lookup for Registration
- **Endpoint:** `GET /api/v1/public/companies` — returns ONLY active companies with minimal fields (`id`, `slug`, `name`); MUST NOT expose license, plan, pricing, or internal company data; companies with inactive licenses MUST be excluded
- **Endpoint:** `GET /api/v1/public/companies/:id/branches` — returns ONLY active branches (`id`, `name`, `address`) of an active company; inactive or unknown companies MUST return 404 with no branch data
- **Scenarios:**
  - Active companies listed → only the active company appears, with only `id`, `slug`, `name`
  - No license or plan leakage → response MUST NOT contain license or plan fields
  - Active branches returned → only the active branch of an active company MUST be returned

---

## 3. SuperAdmin Authentication

### 3.1 SuperAdmin Login
- **Endpoint:** `POST /api/v1/superadmin/login`
- **Process:**
  1. Query SuperAdmin from Master DB
  2. Validate password with bcrypt
  3. Generate SuperAdmin JWT (different secret/key)
  4. SuperAdmin token includes role: "superadmin"
- **Scope:** Only `/api/v1/superadmin/*` routes

---

## 4. RBAC - Role-Based Access Control

### 4.1 Default Roles

| Role | Code | Permissions |
|------|------|-------------|
| Administrador | admin | All: `*.*` |
| Caja | cashier | `payments.*`, `customers.read`, `packages.read`, `dashboard.read` |
| Recepción | reception | `packages.*`, `customers.*`, `branches.read` |
| Almacén | warehouse | `packages.read`, `packages.update`, `branches.read` |
| Repartidor | delivery | `deliveries.*`, `packages.read` |

### 4.2 Permission Matrix

Each permission follows `{resource}.{action}` format:

| Resource | Actions |
|----------|---------|
| dashboard | read |
| customers | create, read, update, delete |
| packages | create, read, update, delete |
| payments | create, read, update, delete |
| deliveries | create, read, update |
| users | create, read, update, delete |
| roles | create, read, update, delete |
| branches | create, read, update, delete |
| reports | read |
| settings | read, update |

### 4.3 Middleware Guard
- `authorize('admin', 'cashier')` — checks role
- `can('packages.create')` — checks granular permission
- Both must pass for the route to execute

---

## 5. Password Rules

- Minimum length: 8 characters
- Must contain: uppercase, lowercase, number
- bcrypt salt rounds: 12
- Max failed attempts before lockout: 5 (within 15 minutes)
- Lockout duration: 30 minutes