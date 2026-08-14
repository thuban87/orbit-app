---
phase: 02-data-foundation-status-engine
reviewed: 2026-08-14T23:29:44Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - src/db/types.ts
  - src/db/uid.ts
  - src/db/migrations/runner.ts
  - src/db/migrations/001-initial.ts
  - src/db/database.ts
  - src/db/mutex.ts
  - src/db/recency-dao.ts
  - src/db/status.ts
  - src/db/queries.ts
  - src/db/benchmark.ts
  - src/db/__testkit__/node-sqlite.ts
  - src/services/launch-sweep.ts
  - App.tsx
  - app.config.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-08-14T23:29:44Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Deep cross-file review of the irreversible migration-1 SQLite data layer, traced along the
`database.openAndMigrate` → `runner.runMigrations` → `migration001.apply` →
`recency-dao` → `status`/`queries` → `benchmark`/`launch-sweep` → `App.tsx` chain, and
cross-checked against every writer of the shared `contacts.last_contact` and `interactions`
tables (grep-verified, not diff-scoped).

**Every high-risk invariant primed for this phase holds.** The migration runner is
hand-rolled (no expo `withTransactionAsync`), sets no PRAGMAs of its own, runs each step in
its own `BEGIN … PRAGMA user_version=N … COMMIT`, rolls back and re-throws the *original*
error, and never lowers `user_version`. `database.ts` sets WAL / `foreign_keys=ON` /
`busy_timeout` before any transaction. `recency-dao.ts` is the sole writer of
`contacts.last_contact` (grep confirms the only `last_contact =` write; `benchmark.ts`
writes it only via `INSERT` into a throwaway ephemeral DB through the injected executor and
never calls `getDb()`), every write is mutex-guarded and hand-rolled-transactional, and
recency is a MAX-over-current-rows recompute with the `rarely_responds` connected-only
filter in-SQL. All values are `?`-bound; the only interpolation is the `Number.isInteger`
-guarded `user_version` literal and status.ts's code-constant thresholds. `PROGRESS_SQL`
applies `'localtime'` only to `now`, never to the already-local `last_contact` (no
double-conversion). `contact_custom_values` ships column-less with only the exempt `uid`
autoindex; no value column, index, or UNIQUE. Status/progress are derived-never-stored.

No BLOCKERs. The findings below are robustness and correctness-hardening issues — a launch
hang on migration failure, an unvalidated divide-by-zero into the status engine, a sweep
that can silently drop a launch, and unscoped interaction writes that can recompute the
wrong contact.

## Warnings

### WR-01: Migration failure hangs the app forever with an unhandled rejection

**File:** `App.tsx:32-40`
**Issue:** The launch effect calls `openAndMigrate().then(...)` with **no `.catch`**. If
`openAndMigrate()` rejects — exactly what the runner is designed to do on a failed migration
(it rolls back cleanly and re-throws the original error) — `setReady(true)` never runs, so
the app is pinned on the `ActivityIndicator` splash forever with zero diagnostics, plus an
unhandled promise rejection. This is the launch path for the one irreversible schema step;
the failure mode with the highest user-visibility has no handler. The runner correctly
leaves the DB at the prior version so the *data* is safe, but the *app* is bricked on that
launch with no signal to the user or logs.
**Fix:** Attach a rejection handler that surfaces the failure (and lets you log it), rather
than leaving it dangling:
```tsx
useEffect(() => {
  let active = true;
  openAndMigrate()
    .then(() => { if (active) setReady(true); })
    .catch((err) => {
      if (!active) return;
      Logger.error("bootstrap", "openAndMigrate failed", err);
      setError(err); // render a retry/error state instead of an infinite spinner
    });
  return () => { active = false; };
}, []);
```

### WR-02: `interval_days = 0` silently mis-buckets a contact as `stable`

**File:** `src/db/status.ts:59`, `src/db/recency-dao.ts:277-312`
**Issue:** `PROGRESS_SQL` divides by `interval_days`. The schema declares
`interval_days INTEGER NOT NULL` with **no `CHECK (interval_days > 0)`**, and
`createContactWithInteraction` writes `input.intervalDays` with no validation. A `0` (or
negative) interval makes `x / 0` evaluate to SQL `NULL`; every comparison in `STATUS_SQL`
against `NULL` is false → the row falls through to `ELSE 'stable'`, and it sorts to the
bottom of `STATUS_SCAN`'s `ORDER BY progress DESC`. A never-nagged, always-"stable" contact
is a silent correctness failure that looks like healthy data. Because migration 1 is
irreversible, a `CHECK` constraint cannot be retro-fitted without a table rebuild, so the
guard must live in TS (consistent with CLAUDE.md "logic that would live in a Postgres
function lives in TypeScript").
**Fix:** Validate at the single write chokepoint before the insert:
```ts
if (!Number.isInteger(input.intervalDays) || input.intervalDays <= 0) {
  throw new Error(`intervalDays must be a positive integer, got ${input.intervalDays}`);
}
```

### WR-03: An overlapping `background → active` launch silently drops its entire sweep

**File:** `src/services/launch-sweep.ts:58-68`
**Issue:** `runLaunchSweep` guards re-entrancy with `if (running) return;` — but this
*discards* the second invocation rather than deferring it. If a real `background → active`
transition arrives while a previous sweep's hooks are still awaiting (they are async), that
launch runs **no** sweep work at all; it does not re-run once the in-flight sweep settles.
Phase 2's registry is empty so nothing is dropped today, but later phases register
quarantine-expiry, archived-purge, and schedule-reconcile here (per the module doc), and the
contract "runs once per real foreground launch" is what those depend on. The mitigating
factor is that hooks are meant to be idempotent and will re-run next launch — hence WARNING,
not BLOCKER — but a skipped-this-launch sweep is a latent correctness gap seeded now.
**Fix:** Coalesce a pending request instead of dropping it — e.g. set a `pendingRerun` flag
when `running` is true and re-invoke in the `finally`, or serialize launches through the
existing `withMutex` primitive so the second launch queues behind the first.

### WR-04: `editTouchpoint` / `deleteTouchpoint` don't scope the write to `contactId`, so a caller mismatch recomputes the wrong contact

**File:** `src/db/recency-dao.ts:237-270`
**Issue:** Both mutations target the interaction by `WHERE id = ?` alone, then call
`recomputeLastContact(exec, input.contactId, …)` using the **caller-supplied** `contactId`.
Nothing checks that `interactionId` actually belongs to `contactId`. If a caller passes a
mismatched pair, the interaction of contact A is edited/deleted while contact B is recomputed
— contact A's `last_contact` is left stale (the exact "recency silently wrong after a
mutation" class the module's own invariant block warns against) and contact B is recomputed
against rows that didn't change. This is a within-module contract that a cheap change makes
un-violable, and it directly protects the project's most load-bearing invariant.
**Fix:** Scope the write by both keys so a mismatch is a no-op the recompute can't
misattribute, or derive `contactId` from the row instead of trusting the argument:
```sql
UPDATE interactions SET occurred_at = ?, connected = COALESCE(?, connected), modified_at = ?
 WHERE id = ? AND contact_id = ?
```
and assert `changes === 1` before recomputing (same for the `DELETE`).

## Info

### IN-01: Failed migration leaves the connection uncached and re-opens on every retry

**File:** `src/db/database.ts:94-113`
**Issue:** `cachedDb` is assigned only after `runMigrations` resolves. If migration throws,
`cachedDb` stays `null` and the opened `SQLiteDatabase` is neither cached nor closed; each
subsequent `openAndMigrate()` call opens `orbit.db` afresh. Minor (expo may hand back the
same underlying handle), but on a device that fails migration on every launch this accretes
open connections and re-runs the PRAGMA bootstrap each time.
**Fix:** Wrap the body in `try/catch`, `await db.closeAsync()` on failure before re-throwing,
so a retry starts from a clean connection.

### IN-02: `types.ts calculateStatus` diverges from the SQL status engine — partial parity claim

**File:** `src/db/status.ts:22-28`, `src/types.ts:98-123`
**Issue:** status.ts documents STABLE_MAX/WOBBLE_MAX as "the SAME buckets" as
`calculateStatus()`. The stable/wobble/decay boundaries do agree, but the legacy
`calculateStatus` returns `'decay'` for a null `lastContact` whereas the SQL path excludes
never-contacted rows entirely (and STATUS_SQL alone would bucket null as `'stable'`), and
`calculateStatus` has no `rogue`/`rarely_responds` path at all (`OrbitStatus` omits
`rogue`). Any later phase that reaches for `calculateStatus` will get a *different* bucketing
than the dashboard's SQL. The drift is documented, but the parity claim overstates it.
**Fix:** Either narrow the docstring to "the stable/wobble threshold *values* only match" or
retire `calculateStatus` for the SQL engine so there is one status authority.

### IN-03: `uid` autoindex exemption is correct, but relies on an undocumented-in-code SQLite fact for Phase 3

**File:** `src/db/migrations/001-initial.ts:148-153`
**Issue:** Not a defect — noting for the Phase-3 handoff. `contact_custom_values.uid TEXT
NOT NULL UNIQUE` creates an autoindex on `uid`, which is correct and exempt from the
value-column index ban. Phase 3's `DROP COLUMN` at quarantine expiry must continue to target
only the TEXT value columns (never `uid`), and must not add any index/UNIQUE to a value
column, or the drop will fail permanently on-device. The current migration honors this; the
risk is entirely in the not-yet-written Phase-3 drop path.
**Fix:** None here. Carry this constraint into the Phase-3 plan's acceptance checks.

---

_Reviewed: 2026-08-14T23:29:44Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
