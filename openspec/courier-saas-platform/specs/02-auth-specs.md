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
- **Input:** email, password
- **Process:**
  1. Same as user login but only users with `isClient: true` can authenticate
  2. Return limited profile (name, email, customerCode, clientId)
  3. Client access token has restricted scope
- **Access Scope:** Clients can only access `/api/v1/client/*` routes

### 2.2 Client Register
- **Endpoint:** `POST /api/v1/auth/client/register`
- **Input:** name, lastName, email, phone, password, document (optional)
- **Process:**
  1. Create Customer record in tenant DB
  2. Create User record with isClient: true, linked to customer via clientId
  3. Generate customer code
  4. Auto-generate response with access token

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