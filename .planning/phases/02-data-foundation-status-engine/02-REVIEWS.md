---
phase: 2
reviewers: [codex, claude]
reviewed_at: 2026-08-14T21:31:35Z
plans_reviewed: [02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md, 02-04-PLAN.md, 02-05-PLAN.md, 02-06-PLAN.md]
---

# Cross-AI Plan Review — Phase 2 (Data Foundation & Status Engine)

> Reviewer independence note: this session runs inside Claude Code, so per the review
> workflow the external `claude -p` CLI is skipped for independence. The **Codex** review
> below is a fully independent external CLI pass (grounded, ran in the repo working tree).
> The **Claude** review is a grounded in-session read of the actual plans + source
> (`src/types.ts`, `src/utils/logger.ts`, `src/utils/dates.ts`, the RESEARCH DDL, `HANDOFF.md`,
> `CLAUDE.md`), not a paraphrase of the plan text.

## Codex Review

## Summary

The plans are well-scoped and correctly preserve the major Phase-2 decisions: hand-rolled migrations, empty fuel/custom-field tables in migration 1, a mutexed recency DAO, and derived status. However, several execution contradictions would block validation or produce incorrect behavior; two are high-risk correctness defects.

## Strengths

- The migration approach correctly follows the irreversible-schema rule: strict, per-step hand-rolled transactions and preservation of the original error are explicitly required in 02-01-PLAN.md:137-144, matching the forward-only constraints in CLAUDE.md:71-76.
- The migration-1 scope is comprehensive: all ten tables, including the empty `fuel` table and deferred custom-field tables, are explicitly retained in 02-02-PLAN.md:109-121.
- The DAO plan uses the correct invariant: recompute a correlated `MAX(occurred_at)` after every mutation, with the `rarely_responds` connected-row predicate, in 02-03-PLAN.md:125-138. This matches the authoritative "current values, not last write" rule in docs/dossier/01-data.md:102-108.
- The dashboard scan correctly excludes never-contacted and archived contacts in 02-04-PLAN.md:133-140, consistent with docs/dossier/01-data.md:183-189.

## Concerns

- **HIGH — local-wall-clock timestamps are converted as UTC in the proposed status SQL.** 02-04-PLAN.md:98-100 specifies `date(last_contact, 'localtime')`, while the authoritative storage decision is "local wall-clock, as written" in docs/dossier/04-log.md:423-432. SQLite interprets a timezone-less datetime before applying `localtime`; in the local test environment, `date('2026-08-14 00:30:00','localtime')` becomes `2026-08-13`. This can make late-night interactions decay a day early.
- **HIGH — the benchmark writes synthetic contacts/interactions into the live app database and bypasses the single-writer rule.** The harness is told to insert contacts and set non-null `last_contact` directly in 02-06-PLAN.md:86-96, then the release build calls it with `getDb()` in 02-06-PLAN.md:149-151. Reverting `App.tsx` does not remove those rows. This both pollutes the developer's real data and creates a second `last_contact` writer outside the DAO.
- **HIGH — the on-device benchmark will not emit the planned log.** `runBenchmark()` is told to log through `Logger` in 02-06-PLAN.md:96-99, but `Logger` defaults to `"off"` in src/utils/logger.ts:10-12 and only prints debug output at `"debug"` in src/utils/logger.ts:37-41. The temporary release wiring does not enable it, so DATA-07 cannot be observed as written.
- **MEDIUM — `runMigrations` has contradictory signatures.** Plan 01 declares three parameters in 02-01-PLAN.md:134-135, but requires `deps` immediately afterward in 02-01-PLAN.md:139-144. Plan 02 calls it with four parameters in 02-02-PLAN.md:154-157. This will either fail typecheck or leave migration seeds without dependencies.
- **MEDIUM — the custom-values index test contradicts the specified schema.** Migration 1's authoritative DDL has `contact_custom_values.uid TEXT NOT NULL UNIQUE` in 02-RESEARCH.md:401-405, which creates an SQLite autoindex. Yet the plan expects `PRAGMA index_list` to show only a PK index in 02-02-PLAN.md:149. The ban applies to dynamic custom value columns, not the row's merge-key `uid`, as clarified in HANDOFF.md:462-465.
- **MEDIUM — sweep installation is not explicitly sequenced after successful migration and reacts to any `active` event.** 02-05-PLAN.md:120-126 permits a separate effect, which can install and invoke the sweep while migration is still running. The trigger also runs for every raw `active` event in 02-05-PLAN.md:94-97, rather than tracking `background → active`; later sweep hooks may consequently run twice on cold start or after transient `inactive` states.

## Suggestions

- Store local wall-clock timestamps canonically as `YYYY-MM-DD HH:mm:ss`; calculate day-granular progress with `date(last_contact)` and retain `date('now','localtime')` only for "today." Add a near-midnight regression test.
- Run benchmarks against a disposable benchmark database, not `getDb()`. Initialize it with migration 1, seed it through the DAO or recompute helper, then delete it. Return benchmark results to the temporary UI or explicitly set/reset `Logger` to `debug`.
- Standardize the runner as `runMigrations(exec, migrations, targetVersion, deps)`, and add preflight tests for a missing version and a database version greater than the app target.
- Change the custom-values assertion to verify no non-PK index/`UNIQUE` exists on dynamic value columns, while allowing the `uid` unique autoindex.
- Install the sweep only after `openAndMigrate()` resolves; track the previous AppState and trigger only on `background → active`.

## Risk Assessment

**HIGH.** The architecture is strong, but the timestamp conversion can misclassify status, and the benchmark plan can mutate real data while failing to produce evidence. These should be corrected before execution, especially because migration-1 behavior and its supporting invariants are difficult to repair after release.

---

## Claude Review

### Summary

The six plans are unusually disciplined for the highest-stakes phase in the project: the crash-safe runner (Plan 01), the comprehensive irreversible DDL with every un-backfillable column (Plan 02), the single-writer/mutexed recency DAO (Plan 03), and derived-never-stored status (Plan 04) all correctly encode the recorded decisions in `HANDOFF.md` §3/§14/§15 and `CLAUDE.md`'s data-layer rules. The empty `fuel` table and `allowBackup=false` owner decisions are honored, not reversed. The defects that remain are not architectural — they are a status-SQL timezone bug that re-introduces the exact off-by-one class the project explicitly forbids, a device-benchmark design that writes to the live datastore and cannot emit its own evidence, and three internal contradictions between plan text, tests, and the authoritative DDL that would surface at typecheck/test time. I independently reached the same two headline correctness findings as Codex.

### Strengths

- **Crash-safe runner is correct.** `src/db/migrations/runner.ts` (Plan 01, 02-01-PLAN.md:137-144) wraps each step as `BEGIN` → `apply` → `PRAGMA user_version = N` (integer literal, never bound) → `COMMIT`, with `ROLLBACK` + re-throw of the ORIGINAL error on failure. This is the correct forward-only, per-step-atomic shape; a mid-migration throw leaves `user_version` exactly where it was. Expo `withTransactionAsync`/`migrateDbIfNeeded` are correctly rejected (P2/P3).
- **DDL is comprehensive and the un-backfillable set is complete.** RESEARCH §Code Example 1b (verified lines 299-419) creates all ten tables with distinct `uid` + `created_at` + `modified_at` on every mergeable table, `contacts.ring_seq`, `interactions.recorded_at`/`source`, `custom_field_defs.display_order`/`share_with_ai`. `contacts.name` carries NO UNIQUE (duplicates warn). `idx_interactions_recency` is scoped to `interactions` only. Verified `src/db/` is currently empty (`.gitkeep` only) so there is no pre-existing second writer of `last_contact` — the single-writer invariant starts clean.
- **Recency recompute SQL is correct and better than the RESEARCH pseudocode.** Plan 03 (02-03-PLAN.md:130-134) uses a properly correlated subquery `SELECT MAX(i.occurred_at) FROM interactions i WHERE i.contact_id = contacts.id AND (contacts.rarely_responds = 0 OR i.connected = 1)` inside `UPDATE contacts ... WHERE id = ?`. This fixes the RESEARCH §Code Example 2 pseudocode, which used a bare `rarely` (no such column) and an uncorrelated subquery. MAX-over-current-rows (not last-write-wins), connected-only for rarely_responds, and NULL for never-contacted are all correct. Every value is `?`-bound.
- **Status is genuinely derived-never-stored.** Plan 04 exports SQL string constants only; no `status`/`progress` column is added; STATUS_SCAN filters `last_contact IS NULL AND archived_at IS NULL`. The rogue 4th-threshold + rarely_responds path matches dossier 04-log.
- **Owner decisions honored, not reversed.** Empty `fuel` table ships in migration 1 (Plan 02, resolving the RESEARCH Q1/A1 source conflict per the 2026-08-14 owner decision); `android:allowBackup=false` is enforced in Plan 06 as a [DECIDED] PII-at-rest control; no ORM/drizzle — plain-TS DDL run at launch.

### Concerns

- **HIGH — `date(last_contact,'localtime')` double-converts an already-local timestamp (status off-by-one).** Confirmed independently. The DDL comments store `occurred_at`/`last_contact` as *local wall-clock* (RESEARCH lines 335, 362: "local datetime", "local wall-clock, editable"). Applying `date(x,'localtime')` to a tz-less local value makes SQLite treat it as UTC and shift it by the local offset: `date('2026-08-14 00:30:00','localtime')` → `2026-08-13` in a negative-offset zone. This also breaks Plan 04's own day-granular equality claim (two same-calendar-day contacts with different times-of-day would bucket differently). It is the exact "UTC off-by-one in evening hours" class `CLAUDE.md` and `src/utils/dates.ts` explicitly forbid, in SQL form. The correct form is `date('now','localtime')` for *now* and `date(last_contact)` (no modifier) for the already-local stored value. Status is query-time so this is fixable post-ship, but it ships wrong status buckets for near-midnight interactions. Needs a near-midnight regression test.
- **HIGH — Plan 06 benchmark runs against the live `orbit.db` and writes `last_contact` directly.** `runBenchmark(getDb())` (02-06-PLAN.md:149-151) targets the real app database; `seedBenchmarkData` (02-06-PLAN.md:86-96) bulk-inserts synthetic contacts with non-null `last_contact` set directly (not via the DAO). Reverting the `App.tsx` wiring does not delete those rows, so it (a) permanently pollutes the owner's real data and (b) is a second writer of `contacts.last_contact` outside the single-writer DAO — on the very phase that establishes that invariant. Fix: seed/measure against a throwaway DB file (migrate it, run, delete), never `getDb()`.
- **HIGH — the on-device DATA-07 evidence cannot be observed as written.** Confirmed against source: `src/utils/logger.ts:11` sets `level = "off"` by default and `Logger.debug` only prints when level === "debug" (logger.ts:38-41); the doc-comment says "no output until settings wire it in Phase 9." Plan 06 reads the benchmark log line from the ReactNativeJS channel but never calls `Logger.setLevel("debug")`, so the timings AND the owed P6 `date('now','localtime')` device probe never print — which is doubly damaging because that probe is exactly how the HIGH #1 timezone bug would be caught on-device. Fix: set the level for the benchmark build (or return the result to the temporary UI).
- **MEDIUM — `runMigrations` signature is specified three inconsistent ways.** Plan 01's canonical signature line (02-01-PLAN.md:134) is `runMigrations(exec, migrations, targetVersion)` — three params, no `deps` — yet the same task's prose (02-01-PLAN.md:143) and the `Migration.apply(exec, deps)` contract require `deps` to reach the seed INSERTs, and Plan 02 Task 3 calls it with four args `runMigrations(adapter, [migration001], TARGET_VERSION, {now, newUid})` while Plan 02 Task 2's example call omits the executor entirely (`runMigrations([migration001], 1, {now, newUid})`). If Plan 01 is implemented to its literal 3-arg signature, migration001's seeds get no `now`/`newUid`. Pin one signature — `runMigrations(exec, migrations, targetVersion, deps)` — across all plans.
- **MEDIUM — Plan 02's `contact_custom_values` index-list test contradicts its own DDL (but this is NOT an invariant reversal).** The DDL declares `contact_custom_values.uid TEXT NOT NULL UNIQUE` (RESEARCH:401-405), which creates a `sqlite_autoindex`, but Plan 02's test asserts `PRAGMA index_list` shows "only the implicit PK, no unique/extra index" (02-02-PLAN.md:149) — so the test would FAIL as written. Verified against `HANDOFF.md:462-465`, which scopes the index/UNIQUE ban to **custom value columns** (the ones that get `DROP COLUMN`-ed at quarantine expiry) and explicitly notes UNIQUE-as-constraint does not apply to the merge-key. The `uid` autoindex does not block dropping value columns, so Phase-3 quarantine-DROP is unaffected. Resolution: keep `uid ... UNIQUE`, and rewrite the assertion to "no non-PK index/UNIQUE on any VALUE column, uid autoindex permitted." (This reconciles the categorical `CLAUDE.md` one-liner with the scoped `HANDOFF.md` rationale — not a decision reversal.)
- **MEDIUM — launch-sweep gating: fires on any raw `active` and may install before migration resolves.** The RESEARCH §Code Example 4 implementation checks `if (s === 'active')` with no previous-state tracking, while Plan 05's must-have (02-05-PLAN.md:19) promises "a real background→active transition, and not on any non-active transition." A transient `inactive`→`active` (permission dialog, notification shade) would re-fire the sweep; cold-start also runs it immediately AND may catch an initial `active` event. Plan 05 also permits installing the trigger in a separate effect (02-05-PLAN.md:120-126) that could run the sweep before `openAndMigrate()` resolves. Registry is empty in Phase 2 so impact is latent, but this skeleton's gating is the deliverable later phases depend on. Track previous AppState (background→active only) and sequence install after migration ready.
- **LOW — "one shared threshold constant set" is aspirational, not real (drift risk).** Plan 04's key_link claims `status.ts` STABLE_MAX/WOBBLE_MAX "mirror calculateStatus 80%/100% buckets — one shared constant set, no drift," but `src/types.ts:112,117` hardcodes `threshold * 0.8` / `< threshold` inline — there is no exported constant to share, so `status.ts` will *duplicate* the literals. A future tuning of one side silently diverges from the other. Consider exporting the numeric thresholds from `src/types.ts` and importing them in `status.ts`, or add a test asserting equality. (The plan mitigates only with a comment, which does not prevent drift.)
- **LOW — `STATUS_SQL` alone buckets a NULL `last_contact` as `'stable'`.** `julianday(date(NULL,...))` → NULL → all comparisons false → ELSE `'stable'`. Harmless in Phase 2 because the only consumer (STATUS_SCAN) pre-filters `last_contact IS NULL`, but any later standalone use of `STATUS_SQL` would mislabel never-contacted as stable. Worth a guard or a comment when it is reused.

### Suggestions

- Adopt Codex's timestamp fix: canonical local `YYYY-MM-DD HH:mm:ss` storage, `date(last_contact)` (no modifier) vs `date('now','localtime')`, plus a near-midnight regression test in `status.test.ts`.
- Benchmark against a disposable DB file; never `getDb()`. Enable `Logger.setLevel("debug")` (or return the result to the temporary UI) for the benchmark build so DATA-07 + the P6 probe are observable.
- Standardize `runMigrations(exec, migrations, targetVersion, deps)` in Plan 01 and every call site; add a "db version > target" preflight test (defensive, forward-only).
- Rewrite the Plan 02 custom-values index assertion to scope to value columns and allow the uid autoindex.
- Track previous AppState and gate the sweep on background→active; install only after `openAndMigrate()` resolves.

### Risk Assessment

**HIGH.** Architecture and decision-fidelity are strong and the irreversible DDL itself looks correct, but two shipped-correctness defects (status timezone off-by-one; benchmark writing to the live DB) and an unobservable device verification (Logger off) must be fixed before execution. None require reversing a recorded decision; all are localized plan/test/SQL corrections.

---

## Consensus Summary

Two independent reviewers (Codex external CLI + Claude in-session grounded read) converged on the same overall verdict — **HIGH risk, strong architecture, fixable defects** — and independently identified the same two headline correctness findings. No reviewer proposed reversing an owner/[DECIDED] item (empty `fuel` table, `allowBackup=false`, no-ORM all correctly left intact); the `uid`-UNIQUE finding was explicitly checked against `HANDOFF.md` and found to be a test-assertion bug, not an invariant reversal.

### Agreed Strengths
- Crash-safe hand-rolled migration runner with original-error preservation (Plan 01).
- Comprehensive migration-1 DDL: all ten tables incl. empty `fuel` + custom-field tables, every un-backfillable column (Plan 02).
- Correct single-writer recency DAO — correlated MAX recompute, connected-only for rarely_responds (Plan 03).
- Derived-never-stored status; dashboard scan excludes never-contacted + archived (Plan 04).

### Agreed Concerns (highest priority — raised by BOTH reviewers)
1. **HIGH — status SQL timezone double-conversion.** `date(last_contact,'localtime')` on an already-local stored timestamp shifts near-midnight interactions by a day and re-introduces the forbidden UTC off-by-one class. Fix: `date(last_contact)` vs `date('now','localtime')` + near-midnight test. (Plan 04)
2. **HIGH — benchmark writes to the live `orbit.db` via `getDb()` and seeds `last_contact` directly**, polluting real data and acting as a second writer outside the single-writer DAO; reverting `App.tsx` does not undo it. Fix: disposable benchmark DB. (Plan 06)
3. **HIGH — on-device benchmark log cannot emit** because `Logger` defaults to `"off"` and the plan never enables `"debug"`; DATA-07 timings AND the owed P6 localtime probe are unobservable as written. Fix: enable logging / return the result. (Plan 06)
4. **MEDIUM — `runMigrations` signature contradiction** across Plans 01/02 (3 vs 4 params; deps missing). Standardize `runMigrations(exec, migrations, targetVersion, deps)`.
5. **MEDIUM — Plan 02 `contact_custom_values` index-list test contradicts the DDL's `uid ... UNIQUE`.** Not an invariant reversal (HANDOFF scopes the ban to value columns); rewrite the assertion to allow the uid autoindex.
6. **MEDIUM — launch-sweep gating** fires on any raw `active` (no background→active tracking) and may install before migration resolves (Plan 05).

### Divergent Views
- **Benchmark Logger-off severity:** Codex rated it HIGH; Claude concurs it is effectively HIGH because the same missing log hides the P6 localtime probe that would otherwise catch finding #1 on-device. No substantive disagreement.
- **`uid`-UNIQUE finding:** both landed at "test bug, not invariant reversal" after checking HANDOFF.md:462-465 — initial instinct (categorical CLAUDE.md one-liner) would have called it HIGH; the scoped HANDOFF rationale correctly downgrades it to MEDIUM. Recorded here as a caution: enforce the invariant on value columns, not the merge key.
- Claude added two LOW items not raised by Codex (threshold-constant duplication drift; STATUS_SQL bucketing NULL as 'stable') — minor, non-blocking.

### Recommendation
Address the three HIGH items and the three MEDIUM contradictions via `/gsd-plan-phase 2 --reviews` before executing. All fixes are localized to plan text, tests, and SQL fragments; none reverse a recorded decision, and the irreversible DDL itself needs no structural change (only the status-SQL date handling and the benchmark harness target/observability).
