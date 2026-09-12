---
phase: 32-interaction-history-insights
plan: 01
subsystem: database
tags: [sqlite, migration, interactions, tone-vocabulary, ai-egress-gate, backup, react-native]

requires:
  - phase: 31-profile-experience
    provides: "profile-presentation migration (schema head 24) — the head+1 this migration follows"
  - phase: 21-interaction-assist-reach-out
    provides: "interaction_assists transport CHECK + markAssistLogged single-writer path"
provides:
  - "Migration 025: interactions.duration (nullable seconds) + interactions.allow_ai (NOT NULL DEFAULT 0 CHECK 0/1)"
  - "Migration 025: Tone value remap (good/fine/hard -> Positive/Neutral/Negative) + channel remap (text/email->Message, call->Call, in-person->In Person); SQL column names stay quality/channel"
  - "app_settings.history_lens ('cycles') + history_cycle_count (10)"
  - "src/db/interaction-vocabulary.ts — the single canonical legacy->new remap (remapLegacyQuality/remapLegacyChannel)"
  - "TouchpointRefineForm extended with Tone, three-channel labels, optional Duration, OFF-by-default Allow-AI toggle"
  - "backup-schema declare-only historyLens/historyCycleCount (restore-accept)"
affects: [phase-32-plan-02-restore-remap, phase-32-plan-03-aggregation, phase-32-plan-04-edit-route, phase-32-plan-05-history-lens, phase-32-plan-07-allow-ai-sparkle, phase-33-group-logging]

actuals:
  tokens: 20050
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Single-source vocabulary map consumed by migration (frozen CASE literals, test-pinned) + live writers"
    - "Additive irreversible migration (ALTER + UPDATE, no rebuild) with jump-from-legacy fixture proof"

key-files:
  created:
    - src/db/interaction-vocabulary.ts
    - src/db/interaction-vocabulary.test.ts
    - src/db/migrations/025-interaction-history-schema.ts
    - src/db/migrations/025-interaction-history-schema.test.ts
  modified:
    - src/db/database.ts
    - src/db/ai-context-read.ts
    - src/db/digest-read.ts
    - src/ai/prompt-types.ts
    - src/db/recency-dao.ts
    - src/db/interaction-assist-dao.ts
    - src/types.ts
    - src/components/TouchpointRefineForm.tsx
    - src/components/touchpoint-refine-logic.ts
    - src/backup/backup-schema.ts

key-decisions:
  - "SQL columns stay named quality/channel (values migrate, names do not) — locked invariant so export-manifest/restore-apply round-trip without a backup-format bump"
  - "Migration CASE arms are frozen literals in the migration file, test-pinned equal to the shared helper but never importing it at runtime"
  - "QualityAggregate keeps internal good/fine/hard field names (= Positive/Neutral/Negative) to hold blast radius; documented in-file"
  - "duration written explicitly through the single recency writer, forcing every DAO-insert test onto schema >= 25"

patterns-established:
  - "Tone/channel vocabulary lives once in interaction-vocabulary.ts; migration + restore + assist writer all consume it"
  - "Consumer lockstep: migration + every live literal-comparing reader ship in one commit (D-06 trip-wire)"

requirements-completed: [HIST-11, HIST-14]

coverage:
  - id: D1
    description: "Migration 025 remaps Tone/channel values, adds duration/allow_ai/history prefs; registered end-to-end (TARGET_VERSION=25)"
    requirement: "HIST-14"
    verification:
      - kind: unit
        ref: "src/db/migrations/025-interaction-history-schema.test.ts"
        status: pass
      - kind: unit
        ref: "src/db/migrations/full-chain.test.ts, src/db/migrations/runner.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Single canonical vocabulary map; migration CASE frozen + test-pinned to the helper"
    verification:
      - kind: unit
        ref: "src/db/interaction-vocabulary.test.ts, 025-interaction-history-schema.test.ts (frozen-CASE pin + source grep)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live literal consumers lockstepped: ai-context aggregate + digest gentle-line count the migrated vocabulary (no silent zero)"
    requirement: "HIST-14"
    verification:
      - kind: unit
        ref: "src/db/ai-context-read.test.ts (jump-from-legacy aggregate), src/db/digest-read.test.ts (migration-regression)"
        status: pass
    human_judgment: false
  - id: D4
    description: "markAssistLogged routes call/text/email through remapLegacyChannel (email->Message never persists a retired value); 014 CHECK intact"
    verification:
      - kind: unit
        ref: "src/db/interaction-assist-dao.test.ts (transport-remap it.each)"
        status: pass
    human_judgment: false
  - id: D5
    description: "duration/allow_ai flow through the single recency writer; deleteTouchpoint tombstone/recompute + forced-failure-preserves-row regression"
    requirement: "HIST-14"
    verification:
      - kind: unit
        ref: "src/db/recency-dao.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "TouchpointRefineForm presents Tone / Message-Call-In Person / optional Duration / OFF-by-default Allow-AI; shaping logic node-tested"
    requirement: "HIST-11"
    verification:
      - kind: unit
        ref: "src/components/touchpoint-refine-logic.test.ts (duration presets, custom bound, none->null, allowAi default 0)"
        status: pass
      - kind: manual_procedural
        ref: "on-device drive of the extended refine form on the Pixel (deferred; device not attached this run)"
        status: unknown
    human_judgment: true
    rationale: "The .tsx widget rendering (Tone picker, duration chips, Allow-AI switch) is device-UAT; node tests cover the pure shaping logic only. Physical Pixel not attached this run."
  - id: D7
    description: "backup-schema declares historyLens/historyCycleCount for restore only; not emitted; BACKUP_FORMAT_VERSION unchanged"
    requirement: "HIST-11"
    verification:
      - kind: unit
        ref: "src/backup/*.test.ts (101 pass); grep confirms keys only in PORTABLE_SETTINGS_KEYS"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-12
status: complete
---

# Phase 32 Plan 01: Interaction history data foundation Summary

**Migration 025 (irreversible, owner-authorized) remaps the interaction Tone/channel vocabulary and adds nullable duration + an OFF-by-default per-interaction Allow-AI gate, with every live literal consumer lockstepped in one commit so no device ever reads a half-renamed vocabulary.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-11T23:44:26Z
- **Completed:** 2026-09-12T00:04:38Z
- **Tasks:** 3 (checkpoint pre-approved)
- **Files modified/created:** 25 files across 2 commits

## Accomplishments
- Shipped migration 025 (TARGET_VERSION 24 -> 25, verified head+1 on disk): additive ALTER+UPDATE only — no table rebuild, no `note` rewrite, no group schema. Tone remap (good/fine/hard -> Positive/Neutral/Negative), channel remap (text/email->Message, call->Call, in-person->In Person), nullable `duration`, `allow_ai INTEGER NOT NULL DEFAULT 0 CHECK(0/1)`, and `app_settings.history_lens`/`history_cycle_count`. Proven with a jump-from-legacy fixture.
- Established `src/db/interaction-vocabulary.ts` as the single canonical remap; the migration's CASE arms are frozen literals test-pinned equal to the helper but never importing it at runtime.
- Lockstepped every live literal-comparing consumer (D-06 trip-wire) in the SAME commit as the migration: `ai-context-read` aggregate and `digest-read` gentle-line now count Positive/Neutral/Negative; `markAssistLogged` routes call/text/**email** through `remapLegacyChannel` so an email assist never persists a retired channel into a v25 row; `interaction_assists` transport CHECK left intact.
- Routed `duration`/`allow_ai` through the single recency writer (insert + editTouchpointFull) with bound params; added a DAO-level `deleteTouchpoint` tombstone/recompute + forced-failure-preserves-row regression.
- Extended `TouchpointRefineForm` with Tone, Message/Call/In Person channel labels, an optional Duration control (5m/15m/30m/1h/2h/Custom/None), and an OFF-by-default Allow-AI toggle; correctness lives in the node-tested `touchpoint-refine-logic.ts`. Declared `historyLens`/`historyCycleCount` restore-only in backup-schema (no emission, no format bump).

## Task Commits

1. **Task 1 (tracer, tdd) + Task 2 (consumer lockstep)** — `eaf5aeb` (feat) — shipped together as ONE commit per the scope_acceptance D-06 trip-wire (migration + every live literal consumer must land atomically so no commit ships a half-renamed vocabulary).
2. **Task 3: extend TouchpointRefineForm + declare-only backup keys** — `d5204d1` (feat)

_Task 1 tracer feedback gate: the migration + full-chain + runner suites were run end-to-end (green) before proceeding — autonomous run, no interactive checkpoint (pure data-layer, no device UI to verify)._

## Files Created/Modified

**Created**
- `src/db/interaction-vocabulary.ts` — single canonical legacy->new remap (frozen maps + pure helpers)
- `src/db/interaction-vocabulary.test.ts` — pins every mapping + pass-through
- `src/db/migrations/025-interaction-history-schema.ts` — the migration (version 25)
- `src/db/migrations/025-interaction-history-schema.test.ts` — jump-from-legacy remap proof + frozen-CASE pin + source discipline

**Modified**
- `src/db/database.ts` — register migration025, TARGET_VERSION=25
- `src/db/migrations/full-chain.test.ts` / `profile-presentation.test.ts` — head snapshots to 25
- `src/db/ai-context-read.ts`, `src/db/digest-read.ts`, `src/ai/prompt-types.ts` — Tone-literal comparisons + docs
- `src/db/recency-dao.ts` — duration/allow_ai through insert + editTouchpointFull
- `src/db/interaction-assist-dao.ts` — remapLegacyChannel at log time
- `src/types.ts` — LastInteractionType documented as unused legacy (excluded from migration)
- `src/components/TouchpointRefineForm.tsx`, `src/components/touchpoint-refine-logic.ts` (+ test) — Tone/channel/duration/Allow-AI
- `src/backup/backup-schema.ts` — declare-only history keys
- Test migration chains bumped to include migration025: `recency-dao`, `interaction-assist-dao`, `ai-context-read`, `impact-read`, `restore-apply`, `widget-mark`, `notification-actions` tests

## Decisions Made
- Checkpoint (irreversible migration authorization) was pre-approved by the owner (option `approved`); executed without pausing. SQL column name `quality` retained (locked invariant, not a choice — there was never a rename option).
- Migration CASE literals frozen in the migration file, test-pinned to the shared helper — the migration cannot drift from the map yet does not depend on it at upgrade time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dependent test migration chains broke when the shared INSERT gained duration/allow_ai**
- **Found during:** Task 2 (recency writer change)
- **Issue:** Adding `duration`/`allow_ai` to `insertInteraction`'s INSERT means every test that inserts an interaction via the DAO at a schema < 25 fails with "no such column". The plan's Task 2 `<files>` under-enumerated these. Per CLAUDE.md "review the code, not the diff," the full set was found by grep.
- **Fix:** Tests using `MIGRATIONS/TARGET_VERSION` from database.ts auto-updated (orrery-exploration, orrery-impact-read, bulk-actions-dao, data-revision-dao, value-history-dao, contacts-dao, merge-dao, purge-dao). Seven hand-rolled-target tests had `migration025` added to their chains (widget-mark + notification-actions also needed `migration002` for the app_settings ALTER).
- **Verification:** Full suite 2962 pass.
- **Committed in:** `eaf5aeb`

**2. [Rule 1 - Bug] Stale head-snapshot assertion in profile-presentation.test.ts**
- **Found during:** Task 2 full-suite run
- **Issue:** `expect(TARGET_VERSION).toBe(PROFILE_PRESENTATION_SCHEMA_VERSION)` pinned profile-presentation as the schema head; it is no longer head after 025.
- **Fix:** Changed to `toBeGreaterThanOrEqual` (the build target includes, not equals, this migration).
- **Committed in:** `eaf5aeb`

---

**Total deviations:** 2 auto-fixed (1x Rule 3, 1x Rule 1). All necessary to keep the atomic migration+consumer landing green. No scope creep.

## Issues Encountered
- Two migration-test harness fixes (not code bugs): node:sqlite `run()` throws synchronously, so a CHECK-rejection assertion needed an async thunk for `.rejects`; and the migration source-discipline grep initially matched the migration's own doc comment (fixed by stripping comments before grepping).

## Pre-existing / Out-of-scope (not fixed — logged)
- `src/components/orrery/orrery-controls-render.test.tsx` fails to LOAD with `SyntaxError: Unexpected token 'typeof'` (a `vi.mock` generic under the current Vite config-loader). It imports none of this plan's files — pre-existing tooling issue. Logged in `deferred-items.md`.
- `tsconfig.json` was already modified in the working tree before this plan; deliberately NOT staged.

## User Setup Required
None - no external service configuration required. Migration 025 applies automatically on next app launch.

## Next Phase Readiness
- Wave-2 promotion gate satisfied: the FULL Plan-01 file set (Tasks 1-3) has landed, so Plans 04 (wraps the extended form), 05 (reads history_lens/history_cycle_count), and 07 (renders the allow_ai sparkle) build against a complete contract.
- Plan 02 (restore-remap) must consume the SAME `src/db/interaction-vocabulary.ts` helpers this plan created — the single source of truth.
- Device UAT of the extended TouchpointRefineForm on the physical Pixel is deferred (device not attached this run); the pure shaping logic is node-proven.

## Self-Check: PASSED
- Created files verified on disk: interaction-vocabulary.ts, 025-interaction-history-schema.ts, touchpoint-refine-logic.ts, 32-01-SUMMARY.md.
- Commits verified in git log: `eaf5aeb`, `d5204d1`.

---
*Phase: 32-interaction-history-insights*
*Completed: 2026-09-12*
