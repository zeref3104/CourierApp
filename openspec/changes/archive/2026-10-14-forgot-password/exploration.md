# Exploration: Self-service "Forgot password?" flow

## Current State

### Stack
- **Monorepo** (npm workspaces): `apps/api` (Express + Mongoose, CommonJS), `apps/web` (React 18 + Vite + Redux Toolkit + Tailwind + react-hook-form + zod), `apps/mobile` (Expo / React Native), `packages/validation` (shared zod schemas), `packages/constants`, `packages/helpers`.
- **Multi-tenant MongoDB**: a master DB (Company, License, SuperAdmin, OtpCode, TenantUserIndex, ClientEmailIndex) + one tenant DB per company (User, Customer, Package, ...). Tenant resolution via `tenantResolver` middleware (subdomain / `x-tenant-slug` header) or pre-tenant resolution from master indexes during login.
- **Testing**: API has Jest unit (`apps/api/tests/unit/`, incl. `otp.service.test.js`) + supertest integration (`apps/api/tests/integration/`, incl. `otp.http.test.js`, `register.http.test.js`). Web/mobile have no test tooling.

### Auth today
- `POST /auth/login` (staff + superadmin), `POST /auth/client/login` (client, by global code `XX-NNNNNN` OR email), JWT access token + rotating refresh token (`tokenService`, replay detection via `previousRefreshTokenHash`). Lockout after 5 failed attempts (30 min).
- Client accounts are a pair: tenant `Customer` (phone **required**, email optional) + tenant `User` with `isClient: true` linked via `clientId`. `User` has `email` **required**, `phone` optional, `password` (bcrypt, `select: false`), `mustChangePassword`, `refreshToken`.
- Master indexes resolve email → tenant: `TenantUserIndex` (staff, globally unique email) and `ClientEmailIndex` (clients, unique **per company** — same email may exist in several companies → login answers 409 "use your client code").
- Only password mutation today: authenticated `PATCH /auth/password` (change with current password).

### Existing password-reset scaffolding: NONE (but almost everything needed exists)
- Grep for `forgot|reset.?password` across `apps/`: **zero matches**. No reset routes, pages, or templates.
- **Reusable OTP infrastructure** (`apps/api/src/services/otp.service.js` + master `OtpCode` model): 6-digit email OTP, sha256-hashed at rest, 10-min TTL (TTL index auto-deletes), 5 failed-attempt lockout, 60s resend cooldown (429), single-use (`verifiedAt`/`consumedAt`). Key format is already `${email}:${purpose}` — but `OTP_PURPOSE` is **hardcoded to `'register'`**; a reset purpose requires parameterizing it.
- **Email sending**: `email.service.js` (nodemailer SMTP, console fallback when `SMTP_HOST` unset, never throws — best-effort) with per-language templates (es/en/fr) including `sendOtpCode`. **No SMS/WhatsApp sending infrastructure exists** (only a `whatsapp` enum value in the Notification model and plan flags).
- **Frontend patterns**: `RegisterPage.tsx` (web) already implements the multi-step email → OTP → submit flow with resend cooldown; `LoginPage.tsx` has NO "Forgot password?" link yet. Mobile `app/login.tsx` + `app/register/` mirror the same flow.
- **Rate limiting**: `authLimiter` (10 req/15 min) currently applied only to `/(login|refresh)/`; new reset endpoints must be added. Redis-backed store available via `REDIS_URL`.
- **Public routes**: `tenantResolver.PUBLIC_ROUTES` already whitelists `/auth/password` prefix; new forgot-password endpoints (pre-tenant) need explicit entries.

## Affected Areas

- `apps/api/src/services/otp.service.js` — parameterize purpose (e.g. `password_reset` alongside `register`); today constant-hardcoded.
- `apps/api/src/modules/auth/auth.routes.js` — add `POST /auth/forgot-password` (send) + `POST /auth/reset-password` (verify + set new password); extend `authLimiter` regex.
- `apps/api/src/modules/auth/auth.service.js` — reset flow: resolve tenant (ClientEmailIndex / TenantUserIndex), validate OTP, set new password on linked `User`, clear `mustChangePassword` + lockout counters, invalidate refresh-token chain.
- `apps/api/src/modules/auth/auth.controller.js` — new handlers; follow `asyncHandler` + `apiResponse` patterns.
- `apps/api/src/middlewares/tenantResolver.js` — add new paths to `PUBLIC_ROUTES`.
- `apps/api/src/services/notifications/emailTemplates.js` — add/extend OTP template for reset purpose (or reuse `otp` template).
- `packages/validation/src/index.js` — new zod schemas (`forgotPasswordSchema`, `resetPasswordSchema` reusing the `otpCode` + password rules).
- `apps/web/src/pages/auth/LoginPage.tsx` — "Forgot password?" link.
- `apps/web/src/pages/auth/ForgotPasswordPage.tsx` (new) — email → OTP → new-password steps; mirror `RegisterPage` OTP step.
- `apps/web/src/App.tsx` — route under `AuthLayout` (e.g. `/auth/forgot-password`).
- `apps/web/src/services/auth.service.ts` — API client methods.
- `apps/web/src/i18n/locales/*` — es/en/fr strings.
- `apps/mobile/app/` (optional phase 2) — `forgot-password` screens mirroring register flow.
- Tests: `apps/api/tests/unit/otp.service.test.js` (purpose isolation), new `tests/integration/forgot-password.http.test.js`.

## Approaches

### 1. Email OTP via master OtpCode with `password_reset` purpose (RECOMMENDED)
Generalize `otp.service` purpose (`buildKey(email, purpose)`), add forgot/reset endpoints reusing the registration-OTP contract (6-digit, 10 min, 5 attempts, 60 s cooldown, single-use). Send endpoint resolves the email through `ClientEmailIndex` (clients) / `TenantUserIndex` (staff, optional scope) and returns a generic success regardless of existence (anti-enumeration). Reset endpoint verifies the OTP, resolves the tenant, updates the linked `User.password` (bcrypt pre-save hook handles hashing), clears lockout + `mustChangePassword`, and revokes the refresh-token chain so active sessions die.
- Pros: reuses battle-tested OTP service, email transport, templates, validation and frontend step patterns; zero new dependencies; consistent UX with client registration; small diff, easy to spec with Given/When/Then.
- Cons: email-only in v1 (no phone channel); multi-company email ambiguity (same client email in 2+ companies) must be handled (recommend: require client code as a second disambiguator, or answer the same 409 "use your client code" and let the reset flow accept code + email).
- Effort: **Medium**.

### 2. Emailed reset link (signed magic token / URL)
Generate a single-use signed token, email a `<WEB_BASE_URL>/reset-password?token=...` link instead of a code.
- Pros: standard consumer UX; no code typing.
- Cons: no precedent in the codebase (new token model or purpose-based OtpCode variant, base-URL config, link-click handling on mobile deep links); web-only consumption is awkward for the Expo app; harder to spec anti-enumeration/cooldown parity. Effort: **Medium-High**.

### 3. Phone OTP via SMS/WhatsApp provider
Add Twilio (or similar) integration; index phone on master; OTP delivered by SMS to `Customer.phone` (required on Customer).
- Pros: reaches customers without working email; phone is the *required* contact field on Customer.
- Cons: **no SMS infrastructure exists at all** — new provider, credentials, cost, per-tenant from-address config, template/i18n work; `User.phone` is optional so staff coverage would be partial; phone is not unique-indexed on master (no phone → tenant resolver). Effort: **High**.

## Recommendation

**Approach 1 (email OTP, `password_reset` purpose) for v1**, covering client accounts on both web and (optionally) mobile; Approach 3 (phone OTP) explicitly deferred to a phase 2 pending an SMS-provider decision by the user. Key design points to carry into propose/spec:
- Parameterize `otp.service` purpose; keep `register` behavior untouched (existing tests must stay green).
- Anti-enumeration: `POST /auth/forgot-password` always answers 200 with a generic message when the email is unknown; rate limit via `authLimiter`.
- Multi-company email ambiguity: mirror `clientLogin` semantics — accept optional client code; ambiguous email without code answers 409 telling the user to use their code (or verify against all matched tenants and only email when exactly one matches).
- Reset must hard-revoke sessions: clear `refreshToken` + `previousRefreshTokenHash`, reset `failedLoginAttempts`/`lockedUntil`, set `mustChangePassword: false`.
- Scope decision needed from user: **clients only** (matches the stated goal of eliminating operator-assisted client resets) vs **clients + staff** (staff reset adds the `TenantUserIndex` path cheaply). Superadmin excluded (no self-service recovery for master admins is safer).

## Risks

- **No SMS path**: phone-based recovery is a hard requirement gap if the user's customers frequently lack working email — must be confirmed before deferring.
- **Email ambiguity across companies** (ClientEmailIndex is per-company unique): naive email-only reset could reset the wrong account or leak cross-tenant existence; must replicate the 409/code-disambiguation logic.
- **Enumeration leakage** from timing/behavior differences (OTP send is best-effort email, so keep responses and cooldown behavior identical for unknown emails).
- **`otp.service` purpose hardcoding**: changing `buildKey` signature touches registration paths; regression covered by existing `otp.service.test.js` / `register.http.test.js`.
- **Session revocation**: if the reset does not invalidate the refresh-token chain, an attacker with a stolen session keeps access after the victim resets.
- **SMTP not configured in some deployments** (console fallback): reset would silently no-op — the UI should hint "if the email is registered you'll receive a code" and operators need SMTP in production.
- **Review budget (800 lines)**: API + web + i18n + tests may exceed it; likely 2 chained PRs (API, web/mobile UI).

## Ready for Proposal

Yes — with two user decisions to confirm during propose: (1) v1 scope = client accounts only, or clients + staff; (2) accept email-only v1 with phone/SMS deferred to phase 2.
