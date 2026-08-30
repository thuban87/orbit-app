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
| RCN-03 | primary-method resolution honoured — chosen ABSORBED primary wins; default survivor-wins (HIGH #3) | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ W0 | ⬜ pending |
| RCN-03 | profile merge picker includes Bound AND Unbound live contacts (finding 1) | unit | `npx vitest run src/db/merge-candidate-read.test.ts` | ❌ W0 | ⬜ pending |
| RCN-01 | reconcile scalar-only apply ADVANCES `data_revision` (backup-visible, HIGH #1) | unit | `npx vitest run src/db/reconcile-apply.test.ts` | ❌ W0 | ⬜ pending |
| RCN-01 | freshness revalidation — a post-scan Orbit edit is NOT overwritten on a resumed apply (staleFields), HIGH #1 | unit | `npx vitest run src/db/reconcile-apply.test.ts` | ❌ W0 | ⬜ pending |
| RCN-01 | reconcile photo apply is all-or-nothing — rollback leaves DB + master intact; persistMaster post-commit (HIGH #2) | unit | `npx vitest run src/services/photos/reconcile-photo.test.ts` | ❌ W0 | ⬜ pending |
| RCN-02 | `Use Contact Values` unavailable/blocked on a non-additive selection (HIGH #2 grid gate) | unit | `npx vitest run src/components/candidate-card-grid-actions.test.ts` | ❌ W0 | ⬜ pending |
| RCN-02 | additive-only eligibility excludes conflict/removed/missing selections | unit | `npx vitest run src/logic/reconcile-bulk-eligibility.test.ts` | ❌ W0 | ⬜ pending |
| RCN-01 | relink retire-then-attach + duplicate-active-link preflight (no ABORT/clobber) | unit | `npx vitest run src/db/reconcile-relink-dao.test.ts` | ❌ W0 | ⬜ pending |
| RCN-02 | import-vs-reconcile resume precedence (one prompt at a time) | unit | `npx vitest run src/services/resume-prompt-precedence.test.ts` | ❌ W0 | ⬜ pending |
| RCN-02 | bulk-review read omits resolved rows; Fix advances `data_revision`, Ignore does not | unit | `npx vitest run src/db/bulk-review-read.test.ts src/db/bulk-review-dao.test.ts` | ❌ W0 | ⬜ pending |
| RCN-02 | `createReconcileSessionCore` composes inside an outer txn without deadlock (finding 4) | unit | `npx vitest run src/db/reconcile-session-dao.test.ts` | ❌ W0 | ⬜ pending |
| RCN-04 | absorbed contact tombstoned as `contact`, not archived; absent from `listArchived` | unit | `npx vitest run src/db/merge-dao.test.ts` | ❌ W0 | ⬜ pending |
| RCN-04 | tombstone beats older row on reconciliation (resurrection-proof) | unit | `npx vitest run src/backup/reconciliation.test.ts` (extend) | ⚠ extend | ⬜ pending |
| RCN-04 | v12→v13 forward migration + FK integrity | unit | `npx vitest run src/db/migrations/013-*.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/db/merge-dao.test.ts` — RCN-03/04 (reparent, integrity resolution, `field_history`, recompute, rollback, tombstone-not-archive, **primary-method resolution / chosen-absorbed-primary-wins — HIGH #3**, **DUAL phone-AND-email contention — finding 1**, **selected-primary-wins-dedupe — finding 6**, **custom-field collision + custom-field resolution favouring the ABSORBED value — actionable 1**, **pending-reconcile-card discard-with-DERIVED-session-finalize — HIGH #1 / finding 2**)
- [ ] `src/db/merge-candidate-read.test.ts` — Bound+Unbound merge picker (finding 1)
- [ ] `src/db/reconcile-apply.test.ts` — **scalar-only apply data_revision-advances (HIGH #1 backup-visibility)** + **freshness revalidation: post-scan Orbit edit preserved / staleFields (HIGH #1)** + method desired-list (current ∪ accepted) data-loss guard
- [ ] `src/services/photos/reconcile-photo.test.ts` — staging + content-hash, **rollback-leaves-photo-intact / post-commit persistMaster (HIGH #2)**
- [ ] `src/logic/reconcile-bulk-eligibility.test.ts` — `isAdditiveOnlySelection` excludes conflict/removed/missing/empty (Cluster J)
- [ ] `src/components/candidate-card-grid-actions.test.ts` — **`isBulkActionAvailable` gate: `use-contact-values` unavailable/blocked on a non-additive selection (HIGH #2)**
- [ ] `src/db/reconcile-session-dao.test.ts` + `reconcile-session-read.test.ts` — RCN-02 durability across process death; `createReconcileSessionCore` composes in an outer txn (finding 4); `getNewestPendingReconcileSessionId` (finding 7)
- [ ] `src/db/reconcile-snapshot-dao.test.ts` — RCN-02 narrow last-reviewed-source memory + **multi-method SET serialization round-trip (actionable 2)**
- [ ] `src/db/reconcile-relink-dao.test.ts` — retire-then-attach ordering + duplicate-active-link preflight (no ABORT/clobber)
- [ ] `src/services/resume-prompt-precedence.test.ts` — import-vs-reconcile precedence (all four combinations, finding 8)
- [ ] `src/services/import/reconcile-resume-sweep.test.ts` — resumable-session resolve, corrupt→discardOnly, staging sweep, no-work-on-import
- [ ] `src/logic/reconcile-diff.test.ts` — RCN-01 classification + Cluster D/M (multi-source → one card) + `serializeMethodFamily` order-independence
- [ ] `src/logic/survivor-recommendation.test.ts` — survivor heuristic (if the planner adopts one; else N/A)
- [ ] `src/db/bulk-review-read.test.ts` + `src/db/bulk-review-dao.test.ts` — unresolved-flag read omits resolved rows; Fix advances `data_revision` (finding 4), Ignore does not; durable across DB reopen
- [ ] `src/db/migrations/013-*.test.ts` — v12→v13 forward migration + FK integrity (incl. `bulk_review_resolutions`, nullable `staged_photo_rel_path`)
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
