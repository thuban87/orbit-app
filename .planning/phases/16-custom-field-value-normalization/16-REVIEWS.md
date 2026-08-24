---
phase: 16
reviewers: [codex, claude]
reviewed_at: 2026-08-24T19:26:27Z
plans_reviewed: [16-01-PLAN.md, 16-02-PLAN.md, 16-03-PLAN.md, 16-04-PLAN.md, 16-05-PLAN.md, 16-06-PLAN.md, 16-07-PLAN.md]
models:
  codex: "gpt-5-codex (codex-cli 0.149.1)"
  claude: "claude-opus-5 (headless -p, read-only Read/Grep/Glob)"
model_sources:
  codex: "cli-invocation"
  claude: "cli-invocation"
review_method: "manual salvage path — codex run without --dangerously-bypass-hook-trust; claude via headless read-only CLI (see CLAUDE.md reviewer memories). gsd-review skill lanes bypassed intentionally."
cycle: 1
---

# Cross-AI Plan Review — Phase 16 (Custom Field Value Normalization)

## ⚠ Owner Resolution — REQUIRED for cycle-2 replan (blocking)

**D-06a (fail-closed brick, non-loss inconsistency):** Owner chose *snapshot + proceed for non-loss only*. LOSS-bearing inconsistencies (missing value column) still FAIL CLOSED unchanged. NON-LOSS inconsistencies (orphan dynamic column with no matching def) must NOT brick: snapshot the orphan data to `field_history` and drop it in the same transaction, then proceed. Also correct the classified migration-failure UI copy (`16-UI-SPEC.md`) so it names the permanent state honestly and does not promise a support channel. See `16-CONTEXT.md` D-06a. The replan MUST incorporate this into Plan 01 (migration) + the UI-SPEC copy row; do not re-open the loss-bearing fail-closed path.

## Consensus Summary

Two independent source-grounded reviewers (Codex and Claude Opus 5) both rate the phase **HIGH risk** — not because the plans are weak (research quality and the migration-transaction protocol are strong) but because the blast radius is maximal: a forward-only, unrecoverable on-device SQLite migration (006), no backend, no remote repair, `allowBackup="false"`, and no shipped export (Phase 17 comes after). Both reviewers independently converged on the same core HIGH findings.

### Agreed Concerns (raised by BOTH reviewers — highest priority)

1. **HIGH — Quarantine→restore breaks the one-row-per-(contact×field) invariant (D-03).** Plans 01/02/03 disagree on whether *quarantined* definitions get pair rows. Failure path: quarantine a field → create a contact (skipped as not "live") → restore the field (`restoreField` at `src/db/field-defs-dao.ts:178-192` only nulls `quarantined_at`, backfills nothing) → that contact now has no pair row for a live field.
2. **HIGH — `src/screens/CustomFieldsScreen.tsx` is an uncovered production caller.** `isFieldEmpty` re-keys from `col_name` to `field_def_id`, but the sole caller (`CustomFieldsScreen.tsx:114`) passes a string, and that screen is in no plan's `files_modified` — while driving six of the seven APIs being reshaped. Surfaces only as a project-wide `tsc` failure the executor must fix by deviation.
3. **HIGH — Plan 07's malformed-fixture device UAT is impossible on a release APK.** Writing a malformed legacy DB on-device needs `run-as`, which `docs/runbooks/desktop-build-pipeline.md:193-198` says works only on a DEBUG build. The task requires two APK variants and names neither correctly.
4. **HIGH — Wave ordering vs the `tsc` gate.** Plan 01 changes the value-write contract without a compatibility overload; callers migrate in Plan 02; but Plans 03/05/06 run in the same wave and each runs `tsc --noEmit`, which cannot pass until Plan 02 lands. (Codex frames this as wave-ordering HIGH; Claude frames the tsc-gate limitation as MEDIUM — `tsc` can't see string-literal SQL writers either way.)

### Divergent / Single-Reviewer Concerns

**Claude-only HIGH:**
- **Bare `UPDATE` edit path = silent data loss.** Plan 02's "edit/clear update existing pair rows" as a bare `UPDATE … WHERE contact_id=? AND field_def_id=?` hits 0 rows and throws nothing when the row is missing (composes with #1). Current code self-heals via `INSERT … ON CONFLICT DO UPDATE` (`src/db/field-values-dao.ts:136-144`). Fix: mandate UPSERT on the pair constraint, or a `changes===1` assertion.
- **Fail-closed "brick" on a *non-loss* inconsistency → OWNER-BUCKET.** D-06 (fail closed) is a recorded owner decision and is NOT being reopened. But the plans don't distinguish *loss-bearing* (value column missing — failing closed is correct) from *non-loss-bearing* (orphan dynamic column, no def — nothing to lose) inconsistencies. For the second class the app never opens again, forever, with no export/repair path, and `16-UI-SPEC.md:138` tells the user to "contact support" — a channel the project can't keep. Reviewer recommends surfacing this to the owner as an explicit checkpoint and fixing the copy regardless.

**Codex MEDIUM:** migration timestamp semantics underspecified (`created_at` never defined); v5-centric migration proof vs forward-only v1→v6 rule; legacy-identifier negative migration test missing; permanent-delete of a populated photo field has no filesystem-lifecycle decision (orphaned files).

**Claude MEDIUM:** `sortExpr()` has **zero runtime consumers** in this repo (`src/db/field-sort.ts:44-45` says so) — so CFN-03's "same user-visible ordering" and Plan 04 Task 2's parity claims are vacuous, and Plan 07's "sort/filter parity" UAT observation is unperformable; `tsc` can't enumerate string-literal SQL writers (need a grep gate); no plan updates CLAUDE.md / HANDOFF §14 / writes an ADR (project non-negotiables become false); migration cost O(C·D) row-by-row is unbounded/unmeasured behind a bare spinner; `modified_at` provenance (contact-wide, fanned per-field) feeds Phase 17 merge and is an unescalated one-way decision; Plan 01 is one 8-file task mixing the irreversible migration with a reversible DAO refactor; all seven plans self-report `estimate.confidence: low`; normalized read must filter by passed `defs` (privacy: quarantined + non-`share_with_ai` values must not leak into the AI egress map).

**Claude LOW:** Plan 01/05 shared-file ownership overlap; stale Node-18 blocker (shell is v22.22.2, existing suite green in 416ms); Plan 01 bootstrap-gate truth statement inaccurate; `col_name` reuse-after-delete becomes more load-bearing; `purge-photo-cleanup.test.ts` pinned to v1 gives false coverage.

---

## Codex Review

## Summary

The plans have a strong migration-safety intent and correctly trace most storage, lifecycle, read, purge, and UAT seams. However, I would not execute them as written: there are three HIGH issues in the durable-pair invariant, production caller coverage, and wave ordering, plus the physical UAT cannot prove its rollback claim using the specified release build.

## Strengths

- The plans build on a genuinely atomic migration contract: each version runs in its own `BEGIN`/`COMMIT`, advances `user_version` only after success, and rolls back/rethrows the original failure. [runner.ts](/home/bwales/projects/orbit-app/src/db/migrations/runner.ts:56)

- They preserve the important behavioral boundary: the current value map is keyed by `col_name`, while new storage can be row-based. This matches the existing edit and AI consumers, which already consume `getValuesForContact()` rather than direct schema details. [contact-read.ts](/home/bwales/projects/orbit-app/src/db/contact-read.ts:196) [ai-context-read.ts](/home/bwales/projects/orbit-app/src/db/ai-context-read.ts:157)

- Lifecycle intent is sound: snapshot non-NULL values to `field_history` before destructive deletion, retain the launch sweep, and avoid nested write transactions. That matches both the current implementation and its non-reentrancy constraint. [field-ddl.ts](/home/bwales/projects/orbit-app/src/db/field-ddl.ts:120) [transaction.ts](/home/bwales/projects/orbit-app/src/db/transaction.ts:12)

- The migration fixture is appropriately ambitious: NULL vs empty text, unusual raw text, photos, archived contacts, contacts without a legacy row, rollback, and AI/privacy regressions are all explicitly in scope. [16-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-01-PLAN.md:102)

- The plans correctly preserve custom-photo filenames as `contactId + col_name`, rather than rekeying them to value UIDs. [photo-storage.ts](/home/bwales/projects/orbit-app/src/services/photos/photo-storage.ts:79)

## Concerns

- **[HIGH] Restoring a quarantined field can violate the “one row for every live contact × field” invariant.** Plan 02 creates rows only for “every live definition.” [16-02-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-02-PLAN.md:78) If a field is quarantined, a new contact is created, then the field is restored, that contact has no pair row. The current restore operation only clears `quarantined_at`; it creates no values. [field-defs-dao.ts](/home/bwales/projects/orbit-app/src/db/field-defs-dao.ts:181) This breaks D-01 after normal, supported lifecycle actions.

- **[HIGH] Plan 03 omits a real production caller that must change for its stated `field_def_id` query shape.** The plan says lifecycle/emptiness reads move to bound `field_def_id` queries, but its modified-file list excludes `CustomFieldsScreen.tsx`. [16-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-03-PLAN.md:73) That screen currently calls `isFieldEmpty(exec, d.col_name)`. [CustomFieldsScreen.tsx](/home/bwales/projects/orbit-app/src/screens/CustomFieldsScreen.tsx:114) Either the API remains col-name based, contrary to the plan, or this is a missed compile/runtime caller.

- **[HIGH] The wave dependency graph conflicts with the required TypeScript gates.** Plan 01 deliberately changes the value-write contract without a compatibility overload, while `contacts-dao.ts` still calls the legacy `(rowUid, col)` core. [contacts-dao.ts](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:163) Plan 02 migrates those callers, but Plans 03, 05, and 06 run in the same wave and each requires `npx tsc --noEmit`. [16-02-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-02-PLAN.md:5) [16-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-03-PLAN.md:80) Those checks cannot reliably pass until Plan 02 lands.

- **[HIGH] The device UAT procedure cannot prove “database unchanged after rollback” with a release APK.** Plan 07 explicitly specifies a release-build malformed-fixture test and requires proof of unchanged data. [16-07-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-07-PLAN.md:85) The required runbook says release APKs are not `run-as` debuggable and on-device database inspection requires a debug build plus Metro. [desktop-build-pipeline.md](/home/bwales/projects/orbit-app/docs/runbooks/desktop-build-pipeline.md:193)

- **[MEDIUM] Migration timestamp semantics are underspecified.** The legacy row has only `modified_at`, not `created_at`. [001-initial.ts](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:149) Plan 01 requires timestamped value rows but only specifies preservation of `modified_at`; it never defines the required, deterministic `created_at` value for migrated rows. [16-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-01-PLAN.md:104) This should be intentional before values become later sync inputs.

- **[MEDIUM] The migration proof is v5-centric despite the forward-only rule requiring safe jumps from all prior versions.** The migration runner applies pending steps based on the database’s current version. [runner.ts](/home/bwales/projects/orbit-app/src/db/migrations/runner.ts:43) The project rule explicitly calls out v1→v6 upgrades. [CLAUDE.md](/home/bwales/projects/orbit-app/CLAUDE.md:73) The plans only require a real v5 fixture. A parameterized v1/v4/v5 upgrade test would verify registration and bootstrap sequencing, even though the custom-field schema itself was introduced in v1.

- **[MEDIUM] Legacy identifier safety needs an explicit negative migration test.** Normal runtime code currently guards every interpolated custom identifier. [field-values-dao.ts](/home/bwales/projects/orbit-app/src/db/field-values-dao.ts:45) Migration 006 must temporarily read legacy columns by identifier; its plan says it will validate correspondence, but does not explicitly require a test where a malformed persisted `col_name`/column pair fails before any write. [16-01-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-01-PLAN.md:107)

- **[MEDIUM] Permanent deletion of a populated custom-photo field has no filesystem-lifecycle decision.** Plan 03 removes value rows and the definition. [16-03-PLAN.md](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-03-PLAN.md:79) Existing purge cleanup enumerates only surviving photo definitions, so once a photo definition is deleted its per-contact files cannot be rediscovered by that cleanup. [purge-photo-cleanup.ts](/home/bwales/projects/orbit-app/src/services/photos/purge-photo-cleanup.ts:69) Decide whether expiry schedules best-effort post-commit cleanup from the snapshot or explicitly documents this as a pre-existing bounded orphan behavior.

## Suggestions

- Make the invariant continuous: either create rows for all definitions, including quarantined ones, on contact creation, or make `restoreField` atomically insert missing NULL pairs for every contact, minting one UID per inserted row.

- Add `CustomFieldsScreen.tsx` to Plan 03 and change `isFieldEmpty` to accept `fieldDefId`; add a regression that proves the screen’s per-definition emptiness load still works.

- Serialize the dependency chain: make Plan 02 complete before any plan that runs `tsc`, then place Plans 03/05/06 after it. Alternatively, defer all phase-wide compile gates until that caller migration is complete.

- Define and test timestamp policy explicitly, e.g. `created_at = legacy modified_at` for source-derived pairs and `created_at = modified_at = migration now` for synthesized blanks.

- Add rollback tests for unsafe/mismatched legacy identifiers and parameterize real runner upgrades from representative v1, v4, and v5 starting versions.

- Split UAT into:
  - release APK for silent, standalone upgrade/UI proof;
  - disposable debug APK plus Metro for malformed-fixture setup and post-failure SQLite inspection.

## Risk Assessment

**HIGH** until the three HIGH design/execution issues are resolved. The proposed storage model is suitable, but this is an irreversible on-device migration: a missed pair after restore, an untracked caller, or a falsely signed-off rollback UAT could leave users with state that cannot be repaired remotely.

---

## Claude Opus 5 Review

I've read the plans and verified them against the actual source. Here is the review.

---

# Cross-AI Plan Review — Phase 16 (Custom Field Value Normalization)

## 1. Summary

This is a well-researched, unusually disciplined plan set for a genuinely dangerous change: a forward-only, unrecoverable on-device migration that retires the shipped dynamic-column custom-value store. The migration-proof protocol (validate structure → copy → prove → retire, all inside the runner's existing per-version transaction), the refusal to build a dual-read/dual-write mode, the preservation of `col_name` as a non-SQL compatibility key, and the explicit fail-closed boundary are all correct and correctly grounded in `src/db/migrations/runner.ts:56-66` and `src/db/transaction.ts:19-36`. The plan-to-file decomposition covers **almost** every writer of the affected tables. However, I found four issues I would not ship without resolving: a **cross-plan inconsistency about whether quarantined definitions get pair rows**, which combined with a bare-`UPDATE` edit path creates a silent data-loss route; an **uncovered production consumer (`CustomFieldsScreen.tsx`) whose call signature must change** and which appears in no plan's `files_modified`; a **device UAT step that is physically impossible as written** on a release APK; and a **fail-closed design that permanently bricks the app with copy that implies transience**, with no plan escalating that to the owner. Separately, CFN-03's "existing sort/filter" and Plan 04 Task 2 are built on a premise that is false in this repo — `sortExpr()` has zero runtime consumers.

---

## 2. Strengths

- **Migration transaction ownership is exactly right.** `16-RESEARCH.md` Pattern 2 and Plan 01's action both mandate raw `SqlExecutor` calls inside the runner's already-open `BEGIN`, never `inWriteTransaction`. Verified: `src/db/migrations/runner.ts:56-66` opens `BEGIN`, calls `migration.apply`, sets `PRAGMA user_version = N`, and `COMMIT`s atomically, rolling back and re-throwing the *original* error; `src/db/transaction.ts:43-58` takes the non-reentrant `withMutex`. Nesting would be a permanent hang, and the plans call this out by name in three separate places.

- **Snapshot-before-destroy ordering is preserved correctly.** Plan 03 Task 1 requires `INSERT field_history … → DELETE value rows → DELETE def` in one transaction. That matches the existing contract at `src/db/field-ddl.ts:113-137` (snapshot at (a), `DELETE custom_field_defs` at (b), drop at (c)) and satisfies the CLAUDE.md non-negotiable "every destructive operation snapshots to `field_history` inside the same transaction."

- **Type changes stay non-destructive.** Plan 04 Task 1 explicitly forbids rewriting stored bytes and keeps parser logic in TypeScript. That preserves `src/db/field-type-change.ts:145-189`, where `applyTypeChange` writes only the `field_history` snapshot plus `UPDATE custom_field_defs SET type` and touches values not at all. The "flag, don't coerce" invariant survives.

- **The AI egress boundary is explicitly re-proven, not assumed.** Plan 05 Task 2's threat T-16-10 targets exactly the right code: `src/db/ai-context-read.ts:153-178` filters `listDefs(…, {includeQuarantined:false})` → `share_with_ai === 1` → drops `null`/`undefined`/whitespace-only. Requiring regression coverage for each exclusion on a store change that could widen the projection is the correct instinct for the one network-egress path in the app.

- **Custom-photo path compatibility is correctly identified as load-bearing and left alone.** Plan 06 Task 1 forbids re-keying photos to the value `uid`. Verified against `src/components/field-widgets/photo-field-logic.ts:16-28` (the stored value *is* `customFieldPhotoRelPath(contactId, colName)`) and `src/services/photos/purge-photo-cleanup.ts:71-98`, which enumerates surviving photo defs by `col_name`. Re-keying would orphan every existing file.

- **The `UNIQUE(contact_id, field_def_id)` constraint is placed in the schema, not in DAO convention**, which is the only way D-03 is actually enforceable. And the research correctly notes the CLAUDE.md "never index a value column" ban was scoped to `contact_custom_values` precisely because `DROP COLUMN` fails on indexed columns — a constraint that evaporates once `DROP COLUMN` is gone.

- **The `rowUid` retirement is traced end-to-end.** Plan 02 Task 2's acceptance criterion greps the exact five files. Verified those are the real call sites: `src/db/contacts-dao.ts:97,169,230,326`, `src/screens/create-contact-logic.ts:47,100`, `src/screens/edit-contact-logic.ts:78`, `src/screens/CreateContactScreen.tsx:143`, `src/screens/EditContactScreen.tsx:315`.

---

## 3. Concerns

### HIGH — Plans 01/02/03 disagree on whether *quarantined* definitions get pair rows

Three plans specify the cross-product differently:

- **Plan 01** (migration): "copy the complete contact × definition matrix." `16-RESEARCH.md` step 1 says the migration reads "all definitions, **including quarantined ones**."
- **Plan 02** Task 1: "Create inserts one value row per **live** definition."
- **Plan 03** Task 1: "A new definition adds a NULL pair record for every existing contact" — silent on which contacts, silent on the quarantine dimension.

These are not reconcilable. Concrete failure: a field is quarantined; a contact is created afterwards (Plan 02 skips it — not "live"); the field is restored within the 30-day window via `restoreField` (`src/db/field-defs-dao.ts:178-192`, which only nulls `quarantined_at` and backfills nothing). That contact now has **no** pair row for a live field. D-03's "the database enforces exactly one current value record per contact-and-field pair" is violated, and every read/write that assumes the row exists is now operating on a hole.

### HIGH — "Edit and clear update existing pair rows" is a silent-data-loss path if a row is missing

Plan 02 Task 1 behavior: "Edit and clear update existing pair rows without deleting/re-keying them." A bare `UPDATE … WHERE contact_id=? AND field_def_id=?` against a missing row affects **0 rows and throws nothing** — the user's typed value is silently discarded on save. The current code cannot fail this way: `src/db/field-values-dao.ts:136-144` is an `INSERT … ON CONFLICT(contact_id) DO UPDATE`, which self-heals a missing row.

This matters because the edit form writes *every* live field on every save — `src/screens/edit-contact-logic.ts:81` documents `editColNames` as "`defsForEditForm(defs).map(d => d.col_name)` — EVERY non-quarantined column." So a single missing pair row (see the HIGH above) silently swallows that field's value on every subsequent save. The plans should mandate an UPSERT keyed on the pair constraint (or a `changes === 1` assertion, matching the loud-failure idiom already used at `src/db/contacts-dao.ts:269-273` and `src/db/purge-dao.ts:204-208`), not a bare `UPDATE`.

### HIGH — `src/screens/CustomFieldsScreen.tsx` must change and is in no plan's `files_modified`

Plan 03 Task 1 moves `isFieldEmpty` off dynamic columns and re-keys it "by bound `field_def_id`." The current signature is `isFieldEmpty(exec, colName: string)` (`src/db/field-defs-dao.ts:220-231`), and the sole production caller passes a **string**: `src/screens/CustomFieldsScreen.tsx:114` — `empties[d.id] = await isFieldEmpty(exec, d.col_name);`.

`CustomFieldsScreen.tsx` appears in the `files_modified` of none of plans 01–07. Plan 03 Task 1's verify is `npm test -- … && npx tsc --noEmit`, which is project-wide, so this surfaces as a hard compile failure the executor must resolve by deviation — on the screen the phase context names as the driver of "creation, retype, options changes, curation, quarantine, restore, and delete." That screen also calls `createField`, `deleteOrQuarantineField`, `applyTypeChange`, `changeFieldOptions`, `preflightTypeChange`, and `preflightOptionsChange` (`CustomFieldsScreen.tsx:37-51, 156, 184, 189, 228, 240, 294`) — six of the seven APIs being reshaped in this phase, unowned by any plan.

### HIGH — Plan 07's malformed-fixture device test cannot be performed on a release APK

Plan 07 Task 2 requires: "In a disposable test profile only, exercise a deliberate malformed fixture and confirm approved classified failure copy, unmounted navigator, and unchanged database after rollback." Producing a malformed *legacy* database on-device means writing to `/data/data/com.bwales.orbit/…` before launch. `docs/runbooks/desktop-build-pipeline.md:193-198` states this explicitly:

> "**The `app-release.apk` is NOT `run-as`-debuggable.** CLAUDE.md's data-layer inspection (`adb exec-out "run-as com.bwales.orbit cat /data/data/…"`) works **only on a DEBUG APK**."

Plan 07's action says "Install migration-006 **release** build over populated pre-006 test-profile data." The two halves of the task require two different APK variants, and the plan specifies neither the debug build nor the `assembleDebug` + Metro path from runbook §2. As written, this blocking human checkpoint has no executable procedure.

### HIGH — Fail-closed on a non-loss inconsistency is a permanent, unrecoverable brick, and the plans don't escalate it

D-06 says fail closed; that's the owner's call and I'm not reopening it. But the plans implement it without distinguishing two very different classes of legacy inconsistency, and without surfacing the consequence:

- **Loss-bearing** (a def whose value column is *missing*): failing closed is correct — the values genuinely cannot be preserved.
- **Non-loss-bearing** (an "unexpected dynamic column" with no matching def): there is nothing to lose. Plan 01 Task 2 rejects this too.

For the second class, the outcome is: the app never opens again, on any launch, forever. There is no remote repair, no export path (Phase 17 hasn't shipped), no in-app retry, and `android:allowBackup="false"` (PROJECT.md Key Decisions). The user's entire relationship history is unreachable. The UI-SPEC copy compounds it — `16-UI-SPEC.md:138`: *"Please reopen the app; if this keeps happening, contact support."* Reopening will fail identically every time, and "contact support" is a promise the project cannot keep.

This is the kind of risk/data-safety posture question CLAUDE.md puts squarely in the owner's bucket. It should be a named checkpoint decision, not a detail folded into Plan 01 Task 1's blanket "authorize the locked boundary."

### MEDIUM — CFN-03 and Plan 04 Task 2 rest on a premise that is false in this repo: `sortExpr()` has no consumers

`grep -rn "sortExpr" src/ | grep -v field-sort` returns only three comment references (`field-type-change.ts:12`, `field-parsers.ts:10,20`). There is no call site. `src/db/field-sort.ts:44-45` says so itself: *"It is latent in Phase 3 — `sortExpr` has no runtime consumer yet."* And `src/db/dashboard-read.ts:147-156` confirms it: the sort map is `status | name | least-recent | most-recent`, all over `contacts` columns; no custom-field branch exists in `dashboard-read.ts`, `queries.ts`, or `orrery-read.ts`.

Consequences the plans don't acknowledge:
- CFN-03's "Every existing custom-field sort and filter works from the normalized rows with the **same user-visible ordering**" is vacuously satisfiable — there is no user-visible ordering to preserve.
- Plan 04 Task 2's `<done>` — "All custom sort/filter callers can use a static normalized-row expression safely" — cannot be demonstrated; there are no callers.
- **Plan 07 Task 2 lists "sort/filter parity" as a PASS/FAIL device observation.** That observation is unperformable: no UI exposes a custom-field sort or filter. A signed UAT recording it as PASS would be a false gate on the phase's exit criteria.
- Plan 04 Task 2's "using the literal DAO alias selected at the query boundary" is under-specified precisely because there is no query boundary. Whoever eventually writes one must also constrain `field_def_id` in the join — otherwise `ORDER BY CAST(value AS REAL)` sorts by an arbitrary field's value or multiplies rows. That constraint belongs in `sortExpr`'s contract now, while it's cheap.

### MEDIUM — `npx tsc --noEmit` is the phase's stated completeness gate, and it cannot see the migration's real risk

Plan 02's `<verification>`: "`npx tsc --noEmit` is the compile gate **proving every direct caller migrated**." It proves no such thing. Every remaining reference to the retired table is a **string literal**, invisible to the type checker:

- `src/db/purge-dao.ts:114` — `SELECT EXISTS(SELECT 1 FROM contact_custom_values WHERE contact_id = ?)`
- `src/db/purge-dao.ts:190` — `DELETE FROM contact_custom_values WHERE contact_id = ?`
- `src/db/field-defs-dao.ts:228` — `SELECT COUNT(*) … FROM contact_custom_values WHERE "${colName}" IS NOT NULL`
- `src/db/field-type-change.ts:82, 179`
- `src/db/field-ddl.ts:100, 127, 136, 173`

These compile cleanly and fail at runtime with `no such table`. This is the exact gap CLAUDE.md warns about ("No TypeScript→SQL edges … the graph cannot enumerate the writers of a table"). The plans need a grep-based completeness assertion (`rg 'contact_custom_values' src/ --glob '!**/001-initial*'` returns only comments) as a wave-exit criterion, not tsc.

### MEDIUM — No plan updates CLAUDE.md, HANDOFF.md, or writes an ADR; the project's own non-negotiables become false

After this phase, the CLAUDE.md §"Custom fields — invariants" block is actively wrong on at least four points: "the same field is a row in one and a column in the other"; "Every column in `contact_custom_values` is declared TEXT, forever"; "**Never add an index or a UNIQUE constraint** to a column in `contact_custom_values`" (the new table has two: `uid UNIQUE` and `UNIQUE(contact_id, field_def_id)`); and "Route every sort or filter through the single `sortExpr()` helper" (still true in name, changed in mechanism). HANDOFF §14.1/§14.2/§14.5/§14.11 likewise. No plan's `files_modified` touches `CLAUDE.md`, `HANDOFF.md`, `docs/decisions/`, or `docs/systems/`.

`.planning/ROADMAP.md:58-60` already records the supersession, but agents read CLAUDE.md, not the roadmap, and CLAUDE.md's rules are framed as non-negotiable. A future agent that "enforces" the stale invariant will fight the new schema. This also matters for the graph: CLAUDE.md's ADR-bridge section requires `docs/decisions/adr-registry.ts` regeneration when an ADR lands, and no ADR is being written for the single largest reversal in the project.

### MEDIUM — Migration cost is unbounded and unmeasured, behind a bare spinner

Plan 01 mandates "Mint exactly one `deps.newUid()` per pair," which forces row-by-row `INSERT`s (a set-based `INSERT … SELECT` cannot call `newUid()`), plus per-cell byte-for-byte validation. For `C` contacts × `D` definitions that is O(C·D) statements plus O(C·D) validation reads, all inside one transaction, on-device. `16-UI-SPEC.md:154` mandates the existing bare `ActivityIndicator` with no progress affordance, and Plan 01's own criteria forbid adding one.

At the owner's stated scale (HANDOFF §10: "seven to eight active contacts") this is trivial. But the `product-not-personal-app` posture applies: a public user with 500 contacts × 20 fields is 10,000 inserts plus 10,000 validation reads. No plan states a measured or estimated bound, and no plan's device UAT measures upgrade duration. A multi-minute silent spinner is indistinguishable from a hang, and the migration is the one moment where a user force-quitting is most likely.

### MEDIUM — `modified_at` provenance for migrated rows is an unresolved assumption feeding Phase 17's merge

`16-RESEARCH.md` A3 flags this as an assumption ("Risk if wrong: A future reconciliation may need a different documented migration timestamp policy") and Plan 01 adopts it without escalating. Legacy `contact_custom_values.modified_at` is **one timestamp per contact** covering all fields (`src/db/migrations/001-initial.ts:148-153`). Fanning it out means:
- every field of a contact claims the same `modified_at`, so a field edited two years ago and one edited yesterday are indistinguishable to Phase 17's newest-edit-wins Merge;
- **blank rows derived from an existing legacy row inherit that timestamp**, asserting "this blank was written at time T" when it never was.

This is a one-way persisted decision (D-02's whole purpose is Phase 17 reconciliation), and it's exactly the sort of thing the roadmap's "do not let Phase 16 pre-decide Phase 17" warning was meant to catch. Also: `created_at` for migrated rows is never specified in any plan.

### MEDIUM — Plan 01 is one 8-file task covering the most dangerous code in the phase

Plan 01 Task 2 is a single task that writes migration 006 + its fixture, rewrites `field-values-dao.ts`, converts two unrelated test files' fixtures, registers `TARGET_VERSION 6`, and changes `App.tsx` bootstrap classification — with `estimate.confidence: low`. The migration alone deserves to be a task (and arguably a plan) whose diff can be read in isolation. Bundling the DAO rewrite in means the irreversible artifact and the reversible refactor share one commit boundary and one review.

Relatedly: **all seven plans self-report `estimate.confidence: low`.** For a forward-only migration on unreachable devices, that is worth flagging to the owner rather than accepting silently.

### MEDIUM — The normalized read must filter by the passed `defs`, and no plan says so

`16-RESEARCH.md`'s illustrative query is `SELECT d.col_name, v.value … WHERE v.contact_id = ?` — unfiltered by definition. The current contract is narrower: `src/db/field-values-dao.ts:63-87` takes a `defs: CustomFieldDef[]` argument and returns keys **only** for those defs. Callers rely on that: `src/db/contact-read.ts:196-200` passes `defsForEditForm(defs)` (quarantine-excluded), and `src/db/ai-context-read.ts:166` passes `sharedDefs` (`share_with_ai === 1` only). An unfiltered normalized read would return quarantined and non-shared values in the map. `ai-context-read.ts:168-176` iterates `sharedDefs` so egress is still safe by accident — but that is one refactor away from a privacy regression, on the one path that leaves the device. Plan 01's "Preserve pure placement selectors and the col_name-keyed compatibility map" doesn't state the filter requirement.

### LOW — Plans 01 and 05 both own `contact-read.test.ts` and `ai-context-read.test.ts`

Plan 01 `files_modified` lists both; Plan 05 lists both again ("Build on the Plan 01 direct normalized fixture conversion"). Sequential execution is configured (`PROJECT.md` Constraints: "sequential (parallelization off)"), so this is benign in practice, but it's a shared-file ownership overlap between a wave-1 and a wave-2 plan, and the wave metadata implies they could run concurrently.

### LOW — The Node-18 blocker cited throughout is stale

`16-RESEARCH.md` Environment Availability marks Node "✗ too old in this shell — `v18.19.1`; `node:sqlite` import fails", `16-VALIDATION.md` carries it as a Wave-0 item, and all seven plans prefix every verify command with "Node 22+:". This shell reports `v22.22.2`, and I ran `npx vitest run src/db/field-values-dao.test.ts src/db/field-ddl.test.ts` → **2 files, 27 tests, all passing in 416ms**. The gating is already satisfied; the prefixes are harmless but the Wave-0 checkbox is noise.

### LOW — Plan 01's truth statement about the bootstrap gate is inaccurate

Plan 01 `must_haves.truths`: "**Only** a classified migration-integrity failure blocks navigation." `App.tsx:205-217` already blocks navigation on **any** bootstrap error (`if (error)` → themed error view, navigator unmounted). Classification changes the *copy*, not the gating. `16-UI-SPEC.md:157` gets this right ("Other bootstrap failure … Preserve the generic `Couldn't start Orbit` error state"); the plan's phrasing does not.

### LOW — `col_name` reuse after permanent delete becomes more load-bearing, and no plan addresses it

D-09 elevates `col_name` to "immutable internal compatibility key" serving three roles at once: the value-map key, the `field_history.field_col_name` key, and the custom-photo filename (`cv-<contactId>-<col>.jpg`). But `makeColName` uniquifies against *existing* defs (`src/db/col-name.ts:62`), so once a def row is deleted its `col_name` is free to be reissued. A new field can then inherit up-to-30-days-old `field_history` rows and collide with a stale photo file under the same name. This is pre-existing behavior, not introduced here — but the phase makes `col_name` the *only* remaining identity thread, which is the moment to note it.

### LOW — `purge-photo-cleanup.test.ts` is in Plan 06's verify command but not its `files_modified`

Plan 06 Task 1 runs `npm test -- src/db/purge-dao.test.ts src/services/photos/purge-photo-cleanup.test.ts`. That second file pins itself to schema v1 (`src/services/photos/purge-photo-cleanup.test.ts:59` — `runMigrations(exec, [migration001], 1, …)`), so it will pass trivially without exercising v6 at all. It gives the appearance of coverage it does not provide. (Same pinning protects `001-initial.test.ts:25` and `reserved-columns.test.ts:35` from breaking — which is good, but Plan 06 Task 2's "derive from the actual version-six literal tables" requires changing that last one's fixture to run all six migrations, which the plan does imply.)

---

## 4. Suggestions

1. **Fix the pair-row rule in one place and propagate it verbatim.** Pick one: *every definition including quarantined* (recommended — it makes D-03 a true invariant and makes restore free), and write it identically into Plan 01 (migration), Plan 02 (create-contact), and Plan 03 (create-definition). Add a cross-plan regression: quarantine a field → create a contact → restore the field → assert the pair row exists and an edit round-trips.

2. **Mandate UPSERT semantics on the value write, not bare UPDATE.** Specify `INSERT … ON CONFLICT(contact_id, field_def_id) DO UPDATE SET value=excluded.value, modified_at=excluded.modified_at` — the `uid` stays on the INSERT branch only, exactly mirroring the existing UID contract at `field-values-dao.ts:120-124`. This makes the missing-row class of bug self-healing instead of silently lossy.

3. **Add `src/screens/CustomFieldsScreen.tsx` to Plan 03's `files_modified`** (for the `isFieldEmpty` call at line 114) and audit the other five DAO calls it makes for signature drift. Consider keeping `isFieldEmpty`/`preflight*` keyed on the def *object* (`Pick<CustomFieldDef,"id"|"col_name">`) rather than a bare id — the screen already passes full defs at lines 184/189/228/294, so a widened `Pick` keeps those call sites source-compatible.

4. **Split Plan 07 Task 2 into two device runs and name the APK variant for each.** (a) Success path: release APK over populated v5 data, per runbook §1. (b) Failure path: **debug** APK + Metro (runbook §2), using `run-as` to write the malformed legacy DB — and say so explicitly, citing runbook §3's caveat so the executor doesn't rediscover it at the checkpoint. Also drop "sort/filter parity" from the observation list, or replace it with what's actually observable.

5. **Escalate the brick risk to the owner as its own checkpoint option.** Frame it as: *non-loss* inconsistencies (orphan column, no def) — fail closed and brick, or log + snapshot to `field_history` + proceed? Whichever way it goes, revise `16-UI-SPEC.md:138`: "Please reopen the app" is misleading for a deterministic permanent failure. Something that names the state honestly and doesn't promise a support channel that doesn't exist.

6. **Replace tsc-as-completeness-gate with a grep assertion.** Add to each wave's exit criteria: `rg -n 'contact_custom_values' src/ --glob '!**/migrations/001-initial*' --glob '!**/*.test.ts'` returns only comment lines. That is the only check that actually enumerates the writers, and CLAUDE.md already tells you the graph won't do it for you.

7. **Add a documentation plan (or a task on Plan 07).** Update CLAUDE.md §"Custom fields — invariants", HANDOFF §14 (as a superseding note, not an edit — §14 is a decision record), and write `docs/decisions/ADR-NNN-normalized-custom-field-values.md` with the rejected alternatives (dual-read mode, JSON column, keeping DDL). Then regenerate `docs/decisions/adr-registry.ts` and rebuild the graph with `npm run graph:build`. Cite the ADR number in a comment in `006-normalize-custom-field-values.ts` so the code→ADR edge actually exists.

8. **Pin down `modified_at`/`created_at` provenance explicitly, and record it where Phase 17 will find it.** State in the migration file header and in the Plan 01 summary: migrated rows carry the legacy row's `modified_at` (contact-wide granularity, not per-field), no-source blanks carry `deps.now`, `created_at` = `<chosen value>`. Phase 17's Merge must know this or it will trust a timestamp that means something different from what it thinks.

9. **Bound the migration cost and prove it.** Add an assertion to Plan 07 Task 1's fixture at a realistic upper bound (e.g. 200 contacts × 15 defs) and record wall-clock in the UAT. If it exceeds a few seconds, that's an owner conversation about the spinner, not a silent acceptance.

10. **State the `defs`-filtering requirement in Plan 01's normalized read contract**, with an explicit test: a quarantined def's value and a non-`share_with_ai` def's value must not appear in the maps returned to `getContactForEdit` and `readSharedFields` respectively.

11. **Re-scope Plan 04 Task 2 honestly.** Either mark it as forward-looking (`sortExpr` is latent; this preserves the helper's contract for its first consumer) and drop the parity claims, or move the sort work out of Phase 16 entirely. If it stays, add the `field_def_id` join constraint to the helper's documented contract — that's the part a future consumer will get wrong.

12. **Reconsider Plan 04's `depends_on: [16-03]`.** Its real dependency is 16-01 (the table + DAO); `field-type-change.ts` has no relationship to `field-ddl.ts`. Moving it to wave 2 shortens the window in which retype/preflight are runtime-broken against the new schema.

---

## 5. Risk Assessment

**Overall: HIGH.**

Not because the plans are bad — the research quality is well above average and the migration protocol is sound — but because the blast radius is maximal and several findings land directly on it:

- The change is **forward-only against unreachable devices** with no backend, no remote repair, `allowBackup="false"`, and no shipped export (Phase 17 comes *after* this). There is exactly one recovery mechanism in the entire system — `field_history` — and it is pruned at 30 days.
- Two of the HIGH findings (**quarantined-def pair rows**, **bare-`UPDATE` edit path**) compose into a *silent* data-loss route: no exception, no log, no user-visible error — a value typed into the edit form simply doesn't persist. Silent loss is the worst class of bug for a phase whose entire justification is "preserve every existing value."
- One HIGH (**`CustomFieldsScreen.tsx`**) means an unowned production file gets modified by executor deviation rather than by plan, on the screen that drives every custom-field lifecycle action.
- One HIGH (**Plan 07 device UAT**) means the phase's final gate — the only proof that real device data survives — is unexecutable as specified, so it will either be improvised at the checkpoint or quietly downgraded.
- The **fail-closed brick** is a deliberate, owner-sanctioned tradeoff, but its worst case (permanent unrecoverable lockout on a *non-loss* discrepancy) has not been put in front of the owner in those terms, and CLAUDE.md puts risk posture in the owner's bucket.

Mitigating factors are real and worth weighting: the runner's per-step transaction is already proven and tested; the `node:sqlite` harness makes the actual SQL testable rather than mocked (I ran the existing suite green on Node 22.22.2 in 416ms); D-05's refusal of a dual-write mode removes the largest class of divergence bug; and the phase is deliberately scheduled "before more than test data exists," which is exactly the right time to do this.

**Recommendation:** resolve the four HIGH findings and the tsc-gate MEDIUM before execution starts — items 1, 2, 3, 4, and 6 are all small, mechanical plan edits. Escalate item 5 (brick posture) and the `modified_at` provenance question (item 8) to the owner as explicit decisions rather than letting them ride inside Plan 01's blanket authorization checkpoint. The documentation gap (item 7) can land with Plan 07 but should not be dropped — CLAUDE.md's custom-field invariants going stale is how the *next* phase gets this wrong.
