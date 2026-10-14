# Design: Self-service Forgot Password (email OTP)

## Technical Approach

Reuse the registration OTP stack with a parameterized purpose (`password_reset`). Two new pre-tenant public endpoints: forgot stages a purpose-scoped OTP and always answers a generic 200; reset verifies the OTP and mutates the tenant `User` (password, lockout, `mustChangePassword`, refresh-token chain). Mirrors `clientLogin` (D9) and `registerClient` (D5/D8) patterns per the `password-recovery` delta spec. Spec-delegated items resolved in D1–D3.

## Architecture Decisions

### D1: OTP consumption when reset fails after verification

**Choice**: Consume (`consumedAt`) ONLY after `user.save()` succeeds. Password-shape failures never reach the service (zod `validate` middleware rejects with 422 pre-service, zero state touched). Account-resolution failures after OTP verification leave the OTP valid until TTL.

| Option | Tradeoff | Decision |
|---|---|---|
| Consume on verify | Transient DB failure strands the code → recovery DoS | ✗ |
| Consume after persist | Mirrors registerClient D8; abuse bounded by 5 attempts + 10-min TTL + authLimiter | ✓ |

### D2: 429 cooldown transfer to `password_reset`

**Choice**: Transfers unchanged — cooldown is keyed per `${email}:${purpose}` (D5), so a staged reset OTP blocks forgot-resends for 60 s (with `resendAfter` in the 429 body), while `register` cooldowns live on their own key and never interfere. Verified by unit test that both purposes coexist.

### D3: Anti-enumeration timing (pinned)

**Choice**: Constant response path in the forgot handler, ALWAYS executed: (1) `ClientEmailIndex` query; (2) `otpService.sendOtp({ purpose: 'password_reset', dispatch })` — cooldown check + code upsert, `dispatch = false` when no unique match (no email leaves, unknown emails still stage a TTL'd record and get identical 429 cooldowns); (3) fixed 300 ms response floor. Status + body identical in all non-409 paths.

| Option | Tradeoff | Decision |
|---|---|---|
| Dummy bcrypt hash | Heavy, doesn't equalize SMTP delta | ✗ |
| Equalize SMTP fully | Impossible without sending junk mail (spec-forbidden) | ✗ |
| Always-stage + 300 ms floor | Equal DB ops; residual SMTP delta acceptable: authLimiter caps probing at 10 req/15 min/IP, ≤1 bit/probe | ✓ |

### D4: Tenant resolution / ambiguous emails

**Choice**: New non-throwing resolution inside `auth.service.forgotPassword`: `ClientEmailIndex.find({email, isActive:true})` → 0 matches: stage + no dispatch + generic 200; 1 match: stage + dispatch; 2+: 409 (exact `clientLogin` message) unless `code` (global client code) is supplied — resolved via `resolveTenantByCode` + index cross-check; code/index mismatch → generic 200. `resetPassword` reuses the same resolution; failure to resolve → 422 "Invalid or expired code" (never 404, never reveals existence).

### D5: `otp.service` parameterization

**Choice**: `buildKey(email, purpose = 'register')`; `sendOtp`/`verifyOtp` gain `purpose` (default `'register'`) and `sendOtp` gains `dispatch = true`. Defaults keep every existing call site and test green. `auth.service._verifyRegistrationOtp` generalizes to `_verifyStagedOtp({email, code, purpose})` (checks `consumedAt`, tolerates `verifiedAt`) shared by register + reset.

### D6: Session revocation

**Choice**: On the resolved client `User`: `password = newPassword` (bcrypt pre-save hook), `refreshToken = null`, `previousRefreshTokenHash = null`, `failedLoginAttempts = 0`, `lockedUntil = null`, `mustChangePassword = false`, `save()`. No blacklist write: refresh lookup matches `refreshToken` on the doc, so nulling kills rotation + replay paths (same primitive as logout / D10 `_revokeClientTokens`; one doc holds the whole client session chain).

### D7: PR split (confirmed)

PR1 = API + validation + tests (~440 lines); PR2 = web UI + i18n (~360 lines). No better cut: web depends only on the contract (stable after PR1); tests ride their code. Both inside the 800-line budget.

## Data Flow

```
Client ── POST /auth/forgot-password {email, code?} ──► API
  API ── ClientEmailIndex.find ──► Master DB
  API ── OtpCode upsert (key: email:password_reset, TTL 10m, cooldown 60s) ──► Master DB
  API ── [unique match] sendOtpCode ──► inbox ; [no match] dispatch=false
  ◄── generic 200 (≥300 ms floor, identical bodies)
Client ── POST /auth/reset-password {email, code?, otpCode, newPassword} ──► API
  API ── resolve (index/code) ──► Master ; verify staged OTP (attempts≤5, single-use)
  API ── Customer→User(clientId) ──► Tenant DB
  API ── user.password=bcrypt(new); clear lockout/flag; refreshToken=null; save
  API ── otpDoc.consumedAt=now ──► Master DB
  ◄── 200 reset OK
```

## API Contract

```js
// POST /auth/forgot-password — public, pre-tenant, authLimiter
// req : { email, lang?: 'es'|'en'|'fr', code?: /^[A-Z]{2,5}-\d{6}$/ }
// 200 : { success, data: { sent: true, resendAfter: 60 }, message }  // identical known/unknown
// 409 : { error: { code: 'CONFLICT', message: 'This email is linked to multiple companies. Sign in with your client code instead.' } }
// 422 : zod validation   429 : authLimiter | OTP cooldown { resendAfter }

// POST /auth/reset-password — public, pre-tenant, authLimiter
// req : { email, code?, otpCode: /^\d{6}$/, newPassword /* min8 + upper + lower + digit */ }
// 200 : { success, data: { reset: true }, message: 'Password reset successful' }
// 409 : same disambiguation   422 : 'Invalid or expired code' (bad shape, bad/expired/exhausted OTP, unresolvable email — identical)   429 : authLimiter
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/services/otp.service.js` | Modify | Purpose param on `buildKey`/`sendOtp`/`verifyOtp` (default `'register'`); `dispatch` flag |
| `apps/api/src/modules/auth/auth.service.js` | Modify | `forgotPassword()`, `resetPassword()`, generalized `_verifyStagedOtp` |
| `apps/api/src/modules/auth/auth.controller.js` | Modify | `forgotPassword`, `resetPassword` handlers; 300 ms floor helper |
| `apps/api/src/modules/auth/auth.routes.js` | Modify | 2 routes + `validate`; extend limiter regex to `/(login\|refresh\|forgot-password\|reset-password)/` |
| `apps/api/src/middlewares/tenantResolver.js` | Modify | `PUBLIC_ROUTES` += `/auth/forgot-password`, `/auth/reset-password` |
| `apps/api/src/services/notifications/emailTemplates.js` | Modify | `otpPasswordReset` template es/en/fr (distinct subject, same `{{code}}`) |
| `apps/api/src/services/notifications/email.service.js` | Modify | `sendPasswordResetOtp(email, code, lang)` wrapper |
| `packages/validation/src/index.js` | Modify | `forgotPasswordSchema`, `resetPasswordSchema`; extract shared `passwordRules` |
| `apps/api/tests/unit/otp.service.test.js` | Modify | Purpose isolation + cooldown-per-purpose + dispatch=false |
| `apps/api/tests/unit/auth.service.resetPassword.test.js` | Create | Reset/revocation semantics with mocked models |
| `apps/api/tests/integration/forgot-password.http.test.js` | Create | 200 parity, 409, cooldown 429, register isolation |
| `apps/api/tests/integration/reset-password.http.test.js` | Create | Full reset lifecycle incl. stolen-token rejection |
| `apps/web/src/pages/auth/ForgotPasswordPage.tsx` | Create | email → OTP → new-password steps (mirrors `RegisterPage` OTP step + resend cooldown) |
| `apps/web/src/pages/auth/LoginPage.tsx` | Modify | "Forgot password?" link |
| `apps/web/src/App.tsx` | Modify | Route `/auth/forgot-password` under `AuthLayout` |
| `apps/web/src/services/auth.service.ts` | Modify | `forgotPassword()`, `resetPassword()` |
| `apps/web/src/i18n/locales/{es,en,fr}.json` | Modify | `auth.forgot.*` strings |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Purpose key isolation; per-purpose cooldown; `register` defaults green; `dispatch=false` skips email only | Jest, extend `otp.service.test.js` |
| Unit | Reset success clears lockout/flag/tokens; OTP not consumed when `user.save()` throws (D1); 409/422 resolution | Jest, mocked models |
| Integration | Known vs unknown 200 body deep-equal + no email on unknown; forgot cooldown 429; 409 without code / 200 with code; register OTP untouched | supertest |
| Integration | Reset happy path (`comparePassword` true, tokens null); single-use re-submit 422; 5 wrong codes → invalidated; expired TTL; stolen refresh token rejected post-reset | supertest |
| E2E / Web | No test tooling in `apps/web` — manual QA checklist (es/en/fr render, redirect to login); zod schemas shared via `@courier/validation` | Manual |

## Migration / Rollout

No migration required. Additive endpoints; staged OtpCodes are garbage-collected by the TTL index. Rollback = revert PR chain (UI first, then API).

## Open Questions

None — all spec-delegated items resolved (D1, D2, D3).
