# Proposal: Client Mobile App (Expo/React Native)

## Intent

Clients today have no mobile access — only the web panel. SPEC 02 §2.2 documents client registration (Customer + isClient User) but it is **never implemented**; no code path creates an isClient User. This change ships a self-service client mobile app: register via company/branch selectors + email OTP, log in with a **global client unique code** (`{PREFIX}-{SEQ}`, e.g. `CS-000001`) + password, and track packages (dashboard, 8-status timeline, push notifications, pay-at-pickup amount).

## Scope

### In Scope
- Global client code: per-company admin-set prefix (suggested initials, platform-unique, set once at provisioning) + master-DB sequence counter
- Self-service registration: company → active branch selector → form (name, phone, document, email, password) → 6-digit email OTP (10 min, 5 attempts) → Customer + isClient User + auto-login
- Code+password login (no email, no company selector) with master-index tenant resolution; token-in-body refresh for RN
- In-app: dashboard (inTransit/readyForPickup/delivered/total), tracking timeline, push notifications, `disponible` → amount (pkg.total) + pickup branch
- App remembers tenant locally after registration/first login
- New `apps/mobile` Expo workspace; write empty spec 13-client-panel-specs.md

### Out of Scope
- Web client panel changes (untouched until backend contracts settle)
- Forgot-password / email-change flows
- iOS App Store / Play Store release automation
- Multi-language app UI (i18n later; API copy follows 3-lang convention)

## Capabilities

### New Capabilities
- `client-code-identity`: `{PREFIX}-{SEQ}` global code; Company.prefix (platform-unique), master counter per company
- `client-registration`: public company/branch lookup, register form, email OTP (6-digit/10min/5 attempts), Customer + isClient User creation
- `client-code-login`: code+password auth, code→tenant resolution, refresh without cookies
- `push-notifications`: device-token storage, push.service (Expo/FCM), Notification channel 'push'
- `client-mobile-app`: Expo/RN app — auth, dashboard, tracking, pay-at-pickup, notifications

### Modified Capabilities
- `auth-specs`: client login keyed by code (not email); register endpoint; OTP verify; in-body refresh
- `client-panel-specs`: spec 13 empty → write dashboard/tracking/amount-to-pay requirements

## Approach

Vertical backend-first slices (exploration recommendation), each independently verifiable; web untouched until slice 3 contracts settle. Slice order: (1) code prefix + master counter + register/OTP, (2) code login + tenant resolution, (3) dashboard/tracking reuse + public company/branch endpoints + spec 13, (4) push + device tokens, (5) Expo app.

## Delivery Forecast (800-line budget, auto-PR)

| Slice | Est. lines | PRs | 400-line risk | 800-line risk |
|-------|-----------|-----|---------------|---------------|
| 1. Code prefix + counter + register/OTP | ~950–1150 | 2 chained | High | Med |
| 2. Code login + tenant resolution | ~450–650 | 1–2 | Med | Low |
| 3. Dashboard/tracking + public endpoints | ~300–500 | 1 | Med | Low |
| 4. Push + device tokens | ~400–600 | 1–2 | Med | Low |
| 5. Expo app | ~2500–4000 | 3–4 chained | High | High |

`Decision needed before apply: Yes` — total ~4600–6900 lines; chaining required.
`Chained PRs recommended: Yes` — feature branch chain, slice 1 & 5 split into work units.
`400-line budget risk: High` (overridden by D2 800-line session budget).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/models/master/Company.js` | Modified | Add `clientCodePrefix` (unique) |
| `apps/api/src/models/master/` | New | CompanyCounter + OtpCode models |
| `apps/api/src/modules/companies/company.service.js` | Modified | Prefix suggestion/validation at provisioning |
| `apps/api/src/modules/customers/customer.service.js` | Modified | `createClient` (Customer + isClient User, txn) |
| `apps/api/src/modules/auth/*` | Modified | Code login, register, OTP, in-body refresh |
| `apps/api/src/middlewares/tenantResolver.js` | Modified | PUBLIC_ROUTES: /public/*, code index |
| `apps/api/src/modules/client/client.routes.js` | Modified | Expose notifications to clients |
| `apps/api/src/services/notifications/` | Modified | OTP email template (es/en/fr), push.service |
| `packages/helpers`, `packages/validation` | Modified | Prefix-aware code gen, new schemas |
| `apps/web/src/i18n/locales/*.json` | Modified | Shared copy (es/en/fr) |
| `apps/mobile/` | New | Expo workspace |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Register + isClient creation missing (blocking) | High | Spec FIRST, txn in `createClient`, jest+supertest suite per slice |
| Code login can't resolve tenant (email-keyed index) | High | Master code index; fallback subdomain/x-tenant-slug |
| Public company/branch endpoints widen attack surface | Med | Whitelist only GET active data; rate-limit OTP |
| OTP security (brute force, expiry) | Med | 6-digit, 10min, 5 attempts, lockout |
| RN refresh token via cookie awkward | Med | Token-in-body variant reusing existing rotation |
| Master counter + prefix migration on existing data | Med | Seed existing CUS- codes as `{PREFIX}-{SEQ}` backfill |
| Push infra greenfield (no FCM/Expo today) | Med | Slice 4 isolated; channel enum already exists |

## Rollback Plan

1. Per-slice: revert PR by PR (feature-branch chain); each slice autonomous
2. Feature-flag registration/code-login routes off; restore email login
3. Drop `clientCodePrefix`/counter models; backfill CUS- codes
4. App: unlisted release; users keep web panel (unaffected)
5. Existing isClient users: none created pre-change — no data cleanup

## Dependencies

- Expo SDK + React Native toolchain (Node ≥ 20 present)
- SMTP already configured (console-log fallback)
- No external push vendor until slice 4 (Expo push or FCM decision there)

## Success Criteria

- [ ] Register → OTP → auto-login creates Customer + isClient User end-to-end
- [ ] Login works with `{PREFIX}-{SEQ}` + password only; tenant resolved via code
- [ ] Dashboard/tracking match web panel data (8-status timeline, pay-at-pickup total + branch)
- [ ] Push notification received on package status change
- [ ] App boots, remembers tenant, survives refresh without cookies
- [ ] All API tests green; web panel unchanged
