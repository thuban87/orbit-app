---
phase: 35-messaging-ai-compose
plan: 05
subsystem: database
tags: [ai-egress, prompt-context, sqlite, privacy, data-minimization, adr-078, adr-107]

# Dependency graph
requires:
  - phase: 35-messaging-ai-compose (35-01)
    provides: Compose tracer + performReachOut handoff; the AI-context egress boundary this plan extends
  - phase: 32-history-insights (migration 025)
    provides: interactions.allow_ai per-interaction gate column (default OFF)
provides:
  - "PromptContext.gatedRecentInteractionNotes? — the ONE new ADR-078 carry-only shape (allow_ai=1 gated notes)"
  - "readPromptContext populates the gated-note shape from the 3 most recent interactions"
  - "Regression fences: off_limits stays out of every AI-facing read; the gated-note shape never serializes this phase"
affects: [36-ai-config, prompt-template-rendering, ai-context-read, fuel-read]

# Actuals (#2632)
actuals:
  tokens: 2600
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Carry-only closed-allowlist extension: add an OPTIONAL field to PromptContext, populate it in the sole projection, but never render it until the owning phase (mirrors sharedMemories?)"
    - "Regression fences over structural egress exclusions so accidental widening fails loudly in CI"

key-files:
  created: []
  modified:
    - src/ai/prompt-types.ts
    - src/db/ai-context-read.ts
    - src/db/ai-context-read.test.ts
    - src/db/fuel-read.test.ts
    - src/ai/prompt-template.test.ts

key-decisions:
  - "Modeled gatedRecentInteractionNotes as ReadonlyArray<string> (note text only) — the minimal egress surface satisfying 'carry the gated note'; date/channel/Tone compact projection deferred with rendering to Phase 36"
  - "Gate applied as LIMIT 3 most-recent interactions THEN allow_ai=1 filter (ADR-078 wording), newest-first, blanks minimized"
  - "Off Limits carried in NO shape (D-14/ADR-107); fuel-read.ts exclusions untouched; no fuel AI-permission column added"

patterns-established:
  - "Carry-only PromptContext extension proven by a prompt-template regression: adding a field does not transmit it because resolvePrompt serializes fields explicitly and never spreads the context"

requirements-completed: [COMP-10]

coverage:
  - id: D1
    description: "PromptContext carries the ADR-078 gated recent-interaction-note shape (note only where interactions.allow_ai=1); empty/blank minimized; newest-first, bounded to 3 most recent"
    requirement: COMP-10
    verification:
      - kind: unit
        ref: "src/db/ai-context-read.test.ts#carries a recent-interaction note ONLY when that interaction's allow_ai=1"
        status: pass
      - kind: unit
        ref: "src/db/ai-context-read.test.ts#orders carried notes newest-first and bounds to the three most recent interactions"
        status: pass
    human_judgment: false
  - id: D2
    description: "Off Limits appears in NO AI-facing shape (positive fuel, gated notes, or any other) — D-14/ADR-107; fuel-read.ts off_limits exclusion unrelaxed with no fuel AI column"
    requirement: COMP-10
    verification:
      - kind: unit
        ref: "src/db/ai-context-read.test.ts#never carries an Off Limits value in ANY AI-facing shape, including the gated notes (D-14 / ADR-107)"
        status: pass
      - kind: unit
        ref: "src/db/fuel-read.test.ts#getRankedFuel returns NO off_limits row for a contact that has one"
        status: pass
      - kind: unit
        ref: "src/db/fuel-read.test.ts#listFuelForEditor IS the one read that surfaces the off_limits row"
        status: pass
    human_judgment: false
  - id: D3
    description: "Group Notes are never carried; the carried gated-note shape does not serialize into the resolved provider payload this phase (carry-only, D-13)"
    requirement: COMP-10
    verification:
      - kind: unit
        ref: "src/db/ai-context-read.test.ts#never egresses a group note at either Allow-AI setting"
        status: pass
      - kind: unit
        ref: "src/ai/prompt-template.test.ts#carries but NEVER serializes the gated recent-interaction-note shape (D-13; Phase 36 owns rendering)"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-09-13
status: complete
---

# Phase 35 Plan 05: AI-Context Egress — Gated Recent-Interaction Note Carry Summary

**Extended the sole closed AI-egress projection to carry ONE new ADR-078 shape — the allow_ai=1-gated recent-interaction note — without widening actual egress, while fencing Off Limits out of all AI egress (D-14/ADR-107) and proving the new shape is carry-only until Phase 36.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-09-13T14:27:00Z
- **Completed:** 2026-09-13T14:33:40Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added `PromptContext.gatedRecentInteractionNotes?` (optional `ReadonlyArray<string>`) — a closed-allowlist, carry-only addition mirroring the `sharedMemories?` precedent, header-commented carry-only-until-Phase-36.
- `readPromptContext` now populates the shape from the 3 most recent interactions, carrying a note ONLY where `interactions.allow_ai = 1`, newest-first, blanks minimized. Group Notes (the `group_events` event-level record) are never read and so are structurally unreachable.
- Off Limits carried in NO AI-facing shape (positive or negative) per D-14/ADR-107 — no `avoidanceConstraints` field, no `fuel` AI-permission column, `fuel-read.ts` exclusions untouched.
- Regression fences: off_limits stays out of `getRankedFuel` while remaining in `listFuelForEditor`; the carried gated-note shape does NOT serialize into the resolved provider payload (proving `resolvePrompt` is untouched and Phase 36 owns rendering).

## Task Commits

Each task was committed atomically:

1. **Task 1: Carry the ADR-078 gated recent-interaction-note shape (TDD)** — `0546254` (test, RED) → `8bc9647` (feat, GREEN)
2. **Task 2: Lock the egress-exclusion invariants (regression fence)** — `4f3b74e` (test)
3. **Task 3: Prove the new shape is carry-only (prompt-template regression)** — `652c706` (test)

_Note: Task 1 is TDD — RED (failing tests) then GREEN (implementation); no refactor commit was needed._

## Files Created/Modified
- `src/ai/prompt-types.ts` - `PromptContext` gains the ONE optional `gatedRecentInteractionNotes?` carry-only field; no off-limits/avoidance shape.
- `src/db/ai-context-read.ts` - `readGatedRecentInteractionNotes` helper (allow_ai=1 gate, 3 most recent, newest-first, blanks dropped) + populate the field in `readPromptContext`.
- `src/db/ai-context-read.test.ts` - New gated-note behavior suite; strengthened Group Notes ban to cover the new shape.
- `src/db/fuel-read.test.ts` - Named egress-exclusion fence (off_limits out of ranked, in editor).
- `src/ai/prompt-template.test.ts` - Carry-only regression (sentinel gated note never in prompt/inspectorDisplay/payload).

## Decisions Made
- **Shape = `ReadonlyArray<string>` (note text only).** The plan and D-13/must-haves narrow this phase to carrying "exactly ONE new shape — the gated recent-interaction NOTE." The fuller ADR-078 compact projection (date/time, channel, Tone) and its rendering are Phase 36's job, so the minimal note-only shape is the lowest egress surface that satisfies the requirement. A future phase that needs richer attribution extends the read then.
- **Gate order: LIMIT 3 most-recent, then allow_ai=1 filter.** Matches ADR-078's "compact projection of the three most recent interactions ... note included only when allow_ai ON": an older allow_ai=1 note outside the 3-row window is not carried.
- **Group child-interaction notes follow the normal per-interaction gate.** Only `group_events.group_note` (the event-level shared record) is banned; it is never read here. A group child's own `interactions.note` is a per-interaction note subject to the same allow_ai gate — consistent with D-08.

## Deviations from Plan
None - plan executed exactly as written. No CLAUDE.md-driven adjustments were needed; the egress surface was not widened beyond the specified ADR-078 shape, and the two production guard files (`prompt-template.ts`, `fuel-read.ts`) were left untouched.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The gated-note shape is carried but NOT rendered; **Phase 36 owns the prompt-template rendering/transmission** of `gatedRecentInteractionNotes` (D-13). The carry-only regression in `prompt-template.test.ts` will fail loudly if that rendering is added prematurely — it must be updated deliberately when Phase 36 implements the serialization.
- Off Limits AI egress is closed (D-14/ADR-107); any future re-widening reverses ADR-107 and is an owner decision.

## Self-Check: PASSED
- `src/ai/prompt-types.ts` FOUND; `src/db/ai-context-read.ts` FOUND (both modified, tsc clean project-wide).
- Commits `0546254`, `8bc9647`, `4f3b74e`, `652c706` all present in `git log`.
- Full verification green: 45 tests across the three touched files pass; `npx tsc --noEmit` exits 0; `git diff 82ec988..HEAD -- src/ai/prompt-template.ts src/db/fuel-read.ts` empty.

---
*Phase: 35-messaging-ai-compose*
*Completed: 2026-09-13*
