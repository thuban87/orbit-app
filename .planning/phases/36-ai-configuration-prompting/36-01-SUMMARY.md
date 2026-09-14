---
phase: 36-ai-configuration-prompting
plan: 01
subsystem: ai-configuration
tags: [sqlite, zustand, ai, openrouter, securestore, react-native]

# Dependency graph
requires:
  - phase: 24.1-contact-knowledge-foundation
    provides: app_settings singleton and portable-settings DAO foundation
  - phase: 35-messaging-ai-compose
    provides: Compose generation lifecycle and provisional AI availability adapter
provides:
  - "Migration 029 with the complete non-secret Phase-36 AI configuration schema"
  - "Durable multi-connection DAO and Zustand configuration store with lane-stable active selection"
  - "Five-input off/ready/needs-attention derivation with no silent connection or model substitution"
  - "Compose generation promoted from legacy singular settings to the active AI connection"
  - "OpenRouter provider identity across the closed provider contract"
affects: [36-02, 36-03, 36-04, 36-05, 36-06, 36-07, 36-08, 36-09]

# Actuals (#2632)
actuals:
  tokens: 16624
  tasks: 4
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-secret AI connection metadata lives in SQLite while credentials remain provider-scoped in SecureStore"
    - "app_settings stores the active lane as a stable natural key; dangling or empty pointers resolve to Needs Attention"
    - "Generation resolves lane, remembered model, and custom endpoint from one active-connection object"

key-files:
  created:
    - src/db/migrations/029-ai-configuration.ts
    - src/db/migrations/029-ai-configuration.test.ts
    - src/db/ai-connections-dao.ts
    - src/db/ai-connections-dao.test.ts
    - src/stores/ai-config-store.ts
  modified:
    - src/db/database.ts
    - src/db/app-settings-dao.ts
    - src/services/ai-types.ts
    - src/logic/ai-availability.ts
    - src/logic/ai-availability.test.ts
    - src/screens/ComposeScreen.tsx
    - src/services/AiService.ts

key-decisions:
  - "Owner selected approve-retire-ack: omit ai_ack_openrouter and retire acknowledgeProvider under ADR-079 instead of freezing a dead column into migration 029."
  - "ai_active_connection stores a lane, not a row uid; empty and dangling pointers resolve to no active connection."
  - "OpenRouter uses the OpenAI-compatible no-output-cap default in token-budget until a model-specific cap is supplied."

patterns-established:
  - "AI readiness is fail-closed: enabled + active connection + credential + selected available model are all required for Ready."
  - "Connection activation is transactional and preserves the prior active connection if activation fails."

requirements-completed: [AICFG-01, AICFG-02, AICFG-03, AICFG-05]

coverage:
  - id: D1
    description: "Global AI enabled state persists independently of connection metadata and forces availability off without destroying saved configuration"
    requirement: "AICFG-01"
    verification:
      - kind: unit
        ref: "src/logic/ai-availability.test.ts#computeAiAvailability"
        status: pass
      - kind: integration
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Multiple saved connection lanes retain their own remembered model while one lane-stable pointer identifies the active connection"
    requirement: "AICFG-02"
    verification:
      - kind: integration
        ref: "src/db/ai-connections-dao.test.ts#AI connection lifecycle"
        status: pass
    human_judgment: false
  - id: D3
    description: "Switching and failed activation preserve saved lanes, remembered models, and the previously active connection"
    requirement: "AICFG-03"
    verification:
      - kind: integration
        ref: "src/db/ai-connections-dao.test.ts#AI connection lifecycle"
        status: pass
    human_judgment: false
  - id: D4
    description: "Missing credentials, missing or unavailable models, and dangling active pointers resolve to Needs Attention without silent substitution; Compose generation uses the active connection"
    requirement: "AICFG-05"
    verification:
      - kind: unit
        ref: "src/logic/ai-availability.test.ts#computeAiAvailability"
        status: pass
      - kind: integration
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: false

# Metrics
duration: 1h 43m
completed: 2026-09-14
status: complete
---

# Phase 36 Plan 01: AI Configuration & Prompting Tracer Summary

**Migration 029, transactional multi-connection persistence, fail-closed AI readiness, and Compose generation promoted end-to-end to the active connection.**

## Performance

- **Duration:** 1h 43m
- **Started:** 2026-09-14T04:13:15Z
- **Completed:** 2026-09-14T05:56:00Z
- **Tasks:** 4 (one approved migration decision plus three implementation tasks; Task 3 split RED→GREEN)
- **Files modified:** 22

## Accomplishments

- Added forward-only migration 029 with the complete non-secret Phase-36 settings columns, unique connection lanes, personalization sections, pinned writing-style vocabularies, and schema integrity tests.
- Added transactional connection CRUD and active-lane persistence; saved lanes retain their own remembered models, activation failure rolls back, and empty/dangling pointers fail closed.
- Replaced the provisional availability calculation with the five-input off/ready/needs-attention contract and promoted Compose/AiService generation away from legacy singular `AiSettings` provider/model selection.
- Added `openrouter` to the closed provider identity contract while keeping it outside the LiteLLM catalog provider union and omitting the retired acknowledgement column and writer.

## Task Commits

1. **Task 1: Migration 029 AI-configuration schema** - `6df1782` (feat)
2. **Task 2: Reshape provider contract and retire acknowledgement writer** - `2cd954c` (feat)
3. **Task 3 RED: Active-connection and availability behavior tests** - `d34a1f3` (test)
4. **Task 3 GREEN: Promote active AI connections end-to-end** - `1c3a3c3` (feat)

**Plan metadata:** committed separately with STATE/ROADMAP/REQUIREMENTS updates.

## Files Created/Modified

- `src/db/migrations/029-ai-configuration.ts` - additive schema version 29 for AI configuration and personalization.
- `src/db/migrations/029-ai-configuration.test.ts` - migration registration, defaults, CHECK vocabulary, and uniqueness coverage.
- `src/db/database.ts` - registers migration 029 and advances `TARGET_VERSION`.
- `src/db/ai-connections-dao.ts` - transactional lane CRUD, remembered-model persistence, active-pointer handling, and connection resolution.
- `src/db/ai-connections-dao.test.ts` - lane switching, remembered-model round trip, rollback, and dangling-pointer coverage.
- `src/stores/ai-config-store.ts` - durable Zustand facade over SQLite-backed AI configuration.
- `src/logic/ai-availability.ts` - fail-closed five-input readiness derivation.
- `src/logic/ai-availability.test.ts` - off/ready/needs-attention truth-table coverage.
- `src/screens/ComposeScreen.tsx` - availability and generation now source the durable active connection.
- `src/services/AiService.ts` - connection-aware provider construction and selection.
- `src/services/ai-types.ts`, `src/ai/token-budget.ts`, `src/screens/settings-ai-logic.ts` - OpenRouter identity, display name, and deliberate no-cap token behavior.
- Supporting DAO, service, migration-chain, restore, notification, and Settings tests/consumers were updated for the new schema and provider contract.

## Decisions Made

- **Retire the acknowledgement writer and omit `ai_ack_openrouter`.** The owner selected `approve-retire-ack`; this follows ADR-079's explicit retirement path and avoids an irreversible dead column.
- **Use lane identity for the active pointer.** The lane is shared by SQLite metadata and the SecureStore key namespace and survives backup without row-id remapping.
- **Fail closed on every incomplete readiness input.** Orbit does not choose another saved lane or model when the configured selection is unavailable.
- **Leave OpenRouter uncapped by default.** Its OpenAI-compatible adapter uses the provider/model default unless a later model-specific cap is supplied.

## Deviations from Plan

None - plan executed exactly as written. Closed consumers and fixtures outside the headline file list were updated as the plan explicitly required for the provider-contract and schema reshape.

## Issues Encountered

- The workflow incorrectly paused twice after the plan's sole migration decision checkpoint had already been approved. Those pauses caused no code or schema deviation; closeout resumed from the verified commits without repeating implementation.
- Vitest emitted the existing Vite native-config and Node SQLite experimental warnings; all requested suites passed.

## Known Stubs

None introduced by this plan. The Settings hub, OpenRouter OAuth/catalog, personalization UI, permission manager, and backup v5 expansion remain deliberately assigned to Plans 36-02 through 36-09.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run src/db/migrations/029-ai-configuration.test.ts src/logic/ai-availability.test.ts src/db/ai-connections-dao.test.ts` - 3 files, 25 tests passed.
- `npx vitest run src/db/app-settings-dao.test.ts src/screens/settings-ai-logic.test.ts` - 2 files, 118 tests passed.
- `npx tsc --noEmit` - passed.
- `npm run check:colors` - passed.
- Stub scan over the realized diff found no new TODO, FIXME, coming-soon, placeholder, or UI-flowing hardcoded empty-value stub.

## Next Phase Readiness

- Migration 029 is the complete Phase-36 SQLite schema; later Phase-36 plans must not add another PRAGMA migration.
- Plans 36-02 through 36-09 can build OpenRouter, prompt assembly, permissions, connection/model UI, personalization, transparency, backup v5, and Settings reachability on the active-connection contract.
- Credentials remain exclusively in `ai-key-store`/SecureStore; neither migration 029, app_settings, `ai_connections`, nor the Zustand config store contains credential material.

## Self-Check: PASSED

- Verified all created key files exist on disk.
- Verified commits `6df1782`, `2cd954c`, `d34a1f3`, and `1c3a3c3` exist on `main` in the expected order.
- Verified the summary's test, typecheck, color, schema-version, provider-contract, and retired-ack claims against the current working tree.

---
*Phase: 36-ai-configuration-prompting*
*Completed: 2026-09-14*
