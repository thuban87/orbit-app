---
phase: 3
cycle: 3
reviewers: [codex, claude]
reviewed_at: 2026-08-14
plans_reviewed: [03-03-PLAN.md, 03-07-PLAN.md]
scope: re-review of cycle-2's 3 concurrency/correctness residuals (0 HIGH); only 03-03 + 03-07 changed (commit c7fa916)
---

# Cross-AI Plan Review — Phase 3 (Custom Fields), Cycle 3

Focused re-review of the two plans revised to close cycle-2's three residuals:
(1) complete write-serialization of the remaining field-def writers + the history prune,
(2) the sweep scan→drop TOCTOU, (3) the strict-`<` expiry off-by-one. Both reviewers verified the
plans against the actual code on disk (`src/db/mutex.ts`, `src/db/recency-dao.ts`,
`src/db/migrations/001-initial.ts`, `src/services/launch-sweep.ts`). Plan 01 artifacts
(`src/db/transaction.ts`, `col-name.ts`, `field-types.ts`) are not built yet — the authoritative
`inWriteTransaction` reference is the private function in `recency-dao.ts:198-213`.

## Codex Review

## Summary

One unresolved MEDIUM plan-text contradiction remains. The intended implementation fixes
serialization, TOCTOU, and boundary handling; however, Plan 03 still twice instructs the sweep to
call `dropField`, which bypasses the required stale-under-lock re-check.

## Concerns

- **MEDIUM** — `03-03-PLAN.md:55-59` and `03-03-PLAN.md:126-129` say Plan 07 calls public `dropField`
  directly, contradicting the required and otherwise specified `expireFieldIfStale` route at
  `03-03-PLAN.md:64-67,142-156` and `03-07-PLAN.md:101-108`. Direct `dropField` would not nest the
  mutex, but it would omit the under-lock `quarantined_at` re-check and could drop a field restored
  after the candidate scan. Remove the two stale `dropField` references.

No new deadlock is introduced by the intended path: `expireFieldIfStale` owns one transaction and
calls the non-mutexed core; Plan 07 calls it bare. This matches the non-reentrant promise chain in
`src/db/mutex.ts:32-35`, the hand-rolled shared transaction pattern in `src/db/recency-dao.ts:198-212`,
and avoids wedging the registry, whose hook awaits block while `running` remains true
(`src/services/launch-sweep.ts:76-88`).

## Verdict

1. **Write serialization complete: Yes.** The remaining def writers are each specified inside
   `inWriteTransaction` (`03-03-PLAN.md:205-233`), with single-BEGIN tests (`03-03-PLAN.md:249-252`);
   the history prune is likewise serialized (`03-07-PLAN.md:111-117`). No writer bypass remains.
2. **Sweep TOCTOU fixed: No — plan contradiction remains.** The correct implementation is fully
   specified (`03-03-PLAN.md:142-156`; `03-07-PLAN.md:101-108`), but the conflicting `dropField`
   instructions above must be removed for the plan to be unambiguous.
3. **Off-by-one fixed: Yes.** Candidate scan and under-lock re-check both use strict `<`
   (`03-07-PLAN.md:91-100`; `03-03-PLAN.md:145-147`), with exact-30-day coverage
   (`03-07-PLAN.md:130-132`). The history prune deliberately remains `<=` (`03-07-PLAN.md:111-116`).

## Claude Review

### Summary

All three cycle-2 residuals are fixed in the authoritative plan text and are consistent with the
real mutex/transaction semantics. No new deadlock, no writer bypasses the shared mutex, no decision
reversal. One actionable MEDIUM confirmed independently: two leftover sentences in 03-03 still assert
the sweep calls `dropField` directly, contradicting the rest of the plan.

### Verification against the code

- **Non-reentrancy is real.** `src/db/mutex.ts:32-36` — `chain.then(fn, fn)` then
  `chain = run.catch(...)`. Calling `withMutex` (via `inWriteTransaction`) inside an already-running
  `withMutex` body queues behind the current run's own tail, which cannot settle until the body it is
  awaiting returns → permanent deadlock. The fix's whole shape (non-mutexed `dropFieldColumns` core
  composed inside each mutex-owning entry; sweep calls `expireFieldIfStale` bare; history prune is a
  SEPARATE sequential `inWriteTransaction` after the loop, never nested) correctly avoids this.

- **Residual 1 — serialization complete.** `03-03-PLAN.md:205-233` wraps every remaining def writer
  (rename/changeFieldOptions/updateFieldCuration/quarantine/restore) in its own `inWriteTransaction`;
  `03-03-PLAN.md:249-252` asserts exactly one BEGIN per writer and zero for `listDefs`/`isFieldEmpty`.
  `03-07-PLAN.md:111-117` wraps the `field_history` prune in `inWriteTransaction`. Enumerating every
  writer in the phase (createField, dropField, deleteOrQuarantineField, expireFieldIfStale, the five
  defs-dao writers, the prune) leaves no bare writer; `dropFieldColumns` is a private core only ever
  called inside an owned transaction. **Resolved.**

- **Residual 2 — sweep TOCTOU.** `03-03-PLAN.md:142-156`: `expireFieldIfStale` opens ONE
  `inWriteTransaction`; the guard `SELECT ... quarantined_at IS NOT NULL AND quarantined_at <
  datetime('now','localtime', ?)` and the `dropFieldColumns` core call are both inside that single
  transaction body — the re-check and the drop are genuinely one transaction. It calls the non-mutexed
  core, never public `dropField`, so no nesting. `03-07-PLAN.md:101-108` calls `expireFieldIfStale`
  bare. Because `restoreField` is now mutex-serialized (`03-03-PLAN.md:228-233`), a restore ordered
  before the expiry transaction is seen by the guard SELECT and the field survives; the mandatory
  SWEEP-TOCTOU test (`03-07-PLAN.md:133-139`) asserts exactly this. Even in the unorderable race the
  drop is snapshot-to-`field_history`-first, so no silent data loss. **Resolved in the authoritative
  text** — but see the MEDIUM below.

- **Residual 3 — strict `<`.** `03-07-PLAN.md:91-100` (candidate scan) and `03-03-PLAN.md:145-147`
  (under-lock re-check) both use strict `<` with the SAME `windowModifier`; the prune stays `<=`
  by explicit design (`03-07-PLAN.md:111-116`); boundary tests cover exactly-30 (survives) and
  exactly-31 (expires) (`03-07-PLAN.md:130-132`). Time only advances, so a def passing the scan cannot
  fail the later guard on clock drift alone. **Resolved.**

### Concerns

- **MEDIUM (actionable)** — `03-03-PLAN.md:59` ("…is what Plan 07's sweep calls DIRECTLY") and
  `03-03-PLAN.md:128` ("Plan 07's sweep calls THIS directly") are stale cycle-1/2 wording about the
  public `dropField`. They contradict the authoritative cycle-3 text at `03-03-PLAN.md:30`, `64-67`,
  `142-156` (esp. line 156: "the sweep calls `expireFieldIfStale` (never `dropField`)") and all of
  `03-07-PLAN.md` (`79-80`, `101-108`). Plan 07 — the plan that actually implements the sweep — never
  instructs a `dropField` call, and its mandatory TOCTOU test would fail if one were used, so an
  executor is well-guarded; but the two stray sentences should be deleted so the plan is internally
  consistent and cannot be misread into reopening the TOCTOU. **Fix:** in 03-03, change line 59 to say
  the public `dropField` is the drop primitive exercised by the drop-mechanics tests (the sweep calls
  `expireFieldIfStale`), and delete "Plan 07's sweep calls THIS directly — and" from line 128,
  keeping the non-reentrancy warning.

### Verdict

No HIGH concerns. No new deadlock, no writer bypass, no boundary/operator disagreement, no decision
reversal. All three residuals are substantively fixed; one plan-hygiene MEDIUM remains.

## Consensus Summary

Both reviewers independently reach the same conclusion: the three cycle-2 residuals are fixed in the
authoritative plan text and are consistent with the actual non-reentrant `withMutex` chain and
hand-rolled transaction pattern in the code. No new deadlock, no bare writer, no boundary mismatch,
no decision reversal.

### Agreed Strengths
- Write-serialization is now complete — every def writer and the history prune run through one
  `inWriteTransaction` (single-BEGIN tests asserted); pure reads take none.
- The core/wrapper split correctly avoids nesting the non-reentrant mutex; the sweep composes
  `expireFieldIfStale` (own txn) and a separate sequential prune txn — no deadlock path.
- The under-lock `quarantined_at` re-check shares the drop's single transaction, closing the
  scan→drop TOCTOU; strict `<` expiry vs deliberate `<=` retention prune agree with the boundary tests.

### Agreed Concerns
- **MEDIUM (both reviewers, actionable):** `03-03-PLAN.md:59` and `:128` still assert the sweep calls
  public `dropField` directly — stale text contradicting the rest of 03-03 and all of 03-07, which
  route the sweep through `expireFieldIfStale`. Remove/correct the two clauses so the plan is
  unambiguous and cannot be misread into skipping the under-lock re-check.

### Divergent Views
None. Codex tags the contradiction as blocking residual #2's verdict; Claude confirms the same finding
but notes 03-07's implementing text and mandatory TOCTOU test guard the executor, making it a
plan-hygiene MEDIUM rather than a HIGH. Both agree on zero HIGH and on the single required edit.
