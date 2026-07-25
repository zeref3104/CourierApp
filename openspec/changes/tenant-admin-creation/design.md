# Design: Tenant Admin Auto-Creation

## Technical Approach

Extend `company.service.create()` to provision the tenant database synchronously after creating the Company + License: get tenant connection via `connectionManager.getConnection()`, find-or-create the "admin" Role, and create the admin User with `mustChangePassword: true`. Add `mustChangePassword` field to User model. On login, include the flag in the response instead of blocking — the frontend uses the access token to call `PATCH /auth/password`. New ChangePasswordPage inside AuthLayout (user has token, no protected route needed).

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| adminEmail carrier | Separate `adminEmail` field in POST body + `CreateCompanyData` | Reuse `email` field | Company model keeps `email` as company email; `adminEmail` carries the admin's email for user creation |
| Tenant provisioning timing | Synchronous inside `company.service.create()` | Async job/queue | No external workers; single request guarantees atomicity — if any step fails, the whole creation fails and rolls back |
| Role creation strategy | `findOneAndUpdate({ code: 'admin' }, { $setOnInsert }, { upsert: true })` | Create always, then check-and-create | Upsert is idempotent — safe if the method is retried |
| Login when `mustChangePassword=true` | Return `mustChangePassword: true` + valid tokens | Throw 403 / block login | Frontend needs the access token to call `PATCH /auth/password`; blocking would require a separate pre-auth flow |
| ChangePasswordPage route | Inside `AuthLayout` (no `ProtectedRoute`) | Inside `ProtectedRoute` with role bypass | User has a valid token but hasn't changed password — `ProtectedRoute` redirects to `/login` if any role mismatch |
| confirmPassword validation | Frontend-only (zod refine) | Backend schema field | Backend only needs `currentPassword` + `newPassword`; the existing `changePasswordSchema` already validates both |
| `mustChangePassword` default | `false` in User model | `true` | Only newly provisioned admin users get `true`; existing users (`isClient`, manually created) remain unaffected |

## Data Flow

```
CreateCompanyPage ──POST /superadmin/companies──→ companyController.create()
                                                       │
                                                       ▼
                                              company.service.create()
                                                       │
                              ┌────────────────────────┼────────────────────────┐
                              ▼                        ▼                        ▼
                      Company.create()          License.create()      connectionManager.getConnection()
                              │                        │                        │
                              └────────────────────────┴────────────────────────┘
                                                                                │
                                                                                ▼
                                                                        Role.findOneAndUpdate(
                                                                          { code: 'admin' },
                                                                          { $setOnInsert: { name: 'Admin',
                                                                            isSystem: true,
                                                                            permissions: ['*.*'] } },
                                                                          { upsert: true }
                                                                        )
                                                                                │
                                                                                ▼
                                                                        User.create({
                                                                          email: adminEmail,
                                                                          name: 'Administrador',
                                                                          password: '123456',
                                                                          roleId: adminRole._id,
                                                                          mustChangePassword: true,
                                                                        })
```

### Login + Password Change Flow

```
LoginPage ──POST /auth/login──→ authService.login()
                                      │
                                      ▼
                              LoginResponse {
                                accessToken,
                                mustChangePassword: true,  ← NEW
                                user
                              }
                                      │
                                      ▼
                              LoginPage checks mustChangePassword
                                      │
                                      ▼
                              navigate('/auth/change-password')
                                      │
                                      ▼
                              ChangePasswordPage
                              POST /auth/password (with Bearer token)
                                      │
                                      ▼
                              Auth validates currentPassword,
                              hashes newPassword,
                              sets mustChangePassword=false
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/models/tenant/User.js` | Modify | Add `mustChangePassword: { type: Boolean, default: false }` |
| `apps/api/src/modules/companies/company.service.js` | Modify | After Company + License creation: get tenant connection, find-or-create admin Role, create admin User |
| `apps/api/src/modules/auth/auth.service.js` | Modify | `login()` reads `user.mustChangePassword` and includes it in response; add `changePassword()` method |
| `apps/api/src/modules/auth/auth.controller.js` | Modify | Add `changePassword` handler — gets user from `req.user`, delegates to `authService.changePassword()` |
| `apps/api/src/modules/auth/auth.routes.js` | Modify | Add `router.patch('/password', auth, validate(changePasswordSchema), authController.changePassword)` |
| `apps/web/src/services/auth.service.ts` | Modify | Add `changePassword(data)` method |
| `apps/web/src/types/auth.ts` | Modify | Add `mustChangePassword?: boolean` to `LoginResponse` |
| `apps/web/src/services/company.service.ts` | Modify | Add `adminEmail` field to `CreateCompanyData` |
| `apps/web/src/pages/admin/companies/CreateCompanyPage.tsx` | Modify | Split email input into "Email de la empresa" + "Email del administrador"; submit `adminEmail` separately; show generated password in success feedback |
| `apps/web/src/pages/auth/LoginPage.tsx` | Modify | After login success, check `response.data.mustChangePassword` → navigate to `/auth/change-password` |
| `apps/web/src/pages/auth/ChangePasswordPage.tsx` | Create | Form with current password, new password, confirm; calls `authService.changePassword()` |
| `apps/web/src/App.tsx` | Modify | Add route `/auth/change-password` inside `AuthLayout` |

## Interfaces / Contracts

### LoginResponse (frontend — modified)
```ts
export interface LoginResponse {
  accessToken: string;
  mustChangePassword?: boolean;  // ← ADDED
  user: UserProfile;
}
```

### CreateCompanyData (frontend — modified)
```ts
export interface CreateCompanyData {
  name: string;
  slug: string;
  email: string;         // Company email
  adminEmail: string;    // ← ADDED — admin's email for user creation
  phone?: string;
  planId: string;
}
```

### PATCH /auth/password request body
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

### PATCH /auth/password response
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### company.service.create() — extended signature
```js
async create(data, masterConnection) {
  // data.email → Company.email
  // data.adminEmail → admin User email
  // data.phone, data.name, data.slug, data.planId
}
```

### Login response (backend — modified)
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "mustChangePassword": true,
    "user": { "id": "...", "name": "...", ... }
  }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `company.service.create()` provisioning | Stub `connectionManager.getConnection()`, `Role.findOneAndUpdate`, `User.create` — verify all called with correct args |
| Unit | `authService.login()` with mustChangePassword | Create user with flag true → assert response includes `mustChangePassword: true` |
| Unit | `authService.changePassword()` | Verify current password validated, new password hashed, flag cleared |
| Integration | Full company creation flow | Create company → verify tenant DB has Admin role + admin User with `mustChangePassword: true` |
| Integration | Login + password change | Login with default password → receive flag → change password → login again → flag is `false` |
| E2E | Frontend form split + redirect | Create company → navigate to login → submit default creds → redirected to change-password → submit new password → reaches dashboard |

## Migration / Rollout

No data migration required. `mustChangePassword` defaults to `false` — only newly created admin users get `true`. Existing users are unaffected. Deploy backend first (model + service changes), then frontend.

## Open Questions

- [ ] Should the created admin Role include a specific set of permissions (`['*.*']` as wildcard) or a curated subset? Proposal mentions `*.*`.
- [ ] Success feedback in CreateCompanyPage — should it show the generated password `123456` in a callout before navigating? Proposal says "Show generated password in company creation success feedback".
