# Proposal: Tenant Admin Auto-Creation

## Intent

When a SuperAdmin creates a new tenant company, the system creates the Company record and trial license — but no tenant database, no admin user, and no way to log in. The "admin email" field is stored as the company email with no user created. This change automates tenant provisioning: create the tenant DB, seed the Admin role, create the first admin user, and force a password change on first login.

## Scope

### In Scope
- Split CreateCompany form: "Email de la empresa" (company) + "Email del administrador" (admin)
- Auto-create tenant database + Admin role + admin user on company creation (default pw: `123456`)
- Add `mustChangePassword` boolean to User model (default: `true` for new admin)
- Detect `mustChangePassword` on login → return `mustChangePassword: true` in response
- `PATCH /auth/password` endpoint — validate current password, set new, clear flag
- Frontend: ChangePasswordPage + route + login redirect when flag detected
- Show generated password in company creation success feedback

### Out of Scope
- Password recovery / "forgot password" flow
- Email notifications to the new admin
- Admin email validation or verification
- Multi-admin seeding (only the first admin)

## Capabilities

### New Capabilities
- `tenant-provisioning`: auto-creation of tenant database, system roles, and initial admin user when a company is created
- `first-login-password-change`: force password change flow — `mustChangePassword` flag on login response, dedicated change password page and endpoint

### Modified Capabilities
- `auth-specs`: login response includes `mustChangePassword` signal; new `PATCH /auth/password` endpoint; change password schema already exists in validators

## Approach

Extend `company.service.create()` to: (1) create tenant DB via `connectionManager.getConnection()`, (2) upsert the "Admin" role with `*.*` permissions, (3) create the admin user with `mustChangePassword: true` and default password. Add `mustChangePassword` field to User model. In `auth.service.login()`, check the flag and include it in response. New `PATCH /auth/password` that verifies current password, hashes the new one, clears `mustChangePassword`. Frontend: detect flag on login, redirect to ChangePasswordPage, submit new password, then proceed to dashboard.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/modules/companies/company.service.js` | Modified | Extend `create()` to provision tenant DB + admin user |
| `apps/api/src/models/tenant/User.js` | Modified | Add `mustChangePassword: { type: Boolean, default: false }` |
| `apps/api/src/modules/auth/auth.service.js` | Modified | Return `mustChangePassword` on login; add `changePassword()` method |
| `apps/api/src/modules/auth/auth.controller.js` | Modified | Add `changePassword` handler |
| `apps/api/src/modules/auth/auth.routes.js` | Modified | Add `PATCH /password` route |
| `apps/api/src/validators/schemas/auth.schema.js` | Unchanged | `changePasswordSchema` already exists |
| `apps/web/src/pages/admin/companies/CreateCompanyPage.tsx` | Modified | Split email into two fields; show generated password |
| `apps/web/src/pages/auth/LoginPage.tsx` | Modified | Detect `mustChangePassword`, redirect |
| `apps/web/src/pages/auth/ChangePasswordPage.tsx` | New | Force password change form |
| `apps/web/src/services/auth.service.ts` | Modified | Add `changePassword()` method |
| `apps/web/src/App.tsx` | Modified | Add `/change-password` route |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tenant DB creation fails (connection timeout) | Low | Catch in `company.service.create()`, roll back company + license creation |
| Admin role or user creation fails mid-flight | Low | Use tenant connection transactionally; log and surface error |
| `123456` default password is weak | Medium | Accept for this iteration; change enforced by `mustChangePassword` on first login |

## Rollback Plan

1. Remove the `mustChangePassword` field from User model (rollback migration / drop field)
2. Revert `company.service.create()` to previous version (no tenant provisioning)
3. Revert auth changes (login check, password endpoint)
4. Revert frontend changes (form, page, route)
5. Existing companies with partially provisioned tenants: drop their DB and re-create manually

## Dependencies

None. All changes are within the existing tech stack (MongoDB, Express, React, Zod).

## Success Criteria

- [ ] Creating a company provisions a tenant DB with Admin role and an admin user
- [ ] Admin user can log in with `123456` and receives `mustChangePassword: true`
- [ ] Form shows "Email de la empresa" + "Email del administrador" as separate fields
- [ ] After password change, login returns `mustChangePassword: false` and user reaches dashboard
- [ ] `PATCH /auth/password` rejects weak passwords per the existing schema
