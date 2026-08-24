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

---

# Cycle 2 Re-Review (2026-08-24T20:07:07Z)

Revised plans (8 plans, re-waved) re-reviewed by codex + claude opus 5. **Both reviewers: all five cycle-1 HIGHs RESOLVED at the data-safety level.** Codex overall risk HIGH (on a D-03 claim-precision point + a codex-sandbox Node false-positive); Claude overall risk **MEDIUM (down from HIGH)** — remaining items are execution-sequencing, all mechanical, none touching a recorded decision.

## Orchestrator adjudication (cycle 2)

- **Must fix before execute (mechanical):** HIGH-1 (Plan 02 first-tsc gate cannot pass — cycle-1 shared-file-overlap fix moved contact-read.test.ts + ai-context-read.test.ts, which import the retired 6-arg upsertValue, into wave-3 Plan 05, behind Plan 02's gate; Plan 02 <verification> prose is false — confirmed by `tsc --listFiles`); MEDIUM-2 (Plan 03 Task 1 tsc gate fails before Task 2 fixes CustomFieldsScreen:114); MEDIUM-3 (Plan 04 must WIDEN preflight `Pick` to `id|col_name`, keep object param — a literal 'replace with fieldDefId' re-breaks CustomFieldsScreen:184,189 in a plan that doesn't own the screen; order-sensitive vs Plan 03); MEDIUM-5 (runtime UPSERT omits `created_at NOT NULL` → self-healing INSERT branch throws).
- **Must land before Plan 08 writes immutable ADR-001:** MEDIUM-4 — orphan `field_history` snapshot is a bounded 30-day local trace with no read surface + excluded from backup (D-10); Plan 01 header + ADR-001 Consequences must state it is NOT a recovery mechanism. Codex's photo-orphan MEDIUM is the same class (Plan 03 falsely claims contact-purge deletes orphaned photo files — `purge-photo-cleanup.ts:71-98` only enumerates surviving defs).
- **Codex NEW HIGH (D-03 not DB-enforced):** downgraded to claim-precision. No SQL constraint enforces lower-bound cardinality; UNIQUE(contact_id,field_def_id) enforces at-most-one, seeding at all creation points + UPSERT maintain existence. Claude verified the invariant is continuous with no fourth writer. Fix = make the plan/ADR wording honest about HOW D-03 holds; NOT a data-safety hole, NOT a reversal of D-03.
- **Codex Node-18 'NOT RESOLVED':** FALSE POSITIVE from codex's own ephemeral sandbox. Verified this environment is Node v22.22.2 and `node:sqlite` works; cycle-1 Claude ran the suite green here. Residue: stale line `16-VALIDATION.md:24` (non-gating doc) — correct it.
- **LOW-6 → OWNER-BUCKET (pending decision):** 'contact support' promise removed from the classified copy still lives in the app-wide generic bootstrap branch (`App.tsx:211-213`, preserved verbatim). Plans strictly comply with D-06a; extending the fix is a scope/copy call for the owner.
- **Other LOWs (planner bucket, incorporate or defer):** LOW-7 (`createContactWithInteraction` exported path bypasses seeding — no prod caller today; add a guard comment + ADR note); LOW-8 (`hasCustomValues` becomes universally true — keep unrendered, state shape); LOW-9 (reserved-columns drift guard goes vacuous at v6 — re-point or delete-with-reason); LOW-10 (Plan 02 'retain newUid for interactionUid' also needs the links draft uid at EditContactScreen:257); Plan 02 grep-gate wording contradiction (codex LOW).

## Codex Review (cycle 2)

## Summary

Most cycle-1 findings are substantively addressed: lifecycle callers, UPSERTs, wave ordering, release/debug UAT separation, privacy filtering, migration evidence, and documentation are now explicitly planned. However, I would not approve execution yet: the revised plan still does not make D-03’s *complete* contact×definition matrix database-enforced, and it contains a real Node-version verification blocker.

## Resolution status of prior findings

| Finding | Status | Evidence |
|---|---|---|
| Quarantine → create → restore could leave a live field without a pair row | **RESOLVED** | Plan 02 now seeds rows for *all* definitions, including quarantined ones, and requires the end-to-end regression; Plan 03 correctly keeps restore metadata-only because the pair already exists. This fixes the actual current hole: [`restoreField`](../home/bwales/projects/orbit-app/src/db/field-defs-dao.ts:181) only clears `quarantined_at`. |
| `CustomFieldsScreen.tsx` uncovered `isFieldEmpty` caller | **RESOLVED** | Plan 03 owns the screen and changes the current string call at [`CustomFieldsScreen.tsx:114`](/home/bwales/projects/orbit-app/src/screens/CustomFieldsScreen.tsx:114) to `d.id`, matching the planned bound-ID query. |
| Malformed-fixture UAT impossible on release APK | **RESOLVED** | Plan 07 correctly separates silent success on release from malformed-fixture checks on debug + Metro + `run-as`, exactly matching the runbook’s restriction that release is not `run-as` debuggable. [`desktop-build-pipeline.md:193`](/home/bwales/projects/orbit-app/docs/runbooks/desktop-build-pipeline.md:193) |
| Wave ordering versus TypeScript gate | **RESOLVED** | Plan 02 is now wave 2 and owns the first `tsc`; Plans 03–06 depend on it before their own gates. This matches the current stale write contract in [`contacts-dao.ts:171`](/home/bwales/projects/orbit-app/src/db/contacts-dao.ts:171). |
| Bare `UPDATE` could silently lose a missing pair-row edit | **RESOLVED** | Plan 01 mandates pair-keyed UPSERT, including first-write, clear-to-NULL, and uid-preservation tests. This retains the current self-healing property of [`upsertValueCore`](../home/bwales/projects/orbit-app/src/db/field-values-dao.ts:126). |
| `created_at` provenance unspecified | **RESOLVED** | Plan 01 defines and tests it: use legacy row `modified_at` for source-derived pairs; `deps.now` for synthesized blanks. This is necessary because legacy rows only have `modified_at`. [`001-initial.ts:148`](/home/bwales/projects/orbit-app/src/db/migrations/001-initial.ts:148) |
| `tsc` cannot find string-literal legacy SQL writers | **PARTIALLY RESOLVED** | Plan 07 adds the correct runtime grep gate after all writers migrate. But Plan 02 still calls itself the producer of that grep assertion and names Task 2 “tsc + grep,” while its own action says it cannot pass until wave 3. [`16-02-PLAN.md:62`](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-02-PLAN.md:62), [`16-02-PLAN.md:121`](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-02-PLAN.md:121) |
| `sortExpr()` parity claims were vacuous | **RESOLVED** | Plan 04 now explicitly treats it as latent/forward-looking and removes the parity claim. That matches its current zero-consumer status. [`field-sort.ts:44`](/home/bwales/projects/orbit-app/src/db/field-sort.ts:44) |
| No ADR / CLAUDE / HANDOFF update | **RESOLVED** | Plan 08 owns ADR-001, the invariants update, and an appended HANDOFF supersession note. |
| O(C×D) migration behind spinner unmeasured | **RESOLVED** | Plan 07 adds a 200×15 upper-bound fixture, timing, recording, and owner escalation if slow. |
| Normalized read might widen AI egress | **RESOLVED** | Plan 01 requires defs-filtered maps; Plan 05 proves edit and AI exclusions. This targets the current allowlist path in [`ai-context-read.ts:158`](/home/bwales/projects/orbit-app/src/db/ai-context-read.ts:158). |
| Permanent delete of a photo definition can orphan files | **PARTIALLY RESOLVED** | Plan 03 records an explicit bounded-local-orphan decision, but it incorrectly says contact purge will still delete those files. It will not: cleanup only enumerates *surviving* photo definitions. [`purge-photo-cleanup.ts:69`](/home/bwales/projects/orbit-app/src/services/photos/purge-photo-cleanup.ts:69) |
| v5-only migration proof | **RESOLVED** | Plan 07 adds v1/v4/v5 → v6 runner coverage. This matches the runner’s pending-version behavior. [`runner.ts:43`](/home/bwales/projects/orbit-app/src/db/migrations/runner.ts:43) |
| Plan 01/05 test-file overlap | **RESOLVED** | Plan 01 no longer owns the contact/AI read test files; Plan 05 is sole owner. |
| Stale Node-18 blocker | **NOT RESOLVED** | The revised plans assert Node 22 is present, but this shell is Node `v18.19.1`, and `require("node:sqlite")` fails. The validation artifact also still records that Node 18 cannot run this harness. [`16-VALIDATION.md:24`](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-VALIDATION.md:24), [`node-sqlite.ts:6`](/home/bwales/projects/orbit-app/src/db/__testkit__/node-sqlite.ts:6) |
| Inaccurate bootstrap-gate truth | **RESOLVED** | Plan 01 now correctly says classification changes copy only; both classified and generic failures keep navigation unmounted, matching [`App.tsx:205`](/home/bwales/projects/orbit-app/App.tsx:205). |
| `purge-photo-cleanup.test.ts` falsely appears to cover v6 | **RESOLVED** | Plan 06 explicitly identifies the v1 pin and places genuine v6 purge coverage in `purge-dao.test.ts`. The pin is real. [`purge-photo-cleanup.test.ts:59`](/home/bwales/projects/orbit-app/src/services/photos/purge-photo-cleanup.test.ts:59) |

## New concerns

- **HIGH — D-03 is still not database-enforced as claimed.** The proposed `UNIQUE(contact_id, field_def_id)` constraint prevents duplicate rows, but cannot require a row for every extant contact×definition pair. Plan 01/02/03 seed rows through application code, which fixes supported flows but is explicitly not “the database, not application convention alone.” The migration schema needs an enforceable lower-bound strategy or the plans must not claim D-03 is database-enforced. [`16-01-PLAN.md:57`](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-01-PLAN.md:57), [`16-02-PLAN.md:96`](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-02-PLAN.md:96)

- **MEDIUM — The accepted photo-orphan documentation contains a false assurance.** After permanently deleting a populated photo definition, its files cannot be enumerated by later contact purge because `listDefs(... includeQuarantined: true)` cannot return a deleted definition. The plan should say those files remain until a future cleanup mechanism, or actually add that cleanup; it must not claim purge removes them. [`16-03-PLAN.md:94`](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-03-PLAN.md:94), [`purge-photo-cleanup.ts:83`](/home/bwales/projects/orbit-app/src/services/photos/purge-photo-cleanup.ts:83)

- **LOW — Plan 02’s grep-gate language is internally contradictory.** Its artifact and task name promise a Plan-02 grep assertion, but its action correctly defers it to Plan 07. Remove the earlier wording so an executor cannot treat a guaranteed-failing grep as a required gate. [`16-02-PLAN.md:62`](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-02-PLAN.md:62), [`16-02-PLAN.md:127`](/home/bwales/projects/orbit-app/.planning/phases/16-custom-field-value-normalization/16-02-PLAN.md:127)

## Overall risk: HIGH

The revised plans are much stronger, but the D-03 enforcement gap affects the core irreversible representation, and the stated Node environment cannot run the required migration suite. Resolve those before executing migration 006.

---

## Claude Opus 5 Review (cycle 2)

I've verified the revised plans against the source. Here is the cycle-2 review.

---

# Cross-AI Plan Re-Review — Phase 16 (Cycle 2)

## Summary

The revision does real work. All five cycle-1 HIGH findings are addressed at the **data-safety** level — the pair-row invariant is now stated identically in Plans 01/02/03 and made free at restore, the UPSERT-on-pair mandate closes the silent-loss route, `CustomFieldsScreen.tsx` is owned with a signature audit, the device UAT is split across correctly-named APK variants, and D-06a is threaded through Plan 01, the UI-SPEC copy, and Plan 07's debug run. The new Plan 08 closes the documentation gap, and Plan 04's honest re-scoping of `sortExpr` is exactly right.

What remains is not data-safety design — it is **execution sequencing**. Two of the revision's own edits create hard gates that cannot pass as written, and one of them (HIGH-1) was caused directly by the fix for a cycle-1 LOW. On a forward-only migration that matters more than usual: a plan that stalls on a red `tsc` mid-wave invites an executor to "fix it by deviation" on the value-write path, which is the exact code the phase exists to get right.

I confirmed the migration protocol itself is sound, and found one reassuring fact neither cycle-1 review noted: **both** the loss-bearing and orphan-column states D-06/D-06a arbitrate are practically unreachable in production, because `createField` (`src/db/field-ddl.ts:78-102`) and `dropFieldColumns` (`:113-137`) each perform their def-write and their DDL inside one transaction. Neither branch is a live hazard; both are correct safety valves.

---

## Resolution status of cycle-1 findings

### HIGH

**(1) Quarantine→restore leaves a live field with no pair row (D-03) — RESOLVED.**
The rule is now stated identically at all three creation points: migration (`16-01` Task 2 — "EVERY definition including quarantined ones"), create-contact (`16-02` Task 1 — `listDefs(includeQuarantined: true)`), and create-definition (`16-03` Task 1 — "every existing contact (including archived)"). `restoreField` correctly stays metadata-only, matching `src/db/field-defs-dao.ts:181-193`, which nulls `quarantined_at` and backfills nothing. The cross-plan regression (quarantine → create → restore → edit round-trips) is in `16-02` Task 1 *and* re-run end-to-end in `16-07` Task 1.

I checked for a **fourth** creation point the plans might have missed. There are exactly two production writers of a `contacts` row: `contacts-dao.ts:133` (`createContactFull`) and `recency-dao.ts:358` (`createContactWithInteraction`). `CaptureScreen.tsx:485`'s inline name-only create routes through `createContactFull`, so it inherits the matrix for free. See **NEW LOW-7** for the second writer.

**(2) `CustomFieldsScreen.tsx` uncovered caller — RESOLVED.**
It is now in `16-03`'s `files_modified` with a dedicated Task 2. The cited call site is accurate: `src/screens/CustomFieldsScreen.tsx:114` — `empties[d.id] = await isFieldEmpty(exec, d.col_name);`. I verified the audit claim ("only the isFieldEmpty arg changed") holds against the other five call sites: `applyTypeChange` at `:228` and `deleteOrQuarantineField` at `:294` pass object literals already carrying `id`; `preflightTypeChange` (`:184`) and `preflightOptionsChange` (`:189`) pass the full `CustomFieldDef`. See **NEW MEDIUM-3** for the condition that has to hold in Plan 04 for that to stay true.

**(3) Plan 07 malformed-fixture impossible on a release APK — RESOLVED.**
Split into Task 2 (release, runbook §1) and Task 3 (debug + Metro, runbook §2, with `run-as`). The runbook citation is accurate: `docs/runbooks/desktop-build-pipeline.md:193-196` states "The `app-release.apk` is NOT `run-as`-debuggable… works **only on a DEBUG APK**." Task 3 names `assembleDebug`, cites the caveat by section, and adds the D-06a orphan observation alongside the loss-bearing one.

**(4) Wave ordering vs the `tsc` gate — PARTIALLY RESOLVED.**
Plan 02 is now the sole first `tsc` gate and 03/04/05/06 all depend on it. The *production* caller analysis is correct. But two test files that `tsc` does compile were moved out of Plan 01 into wave-3 Plan 05, and Plan 02's verification block asserts, incorrectly, that they don't exist. See **NEW HIGH-1**.

**(5) Bare `UPDATE` = silent data loss — RESOLVED.**
`16-01` Task 3 mandates `ON CONFLICT(contact_id, field_def_id) DO UPDATE`, forbids bare `UPDATE` by name, adds the `rg "ON CONFLICT\(contact_id\)"`-returns-nothing criterion, and tests the missing-row INSERT case. Propagated into `16-02` Task 1. The design is sound against the existing UID hazard documented at `src/db/field-values-dao.ts:26-36`: because each write mints a *fresh* uid, the pair-conflict path takes DO UPDATE and the discarded uid can never collide on `uid UNIQUE`. One gap in the column list — see **NEW MEDIUM-5**.

### MEDIUM / LOW

| Cycle-1 finding | Status |
|---|---|
| `created_at` unspecified for migrated rows | **PARTIALLY RESOLVED** — provenance is now precise for the migration (`16-01` Task 2, asserted for both a source-derived row and a synthesized blank, recorded in the summary for Phase 17). The **runtime** UPSERT column list still omits it → **NEW MEDIUM-5**. |
| `tsc` can't see string-literal SQL writers → need a grep gate | **RESOLVED.** I ran `16-07` Task 1's exact command. It returns 11 executable lines today across `field-ddl.ts`, `field-type-change.ts`, `purge-dao.ts`, `field-defs-dao.ts`, `field-values-dao.ts` — all five files are owned by Plans 01/03/04/06, so the gate is achievable and complete. |
| `sortExpr()` has zero runtime consumers → parity claims vacuous | **RESOLVED.** `16-04` Task 2 drops the parity claim, and `16-07` Task 2 explicitly drops the unperformable UAT observation. Verified: `src/db/field-sort.ts:44-45` says so itself, and `dashboard-read.ts` has no custom-field sort branch. The added `field_def_id`-join requirement in the JSDoc contract is the right call. |
| No ADR / CLAUDE.md / HANDOFF update | **RESOLVED.** Plan 08 covers all three. Verified `docs/decisions/` does not exist — Plan 08's "first global ADR, directory created here" is accurate. Deferring the `adr-registry.ts` / `graph:build` step is correct: neither the registry, `scripts/normalize-graph-docrefs.ts`, nor the npm scripts exist yet, and CLAUDE.md requires porting them from quest-board first. |
| Unbounded O(C·D) migration behind a bare spinner | **RESOLVED.** `16-07` Task 1 adds the 200×15 upper-bound fixture with recorded wall-clock, plus the observed duration in the release UAT, and routes a slow result back to the owner as a spinner conversation. |
| Normalized read must filter by passed `defs` (AI-egress privacy) | **RESOLVED.** Now a `must_haves` truth in `16-01`, a threat row (T-16-17), a test in `16-01` Task 3, and an explicit "ABSENT from the returned map" assertion at *both* consumers in `16-05`. Correctly targets the real code: `contact-read.ts:196-200` passes `defsForEditForm(defs)`; `ai-context-read.ts:158-166` passes `sharedDefs`. |
| Orphaned photo files on permanent delete | **RESOLVED as a documented decision.** Verified genuinely pre-existing: `purge-photo-cleanup.ts:71-98` enumerates surviving defs by `col_name`, and today's `dropFieldColumns` already deletes the def before that adapter could see it. Planner's bucket. Recorded in-file and in ADR-001. |
| v5-centric migration proof | **RESOLVED.** `16-07` Task 1 parameterizes v1/v4/v5 → v6 through the real runner. |
| Plan 01/05 shared-file overlap | **RESOLVED** — and this fix is what produced **NEW HIGH-1**. |
| Stale Node-18 blocker | **RESOLVED.** Confirmed `v22.22.2`; every plan's `<verification>` now states it and drops the provisioning step. |
| Plan 01 bootstrap-gate truth inaccurate | **RESOLVED.** The new wording ("both keep the navigator unmounted; classification changes the copy only, not the gating") matches `App.tsx:205-217`, and the plan's `~205-217` line reference is correct. |
| `purge-photo-cleanup.test.ts` v1-pinned → false coverage | **RESOLVED.** Verified the pin at `src/services/photos/purge-photo-cleanup.test.ts:59` — `runMigrations(exec, [migration001], 1, …)`. `16-06` notes it, routes real v6 coverage through `purge-dao.test.ts`, and records the caveat in the summary. |

*Also resolved but not on your list:* Plan 01 is no longer one 8-file task (now checkpoint + migration + DAO + App, 6 files); the `modified_at`/`created_at` provenance is now explicit and handed to Phase 17.

---

## New concerns

### HIGH-1 — Plan 02's first-`tsc` gate cannot pass; its verification block asserts a claim that is false against the source

`16-02` Task 2 verifies with `npx tsc --noEmit` and its `<verification>` states: *"It passes here because the only typed caller of the changed value-write API was contacts-dao."*

That is not true. `tsconfig.json` includes `**/*.ts`, and I confirmed with `npx tsc --noEmit --listFiles` that both of these are in the program:

- `src/db/contact-read.test.ts:23,229` — `import { upsertValue } …` / `await upsertValue(exec, id, uid(), "nickname", "Eddie", NOW)`
- `src/db/ai-context-read.test.ts:17,163,164,224,247` — same legacy 6-arg contract

`16-01` explicitly retires that export ("The legacy `upsertValue(...)` / `upsertValueCore` contract is RETIRED") and forbids a compatibility overload (D-05). So at Plan 02 Task 2, `tsc` fails with an unresolved import in two files **owned by Plan 05, which is wave 3** — after Plan 02.

This is cycle-1 HIGH #4 surviving in a narrower form, and it was introduced by the fix for cycle-1 LOW "Plan 01/05 shared-file overlap": moving those two test files wholesale to Plan 05 removed the overlap and simultaneously moved them behind the gate that needs them.

**Fix (small):** either (a) return the *import/call-site* conversion of `contact-read.test.ts` and `ai-context-read.test.ts` to Plan 01 or Plan 02 while leaving the richer fixture/assertion work in Plan 05, or (b) move Plan 05 to wave 2 alongside Plan 02 and make Plan 02's tsc gate the joint wave-2 exit. Either way, Plan 02's `<verification>` prose must be corrected — as written it will convince an executor that a red `tsc` is a bug in its own work.

### MEDIUM-2 — Plan 03 Task 1's own `tsc` gate cannot pass before Task 2 runs

`16-03` Task 1 re-keys `isFieldEmpty` to `(exec, fieldDefId: number)` and verifies with `… && npx tsc --noEmit`. But the sole production caller, `src/screens/CustomFieldsScreen.tsx:114`, still passes `d.col_name` (a string) until **Task 2** fixes it. Task 1's project-wide typecheck therefore fails on the file the next task owns.

Under the execute-plan HARD GATE protocol, a task with failing acceptance criteria blocks the next task and, after two fix attempts, is logged as a deviation — so this either stalls the plan or gets papered over. Same class as cycle-1 HIGH #2, relocated from plan-scope to task-scope.

**Fix:** drop `npx tsc --noEmit` from Task 1's verify (keep the targeted Vitest run) and let Task 2's existing `npx tsc --noEmit && npm run check:colors` be the plan's single compile gate — or merge the one-line screen edit into Task 1.

### MEDIUM-3 — Plan 04 must *widen* the preflight `Pick`, not replace the parameter, or it re-creates the uncovered-caller finding in a plan that doesn't own the screen

`16-04` Task 1 says preflight will read "by bound `field_def_id`", but the current signatures carry no `id`:

- `src/db/field-type-change.ts:95-97` — `preflightTypeChange(exec, field: Pick<CustomFieldDef, "col_name">, target)`
- `src/db/field-type-change.ts:124-126` — `preflightOptionsChange(exec, field: Pick<CustomFieldDef, "col_name">, options)`

Widening to `Pick<CustomFieldDef, "id" | "col_name">` is source-compatible with `CustomFieldsScreen.tsx:184,189` (both pass a full def), so nothing else needs to change. But `16-04` never says "widen the Pick, keep the object parameter," and it does not list `CustomFieldsScreen.tsx` in `files_modified`. A literal reading — `preflightTypeChange(exec, fieldDefId: number, …)` — breaks both call sites in a plan that owns neither the screen nor the fix.

Plans 03 and 04 are both wave 3 with identical `depends_on`, so this is order-sensitive: if 04 lands first, Plan 03 Task 2's acceptance criterion ("no other CustomFieldsScreen call site changed") is already false when it runs.

**Fix:** one sentence in `16-04` Task 1's `<action>`: *"Widen the preflight `Pick` to `"id" | "col_name"` — keep the `field`-object parameter shape so `CustomFieldsScreen.tsx:184,189` stay source-compatible."* And add the same constraint to Plan 03 Task 2's read_first note so the audit has something to check against.

### MEDIUM-4 — The D-06a orphan "snapshot" is a 30-day, UI-inaccessible trace; ADR-001 will record it as if it were preservation

Plan 01 Task 2 snapshots the orphan column's non-NULL values to `field_history` and proceeds. But `src/services/field-sweep.ts:127-135` prunes `field_history` on every launch with `DELETE … WHERE created_at <= datetime('now','localtime','-30 days')`, there is no UI anywhere that reads `field_history`, and D-10 excludes it from backup/sync. So the snapshot is a forensic trace reachable only via `run-as` on a debug build, and it is gone in 30 days.

That is consistent with the owner's D-06a reasoning (an orphan column has no def, so it was never user-visible — "nothing to lose"), and I am not reopening it. The problem is the wording: `16-01`'s truths, the `<threat_model>` row, and especially **Plan 08's immutable ADR-001** will all say "snapshotted to `field_history`," which a Phase-17 reader will reasonably take to mean recoverable.

**Fix:** state the retention property once, in Plan 01's migration header and in ADR-001's Consequences — *"the orphan snapshot is a bounded 30-day local audit trace with no read surface and no backup path; it is not a recovery mechanism."*

### MEDIUM-5 — The runtime UPSERT's column list omits `created_at`, which the table declares `NOT NULL`

`16-01`'s Artifacts section declares `created_at TEXT NOT NULL` on `custom_field_values`. `16-01` Task 3's UPSERT spec names only `value`, `modified_at`, and `uid`:

> "INSERT the pair with a fresh uid on first write; ON CONFLICT(contact_id, field_def_id) DO UPDATE SET value = excluded.value, modified_at = excluded.modified_at (uid on the INSERT branch only)."

An INSERT that omits `created_at` violates the NOT NULL constraint. Because the full-matrix seeding means rows almost always pre-exist, the failing branch is precisely the **self-healing INSERT** that cycle-1 HIGH #5 exists to guarantee — so the missing-row case would trade silent loss for a hard throw. Better than silent, but not the intent, and it would surface as a mid-execution deviation on the phase's most sensitive write.

This is the unfixed half of the cycle-1 `created_at` MEDIUM: the migration's provenance is now precise, the runtime writer's is not.

**Fix:** add `created_at` to the INSERT branch (set from the same `now` as `modified_at`) and state that DO UPDATE never rewrites it — mirroring the uid rule. Add a test that a self-healed INSERT carries both timestamps.

### LOW-6 — The "contact support" promise D-06a removed survives in the generic branch, and Plan 01 locks it in

The revised classified copy (`16-UI-SPEC.md:138`) correctly drops it. But the *generic* branch at `App.tsx:211-213` already reads:

> "Your data is safe and unchanged. Please reopen the app; if this keeps happening, contact support."

`16-01` Task 4's acceptance criterion is "the generic branch is unchanged," and the UI-SPEC mandates preserving it verbatim. So after Phase 16 the app still promises a support channel the project cannot keep — one branch over from the one that was fixed, reachable from any bootstrap failure.

Strictly the plans comply with D-06a, which scoped the correction to the classified body. But the owner's stated reason ("must not promise a support/recovery channel the project cannot keep") applies identically here. Worth surfacing to the owner as a one-line copy decision rather than shipping the contradiction.

### LOW-7 — `createContactWithInteraction` remains an exported contact-creation path that bypasses pair seeding

`src/db/recency-dao.ts:335-388` inserts a `contacts` row and writes no custom values. It has **no production caller** today (test-only: `recency-dao.test.ts`, `impact-read.test.ts`, `ai-context-read.test.ts`, `widget-mark.test.ts`), so it is not a live D-03 hole. But it is exported, un-deprecated, and is exactly the shape of hole D-03 exists to close — and Phase 17's restore path is a plausible future caller. No plan mentions it.

**Fix:** a comment in `recency-dao.ts` (Plan 02 or 03) naming `createContactFull` as the only contact-creation path that satisfies D-03, and a line in ADR-001's Consequences.

### LOW-8 — Purge impact accounting: `hasCustomValues` becomes universally true, and Plan 06 doesn't say what replaces it

`src/db/purge-dao.ts:58,113-122` exposes `hasCustomValues: boolean` from `SELECT EXISTS(… contact_custom_values …)`. Under D-01 every contact gets a row for every definition, so this is `true` for every contact whenever any definition exists. `16-06` Task 1 says "impact accounting reflects the multi-row child" without stating the resulting shape.

Currently harmless — `purge-dao.ts:129-132` records that it is "DELIBERATELY not rendered." But if it becomes a count and is ever surfaced, the confirm dialog would tell a user with all-blank fields that purging destroys "12 custom values." Worth one sentence: keep it unrendered, and say whether it stays a boolean or becomes a non-blank count.

### LOW-9 — The reserved-columns drift guard goes silently vacuous at v6

`src/db/reserved-columns.test.ts:31-46` asserts `RESERVED_COLUMN_NAMES` is a superset of `PRAGMA table_info(contact_custom_values)`. After migration 006 that table is dropped, and `PRAGMA table_info` on a nonexistent table returns zero rows rather than erroring — so half the drift guard passes trivially. `16-06` Task 2 says "derive from the actual version-six literal tables" but doesn't say to re-point that half at `custom_field_values` (or to delete it and say why). Worth being explicit, since the whole reserved-name mechanism becomes vestigial once `col_name` is never a physical column.

### LOW-10 — Factual nit in Plan 02 Task 2

"In `EditContactScreen` retain `newUid` only for `interactionUid`" — the screen also mints a **link** uid at `src/screens/EditContactScreen.tsx:257`. Taken literally, an executor could remove that. The grep criterion targets `rowUid` only, so the gate wouldn't catch it. One word: "retain `newUid` for `interactionUid` **and the links draft**."

---

## Overall risk: **MEDIUM**

Down from HIGH, and I think that is earned rather than generous.

The data-safety design is now sound where it counts. The pair-row invariant is genuinely continuous across all three creation points and I verified there is no fourth production writer. The UPSERT mandate closes the silent-loss route on the correct constraint. The defs-filtered read closes the AI-egress path at both consumers with explicit absence assertions. The proof matrix is realistic — parameterized prior versions, an upper-bound scale run, isolated rollback and orphan cases — and the device UAT is now executable on the right APK variants. The documentation reversal has an owner. And structurally, both states D-06/D-06a arbitrate are unreachable in production because the pre-006 def-write and DDL are already atomic, so the fail-closed brick is a valve, not a live hazard.

What holds it at MEDIUM is that **two hard gates cannot pass as written** (HIGH-1, MEDIUM-2) and a third is order-dependent (MEDIUM-3). On ordinary work that is a scheduling nuisance. Here it is not: the failure mode is an executor hitting a red `tsc` on the value-write path mid-wave, being told by the plan's own prose that this shouldn't happen, and reaching for a deviation on `field-values-dao.ts` — the one file where a wrong call is unrecoverable on a user's device.

**Recommendation:** fix HIGH-1, MEDIUM-2, MEDIUM-3, and MEDIUM-5 before execution starts. All four are mechanical plan edits — a wave move plus three sentences — and none touches a recorded decision. MEDIUM-4 is a one-paragraph honesty correction that must land before Plan 08 writes the immutable ADR. LOW-6 is the only item worth putting in front of the owner as a decision rather than fixing in the plans.

## ⚠ Owner Resolution — cycle 2 (LOW-6)

**D-06b:** Owner chose to FIX the generic branch too. The cycle-3 replan MUST correct the app-wide generic bootstrap error copy (App.tsx generic branch ~211-213 + the `16-UI-SPEC.md` "preserve verbatim" row) to drop the "contact support" promise, consistent with D-06a. See CONTEXT.md D-06b.
