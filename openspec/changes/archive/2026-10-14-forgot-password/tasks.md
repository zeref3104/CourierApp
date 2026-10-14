# Tasks: Self-service Forgot Password (email OTP)

## Review Workload Forecast

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium
800-line budget risk: Low
Estimated changed lines: ~800 total (PR1 ≈440, PR2 ≈360)

### Suggested Work Units

| Unit | Goal | PR | Base |
|------|------|----|------|
| 1 | Forgot/reset API + validation + tests | PR 1 | main |
| 2 | Web flow + i18n es/en/fr | PR 2 | PR 1 |

Trace legend: R1 Anti-enumeration, R2 Disambiguation, R3 Purpose Isolation, R4 OTP Lifecycle, R5 Reset Application, R6 Session Revocation, R7 Rate Limiting/Public, R8 Web Flow/i18n.

## PR 1 — API + Tests

### Phase 1: Foundation

- [x] 1.1 Add `forgotPasswordSchema`/`resetPasswordSchema` + shared `passwordRules` — `packages/validation/src/index.js`; AC: weak password → 422; Trace: R4, R5.
- [x] 1.2 Add `otpPasswordReset` template (es/en/fr) + `sendPasswordResetOtp()` — `emailTemplates.js`/`email.service.js`; AC: distinct subject, same `{{code}}`; Trace: R8.

### Phase 2: Core API

- [x] 2.1 Parameterize purpose: `buildKey(email, purpose='register')`, purpose on `sendOtp`/`verifyOtp`, `dispatch` flag — `apps/api/src/services/otp.service.js`; AC: register tests unchanged; Trace: R3.
- [x] 2.2 Add `forgotPassword()`: 0 matches → stage/no dispatch, 1 → stage+dispatch, 2+ → 409 unless `code` — `auth.service.js`; AC: identical known/unknown body; Trace: R1, R2.
- [x] 2.3 Add `resetPassword()`: verify OTP, save password, clear lockout/flag, null refresh tokens, consume OTP after `save()`; generalize `_verifyStagedOtp` — `auth.service.js`; AC: D1; Trace: R4, R5, R6.
- [x] 2.4 Add `forgotPassword`/`resetPassword` handlers + 300 ms response-floor helper — `auth.controller.js`; AC: identical status+body on non-409 paths; Trace: R1.
- [x] 2.5 Register 2 public routes + `validate`, extend limiter regex to forgot/reset, add to `PUBLIC_ROUTES` — `auth.routes.js`, `tenantResolver.js`; AC: burst → 429, no tenant; Trace: R7.

### Phase 3: API Tests

- [x] 3.1 Extend `tests/unit/otp.service.test.js`: purpose isolation, cooldown per purpose, `dispatch=false`; AC: register tests green; Trace: R3, R4.
- [x] 3.2 Create `tests/unit/auth.service.resetPassword.test.js`: clears lockout/flag/tokens, OTP survives `save()` throw (D1), 409/422 resolution; Trace: R5, R6.
- [x] 3.3 Create `tests/integration/forgot-password.http.test.js`: 200 deep-equal known/unknown, no email unknown, cooldown 429, 409/200 code paths; Trace: R1, R2, R4.
- [x] 3.4 Create `tests/integration/reset-password.http.test.js`: happy path, single-use 422, 5 wrong codes, expired TTL, stolen token rejected; Trace: R4, R5, R6.
- [x] 3.5 Run full API suite; AC: all Jest + supertest green incl. register regression; Trace: R3.

## PR 2 — Web UI + i18n

### Phase 4: Web Flow

- [x] 4.1 Add `forgotPassword()`/`resetPassword()` — `apps/web/src/services/auth.service.ts`; AC: matches PR 1 contract; Trace: R8.
- [x] 4.2 Create `pages/auth/ForgotPasswordPage.tsx`: email → OTP → new-password, resend cooldown mirroring `RegisterPage`; AC: full flow submits; Trace: R8.
- [x] 4.3 Add "Forgot password?" link (`LoginPage.tsx`) + route `/auth/forgot-password` under `AuthLayout` (`App.tsx`); AC: unauthenticated navigation works; Trace: R8.

### Phase 5: Localization + Manual QA

- [x] 5.1 Add `auth.forgot.*` strings — `apps/web/src/i18n/locales/{es,en,fr}.json`; AC: no missing keys per locale; Trace: R8.
- [ ] 5.2 Manual QA: es/en/fr steps + OTP email render, success redirects to login; AC: checklist passes; Trace: R8 (Complete localized recovery). — automated gates green (tsc strict + vite build + check-i18n 470 keys × 3 locales); browser QA pending human run
