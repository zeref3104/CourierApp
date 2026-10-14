## Verification Report

**Change**: forgot-password
**Version**: N/A (spec: `openspec/changes/forgot-password/specs/password-recovery/spec.md`, 8 requirements R1–R8, 12 scenarios — inputs cited 14; the spec file contains 12 `#### Scenario` sections)
**Mode**: Strict TDD (partial — backend only; `apps/web` has no test tooling, web verification = gates + spec-conformance review per orchestrator contract)
**Branches verified**: `feat/forgot-password-api` (7 commits) and `feat/forgot-password-web` (3 commits, stacked) — current checkout `feat/forgot-password-web` contains both; nothing merged to master, history untouched.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 16 |
| Tasks complete | 15 |
| Tasks incomplete | 1 (5.2 manual browser/email QA — known-open for a human) |

### Build & Tests Execution

**API unit**: ✅ 225 passed / 0 failed
```text
> cross-env NODE_OPTIONS=--experimental-vm-modules jest --coverage
Test Suites: 30 passed, 30 total
Tests:       225 passed, 225 total
Time:        5.48 s
```

**API integration**: ✅ 51 passed / 0 failed
```text
> jest --config jest.integration.config.js
Test Suites: 8 passed, 8 total
Tests:       51 passed, 51 total
Time:        15.015 s
```

**Web build gates**: ✅ Passed
```text
> tsc -b && vite build && node ../../scripts/check-i18n.mjs
✓ 2747 modules transformed / ✓ built in 9.16s
i18n completeness check PASSED: 470 keys in es, en and fr (0 missing, 0 extra, interpolation params aligned)
```
(Only pre-existing warnings: vite chunk >500 kB, dynamic-import note on `config/axios.ts`.)

**Coverage**: changed files (from unit `--coverage`): see Changed File Coverage below. Aggregate of the 4 instrumented changed API files ≈ 74% line — ⚠️ below 80%, but per-file analysis shows new code is covered; uncovered lines are pre-existing paths. No project threshold configured.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| R1 Anti-enumeration Forgot Response | Known email | `tests/integration/forgot-password.http.test.js > 200: known and unknown emails answer deep-equal bodies…` | ✅ COMPLIANT |
| R1 Anti-enumeration Forgot Response | Unknown email | same test (deep-equal bodies, `mockResetMails` empty on unknown, ≥300 ms floor both paths, staged record hashed) | ✅ COMPLIANT |
| R2 Client-code Disambiguation | Ambiguous email without code | `forgot-password.http.test.js > 409 without a client code…` (+ `auth.service.resetPassword.test.js` exact-message unit) | ✅ COMPLIANT |
| R2 Client-code Disambiguation | Ambiguous email with valid code | same test (code `AAA-000001` → 200 + OTP mail) | ✅ COMPLIANT |
| R3 OTP Purpose Isolation | Purpose-scoped keys | `forgot-password.http.test.js > purpose isolation…` + `otp.service.test.js > stages register and password_reset codes under distinct purpose keys` | ✅ COMPLIANT |
| R4 OTP Lifecycle | Expired or exhausted code rejected | `reset-password.http.test.js > 422: an expired OTP…` + `> 422: 5 wrong codes invalidate the OTP` + unit `OTP exhausted after 5 failed attempts` | ✅ COMPLIANT |
| R4 OTP Lifecycle | Single-use consumption | `reset-password.http.test.js > 422: the consumed code is rejected on re-submit…` | ✅ COMPLIANT |
| R4 OTP Lifecycle | Resend cooldown | `forgot-password.http.test.js > 429: a resend inside the 60 s cooldown is rejected…` | ✅ COMPLIANT |
| R5 Password Reset Application | Successful reset | `reset-password.http.test.js > 200: saves the hashed password, clears lockout/forced-change…` (comparePassword, lockout, flag, OTP consumed) | ✅ COMPLIANT |
| R6 Session Revocation on Reset | Stolen session dies after reset | `reset-password.http.test.js > 401: a stolen refresh token (current and rotated-out) dies with the reset` (+ fresh login 200) | ✅ COMPLIANT |
| R7 Rate Limiting and Public Access | Request burst throttled | `forgot-password.http.test.js > burst: the 11th… 429 RATE_LIMIT` + `> public route: non-localhost Host … 200` | ✅ COMPLIANT |
| R8 Web Flow and Localization | Complete localized recovery | Email half: `emailTemplates.passwordReset.test.js` (es/en/fr subject/body/code, distinct from register) ✅; UI half: static review + `tsc -b` + `vite build` + `check-i18n` (470 keys × 3) only — no runtime browser coverage; task 5.2 open | ⚠️ PARTIAL |

**Compliance summary**: 11/12 scenarios COMPLIANT, 1 PARTIAL (R8 UI half — pending human QA, task 5.2).

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| R1 | ✅ Implemented | `auth.controller.js` `responseFloor()` (L102) always applied on non-409 paths (L272/276); identical 200 body asserted |
| R2 | ✅ Implemented | `auth.service.js _resolveRecoveryTarget` (L653); 409 = exact `clientLogin` message (test constant L55-56) |
| R3 | ✅ Implemented | `otp.service.js` purpose keys; register defaults green (225/225 incl. register suites) |
| R4 | ✅ Implemented | TTL/attempt/cooldown/single-use all asserted at HTTP + unit layers; 6-digit + hashed at rest asserted (`codeHash` sha256, forgot test L212) |
| R5 | ✅ Implemented | `auth.service.js resetPassword` (L586); zod 422 pre-service (weak-password test: zero state touched) |
| R6 | ✅ Implemented | token chain nulled (D6) — stolen current + rotated-out tokens both 401 |
| R7 | ✅ Implemented | `auth.routes.js` `AUTH_LIMITER_PATH` (L15) + `PUBLIC_ROUTES` in `tenantResolver.js` (L16-17); forgot burst tested, reset-endpoint limiter static-only (see WARNING 4) |
| R8 | ⚠️ Partial | Link (`LoginPage.tsx` L134-136), route under `AuthLayout` (`App.tsx` L76), 3-step flow + resend cooldown + 409/429 handling (`ForgotPasswordPage.tsx`), success → `navigate('/login')` (L144), `auth.forgot.*` 14 keys × 3 locales (`es.json` L445-458, parity proven by check-i18n) — all static/gate evidence |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 consume-after-save | ✅ Yes | Unit `D1: when user.save() throws, the OTP stays UNCONSUMED` + weak-password test (`attempts: 0`) |
| D2 per-purpose cooldown | ✅ Yes | Unit `a live password_reset cooldown blocks resends for THAT purpose key with 429` |
| D3 always-stage + 300 ms floor | ✅ Yes | `responseFloor` in controller; integration asserts ≥300 ms on success AND 429 paths |
| D4 non-throwing resolution | ✅ Yes | 409 w/o code; mismatched/unknown code → generic 200/422; never 404 (integration L410) |
| D5 otp.service parameterization | ✅ Yes | Purpose defaults keep existing call sites green (189→225 baseline, register suites pass) |
| D6 session revocation | ✅ Yes | Stolen-token integration proves both tokens die; fresh login issues new pair |
| D7 PR split | ✅ Yes | Two stacked branches as planned; nothing on master |
| Reported deviations (harness: new `jest.integration.config.js`, model registrations; PR2 +51 lines) | ✅ Acceptable | Test-only / within approved 800-line budget; disclosed in apply-progress |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | 6-row "TDD Cycle Evidence" table in apply-progress (#2152) |
| All tasks have tests | ✅ | Backend tasks 1.1–3.5 all map to existing test files (verified on disk) |
| RED confirmed (tests exist) | ⚠️ | 6/6 test files exist; historical RED is claimed in apply-progress, not independently provable from commit order (see SUGGESTION 2) |
| GREEN confirmed (tests pass) | ✅ | 225/225 unit + 51/51 integration pass on this execution |
| Triangulation adequate | ✅ | Claimed RED counts match actual file counts: schemas 8, templates 5, otp purpose 5, auth.service 18, HTTP 13 |
| Safety Net for modified files | ⚠️ | SAFETY NET column absent from the evidence table; suite-level baselines recorded instead (unit 189→225, integration 38→51) |

**TDD Compliance**: 4/6 checks fully passed, 2 ⚠️ (both evidence-reporting gaps, not test failures)

---

### Test Layer Distribution
| Layer | Tests (change-related) | Files | Tools |
|-------|-------|-------|-------|
| Unit | 36 (schemas 8, templates 5, otp purpose 5, auth.service 18) within 225 total | 4 | Jest 29.7 ✅ |
| Integration | 13 within 51 total | 2 | supertest + real MongoDB ✅ |
| E2E | 0 | 0 | not installed (no web test tooling — manual QA is the substitute) |
| **Total (change)** | **49** | **6** | |

---

### Changed File Coverage
| File | Line % | Branch % | Uncovered Lines | Rating |
|------|--------|----------|-----------------|--------|
| `apps/api/src/services/otp.service.js` | 100% | 96.29% | L31 (branch) | ✅ Excellent |
| `apps/api/src/modules/auth/auth.service.js` | 69.2% | 63.97% | 33-78, 289-311, 336-350, 390-469, 496-533, 612, 866-869, 958, 984 — pre-existing login/register/refresh paths; new regions L551-653, L919 covered except single line L612 | ⚠️ Acceptable (new code covered) |
| `apps/api/src/services/notifications/emailTemplates.js` | 100% | 50% | L115 (branch) | ⚠️ Acceptable |
| `apps/api/src/services/notifications/email.service.js` | 25.58% | 34.04% | 24-104, 125-134 — pre-existing SMTP transport; new `sendPasswordResetOtp` (L112) covered | ⚠️ Low overall, new code covered |

**Average changed file coverage**: ~74% (line). Uncovered lines in the two low files are overwhelmingly pre-existing, unrelated paths; the change's own code paths are exercised by the dedicated suites. `packages/validation` is not instrumented by the API coverage run — schema behavior covered by `password-recovery.schemas.test.js`.

---

### Assertion Quality
Audited all 6 change-related test files (2 integration + 4 unit) for tautologies, orphan empty checks, type-only-only assertions, ghost loops, smoke tests, implementation-detail coupling, and mock/assertion ratio.

**Assertion quality**: ✅ All assertions verify real behavior — no tautologies, no ghost loops, no smoke-only tests. (The one `toBeDefined()` at `emailTemplates.passwordReset.test.js:15` is combined with `subject` truthy + `body` contains `{{code}}` in the same test — allowed pattern.) Behavior-level assertions throughout: byte-identical bodies, `comparePassword`, DB state, status codes, timing floors.

---

### Quality Metrics
**Linter**: ➖ Not available (no lint script in `apps/api` or `apps/web` package.json)
**Type Checker**: ✅ `tsc -b` (TS 5.7 strict) — no errors in changed web files (whole-project gate)

### Issues Found

**CRITICAL**: None.

**WARNING**:
1. **R8 "Complete localized recovery" is PARTIAL — task 5.2 (manual browser/email QA) open.** No runtime coverage exists for the web flow (no test tooling in `apps/web`); evidence is static review + `tsc -b` + `vite build` + `check-i18n`. The checklist (es/en/fr steps render, OTP email in inbox, 409 disambiguation with multi-company email, resend cooldown, success redirect to `/login`, staff 409 message unchanged) must be run by a human **before merging the chain**. References: `apps/web/src/pages/auth/ForgotPasswordPage.tsx`, `apps/web/src/pages/auth/LoginPage.tsx:134`, `apps/web/src/App.tsx:76`.
2. **Changed-file coverage < 80%** on `auth.service.js` (69.2%) and `email.service.js` (25.6%) — per strict-TDD rules informational/WARNING only: uncovered ranges are pre-existing paths; every new recovery function is covered by dedicated tests (see coverage table).
3. **TDD evidence table lacks the SAFETY NET column** — per-task safety nets for modified files (`otp.service.test.js`, `emailTemplates.js`, `auth.routes.js`, …) are not reported; only suite-level baselines (189→225 unit, 38→51 integration) are recorded in apply-progress.
4. **R7 reset-endpoint limiter verified statically only** — `AUTH_LIMITER_PATH` includes `reset-password` (`auth.routes.js:15`) but the burst test exercises forgot-password only; a reset-burst 429 has no runtime test.

**SUGGESTION**:
1. **Scenario-count discrepancy**: launch inputs cite 14 scenarios; the spec file contains 12 (`#### Scenario` sections across R1–R8). Confirm the source of truth (possibly exploration.md) before archiving.
2. **Commit hygiene**: PR1 commits tests last (`7c9f1c5`) — RED-first ordering is provable only from apply-progress, not from history. For the next strict-TDD change, land the failing test in the same commit as (or before) the implementation.
3. `emailTemplates.js` branch at L115 uncovered (50% branch) — likely a locale-fallback branch; one test would round it out.
4. Vite chunk-size warning (787 kB > 500 kB) is pre-existing and unrelated to this change.

### Verdict
**PASS WITH WARNINGS**
All executable gates are green (API unit 225/225, integration 51/51, web `tsc -b` + `vite build` + `check-i18n`); 11/12 spec scenarios COMPLIANT with runtime proof, 1 PARTIAL pending the pre-acknowledged human QA (task 5.2) — run that checklist before merging `feat/forgot-password-web` → `feat/forgot-password-api` → master.
