---
phase: 3
reviewers: [codex, claude]
reviewed_at: 2026-08-15T00:41:39Z
plans_reviewed:
  - 03-01-PLAN.md
  - 03-02-PLAN.md
  - 03-03-PLAN.md
  - 03-04-PLAN.md
  - 03-05-PLAN.md
  - 03-06-PLAN.md
  - 03-07-PLAN.md
  - 03-08-PLAN.md
models:
  codex: gpt-5.6-terra
  claude: default
note: >
  Both reviewers ran with repo access and grounded their findings in file:line evidence.
  The orchestrating agent independently re-verified the load-bearing claims against the
  actual Phase-2 code (mutex.ts, recency-dao.ts, migrations/001-initial.ts, launch-sweep.ts,
  database.ts) and the plugin FormRenderer before writing the consensus — including running
  the mutex-reentrancy and datetime-granularity cases directly. See "Orchestrator Verification".
---

# Cross-AI Plan Review — Phase 3: Custom Fields

## Codex Review

### Summary

The plans preserve the intended TEXT-forever, no-index, metadata-only type-change design and correctly build on Phase 2's schema and launch lifecycle. However, they are not implementation-ready: identifier guards are incomplete, custom-value writes are not serialized with DDL, and Plan 07 as written can deadlock the sweep.

### Strengths

- **03-01 correctly treats the existing migration as the schema source of truth.** `custom_field_defs` already has the planned definition columns at `001-initial.ts:127`–`142`, while `contact_custom_values` has only `contact_id`, `uid`, and `modified_at` at `149`–`153`. A PRAGMA-based drift test is appropriate.
- **03-03 chooses the correct transaction model.** The existing primitive is a shared-mutex, hand-rolled `BEGIN`/`COMMIT`/best-effort `ROLLBACK` transaction at `recency-dao.ts:198`–`213`; the module explicitly forbids Expo's transaction wrappers at `recency-dao.ts:22`–`30`.
- **03-03 respects the value-column storage invariants.** Migration 1 explicitly requires future value columns to be TEXT and forbids indexes/UNIQUE constraints on them at `001-initial.ts:144`–`147`. The proposed populated-column DROP test is a useful end-to-end proof.
- **03-07 wires into the real sweep lifecycle correctly in principle.** The registry is intentionally empty for later consumers at `launch-sweep.ts:41`–`47`; cold-start execution occurs in `installSweepTrigger` at `102`–`114`. `App.tsx` already installs it only after migration readiness at `62`–`68`.
- **03-06 uses the plugin renderer as the right behavioral reference.** It has a single type dispatcher at `FormRenderer.tsx:90`–`101`, covers the seven types, and already preserves an out-of-list dropdown value rather than discarding it at `114`–`130`.

### Concerns

- **HIGH — 03-03/03-04/03-05 do not establish one serialization boundary for all custom-field writers.** Plan 03 serializes DDL, but Plan 04's `upsertValue` is a write with no mutex/transaction requirement. The actual mutex only serializes callers that explicitly use it (`mutex.ts:22`–`35`); `SqlExecutor` itself provides no serialization (`types.ts:17`–`28`). Consequently, `deleteOrQuarantineField` can observe an empty field, then a concurrent UPSERT can write a value before DROP; that value is destroyed. A concurrent UPSERT can also land while DDL is active on the shared connection.
- **HIGH — 03-02 and 03-03 leave dynamic SQL identifier paths dependent on an assumption rather than enforcing the guard locally.** `sortExpr()` is specified to interpolate `field.col_name` but does not call `isSafeColName`; `dropField()` likewise has no explicit guard in its task. Double quotes are not a validation mechanism. The live schema only enforces `col_name TEXT NOT NULL UNIQUE`, not the whitelist regex (`001-initial.ts:127`–`142`). Every function that interpolates the identifier must reject unsafe input itself.
- **HIGH — 03-07 can self-deadlock as written.** It says to run each stale def in its own `withMutex` transaction and then call Plan 03's `dropField`, which itself uses `inWriteTransaction`/`withMutex`. The inner mutex operation queues behind the outer operation (`mutex.ts:32`–`35`), while the outer operation waits for the inner one. Quarantine expiry never completes.
- **MEDIUM — 03-07's "one failed drop cannot wedge the rest" claim is false without per-def error handling.** `runLaunchSweep()` awaits each hook and does not isolate failures (`launch-sweep.ts:71`–`89`). Within a hook, one rejected `dropField()` aborts its loop and skips history pruning unless the plan explicitly catches, logs, and continues for each field.
- **MEDIUM — 03-03's atomic-create test does not exercise a failing `ALTER TABLE`.** The planned duplicate `col_name` fails at the definition INSERT because `custom_field_defs.col_name` is already UNIQUE (`001-initial.ts:129`–`132`). It therefore cannot prove rollback after the def row has been inserted. Seed an unmanaged physical value column first, then create a definition with that otherwise-free name so `ADD COLUMN` is the statement that fails.
- **MEDIUM — 03-05's history snapshot cannot record the stated old type.** `field_history` has only `contact_id`, `field_col_name`, `old_value`, `operation`, and `created_at` (`001-initial.ts:155`–`163`). The plan writes only `operation = 'type_change'`, so it cannot preserve the pre-change field type required for meaningful undo/reconciliation. This must be encoded in the existing representation or the owner must explicitly narrow the history contract—without rewriting any values.
- **MEDIUM — dropdown invalid-value flagging is not actually specified end-to-end.** Plan 02 deliberately makes the dropdown parser identity, and Plan 05 preflight receives only a target `FieldType`, not target options. It therefore cannot classify a stored value excluded by an option edit. The plugin specifically handles this condition (`FormRenderer.tsx:123`–`126`), and the DB stores options as unconstrained TEXT (`001-initial.ts:133`–`134`). Plan 06 says it will show an error state, but does not specify the option-membership check that makes that possible.
- **MEDIUM — 03-08 has no persistence path for editing `show_on_new` or `always_show`, and its create payload is underspecified.** The form offers both flags, but Plan 03's DAO operations only cover label, order, options, quarantine, and restore. Also, the real schema requires `uid`, `display_order`, `created_at`, and `modified_at` (`001-initial.ts:129`–`141`); the UI plan does not say who generates/computes those required `NewFieldDef` fields.

### Suggestions

- Extract and export a single shared write-transaction helper. Route **every** custom-field write, including `upsertValue`, through its mutex. Make the emptiness check and delete/quarantine decision occur inside the same serialized transaction.
- Make `isSafeColName()` mandatory inside `sortExpr`, `dropField`, `isFieldEmpty`, dynamic reads, and UPSERTs. Add rejection tests for each public SQL-building function.
- Let `dropField` own its single mutex transaction. The sweep should call it directly, never wrap it in another mutex. Catch and log failures per stale definition so later fields and history retention still run.
- Replace the duplicate-definition rollback test with a deliberately pre-existing physical column that has no matching def row.
- Define a non-destructive old-type history encoding and test it. Add an `isValidForField(value, type, options)` classifier for dropdown membership, reused by preflight and `CustomFieldValue`.
- Add an explicit DAO update for `show_on_new`/`always_show`, and specify that the screen creates `uid`, `now`, and `display_order` before calling `createField`.

### Risk Assessment

**HIGH.** The architecture is close to the intended design, but the current plan permits an empty-check/UPSERT race that can permanently drop a newly stored value, leaves two identifier interpolation paths unguarded, and describes a sweep implementation that can deadlock. These should be resolved before execution.

---

## Claude Review

I read the Phase-2 modules on disk (`mutex.ts`, `recency-dao.ts`, `001-initial.ts`, `launch-sweep.ts`, `database.ts`, `App.tsx`, `queries.ts`, `status.ts`, the testkit) and the plugin `FormRenderer.tsx`/`loader.ts`, and grepped for every writer of the three custom-field tables (there are none outside migration 1).

### 1. Summary

These eight plans are unusually well-grounded: line references into Phase-2 code are accurate (I verified ~20 of them), every non-negotiable invariant is named in the plan that could break it, and the two hardest calls — TEXT-forever storage and "a type change is `UPDATE defs.type` only" — are enforced with a load-bearing test (byte-identical value column after `applyTypeChange`). I found **no invariant violation**: no index/UNIQUE on a value column, no value-rewrite path, no un-whitelisted interpolated identifier, no cascade-reliant column drop, no expo `withTransactionAsync`, no new dependency, no scope leak into Phase 4/5. The single HIGH is a mechanical one: **Plan 07 instructs the executor to wrap `dropField` in its own `withMutex`, and `withMutex` is a non-reentrant promise chain — the quarantine sweep deadlocks permanently.** Below that sit a cluster of MEDIUMs where a plan *claims* a mechanism that the referenced code cannot actually perform: an atomicity test that can't reach the path it asserts, a tap-to-fix error state for out-of-list dropdown values that no parser can ever raise, a `field_history` snapshot that cannot record the thing an undo would need, and three wrong `depends_on` edges.

### 2. Strengths

- **Transaction primitive correctly identified and correctly reused.** `inWriteTransaction` is exactly where Plan 03 says it is (`src/db/recency-dao.ts:198-213`), and it composes `withMutex` (`src/db/mutex.ts:32-36`) with a hand-rolled `BEGIN`/`COMMIT`/`ROLLBACK` that preserves the original error (`recency-dao.ts:209-210`). Every plan that writes DDL routes through it and explicitly bans expo `withTransactionAsync` — which `recency-dao.ts:27-31` documents as the P3/P4 rejection.
- **The TEXT-forever invariant is enforced *and tested*, not just asserted.** 03-05 Task 2's "capture the raw stored bytes … assert BYTE-IDENTICAL after `applyTypeChange`" is the correct executable form of CLAUDE.md's "blast radius zero," and it directly guards the schema comment at `src/db/migrations/001-initial.ts:22-29`.
- **The cascade trap is handled explicitly.** 03-03 Task 1 requires `DELETE FROM custom_field_defs` *and* `ALTER TABLE … DROP COLUMN` as separate statements in one transaction, matching `001-initial.ts:150` (`ON DELETE CASCADE` on `contact_id`, which deletes rows only).
- **The no-index invariant has a real proof, not a comment.** 03-03 test (d) — populate a field, assert `dropField` succeeds — is the right test, because SQLite's `DROP COLUMN` throws `error in index … after drop column` if an index exists. The `uid TEXT UNIQUE` autoindex at `001-initial.ts:151` is correctly left exempt (it is not a value column, per the scoping at `001-initial.ts:25-29`).
- **The `col_name` chokepoint is genuinely singular.** Plan 01 makes `makeColName` the only producer, `isSafeColName` (`^[a-z][a-z0-9_]*$`) the downstream guard, and the drift test reads `PRAGMA table_info` against the real `migration001` fixture — so the whitelist cannot silently fall behind `CREATE_CONTACTS` (`001-initial.ts:61-82`) or `CREATE_CONTACT_CUSTOM_VALUES` (`:148-153`). Every other value is `?`-bound, consistent with the discipline documented at `src/db/queries.ts:9-13`.
- **Sweep registration is correctly placed.** 03-07 Task 2 registers *after* `openAndMigrate()` resolves and *before* `installSweepTrigger`, which matches the `ready`-gated effect at `App.tsx:64-68` and the "cold-start sweep fires immediately" behaviour at `launch-sweep.ts:106`. It avoids the module-top-level registration that `launch-sweep.ts:12-18` calls out as P5.
- **Deferrals honour the recorded decisions.** `share_with_ai` absent from both UI plans (Phase 14), `photo` widget a disabled placeholder (Phase 5), no navigation library, no per-profile view options. Zero installs — consistent with the empty `dependencies` delta in `package.json`.

### 3. Concerns

**HIGH — 03-07 Task 1: nesting `withMutex` around `dropField` deadlocks the launch sweep permanently.**
The plan says: *"for each stale def, in its OWN withMutex transaction, call `dropField(exec, def, 'quarantine_expiry', now)`."* But 03-03 Task 1 builds `dropField` on `inWriteTransaction`, which is itself `withMutex(...)` (`recency-dao.ts:202`). `withMutex` is a serialization chain, not a reentrant lock: `const run = chain.then(fn, fn); chain = run.catch(...)` (`mutex.ts:33-34`). The inner call is queued *behind* the outer call's completion while the outer call awaits the inner one — a permanent hang. Consequence chain: the sweep hook's promise never settles → the `for (const hook of hooks) await hook()` loop at `launch-sweep.ts:82-84` never returns → the `finally` at `:86-89` never runs → `running` stays `true` for the process lifetime → **every** subsequent launch sweep (and every later phase's hook — archived purge, schedule reconcile, backup rotation) short-circuits at `:72-75`. There is no error and no log; it presents as "quarantined fields just never expire." 03-07's own test (a 40-day-old quarantined field) would hang on a vitest timeout rather than fail cleanly, which invites an executor to "fix" it by stripping the transaction out of `dropField` — the worst possible resolution. Fix: `dropField` already owns the mutex + transaction; the sweep must call it bare, and the loop's "one txn per def so a failure can't wedge the rest" property comes for free from `dropField` being per-def.

**MEDIUM — 03-03 Task 1 test (b): the atomic-rollback test cannot reach the path it claims to prove.**
The plan proposes creating a second field "whose `col_name` duplicates the first — the ADD COLUMN throws" and then asserting both the def row and the column are absent. But `col_name TEXT NOT NULL UNIQUE` (`001-initial.ts:131`) means the **INSERT** throws first; `ALTER TABLE … ADD COLUMN` is never reached and no def row was ever written, so both assertions pass trivially without exercising rollback at all. The real risk — INSERT commits, ADD COLUMN fails, orphan def row survives — goes untested. To actually hit it the fixture must pre-create the physical column without a def row (a direct `ALTER TABLE contact_custom_values ADD COLUMN "x" TEXT`), then call `createField` with `col_name = 'x'`: the INSERT succeeds, the ADD COLUMN fails with `duplicate column name`, and the assertion "no def row remains" becomes meaningful.

**MEDIUM — 03-08 Task 2: the `existing` col_name set will likely omit quarantined fields, making create fail.**
Quarantine sets `quarantined_at` but leaves the physical column in place (03-03 Task 2, by design). `makeColName(label, existing)` only uniquifies against what it is handed. 03-08 Task 2 says create composes `col_name` "from the current defs' col_names," and the screen is described as listing quarantined defs in a *separate* section — so if the `existing` set is built from the visible/active list, re-creating a field with the label of a quarantined one produces a colliding `col_name`, the `ADD COLUMN` throws `duplicate column name`, and the whole create rolls back with an opaque error. `listDefs` takes `{ includeQuarantined }` (03-03 Task 2) — the plan must state that the create path passes `includeQuarantined: true`, and 03-01's test should cover "collides with a quarantined field's col_name → suffixed."

**MEDIUM — 03-02 / 03-06: the out-of-list dropdown tap-to-fix state can never fire.**
CONTEXT records the sub-decision that a stored value excluded by a dropdown-options edit renders as the *same* tap-to-fix error state as an unconvertible type change. 03-06 Task 2 implements flagging as "run `parsers[field.type]` on the stored value; if `{ ok: false }`, render the tap-to-fix error state." But 03-02 Task 1 defines `dropdown: (r) => ({ ok: true, … })` — *"option-membership is the caller's concern"* — so `parsers.dropdown` returns `ok: true` for every input and the error state is unreachable for exactly the case it was specified for. Compounding it, 03-03 Task 2's `changeFieldOptions` is a bare `UPDATE` with no pre-flight, so the user gets no summary either. The value is not destroyed (so the "never silently dropped" invariant holds), but it silently stops being visibly wrong. Fix: `CustomFieldValue` must additionally check membership against `JSON.parse(field.options)` for `type === 'dropdown'`, and 03-08 should run an options-change pre-flight reusing that check.

**MEDIUM — 03-05 Task 2: `field_history` structurally cannot record the old type, so the type-change snapshot cannot support undo.**
`field_history` is `(id, contact_id, field_col_name, old_value, operation, created_at)` — `001-initial.ts:155-163`. There is no type column. Because values are (correctly) byte-identical across a type change, the `old_value` written is an exact duplicate of the live value, so the snapshot carries **zero** recoverable information: it cannot tell you what type to revert to, and it duplicates the entire populated column into `field_history` on every retype (then prunes it at 30 days). CONTEXT describes this snapshot as capturing "old type + affected values … purely for undo," which the schema cannot honour. This is a spec-vs-schema mismatch worth surfacing at the `--to 3` gate rather than silently shipping a write-only audit trail. The cheap fix inside the existing schema is to encode the transition in the free-text `operation` column (e.g. `type_change:number->text`); note `field_history.contact_id` has no FK (`001-initial.ts:155-163`), so a single def-level row is also legal if you prefer one row per change over one row per contact.

**MEDIUM — plan graph: three `depends_on` edges are missing, and two of the pairs sit in the same wave.**
- 03-02 declares `depends_on: []` and is Wave 1, but Task 2 requires `Pick<CustomFieldDef,'col_name'|'type'>` from `src/db/field-types.ts`, which 03-01 creates. Its own `read_first` lists that file.
- 03-05 declares `depends_on: [03-02]` but its `read_first` names `src/db/col-name.ts` (`isSafeColName`) and `src/db/field-types.ts` — both 03-01 artifacts.
- 03-08 declares `depends_on: [03-01, 03-03, 03-05, 03-06]` but Task 2's `read_first` names `getExecutor` from `src/db/database.ts`, which **03-07** creates (Task 2). Both are Wave 3, so a parallel run leaves 03-08 unable to typecheck.

Execution is configured sequential (PROJECT.md "parallelization off"), so the practical blast radius today is low — but the wave graph is the artifact that makes parallelism safe later, and 03-08/03-07 are same-wave right now.

**MEDIUM — 03-02 Task 2: `sortExpr` is the one `col_name` interpolation site with no `isSafeColName` guard.**
Every other interpolation site in the phase is specified as "guard with `isSafeColName`, then double-quote" (03-03 create/drop/`isFieldEmpty`, 03-04 select/upsert, 03-05 preflight/apply). 03-02 Task 2 says only *"Double-quote the col_name defensively."* Today its input is a def row read back from the DB, so the value is safe in practice — but `sortExpr` is explicitly designated the permanent, sole sort/filter interpolation site for the whole app (Phase 8's dashboard sort, Phase 13's orrery ordering will feed it defs from wherever they happen to have them). Adding the same guard costs one line and keeps the phase's stated control uniform.

**MEDIUM — 03-04 Task 1: `upsertValue`'s `uid` contract is unspecified, and one plausible reading fails hard.**
`contact_custom_values.uid` is `TEXT NOT NULL UNIQUE` (`001-initial.ts:151`) and is the row's merge key — one per *contact*, not one per field. The signature `upsertValue(exec, contactId, uid, col_name, value, now)` puts uid minting on the caller with no stated contract. If a caller mints a per-field uid, writing the same custom field for a second contact violates `UNIQUE(uid)`; because the violated constraint is not the `ON CONFLICT(contact_id)` target, SQLite raises rather than taking the DO UPDATE branch, and the save fails outright. Even with a per-contact uid, Phase 4 will also insert this row when creating a contact — the plan says "coordinate with Phase 4" but does not say who wins. Pin it: document that `uid` is the `contact_custom_values` row uid (one per contact) and that it is used on INSERT only, never updated.

**LOW — 03-07 Task 1: `datetime` vs `date` granularity makes expiry fire a day late, and the test won't catch it.**
`quarantined_at`/`created_at` are written as local wall-clock `YYYY-MM-DD HH:MM:SS` (`database.ts:45-50` `localDateTime()`), but the sweep compares them against `date('now','localtime','-30 days')`, which yields `YYYY-MM-DD`. String-comparing `'2026-07-15 09:00:00' <= '2026-07-15'` is **false** (common prefix, then the longer string sorts higher), so a field quarantined on day D survives until D+31. The direction errs safe, but it is unintended, and the proposed test cases (40 days and 5 days) sit nowhere near the boundary. Use `datetime('now','localtime','-30 days')` and add exact-30-day and exact-31-day cases.

**LOW — `inWriteTransaction` gets copied verbatim into three or four modules.** 03-03 (twice, `field-ddl` + `field-defs-dao`) and 03-05 each say "copy verbatim from recency-dao.ts." Correctness is preserved (they all close over the same shared `mutex.ts` instance), but four copies is four places for the no-nesting rule to be forgotten — which is precisely how the HIGH above arose. Extract it once to `src/db/transaction.ts` and put the "never call a transactional DAO from inside another transaction — `withMutex` is not reentrant (`mutex.ts:32-36`)" warning in that file's header.

**LOW — 03-04 Task 1: `getValuesForContact` with an empty `defs` array emits `SELECT  FROM contact_custom_values WHERE contact_id = ?`** — a syntax error. Trivially reachable on a fresh install (zero custom fields), which is exactly the state at the `--to 3` gate. Return `{}` early.

**LOW — 03-03 Task 1: `deleteOrQuarantineField`'s emptiness check and the drop are not in one transaction.** The plan queries for a non-null value, then calls `dropField` (which opens its own transaction). Single-user, so the interleaving is essentially unreachable — and note the fix is *not* to wrap both in `inWriteTransaction`, which would reproduce the HIGH deadlock. Worth one sentence in the plan so the executor does not "improve" it.

**LOW — `field_history` is write-only in this phase.** §14.6 calls it "the only recovery mechanism," and Phase 3 builds every writer and no reader; FLD-01…07 do not require an undo surface, so this is a scope observation rather than a defect — but it is worth stating plainly at the `--to 3` gate that a quarantine expiry is, in practice, unrecoverable until someone builds the restore path.

**LOW — 03-06 Task 2 `read_first` cites `FormRenderer.tsx:247-316` for "the FormRenderer wrapper + `buildInitialState` shape."** `buildInitialState` is at `FormRenderer.tsx:31`, not in that range (`PATTERNS.md` has it right at `:31-48`); `renderField` at `:90` and the `FormRenderer` component at `:247` are correct.

### 4. Suggestions

1. **Rewrite 03-07 Task 1's loop as a bare `await dropField(...)`** and add to its `<done>`: "no `withMutex`/`inWriteTransaction` wrapper around `dropField` — the DAO owns the lock." Add a test asserting the sweep hook resolves (a `Promise.race` against a timer, or just rely on the 40-day case completing).
2. **Extract `inWriteTransaction` into `src/db/transaction.ts` in Plan 03-03 Task 1** and have 03-05 and 03-07 import it. Header comment documents the non-reentrancy. This replaces four verbatim copies with one and puts the warning where it will be read.
3. **Fix 03-03's rollback test fixture**: pre-create the physical column via a raw `ALTER TABLE`, then `createField` onto it, so the INSERT-succeeds/ADD-COLUMN-fails path is actually executed.
4. **Add to 03-08 Task 2**: the create path calls `listDefs(exec, { includeQuarantined: true })` to build the `existing` set; add a 03-01 test case for collision against a quarantined col_name.
5. **Give dropdown membership a home**: add `isValueInOptions(field, value)` beside the parsers in 03-02, have `CustomFieldValue` (03-06) flag on `!parsers[type](v).ok || (type === 'dropdown' && !isValueInOptions(...))`, and have 03-08 show the same convert/flag summary before committing an options edit.
6. **Encode the type transition in `field_history.operation`** (e.g. `type_change:number->text`) in 03-05 Task 2, and surface at the `--to 3` gate that `field_history` has no type column so a type-change undo is otherwise impossible.
7. **Add `isSafeColName` to `sortExpr`** (03-02 Task 2), throwing on failure, so all interpolation sites share one guard.
8. **Fix the frontmatter**: `03-02 depends_on: [03-01]`, `03-05 depends_on: [03-01, 03-02]`, `03-08 depends_on: [..., 03-07]` — or move `getExecutor()` out of 03-07 into 03-03/03-04 so 03-08's Wave-3 sibling dependency disappears.
9. **Switch the sweep's window comparisons to `datetime('now','localtime', ?)`** and add exact-boundary test cases.
10. **Document the `contact_custom_values.uid` contract** in 03-04 (one uid per contact row, set on INSERT only, never updated) and state explicitly that Phase 4's contact-create is the primary row creator.

### 5. Risk Assessment

**MEDIUM.**

The design is right and the invariants are enforced where it counts — nothing here would ship a permanent data-corrupting defect, and the two irreversible operations (`DROP COLUMN`, type change) are the best-specified parts of the phase. What pulls it to MEDIUM is that the failure mode of the HIGH is *silent*: a deadlocked sweep looks exactly like "no fields were due for expiry," and it disables the launch-sweep registry for every phase that lands on it afterwards (Phase 4 purge, Phase 11 reconcile, Phase 16 backup rotation) rather than just Phase 3. The MEDIUMs cluster around a recurring pattern — a plan asserting a mechanism that the code it cites cannot perform (a test that can't reach its path, an error state no parser can raise, a snapshot that can't hold the recovering datum) — which is the class of defect that survives execution and passes review because the plan text reads correct. All ten suggestions are small, local edits to the plan files; none require reopening a `[DECIDED]` item.

**No escalation.** Nothing in these plans deletes, weakens, or inverts a recorded decision. The type-change reconciliation in 03-05 enforces the dominant CLAUDE.md invariant rather than reversing FLD-04, and it is already flagged for the owner's `--to 3` review; the only thing I'd add to that flag is that the schema cannot store the old type, which bears on whether the "undo" framing in CONTEXT is achievable as written.

---

## Orchestrator Verification

The orchestrating agent read all 8 plans plus the actual Phase-2 modules and independently re-checked the load-bearing claims against the code on disk (not the plan text). Findings:

- **Sweep deadlock (Plan 07) — CONFIRMED, unanimous HIGH.** `withMutex` (`mutex.ts:32-36`) is a strictly non-reentrant single module-level promise chain (`const run = chain.then(fn,fn); chain = run.catch(...)`). Plan 07 Task 1(b) wraps `dropField` — which already acquires `withMutex` via `inWriteTransaction` (`recency-dao.ts:198-213`) — in a second `withMutex`. The inner acquisition queues behind the outer's settlement while the outer awaits the inner: guaranteed permanent hang. Both reviewers found this; Claude traced the full consequence chain (a wedged sweep leaves `running=true` and disables the registry for every later phase's hook). This is the phase's one clear must-fix defect.
- **datetime-vs-date granularity (Plan 07, Claude LOW) — CONFIRMED empirically.** Ran it: with `localDateTime()`'s `YYYY-MM-DD HH:MM:SS` timestamp, `'2026-07-15 09:00:00' <= date('now','localtime','-30 days')` returns 0 (does not expire — survives an extra day) whereas the `datetime(...)` form returns 1. Errs safe (field lives one day longer) but is unintended; boundary tests are needed.
- **Empty-defs SQL (Plan 04, Claude LOW) — CONFIRMED reachable.** With zero custom fields (the fresh-install state at the `--to 3` gate), a column list built from `defs.map(...)` yields `SELECT  FROM contact_custom_values …` — a syntax error unless `getValuesForContact` early-returns `{}`.
- **Divergence — the unserialized `upsertValue` / empty-check→drop race (Codex HIGH vs Claude LOW).** Confirmed the mechanism: `withMutex` only serializes participants, and Plan 04's `upsertValue` is specified as a bare UPSERT that does not participate, so the empty-check→drop window is real in async terms. Codex rates this HIGH (permanent value loss); Claude rates it LOW (single-user makes the interleaving essentially unreachable, and warns the naive fix reproduces the deadlock). Orchestrator's call: **treat it as an unresolved HIGH.** `mutex.ts`'s own header documents the reason — foreground code AND Phase-11/12 headless widget/notification taps share one process and one connection — so "every writer goes through the shared mutex" is a stated design contract, not a theoretical nicety, and an unserialized writer on a data-loss path should not ship unaddressed. Both reviewers agree on the fix (route `upsertValue` through the mutex; make check+drop one serialized transaction via a non-reentrant-safe txn-body core, NOT by nesting `withMutex`).
- **Divergence — `sortExpr`/`dropField` missing `isSafeColName` (Codex HIGH vs Claude MEDIUM).** Confirmed both sites interpolate `col_name` without the local guard the plans' own threat rows imply. Real exploitability is low: `col_name` is whitelist-constructed at creation and stored `UNIQUE`, so the value read back is provenance-safe. Orchestrator's call: **MEDIUM/actionable**, matching Claude and the orchestrator's own read — it is uniform defense-in-depth on an already-safe value, cheap to add, and `sortExpr` is the app-wide permanent sort/filter interpolation site, so the guard belongs there.
- **All remaining MEDIUM/LOW findings — CONFIRMED and actionable**, including the two that only one reviewer caught: the Plan-08 quarantined-collision create failure (Claude) and the three wrong `depends_on` edges (Claude), plus Codex's Plan-08 missing `show_on_new`/`always_show` DAO update.

No finding reverses a `[DECIDED]`/owner item; both reviewers explicitly reached "no escalation." The type-change reconciliation (Plan 05) enforces the dominant CLAUDE.md invariant rather than reversing FLD-04 — already flagged for the owner's `--to 3` review. The only owner-facing addition both surface: `field_history` structurally cannot store the pre-change type, so the CONTEXT "undo" framing needs narrowing (encode the transition in `operation`) — a contract clarification for the gate, not a value rewrite.

---

## Consensus Summary

Two grounded reviewers (Codex `gpt-5.6-terra`, Claude), both with repo access and file:line evidence, plus independent orchestrator re-verification. The Phase-3 design is faithful to HANDOFF §14 and both reviewers independently confirm **no invariant violation**: TEXT-forever storage, no index/UNIQUE on value columns, type-change-as-`UPDATE defs.type`-only with a byte-identical-values test, `sortExpr` as the sole TEXT-leak, snapshot-before-drop, explicit DELETE+DROP (no cascade reliance), dynamic delete/quarantine, fixed 30-day sweep, and correct reuse of the Phase-2 `inWriteTransaction`/registry primitives. The gaps are in concurrency correctness, defense-in-depth guards, test-path reachability, and a few under-specified seams — not in the data model.

### Agreed Strengths

- Correct transaction primitive identified and reused (`inWriteTransaction` = `withMutex` + hand-rolled BEGIN/COMMIT/ROLLBACK); expo `withTransactionAsync` explicitly banned.
- TEXT-forever / "blast radius zero" enforced *and tested* (byte-identical value column after `applyTypeChange`); the cascade trap handled with explicit DELETE + DROP; the no-index invariant proven by a populated-column DROP-succeeds test.
- `col_name` is a genuinely singular whitelist-constructed chokepoint with a PRAGMA drift test; every value `?`-bound.
- Sweep registered after migration, before `installSweepTrigger`, never at module top-level; deferrals (`share_with_ai`, `photo`, navigation) honour the recorded decisions; zero new dependencies.

### Agreed Concerns (highest priority — all unresolved this cycle)

1. **HIGH (unanimous) — sweep self-deadlock (Plan 07):** the sweep wraps `dropField` in a second `withMutex`; `withMutex` is non-reentrant. Refactor `inWriteTransaction` into a mutex-owning wrapper + an un-mutexed txn-body core; the sweep calls `dropField` bare (per-def failure isolation comes for free), and add a test asserting the hook actually resolves.
2. **HIGH (Codex; Claude LOW) — unserialized `upsertValue` / empty-check→drop race (Plans 03/04):** route every custom-field write through the shared mutex per `mutex.ts`'s documented multi-writer contract; make the emptiness check + delete/quarantine one serialized transaction (via the non-reentrant-safe core, not nested `withMutex`).

### Actionable MEDIUM / LOW (each a local PLAN.md edit; none reopen a `[DECIDED]` item)

- **MED — `isSafeColName` guard** missing at `sortExpr` (03-02) and `dropField`/`isFieldEmpty` (03-03); add it plus per-function rejection tests. *(Codex HIGH / Claude MED — synthesized MED: provenance-safe today, uniform hardening.)*
- **MED — atomic-create rollback test (03-03)** proves an INSERT-UNIQUE failure, not an ADD-COLUMN failure; pre-seed a physical value column via raw `ALTER TABLE`, then `createField` onto it.
- **MED — `field_history` old-type (03-05):** the schema has no type column, so the type-change snapshot is unrecoverable; encode the transition in the free-text `operation` (e.g. `type_change:number->text`) and surface the undo caveat at the `--to 3` gate.
- **MED — dropdown out-of-list flagging (03-02/03-06/03-08):** `parsers.dropdown` is identity so the tap-to-fix state is unreachable; add an `isValueInOptions(field, value)` membership check reused by `CustomFieldValue` and by an options-change pre-flight in 03-08.
- **MED — Plan 08 curation persistence (03-08/03-03):** no DAO update exists for `show_on_new`/`always_show`; add one, and assign uid/display_order/created_at/modified_at generation for the create payload.
- **MED — Plan 08 quarantined-collision (03-08/03-01):** build the create-time `existing` col_name set with `listDefs({includeQuarantined:true})` so re-creating a quarantined field's label can't collide with its still-present column; add a 03-01 collision test.
- **MED — `contact_custom_values.uid` contract (03-04):** document one uid per contact row, set on INSERT only, never updated; name Phase 4's contact-create as the primary row creator.
- **MED — `depends_on` graph:** 03-02 → `[03-01]`; 03-05 → `[03-01, 03-02]`; 03-08 → add `03-07` (or relocate `getExecutor` out of 03-07 so the Wave-3 sibling dependency disappears).
- **MED — sweep failure isolation (03-07):** per-def try/catch so one failed drop neither aborts the loop nor skips history pruning.
- **LOW — sweep window granularity (03-07):** use `datetime('now','localtime', ?)` not `date(...)`; add exact 30/31-day boundary tests.
- **LOW — extract `inWriteTransaction` to `src/db/transaction.ts`** (one copy + a non-reentrancy warning header) instead of ~4 verbatim copies — this is the class of edit that prevents the HIGH from recurring.
- **LOW — `getValuesForContact` empty-defs (03-04):** early-return `{}` to avoid a malformed `SELECT  FROM …` on a fresh install.
- **LOW — `deleteOrQuarantineField` (03-03):** add an executor note that the check+drop must NOT be "fixed" by wrapping in `inWriteTransaction` (reproduces the deadlock).
- **LOW — 03-06 citation:** `buildInitialState` is at `FormRenderer.tsx:31`, not `:247-316`; fix the `read_first` reference.

### Divergent Views

- **Severity of the `upsertValue`/empty-check→drop race:** Codex HIGH (permanent value loss on a shared connection) vs Claude LOW (single-user → essentially unreachable). Orchestrator sided with HIGH, because `mutex.ts` documents foreground + headless writers sharing one connection as the exact reason the mutex exists.
- **Severity of the missing `sortExpr`/`dropField` `isSafeColName` guard:** Codex HIGH vs Claude MEDIUM. Orchestrator sided with MEDIUM (provenance-safe value; uniform defense-in-depth).
- **Overall risk rating:** Codex HIGH vs Claude MEDIUM — driven entirely by the two severity divergences above; both agree the design is correct and no data-corrupting defect ships.
