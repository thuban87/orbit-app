---
phase: 18
review_cycles: [1, 2, 3]
reviewers: [claude, codex]
reviewed_at: 2026-08-26T00:00:00-05:00
plans_reviewed: [18-01-PLAN.md, 18-02-PLAN.md, 18-03-PLAN.md, 18-04-PLAN.md, 18-05-PLAN.md, 18-06-PLAN.md, 18-07-PLAN.md, 18-08-PLAN.md, 18-09-PLAN.md, 18-10-PLAN.md]
cycle_2_plans_reviewed: [18-01-PLAN.md, 18-02-PLAN.md, 18-03-PLAN.md, 18-04-PLAN.md, 18-05-PLAN.md, 18-06-PLAN.md, 18-07-PLAN.md, 18-08-PLAN.md, 18-09-PLAN.md, 18-10-PLAN.md, 18-11-PLAN.md]
models:
  cycle_1_claude: "claude-opus-5"
  cycle_1_codex: "gpt-5.6-terra (reasoning=low)"
  cycle_2_claude: "not declared in supplied review artifact"
  cycle_2_codex: "not declared in supplied review artifact"
  cycle_3_claude: "claude-opus-5"
  cycle_3_codex: "gpt-5.6-terra (reasoning=low)"
model_sources:
  cycle_1_claude: "explicit gate-test invocation"
  cycle_1_codex: "banner"
  cycle_2_claude: "/tmp/orbit-phase18-cycle2-20260826/claude.out contains no model banner"
  cycle_2_codex: "/tmp/orbit-phase18-cycle2-20260826/codex-run/gsd-review-codex.md contains no model banner"
cycle_2_sources:
  claude: "/tmp/orbit-phase18-cycle2-20260826/claude.out (successful direct read-only review, 114 lines)"
  codex: "/tmp/orbit-phase18-cycle2-20260826/codex-run/gsd-review-codex.md (successful flagless review, 37 lines)"
cycle_3_plans_reviewed: [18-01-PLAN.md, 18-02-PLAN.md, 18-03-PLAN.md, 18-04-PLAN.md, 18-05-PLAN.md, 18-06-PLAN.md, 18-07-PLAN.md, 18-08-PLAN.md, 18-09-PLAN.md, 18-10-PLAN.md, 18-11-PLAN.md, 18-12-PLAN.md]
cycle_3_sources:
  claude: "/tmp/orbit-phase18-cycle3-20260826/claude.out (successful direct read-only review, 23,143 bytes)"
  codex: "/tmp/orbit-phase18-cycle3-20260826/codex-run/gsd-review-codex.md (successful flagless review, 2,384 bytes)"
---

# Cycle 3 aggregate — 2026-08-26 (owner-capped final external cycle)

## Reviewer record

| Reviewer | Invocation/source | Model record | Verdict |
|---|---|---|---|
| Claude | Direct read-only invocation; output at `/tmp/orbit-phase18-cycle3-20260826/claude.out` | `claude-opus-5` | Replan required: 2 HIGH, 5 actionable MEDIUM. |
| Codex | Flagless declared lane; output at `/tmp/orbit-phase18-cycle3-20260826/codex-run/gsd-review-codex.md` | `gpt-5.6-terra (reasoning=low)` | Replan required: 1 additional actionable MEDIUM. |

Claude ran before Codex as required. This is the third and final external cycle authorized by the owner. Do not launch another external reviewer after incorporation; final assessment is the independent internal plan checker plus the explicit residual-risk report.

## Consensus before final internal revision gate

**Open before this replan:** 2 HIGH and 6 actionable MEDIUM concerns. Every concern below must become executable PLAN.md content with named ownership, behavior, acceptance criteria, and targeted verification. This record intentionally does not claim external convergence or that Phase 18 is ready to execute: no external reviewer will re-check the post-cycle-3 plan changes because the review cap has been reached.

## Current finding disposition

| ID | Severity | Finding | Required incorporation |
|---|---|---|---|
| C3-H1 | HIGH | Orrery's `rewriteRingSeq` count/update guards omit the Bound predicate after `listOrbitingContacts` becomes Bound-only, so one contacted Unbound contact makes every reorder throw. | 18-12 Task 2 owns `ring-seq-dao.ts` and its test alongside `orrery-read.ts`: use the same `tracking_enabled = 1` predicate in the COUNT and scoped UPDATE guards; prove reorder succeeds with a contacted Unbound contact; expand 18-08's ledger to all orbiting/favourite-set predicate consumers. |
| C3-H2 | HIGH | Migration 009 rebuilds `app_settings` and relationship children without a proof that all existing columns, defaults, indexes, UNIQUE constraints, and data survive. | 18-01 Task 3 seeds every pre-v9 `app_settings` column with distinctive non-default values, asserts row equality after v9, and checks `PRAGMA table_info` plus `sqlite_master` schema/index/UNIQUE completeness for `app_settings` and each rebuilt child. It evaluates `legacy_alter_table` only as a blast-radius-reduction option; the completeness proof is mandatory whichever route is used. |
| C3-M1 | MEDIUM | The typed `MergeableEntityType`/`TombstoneEntityType` refactor can silently omit non-mergeable `field_history` from purge and Replace-all deletion. | 18-07 Task 2 uses the typed maps plus an explicit exhaustively typed residual owned-table list including `field_history`, preserves FK-safe delete order, and proves in `restore-apply.test.ts` that Replace-all removes seeded history. |
| C3-M2 | MEDIUM | Dashboard first-run detection has no Unbound count, so an all-Unbound user sees “Add your first contact” above an Unbound footer. | 18-05 Task 1 owns `dashboard-empty-logic.ts`/test and Home threading: add `unbound` to `DashboardEmptyInput`, require all five populations to be zero for first-run, and test zero/non-zero Unbound cases. |
| C3-M3 | MEDIUM | Included Unbound Never Contacted rows can render a stale favourite star and active `ContactCard` chrome; `DashboardRow.trackingEnabled` is omitted by the unchecked list cast. | 18-03 Task 2 extends `listNeverContacted` to project `trackingEnabled` and NULL favourite rank for Unbound. 18-05 Task 2 owns `NeverContactedScreen.tsx`/test and requires the neutral Unbound row treatment with no favourite or status ring. |
| C3-M4 | MEDIUM | Backup parsing admits illegal lifecycle/cadence combinations, so restore fails mid-transaction with a raw SQLite CHECK/trigger error instead of `BackupSchemaError`. | 18-07 Task 1 validates `intervalDays` as null or positive integer and `trackingEnabled` as 0/1 with Bound implying non-null cadence; its v1→v2 migration removes retired scalar keys. Task 3 adds negative parse and merge tests proving rejection before apply. |
| C3-M5 | MEDIUM | Streamlined Export lacks a UI-spec copy/state contract, a distinct artifact identity, and device UAT despite being a new PII egress surface. | Before 18-10 execution, update the UI-SPEC copy/state tables. 18-10 Task 2 defines a filename prefix, extension, MIME type, and share-sheet title distinct from backup and tests that no artifact label contains “backup”; 18-08 Task 2 invokes and inspects the streamlined export in device UAT. |
| C3-M6 | MEDIUM | DAO promotion cannot protect direct restore writes from two surviving primary methods of a type. | 18-01 Task 3 creates/tests a partial unique index on `(contact_id, method_type) WHERE is_primary = 1`; 18-07 Tasks 1/3 reject a graph with multiple surviving primaries per `(contactUid, type)` before restore, with migration direct-SQL and backup negative coverage. |

## Final-cycle source-coverage note

Claude read all 12 executable plans and the Phase 18 context/research/dossier/validation/UI/review artifacts; it source-checked migration, query/lifecycle, backup/restore, and UI consumer seams. Codex independently read the same plan set and relevant source seams. Their completed raw reviews remain the authoritative evidence for the detailed source locations above.

# Cycle 2 aggregate — 2026-08-26

## Reviewer record

| Reviewer | Invocation/source | Model record | Scope read |
|---|---|---|---|
| Claude | Direct read-only review at `/tmp/orbit-phase18-cycle2-20260826/claude.out` | The supplied artifact does not declare a model; no model is inferred. | All 11 executable plans, Phase 18 context/research/dossier/validation/UI artifacts, ROADMAP/REQUIREMENTS, and cited migration/query/backup/UI seams. |
| Codex | Flagless review at `/tmp/orbit-phase18-cycle2-20260826/codex-run/gsd-review-codex.md` | The supplied artifact does not declare a model; no model is inferred. | All executable plans plus source seams cited in its review. |

## Consensus before replan

Both reviewers required a replan. The shared release-blocker was that v9's durable cadence rules were demanded from 18-02 but not created by 18-01. Claude additionally found unowned purge/tombstone fan-out and an unowned Unbound-sun fallback. The actionable medium/low findings complete query, backup, test, and handoff ownership; they do not reopen the settled targeted-suite-before-18-08 policy or the two resolved research decisions.

**Open before this replan:** 3 HIGH, 6 actionable MEDIUM, 6 actionable LOW. **Unresolved after incorporation:** 0 HIGH, 0 actionable MEDIUM, 0 actionable LOW. This is a review-incorporation record only; it does not mark Phase 18 planned, converged, or executed.

## Current finding disposition

| ID | Severity | Finding | Evidence-based disposition |
|---|---|---|---|
| H1 | HIGH | Purge did not own normalized child preview counts, tombstones, or explicit fan-out deletes. | Incorporated in 18-07 Task 2: `purge-dao.ts`/test use one typed TombstoneEntityType registry for preview, evidence, and deletion; tests cover methods, external links, and provenance. |
| H2 | HIGH | Orrery's Unbound-sun self fallback was assigned to `orrery-read.ts`, which does not own the policy. | Cycle-2 incorporation began with 18-03’s header `trackingEnabled`; the post-cycle-2 scope split assigns the predicate, its test, OrreryScreen, and Bound-only `sun-picker-read.ts` to 18-12. |
| H3 | HIGH | Bound-plus-NULL and assigned-to-NULL durable guards lacked a migration DDL owner. | Incorporated in 18-01 Task 1/3: two contacts-table CHECKs and an update trigger, with migration direct-SQL tests. 18-02 Task 2 exercises the shipped rules without editing migration 009. |
| M4 | MEDIUM | Search could render Unbound contacted rows as stable and expose dormant favourite rank. | Incorporated in 18-03 Task 2 and 18-05 Task 3: search projects lifecycle plus neutral status/rank; Home consumes lifecycle for neutral rendering. |
| M5 | MEDIUM | Shared nullable-cadence fragments in `status.ts`/`queries.ts` were unowned. | Incorporated in 18-03 Task 2 with source-adjacent tests; 18-08 Task 1 records benchmark.ts as an audited positive-cadence fragment consumer. |
| M6 | MEDIUM | Never Contacted preference could force unowned caller signature changes. | Incorporated in 18-05 Task 2: list/count read the one-row setting inside SQL, preserving existing callers. |
| M7 | MEDIUM | Portable backup did not carry favourite rank despite an unverifiable preservation claim. | Incorporated in 18-07 Task 2: merge restore must not clobber an existing local dormant rank; rank remains intentionally outside the portable v2 wire schema and replace-all makes no rank claim. |
| M8 | MEDIUM | `replaceAllReset` used untyped literal entity lists. | Incorporated in 18-07 Task 2: typed maps derive reset tombstone/delete sequences and replace-all proves all new child tombstones. |
| M9 | MEDIUM | Settings cited the wrong DropdownFieldWidget path. | Incorporated in 18-05 Task 2: corrected to `src/components/field-widgets/DropdownFieldWidget.tsx`. |
| L10 | LOW | 18-07 edited reconciliation without running its suite. | Incorporated in 18-07 Tasks 2–3: both named verification commands include `reconciliation.test.ts`. |
| L11 | LOW | v1 forward migration could fail required-array validation. | Incorporated in 18-07 Task 1: materialize all v2 child/link/provenance/tombstone arrays before validation. |
| L12 | LOW | Derived legacy method UIDs lacked a collision rule. | Incorporated in 18-07 Task 1: fixed `legacy-method:${contactUid}:${type}` format and newUid-shape disjointness test. |
| L13 | LOW | `contact-methods-read.ts` had no named behavior suite. | Incorporated in 18-02 Task 1: adds `contact-methods-read.test.ts` and runs it. |
| L14 | LOW | `sun-picker-read.ts` lifecycle behavior was undecided. | Post-cycle-2 scope split assigns 18-12 Task 2: Bound-only candidates, retaining never-contacted Bound candidates. |
| C-L1 | LOW | 18-10 Task 3 routed through its decision checkpoint rather than the builder. | Incorporated in 18-10 Task 3: route to Task 2's builder. |

## Cycle 2 source-coverage audit

| Source | Item | Covered by | Status |
|---|---|---|---|
| GOAL | First-class methods and non-destructive Bound/Unbound lifecycle without authoritative system contacts. | 18-01 through 18-12, with 18-08 final evidence ledger. | COVERED |
| REQ | CDN-01 normalized ordered methods, actionability, and no scalar authority. | 18-01, 18-02, 18-04, 18-06, 18-07, 18-08, 18-10. | COVERED |
| REQ | CDN-02 lifecycle, durable cadence invariant, preservation, and Bound-only behavior. | 18-01, 18-02, 18-03, 18-05, 18-06, 18-07, 18-09, 18-11, 18-12. | COVERED |
| REQ | CDN-03 dedicated Unbound browsing plus Bound-only proactive surfaces and explicit AI. | 18-03, 18-05, 18-06, 18-09, 18-11, 18-12. | COVERED |
| REQ | CDN-04 lossless normalized graph, tombstones, external-link provenance, and non-destructive restore. | 18-01, 18-02, 18-07, 18-08, 18-10. | COVERED |
| RESEARCH | Parser boundary, FK-safe v9 rebuild, lifecycle SQL guards, nullable status fragments, Orrery population/candidate ownership, and complete consumer audit. | 18-01, 18-02, 18-03, 18-08, 18-12. | COVERED |
| RESEARCH | Mergeable external links/provenance, portable v1-to-v2 migration, restore reconciliation, and deletion evidence. | 18-01, 18-07. | COVERED |
| CONTEXT | Zero-to-many methods; Bound/Unbound cadence invariant; preserved history/rank; active-link uniqueness; source non-authority; all stated deferrals. | 18-01, 18-02, 18-03, 18-04, 18-05, 18-07, 18-08, 18-12. | COVERED |

No non-deferred source item is unplanned. The dossier deferrals remain out of plan scope.

## Post-cycle-2 scope-split record — current executable ownership

This is a checker-required plan-size correction, not a third review cycle and not a convergence claim. It preserves the Cycle 2 evidence/history above while making the current execution contract explicit: 18-03 retains direct header retrieval plus dashboard/search/status/digest/shared-fragment ownership in Wave 2; 18-12 follows in Wave 3 with Orrery population, sun candidates, `sun-occupant-logic`, its test, and OrreryScreen. Settings consumes that predicate in Wave 4. The settled targeted-only verification policy before 18-08 remains unchanged.

## Historical Cycle 1 record — incorporated, not current execution work

# Cross-AI Plan Review — Phase 18

Both reviewers inspected the plans, Phase 18 context/research/dossier, and cited source. Claude's read-only gate test succeeded and produced a full Markdown review; Codex completed flaglessly. This is the consolidated feedback to incorporate before execution.

## Consensus Summary

The policy design is strong: Bound/Unbound remains independent of cadence, proactive surfaces are owned at SQL/query seams, cross-contact canonical matching does not leak authority, and normalized backup/restore is deliberately non-destructive. However, several irreversible or release-blocking details remain underspecified. The plan set must be revised before execution.

### Agreed HIGH Concerns

- **Persisted lifecycle settings lack an owned schema migration.** Both reviewers found that 18-05 introduces `phone_region_override`, `include_unbound_never_contacted`, and `birthday_unbound_enabled`, while `app_settings` is column-based (`src/db/app-settings-dao.ts:280`) and previous settings required `ALTER TABLE` migrations (`src/db/migrations/005-digest-settings.ts:16`). Plan 18-01 must add the columns, explicit defaults, and migration assertions (or 18-05 must get a sequenced migration); 18-07 must round-trip them through backup/restore.

- **Nullable cadence has an unplanned explicit-AI failure path.** `src/db/ai-context-read.ts:224` sends impact inputs to `computeContactIntensity`, and `src/services/impact.ts:123` assumes `intervalDays` is numeric. 18-03 makes that value nullable for never-assigned Unbound contacts while the UI contract retains explicit AI. Assign `ai-context-read.ts`, `impact.ts`, and tests to the relevant plan, specify an Unbound fallback that does not expose method PII, and test dormant-cadence and never-assigned cases.

- **Migration 009 needs an explicit FK-safe parent-table rebuild.** `src/db/database.ts:124` enables foreign keys before migrations, and `src/db/migrations/runner.ts:56` begins a transaction. Rebuilding `contacts` can cascade-delete relationship children or retarget their foreign keys. In 18-01's ratified contract, define the exact safe sequence, require `PRAGMA foreign_key_check`, and use a v8 fixture containing rows for every cascaded child plus an Orrery sun reference, asserting they survive unchanged.

- **Legacy phone canonicalization has no durable region policy.** The migration dependencies only expose `now` and `newUid` (`src/db/types.ts:36`), while the proposed region preference appears later in 18-05. Before irreversible migration, choose and test either an injected migration-time region or raw-only migration followed by a launch-time canonicalization sweep. Do not assume a default country.

- **Pre-Phase-18 backups need a defined v1-to-v2 forward migration.** `BACKUP_FORMAT_VERSION` is 1 and `FORWARD_MIGRATIONS` is empty (`src/backup/backup-schema.ts:19`), while current backups serialize scalar phone/email. 18-07 must bump the version, register a deterministic v1 forward migration to normalized rows, preserve lifecycle defaults, and prove a v1 fixture restores its methods intact.

- **The consumer audit is incomplete.** Add unowned consumers to executable tasks: `src/db/digest-read.ts`, `src/db/contact-status-read.ts`, `src/services/impact.ts`, `src/db/ai-context-read.ts`, and `src/screens/CaptureScreen.tsx`. 18-08 must require an evidence-backed `rg` ledger over all scalar-method and nullable-cadence consumers, rather than a narrow audit.

### Actionable MEDIUM Concerns

- The per-wave full `npm test`/`tsc` gate conflicts with the sequence: wave 2 removes scalar read/input contracts that waves 4–5 consumers still use. Move compatibility shims earlier or state targeted-only gates until the first full-green wave.
- In 18-03, cover Unbound-but-contacted status (`src/db/status.ts`, `dashboard-read.ts`, `contact-status-read.ts`) so it cannot display `stable`; also align `countLiveContacts`/related header counts with the Bound-only list and add parity tests.
- 18-07 must depend on 18-05 (or move portable-settings ownership), include all three settings in its closed allowlist and export/parse tests, and add `src/backup/reconciliation.ts` plus tests because it owns the exhaustive entity-policy type.
- Correct 18-06's nonexistent `src/screens/compose-logic.ts` references to `src/logic/compose-logic.ts` and its test, including validation commands.
- Pin `tracking_enabled INTEGER NOT NULL DEFAULT 1` (or update all writers), since `src/db/recency-dao.ts` and `src/db/benchmark.ts` insert contacts without the proposed field. Update `src/db/reserved-columns.ts` for the new column.
- Specify atomic handling for malformed legacy cadence (zero, negative, non-integer) in migration fixtures; do not leave an implicit repair policy.
- Resolve the Orrery sun policy for an Unbound contact and document it in 18-03.
- 18-10 introduces a contact-data share/export PII egress path beyond roadmap requirements. Add an owner decision checkpoint or explicitly defer it.

### Actionable LOW Concerns

- Fix 18-01's inverted `libphonenumber-js` package-presence gate.
- Complete or deliberately defer the draft/pending sign-offs in `18-VALIDATION.md` so its verification contract matches the final plans.

## Claude Review

Claude assessed risk as **HIGH** because the irreversible migration, region policy, backup compatibility, and consumer audit are not yet fully specified. It confirmed the lifecycle/query-owner policy and UI contract are otherwise well aligned with the source. The findings above retain all of its actionable concerns.

## Codex Review

Codex assessed risk as **MEDIUM**: the architecture is sound but settings-schema ownership and explicit-AI behavior with nullable cadence block safe execution. It also highlighted legacy invalid-cadence handling and the 18-05 → 18-07 portable-settings dependency, incorporated above.
