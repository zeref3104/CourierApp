# Tasks: Client Mobile App (Expo/React Native)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (total) | ~4600–6900 |
| 400-line budget risk | High (overridden by D2 800-line session budget) |
| Chained PRs recommended | Yes |
| Suggested split | 10 chained PRs (feature-branch chain) |
| Delivery strategy | auto-chain (preflight A2 auto, C4 auto-PR) |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Per-Slice Forecast & PR Boundaries

| Slice | Est. lines | Chained | 400-line risk | 800-line risk | PR boundaries (tasks) |
|-------|-----------|---------|---------------|---------------|----------------------|
| 1. Code identity + provisioning | ~950–1150 | Yes (2) | High | Med | PR 1a: 1.1–1.8; PR 1b: 1.9–1.14 |
| 2. Registration + OTP + public | ~450–650 | Yes (2) | Medium | Low | PR 2a: 2.1–2.5; PR 2b: 2.6–2.9 |
| 3. Code login + client-panel delta | ~300–500 | No | Medium | Low | PR 3: 3.1–3.7 (single) |
| 4. Push + device tokens | ~400–600 | No | Medium | Low | PR 4: 4.1–4.7 (single) |
| 5. Expo app | ~2500–4000 | Yes (3) | High | High | PR 5a: 5.1–5.4; PR 5b: 5.5–5.6; PR 5c: 5.7–5.10 |

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Slice 1 foundation + provisioning | PR 1a | Base = `feature/client-mobile-app` tracker branch |
| 2 | Slice 1 generation + migration + client role + tests | PR 1b | Base = PR 1a branch |
| 3 | Slice 2 OTP + public endpoints | PR 2a | Base = PR 1b branch |
| 4 | Slice 2 register + auto-login + tests | PR 2b | Base = PR 2a branch |
| 5 | Slice 3 code login + refresh + panel delta + tests | PR 3 | Base = PR 2b branch |
| 6 | Slice 4 push + device tokens + tests | PR 4 | Base = PR 3 branch |
| 7 | Slice 5 workspace + auth/tenant/interceptor | PR 5a | Base = PR 4 branch |
| 8 | Slice 5 dashboard + tracking + amount-to-pay | PR 5b | Base = PR 5a branch |
| 9 | Slice 5 notifications + profile + i18n + tests | PR 5c | Base = PR 5b branch |

## Conventions (apply to all slices)

- Strict TDD active: every behavior ships with tests in the same work unit. Jest is available but **zero first-party tests exist**; `apps/api/package.json` `test:integration` script is **dead** (references missing `jest.integration.config.js`) — the harness is built in 1.14.
- i18n mandatory: any user-visible string (UI, API copy, OTP email, push title/body) needs keys in `apps/web/src/i18n/locales/{es,en,fr}.json` (or app locales for slice 5); `check-i18n.mjs` gate must pass.
- All API code is CJS (`require`/`module.exports`), `apiResponse`/zod/`asyncHandler` conventions.

## Slice 1 — Client Code Identity + Provisioning (PR 1a → PR 1b)

- [ ] 1.1 **Company.clientCodePrefix field** — add `clientCodePrefix` (`^[A-Z]{2,5}$`, uppercase, unique master index, required) to `apps/api/src/models/master/Company.js`; exclude from `UPDATABLE_FIELDS` in `company.service.update`. AC: duplicate prefix rejected 409; prefix immutable on PATCH. Dep: —. PR 1a.
- [ ] 1.2 **Constants** — add `CLIENT_CODE_PATTERN` (`^[A-Z]{2,5}-\d{6}$`), `CLIENT_CODE_PREFIX_PATTERN`, `DEVICE_PLATFORMS`, `PUSH_TOKEN_PATTERN` to `packages/constants/src/index.js`. AC: exported and reusable. Dep: —. PR 1a.
- [ ] 1.3 **Code helpers** — add `suggestClientPrefix(name)` (initials, ≥2 chars, cap 5; single word → first 2) and `generateClientCode(prefix, seq)` (zero-pad 6) to `packages/helpers/src/index.js`; deprecate `generateCustomerCode`. AC: `Rapid Box` → `RB`; `CS`+1 → `CS-000001`. Dep: 1.2. PR 1a.
- [ ] 1.4 **CompanyCounter model** — create `apps/api/src/models/master/CompanyCounter.js` `{ companyId unique, seq }`. AC: model + unique index on `companyId`. Dep: —. PR 1a.
- [ ] 1.5 **Master counter service** — create `apps/api/src/services/master/counter.service.js` `nextSequence(masterConnection, companyId)` mirroring `services/tenant/counter.service.js` (`findOneAndUpdate $inc` upsert + 11000 race retry). AC: atomic distinct seq under concurrency; retry on 11000. Dep: 1.4. PR 1a.
- [ ] 1.6 **Register master models** — register `CompanyCounter` in `apps/api/src/loaders/mongoose.js` `initMaster`. AC: master connection loads model. Dep: 1.4. PR 1a.
- [ ] 1.7 **CreateCompanySchema prefix** — extend `createCompanySchema` in `packages/validation/src/index.js` with optional `clientCodePrefix` (`^[A-Z]{2,5}$`). AC: schema accepts/validates override. Dep: 1.2. PR 1a.
- [ ] 1.8 **Provisioning prefix + client role** — in `apps/api/src/modules/companies/company.service.js` `create()`: server-computed `suggestClientPrefix(name)` with override, platform-unique check (409, company uncreated); upsert canonical `client` role (isSystem, permissions `[]`). AC: dup prefix 409 keeps company uncreated; `client` role exists after provisioning. Dep: 1.3, 1.7. PR 1a.
- [ ] 1.9 **Global code generation** — `customer.service.js` constructor gains `{ companyId, clientCodePrefix, masterConnection }`; `_generateCode()` → `masterCounter.nextSequence` + `generateClientCode`. AC: staff `POST /customers` yields `{PREFIX}-{SEQ:6}`; immutable via `PATCH /customers/:id`. Dep: 1.5. PR 1b.
- [ ] 1.10 **CustomerService wiring** — `apps/api/src/modules/customers/customer.controller.js` passes tenant context (companyId, prefix, master conn) to `CustomerService`. AC: staff-created customer carries global code. Dep: 1.9. PR 1b.
- [ ] 1.11 **Admin prefix field** — `apps/web/src/pages/admin/companies/CreateCompanyPage.tsx`: editable prefix field pre-filled with suggestion, submits override. AC: field shows suggestion; override submitted with create. Dep: 1.8. PR 1b.
- [ ] 1.12 **Slice 1 i18n** — add prefix label + validation keys to `apps/web/src/i18n/locales/{es,en,fr}.json`. AC: `check-i18n.mjs` gate passes. Dep: 1.11. PR 1b.
- [ ] 1.13 **Migration script** — create `apps/api/scripts/migrate-client-codes.js` (+ `migrate:client-codes` npm script): assign suggested prefix to companies missing one (deterministic collision suffix), seed `CompanyCounter`, rewrite `CUS-{4}` → `{PREFIX}-{6}` sorted by `createdAt`, idempotent. AC: 3 `CUS-` customers → `RB-000001..3`; re-run no-op; no `CUS-` remains. Dep: 1.3, 1.5. PR 1b.
- [ ] 1.14 **Test strategy Slice 1** — create `apps/api/jest.integration.config.js` (fixes dead `test:integration` script); unit tests for `suggestClientPrefix`/`generateClientCode`/`nextSequence` (mock `findOneAndUpdate`, 11000 retry); integration: staff `POST /customers` global code, dup prefix 409, migration idempotency. AC: `npm run test` + `npm run test:integration --workspace @courier/api` green. Dep: 1.1–1.13. PR 1b.

## Slice 2 — Registration + OTP + Public Endpoints (PR 2a → PR 2b)

- [ ] 2.1 **OtpCode model** — create `apps/api/src/models/master/OtpCode.js` `{ key unique (email:purpose), codeHash (sha256), expiresAt (TTL 10 min), attempts, cooldownUntil, verifiedAt, consumedAt }`; register in `initMaster`. AC: model + TTL index. Dep: —. PR 2a.
- [ ] 2.2 **OTP/register schemas** — add `otpSendSchema`, `otpVerifySchema`, `registerClientSchema` to `packages/validation/src/index.js` (email, 6-digit code, companyId/branchId/name/lastName/phone/document?/email/password/otpCode). AC: payloads validated. Dep: 1.2. PR 2a.
- [ ] 2.3 **Public endpoints** — create `apps/api/src/modules/public/public.controller.js` + `public.routes.js`: `GET /public/companies` (active+license only, `{id,slug,name}`), `GET /public/companies/:id/branches` (active branches, `{id,name,address}`, 404 unknown/inactive); rate-limited; mount in `apps/api/src/routes/v1/index.js`. AC: inactive company excluded, no license/plan leakage, 404 unknown. Dep: —. PR 2a.
- [ ] 2.4 **OTP email** — add `sendOtpCode(email, code, lang)` to `apps/api/src/services/notifications/email.service.js` + `otp` template (es/en/fr) in `emailTemplates.js`. AC: 3-lang template rendered; `lang` defaults `es`. Dep: —. PR 2a.
- [ ] 2.5 **OTP send/verify** — auth `otpSend` (upsert, 60s cooldown → 429, sha256 hash, 10-min expiry) and `otpVerify` (hash compare, attempts <5 else invalidate, single-use `verifiedAt`); routes `POST /auth/client/otp/send|verify`; `tenantResolver.js` PUBLIC_ROUTES += `/auth/client/otp`, `/auth/client/register`, `/public`. AC: 6-digit code; 429 resend; 5th failed attempt invalidates; single-use. Dep: 2.1, 2.2, 2.4. PR 2a.
- [x] 2.6 **Atomic register** — `auth.service.registerClient()`: validate company active + branch belongs+active + OTP verified + email unique in tenant (409); create Customer (global code via master counter) + `isClient` User (client role) in tenant session transaction, compensating delete fallback on standalone. AC: 201 tokens; 409 dup email; 422 invalid OTP; no Customer/User persists on failure. Dep: 1.5, 1.8, 2.2, 2.5. PR 2b.
- [x] 2.7 **Register endpoint** — `POST /auth/client/register` route + controller handler (registerClientSchema), returns `{accessToken, refreshToken, client:{id,code,name,email}}`. AC: auto-login on success per contract. Dep: 2.6. PR 2b.
- [x] 2.8 **Slice 2 i18n** — OTP email + registration error copy keys in `apps/web/src/i18n/locales/{es,en,fr}.json`. AC: i18n gate passes. Dep: 2.4. PR 2b.
- [x] 2.9 **Test strategy Slice 2** — unit: OTP expiry/lockout/single-use/cooldown; integration (jest+supertest): register flow (company+branch+OTP → Customer+isClient User → tokens), dup email 409, invalid OTP 422, rollback on User failure, public endpoints scenarios. AC: suite green. Dep: 2.1–2.8. PR 2b.

## Slice 3 — Code Login + Tenant Resolution + RN Refresh + Panel Delta (PR 3)

- [ ] 3.1 **Login/refresh schemas** — add `clientCodeLoginSchema` (`code` matches `CLIENT_CODE_PATTERN`, `password`) and `clientRefreshSchema` to `packages/validation/src/index.js`. AC: email rejected as login identifier (422). Dep: 1.2. PR 3.
- [ ] 3.2 **loginByCode** — `auth.service.loginByCode()`: parse prefix → `Company.findOne({clientCodePrefix})` → active/license check (401/403) → `connectionManager.getConnection` → `Customer.findOne({code})` → `User.findOne({clientId, isClient:true})` → bcrypt (401); issue client JWT + refresh token (hash stored). AC: 200 tokens+limited profile; 404 unknown prefix/code; 401 wrong password/inactive; staff `POST /auth/login` unchanged. Dep: 1.8. PR 3.
- [ ] 3.3 **Login route** — `POST /auth/client/login` route + controller handler + `resolveTenantByCode()` helper. AC: response `{accessToken, refreshToken, client:{id,code,name,company:{slug,name,prefix}}}`. Dep: 3.2. PR 3.
- [ ] 3.4 **Body refresh + replay** — `token.service.js` replay-aware rotation; `previousRefreshTokenHash` on `apps/api/src/models/tenant/User.js`; `POST /auth/client/refresh` accepts body token, rotates, and revokes ALL client tokens on replay (401). AC: rotate returns new tokens in body; old token resubmit revokes all. Dep: 3.2. PR 3.
- [ ] 3.5 **Client-panel delta** — `client.service.js`: `getPackageByTracking` emits `amountToPay` (pkg.total) + `pickupBranch` only when `status==='disponible'`; `getNotifications` filters channel `$in ['in_app','push']`. AC: disponible shows total+branch; `en_reparto` hides amount. Dep: —. PR 3.
- [ ] 3.6 **Slice 3 i18n** — login/refresh error copy keys in 3 web locale files. AC: i18n gate passes. Dep: 3.2. PR 3.
- [ ] 3.7 **Test strategy Slice 3** — integration: code login (prefix→tenant→customer→user→bcrypt; 404 unknown prefix; 401 bad password; inactive company 401/403), body refresh rotate + replay revokes all + blacklisted 401, panel `amountToPay` gating scenarios. AC: suite green. Dep: 3.1–3.6. PR 3.

## Slice 4 — Push Notifications + Device Tokens (PR 4)

- [x] 4.1 **deviceTokens on User** — add `deviceTokens: [{ token (Expo regex), platform enum android|ios, createdAt }]` to `apps/api/src/models/tenant/User.js`. AC: schema validates token format. Dep: 1.2. PR 4.
- [x] 4.2 **Device-token schema** — add `deviceTokenSchema` to `packages/validation/src/index.js` (uses `PUSH_TOKEN_PATTERN`). AC: non-Expo token rejected 422. Dep: 1.2. PR 4.
- [x] 4.3 **Register endpoint** — `POST /client/device-token` route in `apps/api/src/modules/client/client.routes.js` + service: dedup by token (idempotent), cap 5 distinct (400). AC: 201 `{registered, devices}`; dup idempotent; 6th distinct token 400. Dep: 4.1, 4.2. PR 4.
- [x] 4.4 **Push service** — create `apps/api/src/services/notifications/push.service.js`: `expo-server-sdk` v6 via dynamic `import()` (CJS-safe), `sendToTokens(tokens, payload)` best-effort. AC: no `ERR_REQUIRE_ESM`; send errors logged. Dep: —. PR 4.
- [x] 4.5 **Push dispatch** — `apps/api/src/events/handlers/notificationHandler.js` `onPackageStatusChanged`: after `in_app` write, push to all customer device tokens with payload `{to,title,body,data:{type:'package_status',packageId,trackingNumber,status,companySlug},sound:'default'}` (< 4 KB), try/catch log-only. AC: in_app + push per token; no tokens → no push; Expo error logged, flow succeeds. Dep: 4.3, 4.4. PR 4.
- [x] 4.6 **Slice 4 i18n** — push title/body (es/en/fr) via template convention in 3 web locale files. AC: i18n gate passes. Dep: 4.5. PR 4.
- [x] 4.7 **Test strategy Slice 4** — unit: push.service payload + dynamic import; integration: status change writes in_app + push per token, no tokens skip, Expo error tolerated, device-token register/dedup/cap. AC: suite green. Dep: 4.1–4.6. PR 4.

## Slice 5 — Expo Mobile App (PR 5a → PR 5b → PR 5c)

- [x] 5.1 **Expo workspace** — create `apps/mobile` (package.json under `workspaces: ["apps/*"]`, app.json, tsconfig, babel config, Expo Router entry, SDK 56, Node ≥ 20.19) + npm workspace scripts. AC: `expo start` boots dev server. Dep: —. PR 5a.
- [x] 5.2 **Core app infra** — zustand stores (auth, tenant, notification badge); axios instance with single base URL (`EXPO_PUBLIC_API_URL`), `Authorization: Bearer` + `x-tenant-slug` headers; 401 → `POST /auth/client/refresh` (body) → retry → logout on failure; refresh token in expo-secure-store; tenant (`companyId`, `companySlug`, `companyPrefix`, `clientId`) in AsyncStorage, restored on restart, cleared on logout. AC: refresh without cookies; refresh failure returns to login; tenant survives restart. Dep: 5.1. PR 5a.
- [x] 5.3 **Login screen** — code+password only (no email/company selector), `POST /auth/client/login`, persists tokens + tenant context. AC: login by code opens dashboard. Dep: 5.2. PR 5a.
- [x] 5.4 **Registration flow** — company selector (`GET /public/companies`), branch selector (`GET /public/companies/:id/branches`), form, OTP screen (send/verify), `POST /auth/client/register` + auto-login; blocks submit before OTP verified. AC: full path → tokens stored → logged in. Dep: 5.2. PR 5a.
- [x] 5.5 **Dashboard + package list** — `GET /client/dashboard` four stats (`totalPackages`, `inTransit`, `readyForPickup`, `delivered`); `GET /client/packages` list with status filter + pagination. AC: four stats displayed; `status=disponible` filter works. Dep: 5.2. PR 5b.
- [x] 5.6 **Tracking detail + pay-at-pickup** — `GET /client/packages/:tracking`: chronological `PackageHistory` timeline + pickup branch; amount-to-pay card (`package.total` + branch) ONLY when `disponible`. AC: timeline ordered across 8 statuses; card shown disponible, hidden `en_reparto`. Dep: 5.5. PR 5b.
- [x] 5.7 **Notifications + push token** — after login request Expo push token (expo-notifications) and register via `POST /client/device-token`; notifications screen from `GET /client/notifications`. AC: token registered after login; notification list renders own records. Dep: 5.2. PR 5c.
- [x] 5.8 **Profile screen** — `GET`/`PATCH /client/profile` read/update. AC: PATCH returns updated profile. Dep: 5.2. PR 5c.
- [x] 5.9 **App i18n** — `apps/mobile/src/i18n` es/en/fr locale files reusing `status.*`/`common.*` key conventions from web; all UI copy + status labels via translation keys. AC: `recibido_miami` label resolves via key, no hardcoded strings. Dep: 5.6. PR 5c.
- [x] 5.10 **Test strategy Slice 5** — unit: zustand stores + axios interceptor refresh/retry/logout logic; E2E manual checklist: register→OTP→dashboard, login by code, refresh without cookies, amount-to-pay card only on `disponible`. AC: interceptor unit tests green + E2E checklist passes. Dep: 5.1–5.9. PR 5c.

## Slice 5 Note — Open Question for Apply

- [ ] 5.11 Confirm team push-device setup (Expo Go vs dev build for Android 13+) before PR 5c; feature-flag `/auth/client/*` + `/public/*` off is the rollback lever for all backend slices.
  - **Status (PR 5c): RAISED, pending team decision** — the app implements push registration with `expo-notifications` (task 5.7) and gracefully skips when no EAS projectId is configured, so both Expo Go and a dev build work code-wise. Android 13+ reliable push delivery requires a development/production build; Expo Go supports tokens for testing only. Team must decide the device setup before E2E push validation. Rollback lever unchanged: feature-flag `/auth/client/*` + `/public/*` off.
