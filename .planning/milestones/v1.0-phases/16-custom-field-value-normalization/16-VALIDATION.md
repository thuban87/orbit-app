---
phase: 16
slug: custom-field-value-normalization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-24
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- src/db/migrations/006-normalize-custom-field-values.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

> The node SQLite test adapter requires Node 22+. This environment is Node v22.22.2 (verified) and `node:sqlite` works — the existing DB suite runs green; no Node provisioning is required.

## Sampling Rate

- **After every task commit:** Run the targeted Vitest command for the touched module, then `npx tsc --noEmit`.
- **After every plan wave:** Run `npm test`, `npx tsc --noEmit`, and `npm run check:colors`.
- **Before `$gsd-verify-work`:** Full suite must be green and the physical-device upgrade check complete.
- **Max feedback latency:** 60 seconds for targeted tests.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | CFN-01 | T-16-01 | Migration fails closed and rolls back on inconsistent legacy state | migration integration | `npm test -- src/db/migrations/006-normalize-custom-field-values.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | CFN-01 | T-16-02 | Normalized rows preserve raw text, blank values, photo paths, and unique IDs | migration integration | `npm test -- src/db/migrations/006-normalize-custom-field-values.test.ts` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 2 | CFN-02 | T-16-03 | Lifecycle operations use pair rows, retain history snapshots, and never use custom-field DDL | DAO/lifecycle integration | `npm test -- src/db/field-values-dao.test.ts src/db/field-ddl.test.ts src/db/field-type-change.test.ts src/services/field-sweep.test.ts` | existing tests extended | ⬜ pending |
| 16-03-01 | 03 | 2 | CFN-03 | T-16-04 | Runtime values are bound; row projection and sort/filter preserve existing semantics | DAO + unit | `npm test -- src/db/field-values-dao.test.ts src/db/field-sort.test.ts` | existing tests extended | ⬜ pending |
| 16-04-01 | 04 | 3 | CFN-04 | T-16-05 | Populated profile survives migration through form, profile, and AI projections | integration regression | `npm test -- src/db/migrations/006-normalize-custom-field-values.test.ts src/db/contact-read.test.ts src/db/ai-context-read.test.ts` | migration fixture ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 Requirements

- [ ] `src/db/migrations/006-normalize-custom-field-values.test.ts` — create a real v5 dynamic-column fixture; assert success and rollback through `runMigrations`.
- [ ] Convert dynamic-column fixture helpers in field DAO and lifecycle tests into normalized-row helpers while preserving their behavioral assertions.
- [ ] Add a post-migration regression through unchanged create/edit/profile/AI projections.
- [x] Node 22+ for the existing `node:sqlite` test adapter — SATISFIED (this environment is Node v22.22.2; `node:sqlite` verified working). No provisioning step needed.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Upgrade a populated test-profile database | CFN-01, CFN-04 | Expo SQLite migration must be proven on a physical device as well as node SQLite | Install the upgrade build over the populated test profile; confirm a silent open, custom photo rendering, existing values, retype/quarantine/restore/delete behavior, sort/filter parity, and no data loss. |
| Upgrade failure presentation | CFN-01 | Deliberately malformed state is safely produced only in a controlled test profile | Confirm a controlled migration failure retains the old DB and displays a clear upgrade failure instead of mounting partial UI. |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies.
- [ ] Sampling continuity: no three consecutive tasks without automated verification.
- [ ] Wave 0 covers all missing references.
- [ ] No watch-mode flags.
- [ ] Feedback latency < 60 seconds.
- [ ] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
