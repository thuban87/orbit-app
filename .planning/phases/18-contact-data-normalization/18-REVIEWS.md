---
phase: 18
reviewers: [claude, codex]
reviewed_at: 2026-08-26T00:00:00-05:00
plans_reviewed: [18-01-PLAN.md, 18-02-PLAN.md, 18-03-PLAN.md, 18-04-PLAN.md, 18-05-PLAN.md, 18-06-PLAN.md, 18-07-PLAN.md, 18-08-PLAN.md, 18-09-PLAN.md, 18-10-PLAN.md]
models:
  claude: "claude-opus-5"
  codex: "gpt-5.6-terra (reasoning=low)"
model_sources:
  claude: "explicit gate-test invocation"
  codex: "banner"
---

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

