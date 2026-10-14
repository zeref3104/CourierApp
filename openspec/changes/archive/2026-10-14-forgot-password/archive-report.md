# Archive Report: forgot-password

**Change**: forgot-password
**Archived to**: `openspec/changes/archive/2026-10-14-forgot-password/`
**Date**: 2026-10-14
**Artifact store**: hybrid (Engram + openspec)
**Final state**: DONE — merged to master

## Outcome

Self-service client password recovery (email OTP) shipped via 2 stacked squash-merged PRs:

- **PR #9** — API + tests, squash commit `4bdfcdd` (branch `feat/forgot-password-api`, deleted)
- **PR #11** — web UI + i18n, squash commit `b75c433` (branch `feat/forgot-password-web`, deleted)
- **Issue #8** closed.
- Flows are live: master auto-deploys to Vercel.

## Verification

**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 4 WARNING)

- API unit: 225/225 ✅ · API integration: 51/51 ✅ · Web gates: `tsc -b` + `vite build` + `check-i18n` (470 keys × es/en/fr) ✅
- Spec compliance: 11/12 scenarios COMPLIANT with runtime proof, 1 PARTIAL (R8 UI half — static/gate evidence only)
- Warnings: (1) task 5.2 manual QA open, (2) changed-file coverage <80% on 2 files (pre-existing paths), (3) TDD evidence table lacks SAFETY NET column, (4) reset-endpoint burst 429 verified statically only.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `password-recovery` | Created (delta was a full spec — no prior main spec) | 8 requirements (R1–R8), 12 scenarios copied verbatim to `openspec/specs/password-recovery/spec.md` |

No existing main spec was modified; nothing destructive in the merge.

## Archive Contents

- `proposal.md` ✅
- `specs/password-recovery/spec.md` ✅
- `design.md` ✅ (D1–D7 decisions, all followed per verify)
- `tasks.md` ✅ — **15/16 tasks complete**
- `verify-report.md` ✅
- `exploration.md` ✅
- `archive-report.md` (this file) ✅

## Open Follow-ups (recorded honestly — NOT completed)

1. **Task 5.2 — manual browser/email QA remains OPEN.** The user merged without running it. The es/en/fr checklist (steps render, OTP email in inbox, multi-company 409 disambiguation, resend cooldown, success redirect to `/login`, staff 409 message unchanged) must still be run by a human — now against the Vercel production deployment from master. This is a verification gap carried into production, not a completed task.
2. **SMS/phone OTP recovery — phase 2.** Email-only v1; no SMS infra.
3. **Staff/superadmin account recovery — phase 2.** Clients-only v1; `TenantUserIndex` extension deferred.
4. **Mobile (Expo) recovery — phase 2.**
5. **Reset-endpoint burst 429** has no runtime test (WARNING 4) — worth a follow-up integration test.

## Notable Fix Shipped in This Change

- **authLimiter no-op bug fixed** (Engram `sdd/forgot-password/apply-progress` #2153): the auth rate limiter regex previously did not match the new routes / was ineffective; fixed as part of task 2.5 so forgot/reset sit behind 10 req/15 min.

## Engram Traceability (observation IDs)

| Artifact | Observation ID | topic_key |
|----------|----------------|-----------|
| proposal | #2143 | `sdd/forgot-password/proposal` |
| spec | #2146 | `sdd/forgot-password/spec` |
| design | #2147 | `sdd/forgot-password/design` |
| tasks | #2148 | `sdd/forgot-password/tasks` |
| verify-report | #2154 | `sdd/forgot-password/verify-report` |
| apply-progress | #2152 | `sdd/forgot-password/apply-progress` |
| authLimiter fix | #2153 | (bugfix observation) |
| archive-report | #2156 | `sdd/forgot-password/archive-report` |

## Source of Truth Updated

- `openspec/specs/password-recovery/spec.md` — now the canonical password-recovery spec.

## SDD Cycle Complete

Planned → specified → designed → implemented (16 tasks) → verified (PASS WITH WARNINGS) → archived.
The change is fully closed; remaining items above are follow-ups for future changes.
