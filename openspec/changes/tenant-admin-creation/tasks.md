# Tasks: Tenant Admin Auto-Creation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation (Model + Backend Services)

- [x] 1.1 Add `mustChangePassword: { type: Boolean, default: false }` field to User model schema at `apps/api/src/models/tenant/User.js`
- [x] 1.2 Extend `company.service.create()` in `apps/api/src/modules/companies/company.service.js` to get tenant connection, upsert Admin role (`code: 'admin'`, `permissions: ['*.*']`, `isSystem: true`), create admin user with `mustChangePassword: true`, `password: '123456'`, and return `defaultPassword` in response
- [x] 1.3 Add `mustChangePassword` to login return value in `apps/api/src/modules/auth/auth.service.js` at the `login()` method
- [x] 1.4 Add `changePassword(currentPassword, newPassword, userId, models)` method to `apps/api/src/modules/auth/auth.service.js` — verify current hash, hash new password, save, clear `mustChangePassword`
- [x] 1.5 Add `changePassword` handler in `apps/api/src/modules/auth/auth.controller.js` — extracts `req.user._id`, delegates to `authService.changePassword()`
- [x] 1.6 Add `PATCH /password` route in `apps/api/src/modules/auth/auth.routes.js` with `auth`, `validate(changePasswordSchema)`, and controller handler

## Phase 2: Frontend (Types + Services)

- [x] 2.1 Add `mustChangePassword?: boolean` to `LoginResponse` interface in `apps/web/src/types/auth.ts`
- [x] 2.2 Add `changePassword(data)` method to `apps/web/src/services/auth.service.ts` that calls `PATCH /auth/password`
- [x] 2.3 Add `adminEmail: string` to `CreateCompanyData` interface in `apps/web/src/services/company.service.ts`

## Phase 3: Frontend (UI Pages)

- [x] 3.1 Modify `apps/web/src/pages/admin/companies/CreateCompanyPage.tsx` — split email field into "Email de la empresa" + "Email del administrador", submit `adminEmail` separately, show generated password in success toast before navigating
- [x] 3.2 Modify `apps/web/src/pages/auth/LoginPage.tsx` — after login success, check `response.data.mustChangePassword` and redirect to `/auth/change-password` when true
- [x] 3.3 Create `apps/web/src/pages/auth/ChangePasswordPage.tsx` — form with currentPassword, newPassword, confirmPassword fields; calls `authService.changePassword()`; redirects to `/` on success
- [x] 3.4 Add route `/auth/change-password` inside `AuthLayout` in `apps/web/src/App.tsx` (import ChangePasswordPage, add `<Route>` before existing login route)

## Phase 4: Testing

- [ ] 4.1 Unit test: `company.service.create()` provisions tenant DB, role, and admin user with correct defaults
- [ ] 4.2 Unit test: `authService.login()` returns `mustChangePassword: true` when user has flag set
- [ ] 4.3 Unit test: `authService.changePassword()` verifies current password, hashes new, clears flag
- [ ] 4.4 Integration: full flow — create company → login default pw → change password → login again returns flag false
- [ ] 4.5 Frontend: ChangePasswordPage submits correctly and redirects on success
