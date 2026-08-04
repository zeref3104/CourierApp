# Design: Client Mobile App (Expo/React Native)

## Technical Approach

Backend-first vertical slices, each independently verifiable, web untouched until client contracts settle (proposal Approach; exploration recommendation). This change adds: a **global client code** `{PREFIX}-{SEQ}` (Company `clientCodePrefix` + master-DB per-company counter, superseding per-tenant `CUS-{4}`), **self-service registration** with email OTP + public company/branch lookup, **code+password login** with code→tenant resolution and cookie-free body refresh for RN, **push notifications** via Expo Push Service on the existing `push` channel, and a new **`apps/mobile` Expo workspace**. All new endpoints follow the existing `apiResponse`/zod/`asyncHandler` conventions; all code lives in the current CJS API (`require`/`module.exports`).

## Architecture Decisions

| # | Decision | Choice | Alternatives | Rationale |
|---|----------|--------|-------------|-----------|
| D1 | Prefix storage | `Company.clientCodePrefix` (`^[A-Z]{2,5}$`, unique master index, set at provisioning, immutable — excluded from `UPDATABLE_FIELDS` in `company.service.update`) | Slug reuse / derived prefix | Slug is lowercase+digits and already the tenant key; a separate uppercase prefix keeps code format readable and decouples from tenant routing |
| D2 | Prefix suggestion | Pure helper `suggestClientPrefix(name)` in `@courier/helpers`: initials of words, ≥2 chars, cap 5; single word → first 2 letters. Server computes authoritatively at `company.service.create`; superadmin form (CreateCompanyPage) shows editable field pre-submit | Client-only suggestion | Server must be the source of truth for uniqueness; frontend preview is UX only |
| D3 | Sequence counter | New master model `CompanyCounter` `{ companyId (unique), seq }` + `masterCounter.nextSequence(masterConnection, companyId)` mirroring `tenant/counter.service.js` (`findOneAndUpdate $inc` upsert, 11000 race retry), registered in `loaders/mongoose.js initMaster` | Tenant Counter reuse | Code must be globally unique across tenants; master DB is the single authority. Mirroring the existing pattern keeps behavior familiar |
| D4 | Code format | `generateClientCode(prefix, seq)` → `{PREFIX}-{SEQ:6}` (zero-padded 6). Replaces `generateCustomerCode` (CUS-) at the single call site `customer.service._generateCode`; `CUS-` no longer generated | Keep CUS- + prefix | Specs mandate global format; migration rewrites existing codes |
| D5 | OTP storage | Master-DB `OtpCode` model `{ email+purpose unique, codeHash (sha256), expiresAt (10 min), attempts, cooldownUntil, verifiedAt, consumedAt }` with TTL index | In-memory / signed token | In-memory loses codes on restart and breaks multi-instance; signed tokens can't enforce attempt lockout or be invalidated server-side. DB gives atomic attempt counting + expiry |
| D6 | OTP email language | OTP send accepts optional `lang` (es default, `es|en|fr`) so the app passes device locale; template added to `emailTemplates` per language | Tenant Setting lookup | OTP is sent pre-tenant (email only), so no tenant language is available |
| D7 | Client role | Canonical `client` role (isSystem, permissions `[]`) created at provisioning alongside the 8 existing roles; client Users reference it | Null roleId | `User.roleId` is required and `auth.service.login` reads role permissions; a dedicated role keeps JWT `role:'client'` explicit while access is gated by the `isClient` claim + PlanEnforcer |
| D8 | Atomic register | Tenant-connection Mongo session `withTransaction` (Customer + User); fallback to sequential create + compensating delete when the deployment is a standalone (default `MONGO_URI` is a single node) | Always transaction / single doc | Spec requires rollback-on-failure. Transactions need a replica set; compensation keeps the contract honored on standalone while staying honest in docs |
| D9 | Code→tenant resolution | Parse `^([A-Z]{2,5})-(\d{6})$`, `Company.findOne({ clientCodePrefix })` (unique master index), then tenant: `Customer.findOne({ code })` (unique) → `User.findOne({ clientId, isClient:true })` | TenantUserIndex by email / global Customer index | TenantUserIndex is email-keyed and unusable for code; master prefix index is a single point lookup and needs no tenant context |
| D10 | RN refresh | `POST /auth/client/refresh` with `refreshToken` in BODY → `{ accessToken, refreshToken }` in body; reuses `authService.refresh` rotation + adds replay detection via `previousRefreshTokenHash` on User | HTTP-only cookie | RN has no cookie jar; spec mandates body variant with rotation and replay revocation (old token resubmitted → revoke ALL client tokens) |
| D11 | Device tokens | Embedded array on tenant `User`: `deviceTokens: [{ token, platform, createdAt }]`, validated `^ExponentPushToken\[[A-Za-z0-9_-]+\]$`, dedup by token, cap 5 | Separate collection | Tokens are per client user; embedding keeps the cap and cleanup trivial, one document read per dispatch |
| D12 | Push provider | Expo Push Service via `expo-server-sdk` v6, loaded with dynamic `import()` inside `push.service.js` (v4+ is ESM-only; API is CJS — `require` would throw `ERR_REQUIRE_ESM`) | FCM native | Specs decide Expo; Expo tokens also feed `expo-notifications` on-device with zero FCM project setup. Dynamic import keeps the CJS app working |
| D13 | Push failure isolation | `notificationHandler.onPackageStatusChanged` sends push best-effort after the `in_app` Notification write, inside try/catch; package update + in-app never blocked | Await before notification write | Spec requires tolerance; push is an outbound channel, not a source of truth |
| D14 | Expo SDK | SDK 56 (RN 0.85, React 19.2.3, Node ≥ 20.19) | SDK 57 (needs Node 22.13) / SDK 54 | Repo `engines.node >=20`; SDK 57 raises the floor to 22.13. SDK 56 is the newest SDK on the Node 20 line. Expo Router is the default router (SDK 56 forked react-navigation — do NOT import `@react-navigation/*` directly) |
| D15 | App state | zustand for auth/tenant/notification-badge stores; server data via axios + hooks | RTK/RTK Query | Web's RTK setup is not shareable (separate workspace, no shared store code); app global state is small (tokens, tenant context, badge). RTK Query is a heavier option if team wants web parity |
| D16 | API base URL | Single base URL (`EXPO_PUBLIC_API_URL`) + `x-tenant-slug` header on every authed request | Per-tenant base URL | Code login has NO company selector pre-auth — a per-tenant base is a chicken-and-egg problem. The API resolves the tenant server-side from the code; the slug header is only needed for tenant-scoped `/client/*` calls after login |
| D17 | Slice order | 5 slices: identity → registration/OTP/public → code login/refresh/client-panel delta → push → app | Proposal's original 3-way split | Task requires registration (with public endpoints) before code login so the app's register-then-login contract exists first; backend proceeds without the app |

## Data Flow

### 1. Register + OTP (client-code-identity, client-registration, auth-specs)

```
App ──GET /public/companies──▶ PublicController ──▶ Company.find({isActive, license active}) ──▶ [{id,slug,name}]
App ──GET /public/companies/:id/branches──▶ PublicController ──▶ connectionManager.getConnection(company) ──▶ Branch.find({isActive}) ──▶ [{id,name,address}]
App ──POST /auth/client/otp/send {email, lang}──▶ otpController.send ──▶ OtpCode upsert (cooldown 60s, 429) ──▶ emailService.sendOtpCode (es|en|fr)
App ──POST /auth/client/otp/verify {email, code}──▶ otpController.verify ──▶ hash compare, attempts<5, single-use (verifiedAt)
App ──POST /auth/client/register──▶ registerController ──▶ validate company active+branch active+OTP verified+email unique
                                                                  │  tenant session (or compensation)
                                                                  ├─▶ masterCounter.nextSequence(masterConn, companyId) → seq
                                                                  ├─▶ Customer.create({ code: `${prefix}-${seq:6}`, branchId, ... })
                                                                  └─▶ User.create({ isClient:true, clientId, roleId: clientRole, password })
                                                                        │
                                                                        ▼
                                                              tokens in body (auto-login): { accessToken, refreshToken, client:{id, code} }
```

### 2. Code login + refresh (client-code-login)

```
App ──POST /auth/client/login {code, password}──▶ clientLogin ──▶ parse prefix → Company.findOne({clientCodePrefix})
        ──▶ license/isActive check (401/403) ──▶ connectionManager.getConnection(company)
        ──▶ Customer.findOne({code}) ──▶ User.findOne({clientId, isClient:true}) ──▶ bcrypt compare (401)
        ──▶ jwt (isClient:true, clientId, tenant) + refresh token (hash stored) ──▶ body response
App ──POST /auth/client/refresh {refreshToken}──▶ refresh ──▶ replay? hash===previousRefreshTokenHash → revoke ALL, 401
        ──▶ rotation (store new hash, keep old as previous) ──▶ { accessToken, refreshToken } in body
```

### 3. Push on package status change (push-notifications)

```
PackageService status change ──▶ eventBus PACKAGE_STATUS_CHANGED ──▶ notificationHandler.onPackageStatusChanged
        ├─▶ createNotification (channel 'in_app') ──▶ socketHandler customer:{customerId} room (existing)
        ├─▶ email (existing, best-effort)
        └─▶ NEW: pushDispatch ──▶ Customer→User.deviceTokens ──▶ push.service.sendToTokens()
                  payload { to, title, body, data:{type:'package_status', packageId, trackingNumber, status, companySlug}, sound:'default' }
                  try/catch → log only; never blocks package update
```

## Slice Ordering & Backend Contracts

Slices are independently shippable; each exposes the interface the next consumes, so the app (slice 5) builds against settled contracts.

### Slice 1 — Code identity + provisioning prefix

**Delivers**: `Company.clientCodePrefix` (schema + validation + suggestion + unique 409), master `CompanyCounter` + `masterCounter.nextSequence`, `generateClientCode`/`suggestClientPrefix` helpers, staff `POST /customers` generates global code, migration script, canonical `client` role at provisioning.

**Contract for later slices**: every Customer code matches `^[A-Z]{2,5}-\d{6}$`; `generateClientCode(prefix, seq)`; `masterCounter.nextSequence(masterConnection, companyId) → seq`.

### Slice 2 — Registration + OTP + public endpoints

**Delivers**: `OtpCode` model + `POST /auth/client/otp/send` + `/verify`, `POST /auth/client/register` (atomic Customer + isClient User), `GET /public/companies` + `/public/companies/:id/branches`; `tenantResolver` PUBLIC_ROUTES gains `/auth/client/otp`, `/auth/client/register`, `/public`.

**Contract**:
```json
POST /auth/client/otp/send   {"email": "a@b.c", "lang?": "es|en|fr"}  → 200 {"sent":true,"resendAfter":60} | 429 (cooldown)
POST /auth/client/otp/verify {"email": "a@b.c", "code": "123456"}     → 200 {"verified":true} | 422 (wrong/expired/locked)
POST /auth/client/register   {"companyId","branchId","name","lastName","phone","document?","email","password","otpCode"}
  → 201 {"accessToken","refreshToken","client":{"id","code","name","email"}} | 409 dup email | 422 OTP | 400/404 company/branch
GET /public/companies        → [{"id","slug","name"}]
GET /public/companies/:id/branches → [{"id","name","address"}]
```

### Slice 3 — Code login + tenant resolution + RN refresh (+ client-panel delta)

**Delivers**: `clientCodeLoginSchema` (`code`,`password`), code→tenant resolution helper, `POST /auth/client/login`, `POST /auth/client/refresh` (body, replay protection), client-panel delta: `GET /client/packages/:tracking` emits `amountToPay` + `pickupBranch` ONLY when `status==='disponible'`; `GET /client/notifications` returns `in_app`+`push` records.

**Contract**:
```json
POST /auth/client/login  {"code":"CS-000001","password":"..."}
  → 200 {"accessToken","refreshToken","client":{"id","code","name","company":{"slug","name","prefix"}}}
  | 404 unknown code | 401 wrong password / inactive | 401/403 company/license
POST /auth/client/refresh {"refreshToken":"..."} → 200 {"accessToken","refreshToken"} | 401 revoked/replay
```

### Slice 4 — Push + device tokens

**Delivers**: `deviceTokens` on User, `POST /client/device-token`, `push.service.js` (expo-server-sdk dynamic import), push dispatch in `notificationHandler`.

**Contract**: `POST /client/device-token {"token":"ExponentPushToken[...]","platform":"android|ios"} → 201 {"registered":true,"devices":n} | 422 format | 400 cap(5)`. Push payload as in §4 spec.

### Slice 5 — Mobile app

**Delivers**: `apps/mobile` workspace consuming slices 1–4 contracts + existing `GET /client/dashboard|packages|packages/:tracking|notifications|profile`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/models/master/Company.js` | Modify | Add `clientCodePrefix` (unique index) |
| `apps/api/src/models/master/CompanyCounter.js` | Create | Master per-company counter `{ companyId unique, seq }` |
| `apps/api/src/models/master/OtpCode.js` | Create | `{ email+purpose unique, codeHash, expiresAt (TTL), attempts, cooldownUntil, verifiedAt, consumedAt }` |
| `apps/api/src/services/master/counter.service.js` | Create | `nextSequence(masterConnection, companyId)` mirroring tenant counter pattern |
| `apps/api/src/loaders/mongoose.js` | Modify | Register CompanyCounter + OtpCode on master connection |
| `apps/api/src/modules/companies/company.service.js` | Modify | Suggest/validate `clientCodePrefix` at create; add `client` canonical role; never update prefix |
| `packages/helpers/src/index.js` | Modify | `suggestClientPrefix(name)`, `generateClientCode(prefix, seq)`; deprecate `generateCustomerCode` |
| `packages/constants/src/index.js` | Modify | `CLIENT_CODE_PATTERN`, `DEVICE_PLATFORMS`, `PUSH_TOKEN_PATTERN` |
| `packages/validation/src/index.js` | Modify | Add `clientCodeLoginSchema`, `registerClientSchema`, `otpSendSchema`, `otpVerifySchema`, `clientRefreshSchema`, `deviceTokenSchema`; extend `createCompanySchema` with optional `clientCodePrefix` |
| `apps/api/src/modules/customers/customer.service.js` | Modify | Constructor gains `{ companyId, clientCodePrefix, masterConnection }`; `_generateCode` → master counter + prefix; add `createClient()` (atomic Customer+User) |
| `apps/api/src/modules/customers/customer.controller.js` | Modify | Pass tenant context to `CustomerService` |
| `apps/api/src/modules/auth/auth.service.js` | Modify | `loginByCode()`, refresh replay detection (`previousRefreshTokenHash`), `registerClient()` |
| `apps/api/src/modules/auth/auth.controller.js` | Modify | `clientCodeLogin`, `clientRefresh`, `register`, `otpSend`, `otpVerify` handlers; `resolveTenantByCode()` helper |
| `apps/api/src/modules/auth/auth.routes.js` | Modify | Route `/client/login` with `clientCodeLoginSchema`; add `/client/otp/send|verify`, `/client/register`, `/client/refresh` |
| `apps/api/src/modules/auth/token.service.js` | Modify | Replay-aware rotation helpers |
| `apps/api/src/models/tenant/User.js` | Modify | Add `previousRefreshTokenHash`, `deviceTokens[]` |
| `apps/api/src/modules/public/public.routes.js` + `public.controller.js` | Create | `/public/companies`, `/public/companies/:id/branches` (whitelisted, rate-limited) |
| `apps/api/src/middlewares/tenantResolver.js` | Modify | PUBLIC_ROUTES += `/auth/client/otp`, `/auth/client/register`, `/auth/client/refresh`, `/public` |
| `apps/api/src/routes/v1/index.js` | Modify | Mount `/public` router |
| `apps/api/src/modules/client/client.routes.js` | Modify | Add `POST /device-token` |
| `apps/api/src/modules/client/client.service.js` | Modify | `getPackageByTracking` emits `amountToPay`/`pickupBranch` only when `disponible`; `getNotifications` channel `$in ['in_app','push']` |
| `apps/api/src/services/notifications/push.service.js` | Create | expo-server-sdk v6 via dynamic import; `sendToTokens()` best-effort |
| `apps/api/src/services/notifications/emailTemplates.js` | Modify | Add `otp` template (es/en/fr) |
| `apps/api/src/services/notifications/email.service.js` | Modify | Add `sendOtpCode(email, code, lang)` |
| `apps/api/src/events/handlers/notificationHandler.js` | Modify | Dispatch push alongside `in_app` on status change |
| `apps/api/scripts/migrate-client-codes.js` | Create | Prefix backfill + CUS-→global code rewrite (idempotent) |
| `apps/web/src/pages/admin/companies/CreateCompanyPage.tsx` | Modify | Editable prefix field with suggestion |
| `apps/mobile/` (package.json, app.json, tsconfig, babel, `app/` routes, `src/`) | Create | Expo SDK 56 workspace |

## Interfaces / Contracts (models)

```js
// Master
CompanyCounter: { companyId: ObjectId(unique), seq: Number }
OtpCode: { key: String(unique, `${email}:register`), codeHash: String, expiresAt: Date(TTL 10min),
           attempts: Number(0), cooldownUntil: Date, verifiedAt: Date?, consumedAt: Date? }
Company: { ..., clientCodePrefix: { type: String, unique: true, match: /^[A-Z]{2,5}$/, uppercase: true } }

// Tenant
User: { ..., previousRefreshTokenHash: String?,
        deviceTokens: [{ token: String(unique, match /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/),
                         platform: { type: String, enum: ['android','ios'] }, createdAt: Date }] }

// JWT (unchanged claims, client path only): { sub, role:'client', isClient:true, clientId, tenant }
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `suggestClientPrefix`/`generateClientCode` | Pure helper cases: initials, single word, 5-char cap, padding |
| Unit | `masterCounter.nextSequence` | Mock `findOneAndUpdate`; assert `$inc` + upsert + 11000 retry |
| Unit | OTP send/verify | Expiry, 5-attempt lockout, single-use, 60s cooldown (429) |
| Integration | Register flow | jest+supertest: company+branch+OTP → Customer+isClient User → tokens; dup email 409; invalid OTP 422; rollback on User failure |
| Integration | Code login | prefix→tenant→customer→user→bcrypt; 404 unknown prefix; 401 bad password; inactive company 401/403 |
| Integration | Client refresh | Body rotate; replay revokes all; blacklisted token 401 |
| Integration | Push | Status change writes `in_app` + push called for each token; no tokens → no push; Expo error logged, flow succeeds |
| Integration | Migration script | 3 CUS- customers → RB-000001..3; idempotent re-run; no CUS- remains |
| E2E | App | (slice 5) register→OTP→dashboard; login by code; refresh without cookies; amount-to-pay card only on `disponible` |

## Migration / Rollout

1. **Deploy order**: slice 1 → 2 → 3 → 4 → 5; each slice its own chained PR (feature-branch chain, ~400-line review budget).
2. **Prefix assignment (MIGRATE)**: `npm run migrate:client-codes --workspace @courier/api` assigns a suggested prefix to any company missing one (deterministic collision suffix), seeds `CompanyCounter` per company, and rewrites `CUS-{4}` → `{PREFIX}-{6}` per tenant sorted by `createdAt`. Idempotent: skips codes already matching the global pattern. No FK impact — `Customer.code` is display-only (emails/receipts); all references use `customerId` ObjectId. Tenant `Counter` key `customer-code` stops being consumed (left in place for rollback).
3. **Rollback**: per-slice revert (feature-branch chain); feature-flag `/auth/client/*` + `/public/*` off restores prior behavior; drop `clientCodePrefix`/`CompanyCounter`/`OtpCode` models and re-run nothing (codes are cosmetic — no automated un-migration; web panel unaffected throughout).

## Open Questions

- [ ] Is the Mongo deployment a replica set? If yes, D8 uses real transactions; if standalone, compensating rollback is the fallback (no schema change either way).
- [ ] OTP `lang` default when the app can't read device locale yet — accept `es` default (already chosen) or negotiate later.
- [ ] `client` role permissions: `[]` (access via `isClient` claim) vs explicit `client.*` permission codes.
- [ ] Push dev/testing: Expo Go supports push tokens; a development build is required for reliable delivery on Android 13+ — confirm the team's device setup in slice 4.
- [ ] Should `GET /client/notifications` add a `read`/`seen` flag for the app badge (currently the badge derives from list length)?
