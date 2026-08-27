---
phase: 18
review_cycles: [1, 2]
reviewers: [claude, codex]
reviewed_at: 2026-08-26T00:00:00-05:00
plans_reviewed: [18-01-PLAN.md, 18-02-PLAN.md, 18-03-PLAN.md, 18-04-PLAN.md, 18-05-PLAN.md, 18-06-PLAN.md, 18-07-PLAN.md, 18-08-PLAN.md, 18-09-PLAN.md, 18-10-PLAN.md]
cycle_2_plans_reviewed: [18-01-PLAN.md, 18-02-PLAN.md, 18-03-PLAN.md, 18-04-PLAN.md, 18-05-PLAN.md, 18-06-PLAN.md, 18-07-PLAN.md, 18-08-PLAN.md, 18-09-PLAN.md, 18-10-PLAN.md, 18-11-PLAN.md]
models:
  cycle_1_claude: "claude-opus-5"
  cycle_1_codex: "gpt-5.6-terra (reasoning=low)"
  cycle_2_claude: "not declared in supplied review artifact"
  cycle_2_codex: "not declared in supplied review artifact"
model_sources:
  cycle_1_claude: "explicit gate-test invocation"
  cycle_1_codex: "banner"
  cycle_2_claude: "/tmp/orbit-phase18-cycle2-20260826/claude.out contains no model banner"
  cycle_2_codex: "/tmp/orbit-phase18-cycle2-20260826/codex-run/gsd-review-codex.md contains no model banner"
cycle_2_sources:
  claude: "/tmp/orbit-phase18-cycle2-20260826/claude.out (successful direct read-only review, 114 lines)"
  codex: "/tmp/orbit-phase18-cycle2-20260826/codex-run/gsd-review-codex.md (successful flagless review, 37 lines)"
---

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
| H2 | HIGH | Orrery's Unbound-sun self fallback was assigned to `orrery-read.ts`, which does not own the policy. | Incorporated in 18-03 Tasks 1–2: header exposes `trackingEnabled`; `sun-occupant-logic.ts`, its test, and OrreryScreen own the single fallback predicate. `sun-picker-read.ts` is pinned Bound-only. |
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
| L14 | LOW | `sun-picker-read.ts` lifecycle behavior was undecided. | Incorporated in 18-03 Task 2: Bound-only candidates, retaining never-contacted Bound candidates. |
| C-L1 | LOW | 18-10 Task 3 routed through its decision checkpoint rather than the builder. | Incorporated in 18-10 Task 3: route to Task 2's builder. |

## Cycle 2 source-coverage audit

| Source | Item | Covered by | Status |
|---|---|---|---|
| GOAL | First-class methods and non-destructive Bound/Unbound lifecycle without authoritative system contacts. | 18-01 through 18-11, with 18-08 final evidence ledger. | COVERED |
| REQ | CDN-01 normalized ordered methods, actionability, and no scalar authority. | 18-01, 18-02, 18-04, 18-06, 18-07, 18-08, 18-10. | COVERED |
| REQ | CDN-02 lifecycle, durable cadence invariant, preservation, and Bound-only behavior. | 18-01, 18-02, 18-03, 18-05, 18-06, 18-07, 18-09, 18-11. | COVERED |
| REQ | CDN-03 dedicated Unbound browsing plus Bound-only proactive surfaces and explicit AI. | 18-03, 18-05, 18-06, 18-09, 18-11. | COVERED |
| REQ | CDN-04 lossless normalized graph, tombstones, external-link provenance, and non-destructive restore. | 18-01, 18-02, 18-07, 18-08, 18-10. | COVERED |
| RESEARCH | Parser boundary, FK-safe v9 rebuild, lifecycle SQL guards, nullable status fragments, and complete consumer audit. | 18-01, 18-02, 18-03, 18-08. | COVERED |
| RESEARCH | Mergeable external links/provenance, portable v1-to-v2 migration, restore reconciliation, and deletion evidence. | 18-01, 18-07. | COVERED |
| CONTEXT | Zero-to-many methods; Bound/Unbound cadence invariant; preserved history/rank; active-link uniqueness; source non-authority; all stated deferrals. | 18-01, 18-02, 18-03, 18-04, 18-05, 18-07, 18-08. | COVERED |

No non-deferred source item is unplanned. The dossier deferrals remain out of plan scope.

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
