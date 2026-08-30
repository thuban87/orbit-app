---
phase: 20
slug: contact-reconciliation-merge
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-30
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 20-RESEARCH.md `## Validation Architecture` (code-grounded, HIGH confidence).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest with `node:sqlite` in-memory DB (existing DAO test pattern) |
| **Config file** | project vitest config (existing; 1,510+ tests green as of 18.1) |
| **Quick run command** | `npx vitest run <touched DAO/logic test file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | quick ~2–5s per file; full suite ~tens of seconds |

> Node version hazard: use Node 24 at `/usr/local/bin` (codex sandbox falls back to system Node 18, which breaks `node:sqlite`/vitest). Re-probe if regressed.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` on the touched DAO/logic test file.
- **After every plan wave:** Run `npm test` (full suite).
- **Before `/gsd-verify-work`:** Full suite must be green **and** a device UAT on the Pixel (debug build, `run-as` DB reads) covering merge atomicity + durable resume across process death.
- **Max feedback latency:** < 10 seconds for quick runs.

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; this map seeds the requirement→test coverage the planner's tasks and Wave 0 must satisfy. `validate-phase` fills real task IDs after planning.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| RCN-01 | additive/conflict/removed classification per field family (name, methods, birthday, photo) | unit | `npx vitest run src/logic/reconcile-diff.test.ts` | ❌ W0 | ⬜ pending |
| RCN-01 | missing-source is distinct from removal; never deletes/overwrites Orbit data | unit | `npx vitest run src/db/reconcile-*.test.ts` | ❌ W0 | ⬜ pending |
| RCN-02 | durable session survives process death (reopen DB, resume) | unit | `npx vitest run src/db/reconcile-session-read.test.ts` | ❌ W0 | ⬜ pending |
| RCN-02 | unchanged reviewed discrepancy suppressed; changed-again re-surfaces (narrow memory) | unit | `npx vitest run src/logic/reconcile-diff.test.ts` | ❌ W0 | ⬜ pending |
| RCN-02 | multiple source links → one Orbit-person card | unit | `npx vitest run src/logic/reconcile-diff.test.ts` | ❌ W0 | ⬜ pending |
| RCN-03 | merge reparents all child tables; asserts exactly one contacts row absorbed | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ W0 | ⬜ pending |
| RCN-03 | competing primaries / duplicate source links resolved before reparent (no partial-index ABORT) | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ W0 | ⬜ pending |
| RCN-03 | `last_contact` (and `rarely_responds`) recomputed through the single-writer path after merge | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ W0 | ⬜ pending |
| RCN-03 | merge failure → full rollback, absorbed contact intact (atomic, no-simple-undo) | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ W0 | ⬜ pending |
| RCN-03 | `field_history` snapshot written on scalar overwrite inside the merge transaction | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ W0 | ⬜ pending |
| RCN-04 | absorbed contact tombstoned as `contact`, not archived; absent from `listArchived` | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ W0 | ⬜ pending |
| RCN-04 | tombstone beats older row on reconciliation (resurrection-proof) | unit | `npx vitest run src/backup/reconciliation.test.ts` (extend) | ⚠ extend | ⬜ pending |
| RCN-04 | v12→v13 forward migration + FK integrity | unit | `npx vitest run src/db/migrations/013-*.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/merge-dao.test.ts` — RCN-03/04 (reparent, integrity resolution, `field_history`, recompute, rollback, tombstone-not-archive)
- [ ] `src/db/reconcile-session-dao.test.ts` + `reconcile-session-read.test.ts` — RCN-02 durability across process death
- [ ] `src/db/reconcile-snapshot-dao.test.ts` — RCN-02 narrow last-reviewed-source memory
- [ ] `src/logic/reconcile-diff.test.ts` — RCN-01 classification + Cluster D/M (multi-source → one card)
- [ ] `src/logic/survivor-recommendation.test.ts` — survivor heuristic (if the planner adopts one; else N/A)
- [ ] `src/db/migrations/013-*.test.ts` — v12→v13 forward migration + FK integrity
- [ ] Extend `src/backup/reconciliation.test.ts` — merged-contact resurrection-proofing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Merge atomicity + durable resume across real process death | RCN-02, RCN-03 | SQLite/process-lifecycle behavior only observable on-device | Device UAT on the Pixel: debug build, install `-r` to preserve data, drive a merge and a mid-review kill/relaunch, read DB via `run-as` (WAL-aware) |
| Side-by-side manual photo choice | RCN-01 | No stable source-photo fingerprint exists; manual choice is the primary path (visual-similarity matching is deferred) | Drive reconciliation with a photo discrepancy; confirm the user picks the survivor photo, no auto-diff |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
