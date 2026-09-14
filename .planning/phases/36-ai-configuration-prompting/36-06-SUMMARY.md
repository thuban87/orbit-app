---
phase: 36-ai-configuration-prompting
plan: 06
subsystem: ai-personalization
tags: [react-native, sqlite, prompt-engineering, openrouter, accessibility, vitest]

requires:
  - phase: 36-01
    provides: migration-029 Writing Style columns and personalization_sections table
  - phase: 36-02
    provides: cached OpenRouter model pricing and context-length metadata
  - phase: 36-03
    provides: permission-gated contact context and no-silent-truncation prompt contract
provides:
  - durable structured Writing Style and ordered personalization-section CRUD
  - subordinate DATA-fenced prompt personalization with enabled as the sole egress gate
  - selected-model token, context-window, overflow, and OpenRouter input-cost estimates
  - accessible personalization editor with detached text import and debounced estimates
affects: [36-07-ai-generation, 36-08-backup-format, 36-09-settings-integration, compose-ai]

actuals:
  tokens: 20704
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - structured global personalization rendered only through resolvePrompt DATA fences
    - cached selected-model metadata drives local estimates without keystroke network access
    - imported personalization files become detached SQLite text records

key-files:
  created:
    - src/db/personalization-dao.ts
    - src/ai/context-estimate.ts
    - src/screens/AIPersonalizationScreen.tsx
    - src/screens/ai-personalization-logic.ts
  modified:
    - src/ai/prompt-template.ts
    - src/ai/prompt-types.ts
    - src/screens/ComposeScreen.tsx
    - src/ai/model-catalog-filter.ts
    - src/backup/phase-17-integration.test.ts

key-decisions:
  - "Structured Writing Style supersedes the legacy raw style note; the legacy field remains only as a compatibility fallback when structured style is absent."
  - "Enabled is the only personalization-section egress gate, while display order is deterministic organization and never implies semantic weighting."
  - "Context estimates use the selected model's cached real capacity; unknown direct/custom capacity remains unknown instead of inventing a product ceiling."
  - "LiteLLM max_input_tokens is stored separately from max_output_tokens so prompt capacity and generation output limits cannot be confused."

patterns-established:
  - "Personalization egress: read durable global style and sections, then pass them through the sole resolvePrompt builder."
  - "Estimate UI: debounce local recomputation, keep the stale value visible, and never refresh remote metadata per keystroke."

requirements-completed: [AICFG-06, AICFG-07]

coverage:
  - id: D1
    description: "Structured Writing Style and ordered personalization sections persist locally with custom values, detached imports, stable reorder, and enabled as the sole gate."
    requirement: AICFG-06
    verification:
      - kind: unit
        ref: "src/db/personalization-dao.test.ts#Writing Style and personalization section CRUD"
        status: pass
    human_judgment: false
  - id: D2
    description: "The immutable prompt contract renders structured style and only enabled sections as bounded DATA blocks without the retired 6,000-character omission governor."
    requirement: AICFG-06
    verification:
      - kind: unit
        ref: "src/ai/prompt-template.test.ts#structured personalization and no fixed total ceiling"
        status: pass
    human_judgment: false
  - id: D3
    description: "Token estimates compare unchanged prompt text with the selected model's real window, expose overflow, and calculate cached OpenRouter input cost."
    requirement: AICFG-07
    verification:
      - kind: unit
        ref: "src/ai/context-estimate.test.ts#selected-model capacity, overflow, and pricing"
        status: pass
    human_judgment: false
  - id: D4
    description: "The personalization screen exposes structured controls, paste/import editing, enablement, accessible ordering, and a debounced estimate that retains stale output while recomputing."
    requirement: AICFG-06
    verification:
      - kind: unit
        ref: "src/screens/ai-personalization-logic.test.ts#debounce, estimate source, and Move controls"
        status: pass
      - kind: other
        ref: "npm run check:colors"
        status: pass
    human_judgment: true
    rationale: "Long-body wrapping, native document picking, switch treatment, and physical accessibility operation require end-of-phase device UAT."

duration: 33min
completed: 2026-09-14
status: complete
---

# Phase 36 Plan 06: AI Personalization and Context Estimate Summary

**Durable structured writing preferences and ordered local context now feed the immutable AI prompt, with cached-model capacity, explicit overflow, OpenRouter cost, and an accessible editor**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-14T07:45:03Z
- **Completed:** 2026-09-14T08:17:32Z
- **Tasks:** 3
- **Files modified:** 14 implementation/test files

## Accomplishments

- Added transactional SQLite CRUD for structured Writing Style and ordered, enableable personalization sections, including detached `.txt`/`.md` content import.
- Retired the artificial total-prompt governor while preserving per-value abuse bounds, immutable output instructions, byte identity, and disabled-section non-egress.
- Added local selected-model token/capacity estimates, explicit overflow guidance, cached OpenRouter input-cost calculation, and direct-provider `max_input_tokens` catalog support.
- Built the personalization settings surface with structured controls, accessible Move actions, local import/replace, debounced stale-preserving estimates, and theme-token-only colors.

## Task Commits

1. **Task 1 RED: personalization DAO tests** — `5a34ff5` (test)
2. **Task 1 GREEN: durable personalization DAO** — `602d96e` (feat)
3. **Task 2 RED: prompt and context-estimate tests** — `cb7602f` (test)
4. **Task 2 GREEN: structured prompt and model-capacity estimate** — `991e93c` (feat)
5. **Task 3: personalization settings surface** — `3a139d7` (feat)
6. **Rule 1 fix: classify deletion policy until backup v5** — `a066bc4` (fix)

## Files Created/Modified

- `src/db/personalization-dao.ts` — transactional Writing Style and ordered-section persistence, detached import, and atomic combined edits.
- `src/db/personalization-dao.test.ts` — round-trip, reorder, enablement, deletion, and import-copy coverage.
- `src/ai/prompt-template.ts` — structured style/section DATA blocks and preserved permitted context without a fixed total governor.
- `src/ai/prompt-types.ts` — closed personalization inputs on the prompt context projection.
- `src/ai/context-estimate.ts` — deterministic local token, selected-window, overflow, and cost calculation.
- `src/ai/context-estimate.test.ts` — capacity, unchanged-prompt, price, unknown-cost, and Unicode estimation tests.
- `src/ai/model-catalog-filter.ts` — direct-provider published input/context windows kept separately from output limits.
- `src/screens/AIPersonalizationScreen.tsx` — Writing Style, section authoring/import/reorder, and estimate UI.
- `src/screens/ai-personalization-logic.ts` — node-pure debounce, estimate-source, caption, and move logic.
- `src/screens/ComposeScreen.tsx` — production prompt resolution now reads the durable global personalization records.
- `src/backup/phase-17-integration.test.ts` — explicit non-mergeable bridge until Plan 36-08 adds personalization to backup format v5.

## Decisions Made

- Structured Writing Style is authoritative. The retired raw template remains a compatibility fallback only when a caller supplies no structured style, preventing two active personalization mechanisms.
- Personalization section order is stable presentation order only; the immutable instruction explicitly gives sections equal weight.
- The estimator returns the original prompt unchanged and reports true selected-model overflow. It never truncates or substitutes an arbitrary capacity when metadata is unknown.
- OpenRouter price/capacity uses its cached catalog row. Direct providers consume LiteLLM's published `max_input_tokens`; Custom reports cost unavailable and no guessed capacity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Wired durable personalization into production Compose generation**

- **Found during:** Task 2
- **Issue:** Adding resolver inputs and a settings surface alone would leave the actual generation caller on the legacy style-only path.
- **Fix:** Compose now reads Writing Style and all personalization sections and passes them through the sole `resolvePrompt` call; disabled-section filtering remains inside the prompt builder.
- **Files modified:** `src/screens/ComposeScreen.tsx`
- **Verification:** prompt and Compose integration suites pass; `npx tsc --noEmit` is clean.
- **Committed in:** `991e93c`

**2. [Rule 2 - Missing Critical] Preserved direct-model prompt capacity in the existing catalog**

- **Found during:** Task 3 estimate wiring
- **Issue:** The LiteLLM filter retained only output limits, so direct-provider estimates could not use the selected model's known real input window.
- **Fix:** Added a separate optional context-window map populated from published `max_input_tokens`, preserving compatibility with older cached catalogs.
- **Files modified:** `src/ai/model-catalog-filter.ts`, `src/ai/model-catalog-filter.test.ts`
- **Verification:** model-catalog tests, TypeScript, and personalization estimate tests pass.
- **Committed in:** `3a139d7`

**3. [Rule 1 - Bug] Classified personalization deletion in the backup hard-delete policy**

- **Found during:** repository-wide verification
- **Issue:** The integration backstop correctly rejected `DELETE FROM personalization_sections` because the table is not yet emitted by backup format 4.
- **Fix:** Classified the table as intentionally non-mergeable only until Plan 36-08 adds its already-planned format-v5 serialization and restore path; no unsupported tombstone type was invented.
- **Files modified:** `src/backup/phase-17-integration.test.ts`
- **Verification:** `src/backup/phase-17-integration.test.ts` passes 3/3; the repository suite excluding the pre-existing Orrery collection failure passes 3,465/3,465.
- **Committed in:** `a066bc4`

**Total deviations:** 3 auto-fixed (2 Rule 2, 1 Rule 1)
**Impact on plan:** All three changes were required to connect the feature to real generation, honor direct-model capacity, and preserve the repository's backup invariants. No product scope was added.

## Issues Encountered

- The complete `npm test -- --run` invocation still reaches the pre-existing Phase 30 collection failure in `src/components/orrery/orrery-controls-render.test.tsx` (`SyntaxError: Unexpected token 'typeof'`). After fixing the one Plan 36-06-caused backup-policy regression, the suite excluding only that known file passed 365 suites and 3,465 tests. The focused 48 tests, `npx tsc --noEmit`, and `npm run check:colors` pass. The unrelated dirty Phase 30 review files and `tsconfig.json` were preserved unchanged and the known failure is recorded in `deferred-items.md`.

## Known Stubs

None. Placeholder strings are input affordances; no empty/mock data source or deferred runtime implementation was introduced.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 36-07 can consume the explicit context-overflow category in the generation/error surface.
- Plan 36-08 owns portable serialization and restore of Writing Style and personalization sections, replacing the temporary explicit non-mergeable policy.
- Plan 36-09 can register this screen in Settings navigation and run physical-device layout/import/accessibility UAT.

## Self-Check: PASSED

- All four primary created artifacts exist on disk.
- All six task/deviation commits exist in git history.

---
*Phase: 36-ai-configuration-prompting*
*Completed: 2026-09-14*
