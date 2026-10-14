# Proposal: Self-service Forgot Password (email OTP)

## Intent

Operators reset client passwords manually; reuse registration email-OTP infra for self-service recovery.

## Scope

### In Scope
- `POST /auth/forgot-password` + `POST /auth/reset-password`: pre-tenant, rate-limited, anti-enumeration.
- Parameterize `otp.service` purpose (`password_reset`); `register` unchanged.
- **Client accounts only** (Customer + `isClient` User): `ClientEmailIndex` lookup, 409 client-code disambiguation mirroring `clientLogin`.
- Reset: revoke refresh-token chain, clear lockout counters, clear `mustChangePassword`.
- Web: login link, `ForgotPasswordPage` (email → OTP → password), route, API client, i18n (es/en/fr).
- API unit + integration tests.

### Out of Scope
- **Phone/SMS recovery — phase 2** (no SMS infra; email-only v1 chosen). Future work, not a v1 requirement.
- Staff/superadmin — clients-only v1; staff reuse via `TenantUserIndex` deferred as low-cost phase-2 extension.
- Mobile (Expo); magic-link URLs — phase 2.

## Capabilities

### New Capabilities
- `password-recovery`: forgot/reset endpoints, `password_reset` purpose, anti-enumeration + rate limiting, ambiguity handling, session revocation, web flow.

### Modified Capabilities
- None — `first-login-password-change` and `ui-i18n` requirements unaffected (flag clearing, translation completeness).

## Approach

Approach 1: parameterize `buildKey(email, purpose)`. Forgot always returns generic 200 (identical for unknown emails); 409 "use your client code" when ambiguous. Reset verifies the single-use OTP, saves bcrypt password, nulls `refreshToken` + `previousRefreshTokenHash`, clears lockout, sets `mustChangePassword: false`. Web mirrors `RegisterPage` OTP step.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/services/otp.service.js` | Modified | Purpose parameterization |
| `apps/api/src/modules/auth/*`, `middlewares/tenantResolver.js`, authLimiter | Modified | Endpoints, flow, `PUBLIC_ROUTES`, rate limits |
| `apps/api/src/services/notifications/emailTemplates.js`, `packages/validation/src/index.js` | Modified | Reset copy (es/en/fr), zod schemas |
| `apps/web/src/pages/auth/*`, `App.tsx`, `services/auth.service.ts`, `i18n/locales/*` | Modified/New | Link, flow, route, strings |
| `apps/api/tests/**` | Modified/New | Purpose isolation + integration tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `buildKey` change regresses registration | Med | Existing otp/register tests stay green |
| Cross-tenant leak / wrong account | Med | Mirror clientLogin 409 + code path |
| Enumeration via response/timing diffs | Med | Identical generic 200 + cooldown |
| Stolen session survives reset | Low | Null refresh token + replay hash |

## Rollback Plan

Additive: revert PR chain (UI first, then API). No migrations; orphaned OtpCodes expire via TTL.

## Dependencies

Existing OTP/email infra (verified); production `SMTP_HOST`.

## Delivery Forecast

**2 chained PRs** (800-line budget likely exceeded): PR1 API+tests, PR2 web-UI+i18n. `Decision needed before apply: Yes`. `Chained PRs recommended: Yes`. `800-line budget risk: Medium`.

## Success Criteria

- [ ] Client self-resets password without operator help
- [ ] Unknown/ambiguous emails reveal nothing (generic 200 / 409)
- [ ] Reset revokes sessions; clears lockout + `mustChangePassword`
- [ ] Tests green; new coverage passes; UI localized es/en/fr
