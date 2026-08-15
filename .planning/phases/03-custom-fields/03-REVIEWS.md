---
phase: 3
cycle: 2
reviewers: [claude, codex]
reviewed_at: 2026-08-14
plans_reviewed: [03-01-PLAN.md, 03-02-PLAN.md, 03-03-PLAN.md, 03-04-PLAN.md, 03-05-PLAN.md, 03-06-PLAN.md, 03-07-PLAN.md, 03-08-PLAN.md]
prior_cycle_commit: 91eb6c5
---

# Cross-AI Plan Review — Phase 3 (Custom Fields) — CYCLE 2 (RE-REVIEW)

Re-review of the eight Phase-3 plans after commit `91eb6c5` incorporated cycle 1's 2 HIGH + 14
actionable findings. Focus: did the fixes hold WITHOUT regression, and is the mutex/transaction
restructure correct (no remaining deadlock or lost-write path)? Only findings that REMAIN unresolved
in the current plans are counted — cycle-1 findings now incorporated are not recounted.

Running inside Claude Code, so the Claude review is done in-session (grounded against the code on
disk); Codex ran as the independent external CLI. Both read the actual source (`src/db/mutex.ts`,
`src/db/recency-dao.ts`, `src/db/migrations/001-initial.ts`, `src/services/launch-sweep.ts`), not the
plan text in isolation.

---

## Cycle-1 fixes — verification (all FULLY RESOLVED)

| Cycle-1 finding | Fix incorporated | Verified against code |
|---|---|---|
| HIGH-1 sweep self-deadlock | 03-07 calls public `dropField` DIRECTLY (no outer withMutex); per-def try/catch; no-hang + second-`runLaunchSweep` tests | `withMutex` non-reentrant confirmed `mutex.ts:32-36`; sweep loop `03-07:90` calls bare; no double-acquire path |
| HIGH-2 upsertValue race + check→drop atomicity | `upsertValue` inside `inWriteTransaction` (03-04); `dropField` split into non-mutexed core `dropFieldColumns` + public `dropField`; `deleteOrQuarantineField` does check+drop in ONE `inWriteTransaction` via the core; single-BEGIN test | `03-03:103-126`, `03-04:86-92`; core is not exported, composed only within field-ddl.ts — no cross-module nesting |
| inWriteTransaction extracted | 03-01 Task 3 creates `src/db/transaction.ts`, recency-dao imports it; no verbatim copies | `03-01:169-207`; current private copy at `recency-dao.ts:198-213` moves verbatim; call sites unchanged |
| isSafeColName at all interp sites | 03-02 sortExpr guards; 03-03 create/drop/isFieldEmpty guard; 03-04 read/upsert guard; 03-05 preflight/apply guard | present in every plan's task body + done criteria |
| datetime('now','localtime',?) window | 03-07 uses datetime not date | `03-07:84,97` (but see LOW below — operator off-by-one) |
| isValueInOptions dropdown membership | 03-02 exports it; 03-06 flags on it; 03-05/08 preflightOptionsChange | `03-02:87-96`, `03-06:128-132`, `03-05:89-97` |
| show_on_new/always_show DAO | 03-03 updateFieldCuration | `03-03:178-180` |
| depends_on fixes | 03-02→[03-01], 03-05→[03-01,03-02], 03-08→[...,03-07] | confirmed in frontmatter |
| uid contract | 03-04 UID CONTRACT block (one per contact, INSERT-only) | `03-04:96-104` |
| field_history operation encoding | 03-05 `type_change:<old>-><new>` | `03-05:124` |
| quarantined-collision create | 03-08 builds existing set from listDefs({includeQuarantined:true}); 03-01 test | `03-08:130-132`, `03-01:153-156` |
| atomic-rollback test fixture | 03-03 pre-seeds an orphan physical column so ADD COLUMN is the failing statement | `03-03:129-137` |

No decision reversal in any plan. TEXT-forever, no index/UNIQUE on value columns,
type-change = UPDATE-defs.type-only (byte-identical), sole sortExpr, 30d fixed window, and
photo/share_with_ai deferral are all upheld.

---

## Claude Review (in-session, grounded)

### Summary
The restructure is correct. I traced every path that acquires the mutex and found no double-acquire:
`deleteOrQuarantineField` opens ONE `inWriteTransaction` and calls the NON-mutexed core
`dropFieldColumns` (never the public `dropField`), so check+drop share exactly one transaction with no
nested mutex; the sweep calls the public `dropField` bare (one acquisition per def); `upsertValue` and
`applyTypeChange` each run in one `inWriteTransaction` with no nested transactional call. Both cycle-1
HIGHs are fully resolved and the fixes are backed by acceptance tests (single-BEGIN atomicity proof;
no-hang + second-`runLaunchSweep` registry-not-wedged proof). All 14 actionable items are incorporated
into task bodies, done-criteria, or threat rows. No recorded decision is weakened.

### Strengths
- No path double-acquires the non-reentrant mutex (`mutex.ts:32-36`). The private/public split of the
  drop logic is the right shape: composition happens through a non-mutexed core, never by nesting.
- Check+drop atomicity is enforced AND tested (03-03 test (f): assert exactly ONE BEGIN).
- `upsertValue` — the cycle-1 permanent-data-loss path — is now serialized (`03-04:86-92`).
- Cited line references remain accurate (verified FieldType@`schemas/types.ts:20`,
  localDateTime@`database.ts:45`, expoExecutor@`database.ts:57`, ready-gated effect@`App.tsx:65-68`,
  migration table shapes@`001-initial.ts:127-163`).

### Concerns
- **MEDIUM — def-metadata writers bypass the shared serialization boundary.** 03-03 Task 2 specifies
  `renameField`, `changeFieldOptions`, `updateFieldCuration`, `quarantineField`, `restoreField` as bare
  single `UPDATE`s (only `reorderFields` is wrapped in `inWriteTransaction`), and 03-07's history prune
  is a bare `DELETE` (`03-07:96`). `mutex.ts:8-20`/`recency-dao.ts:22-31` document why the mutex exists:
  a bare write on the shared connection issued while an explicit `BEGIN` transaction is open is captured
  into that transaction and rolled back with it. A user-initiated metadata edit that overlaps the async
  launch-sweep's in-flight `dropField` transaction on a background→active resume would be captured. I
  rate this MEDIUM (not HIGH as Codex does): the contact-VALUE write path is serialized, the exposed
  writes are def-metadata (a lost edit is re-doable, not corrupted contact data), and every scenario
  needs the async sweep to overlap a user bare-write in a single-user app. But it is a real gap against
  the project's own "every writer through the shared mutex" contract, which cycle 1 applied only to
  `upsertValue`. Cheap, local fix.
- **MEDIUM — sweep expiry TOCTOU: a field restored after the stale-def scan is still dropped.** 03-07
  selects stale defs in a bare SELECT (`03-07:84`) then per-def awaits `dropField` (`03-07:90`) with the
  stale def object. If `restoreField` nulls `quarantined_at` between the scan and that def's drop, the
  drop fires anyway (it re-checks nothing). Serializing the writers (concern above) does NOT fix this —
  `dropField` must re-read `quarantined_at` inside its own transaction for the expiry path. Narrow
  (launch-timed, single-user) and the data is snapshotted to `field_history` first, so it is a
  reversible-quarantine violation rather than permanent loss — MEDIUM.
- **LOW — expiry predicate contradicts its own boundary test.** `03-07:84` uses
  `quarantined_at <= datetime('now','localtime','-30 days')`, but the boundary test (`03-07:108`)
  requires a field quarantined EXACTLY 30 days ago to NOT expire. With `<=`, exactly-30-days expires.
  The plan's stated intent is "older than 30 days" → the operator should be `<` (or the test reworded).
  This would surface as a failing test at execution, but the plan should specify the correct operator.

### Risk Assessment
**LOW–MEDIUM.** The restructure the cycle targeted is correct; no deadlock or contact-value lost-write
remains. The residual items are adjacent writers not brought into the boundary, a narrow launch-time
TOCTOU, and a boundary-operator off-by-one — all small, local plan edits, none reopening a decision.

---

## Codex Review (external CLI)

### Summary
"The revised core restructure fixes both recorded HIGHs: no planned double mutex acquisition, and
`deleteOrQuarantineField` performs the emptiness check plus drop core in one transaction." Codex then
raises two concurrency gaps it rates HIGH.

### Strengths (Codex)
- `withMutex` confirmed non-reentrant — nested acquisition would deadlock (`mutex.ts:32`).
- Extraction preserves the correct hand-rolled transaction semantics (`recency-dao.ts:194`).
- Sweep self-deadlock correctly avoided; `deleteOrQuarantineField` calls the non-mutexed core only from
  its one outer transaction (`03-03:112,117`, `03-07:90`).
- `upsertValue` now serialized through `inWriteTransaction` (`03-04:86`).

### Concerns (Codex)
- **HIGH (Codex) — sweep/restore TOCTOU.** Same mechanism as Claude's MEDIUM sweep-TOCTOU. Codex: "add
  an expiry-specific, mutex-owned transaction that re-reads/verifies the def is still stale immediately
  before invoking the private drop core; serialize restore with the same boundary." (`03-07:84,90`,
  `03-03:168,181`)
- **HIGH (Codex) — not every custom-field writer participates in the shared boundary.** Same mechanism
  as Claude's MEDIUM metadata-writer concern. Codex: "route every mutating custom-field DAO operation and
  sweep prune through `inWriteTransaction` — using non-mutexed cores only when composing within an
  already-owned transaction." (`03-03:168`, `03-07:96`)
- **LOW (Codex) — expiry predicate vs boundary test** (`<=` vs the exactly-30-days test) — same as
  Claude's LOW. Also notes the "injected clock" test phrasing (`03-07:82`) can't inject into SQLite's
  built-in `now`; the test must drive `quarantined_at` values relative to real now (which the plan's
  40/5/31/30-day fixtures already do — so this is wording, not a defect).

### Risk Assessment (Codex)
**HIGH** — on the two concurrency gaps.

---

## Consensus & Orchestrator Verification

Both reviewers agree the **restructure is correct**: no reintroduced nested-mutex deadlock, check+drop
share exactly one transaction, `upsertValue` is serialized. I independently verified each load-bearing
claim against the code on disk (not the plan text): `mutex.ts:32-36` non-reentrant; the non-mutexed
core `dropFieldColumns` is unexported and composed only inside field-ddl.ts; the sweep calls the public
`dropField` bare. **Both cycle-1 HIGHs are FULLY RESOLVED.**

Both reviewers independently surfaced the **same three residual items** (strong agreement on
mechanism):
1. def-metadata writers + sweep prune are not routed through the shared mutex;
2. the sweep scan→drop TOCTOU can expire a just-restored field;
3. the expiry operator (`<=`) contradicts the exactly-30-days boundary test.

**Divergence — severity of items 1 and 2.** Codex rates both HIGH; I rate both MEDIUM. Orchestrator's
call: **MEDIUM, actionable, not counted as unresolved HIGH.** Grounds: (a) the contact-VALUE write path
(`upsertValue`) — cycle-1's permanent-loss path — is serialized; the remaining bare writes are
def-metadata whose loss is a re-doable edit; (b) the sweep TOCTOU snapshots to `field_history` before
dropping, so it is a reversible-quarantine violation, not permanent data loss; (c) both require the
async launch-sweep to overlap a user bare-write in a single-user local app; (d) the fixes are small,
local plan edits. They are nonetheless genuine gaps against the project's own stated "every writer
through the shared mutex" contract and should be incorporated before execution.

No finding reverses or weakens a `[DECIDED]`/owner item — no escalation.

### Agreed Concerns (both reviewers, prioritized — all actionable, none HIGH)
1. **Serialize the remaining custom-field writers.** Route `renameField`, `changeFieldOptions`,
   `updateFieldCuration`, `quarantineField`, `restoreField` (03-03 Task 2) and the `field_history`
   prune (03-07 Task 1) through `inWriteTransaction`, completing the boundary that cycle 1 applied only
   to `upsertValue`. Compose via non-mutexed cores only where already inside an owned transaction.
2. **Guard the sweep expiry TOCTOU.** In the expiry path, re-read `quarantined_at` inside `dropField`'s
   transaction (or a sweep-specific expiry op that re-verifies staleness) so a field restored between
   the stale-def scan and the drop is not expired. Serialization alone does not fix this.
3. **Fix the expiry operator.** Change `03-07`'s predicate to `<` (or reword the exactly-30-days test)
   so "older than 30 days" is internally consistent.

### Divergent Views
- HIGH vs MEDIUM on items 1 and 2 (resolved above as MEDIUM/actionable).

### Not counted
- 03-06 declares `depends_on: [03-02]` and imports the `CustomFieldDef` type transitively via 03-01;
  safe under sequential wave ordering (03-06 Wave 3 > 03-02 Wave 2 > 03-01 Wave 1) — not
  execution-breaking, optional edge to add.
- The 03-07 "injected clock" wording — the test drives `quarantined_at` values relative to real now,
  which is sound; no clock injection is actually required.
