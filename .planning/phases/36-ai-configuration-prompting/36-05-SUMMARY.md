---
phase: 36-ai-configuration-prompting
plan: 05
subsystem: ai-configuration
tags: [react-native, securestore, openrouter, model-catalog, vitest]

requires:
  - phase: 36-01
    provides: durable multi-connection records, active pointer, and availability state
  - phase: 36-02
    provides: OpenRouter OAuth and cached pricing catalog
provides:
  - safe selectable AI connection lanes with SecureStore-only credentials
  - curated-first runtime model picker with OpenRouter pricing and offline cache
  - explicit Needs Attention repair notice with no silent substitution
  - registered OpenRouter OpenAI-compatible generation adapter
affects: [36-09-settings-integration, compose-ai, ai-security]

actuals:
  tokens: 14420
  tasks: 4
  commits: 8

tech-stack:
  added: []
  patterns:
    - activate-on-success connection setup
    - registry-owned runtime curation matched against live catalogs
    - OpenAI-compatible adapter parameterized by fixed public base URL

key-files:
  created:
    - src/screens/AIConnectionScreen.tsx
    - src/screens/ai-connection-logic.ts
    - src/screens/AIModelPickerScreen.tsx
    - src/screens/ai-model-picker-logic.ts
    - src/components/AINeedsAttention.tsx
  modified:
    - src/ai/model-registry.ts
    - src/services/AiService.ts
    - src/services/AiService.test.ts

key-decisions:
  - "A newly credentialed lane remains inactive until a model is explicitly selected; selection then activates that exact lane."
  - "OpenRouter curation is resolved from the runtime catalog by registry policy, so absent models never produce stale cards."
  - "OpenRouter reuses the OpenAI-compatible adapter implementation with its own fixed base URL and per-call SecureStore accessor."

patterns-established:
  - "Connection setup: persist the candidate without moving the active pointer, then activate only after the complete setup succeeds."
  - "Catalog rendering: runtime availability and prices remain authoritative; registry logic supplies ordering and recommendation reasons only."

requirements-completed: [AICFG-02, AICFG-03, AICFG-04, AICFG-05, AICFG-15]

coverage:
  - id: D1
    description: "Connection lanes preserve inactive configuration and activate replacements only after successful credential and model setup."
    requirement: AICFG-03
    verification:
      - kind: unit
        ref: "src/screens/ai-connection-logic.test.ts#AI connection switching"
        status: pass
    human_judgment: false
  - id: D2
    description: "BYOK and custom credentials remain provider-scoped in SecureStore, with custom URLs guard-validated before persistence."
    requirement: AICFG-15
    verification:
      - kind: unit
        ref: "src/screens/ai-connection-logic.test.ts#credential boundary and endpoint guard"
        status: pass
    human_judgment: false
  - id: D3
    description: "The model picker deterministically renders registry-curated runtime models, cached OpenRouter pricing, search, and manual fallback."
    requirement: AICFG-04
    verification:
      - kind: unit
        ref: "src/screens/ai-model-picker-logic.test.ts#curated-first model ordering"
        status: pass
    human_judgment: true
    rationale: "Card wrapping, selected-state clarity, and long model-name layout require end-of-phase device review."
  - id: D4
    description: "Needs Attention maps invalid credentials, expired authorization, unavailable models, and missing connections to explicit repairs."
    requirement: AICFG-05
    verification:
      - kind: unit
        ref: "src/screens/ai-connection-logic.test.ts#Needs Attention repair mapping"
        status: pass
    human_judgment: true
    rationale: "The restrained tonal notice treatment requires end-of-phase device review."
  - id: D5
    description: "An active OpenRouter lane resolves a real adapter and generates through the fixed OpenRouter chat-completions endpoint."
    requirement: AICFG-04
    verification:
      - kind: integration
        ref: "src/services/AiService.test.ts#OpenRouter OpenAI-compatible generation adapter"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-09-14
status: complete
---

# Phase 36 Plan 05: Connection, Model Picker, and OpenRouter Generation Summary

**Safe multi-lane AI setup with SecureStore-only credentials, runtime-priced model selection, explicit repair states, and a working OpenRouter generation adapter**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-14T07:28:32Z
- **Completed:** 2026-09-14T07:41:23Z
- **Tasks:** 4
- **Files modified:** 10 implementation/test files

## Accomplishments

- Added Recommended OpenRouter and Advanced direct/custom connection cards that retain saved configuration and do not displace the working lane during incomplete setup.
- Added a deterministic curated-first model picker backed by live/cached OpenRouter and LiteLLM catalogs, with real OpenRouter pricing, freshness, search, metadata, and manual model entry.
- Added cause-specific Needs Attention repairs and registered OpenRouter as a real OpenAI-compatible generation adapter using its provider-scoped SecureStore key.

## Task Commits

1. **Task 1 RED: connection lane behavior tests** — `b636bbf` (test)
2. **Task 1 GREEN: connection management UI and logic** — `4b30759` (feat)
3. **Task 2: curated runtime model picker** — `0b1e31b` (feat)
4. **Task 3: Needs Attention repair notice** — `38879e1` (feat)
5. **Task 4 RED: OpenRouter adapter tests** — `2b350a6` (test)
6. **Task 4 GREEN: OpenRouter generation adapter** — `f3fdb08` (feat)
7. **Rule 1 fix: defer activation until model selection** — `0d424e4` (fix)

## Files Created/Modified

- `src/screens/AIConnectionScreen.tsx` — connection lane cards, inline setup, safe switching, and deliberate credential removal.
- `src/screens/ai-connection-logic.ts` — node-pure switch state, credential routing, endpoint validation, and repair mapping.
- `src/screens/ai-connection-logic.test.ts` — safe-switch, credential boundary, validation, and repair tests.
- `src/screens/AIModelPickerScreen.tsx` — cached/refreshable model browsing, pricing, metadata, and selection persistence.
- `src/screens/ai-model-picker-logic.ts` — deterministic ordering, filtering, card derivation, and pricing formatting.
- `src/screens/ai-model-picker-logic.test.ts` — stable ordering, absent-curated-id, pricing, search, and direct-lane tests.
- `src/components/AINeedsAttention.tsx` — restrained warning notice with explicit repair action.
- `src/ai/model-registry.ts` — catalog-derived recommendation ordering and reasons.
- `src/services/AiService.ts` — shared OpenAI-compatible configuration plus registered OpenRouter provider.
- `src/services/AiService.test.ts` — OpenRouter request, key boundary, error mapping, and cancellation coverage.

## Decisions Made

- A credential alone is not a valid replacement connection. New OpenRouter/direct setup records the candidate but preserves the prior active pointer until explicit model selection completes.
- OpenRouter recommendation IDs are selected from current cached/live catalog entries by registry policy. The picker never owns a frozen ID or price list.
- The OpenRouter adapter is the existing OpenAI-compatible body/parser/error implementation parameterized with `https://openrouter.ai/api/v1`, avoiding a duplicated network path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented incomplete lanes from replacing a working connection**

- **Found during:** Overall verification after Task 4
- **Issue:** The initial UI activated a newly credentialed OpenRouter/direct lane before it had a selected model, momentarily violating activate-on-success and producing Needs Attention in place of a still-working prior lane.
- **Fix:** New incomplete lanes remain inactive, the model picker persists the explicit model and only then activates the lane, and empty-model rows no longer display the Saved marker.
- **Files modified:** `src/screens/AIConnectionScreen.tsx`, `src/screens/AIModelPickerScreen.tsx`, `src/screens/ai-connection-logic.ts`, `src/screens/ai-connection-logic.test.ts`
- **Verification:** focused 45-test plan suite, TypeScript, and color gate all pass.
- **Committed in:** `0d424e4`

**2. [Rule 2 - Missing critical functionality] Added registry-owned recommendation metadata**

- **Found during:** Task 2
- **Issue:** The existing registry resolved current frontier models but did not expose the recommendation reasons required by the curated-first cards.
- **Fix:** Added runtime-catalog-derived curated references with Balanced, Cost efficient, and Lightweight reasons while keeping availability and prices authoritative in the runtime catalog.
- **Files modified:** `src/ai/model-registry.ts`
- **Verification:** registry and model-picker tests pass; picker contains no hardcoded model IDs or prices.
- **Committed in:** `0b1e31b`

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 2)
**Impact on plan:** Both changes enforce required correctness and catalog ownership without widening product scope.

## Issues Encountered

- The optional repository-wide `npm test` gate still has the pre-existing Phase 30 collection error in `src/components/orrery/orrery-controls-render.test.tsx` (`SyntaxError: Unexpected token 'typeof'`). It passed 3,449 tests across 362 suites before reporting that one unrelated suite. This is recorded in `deferred-items.md`; Plan 36-05's focused 45 tests, `npx tsc --noEmit`, and `npm run check:colors` all pass.

## Authentication Gates

None.

## Known Stubs

None. Navigation registration and the AI Settings entry point remain explicitly owned by Plan 36-09; both new screens expose complete required callback contracts for that integration.

## Threat Flags

None beyond the plan's registered T-36-17 through T-36-20c surfaces. Credentials use only `ai-key-store`, custom endpoints retain the shared validator, and OpenRouter uses a fixed public host.

## User Setup Required

None. Real OpenRouter browser authorization and generation remain user-initiated device actions.

## Next Phase Readiness

- Plan 36-09 can register the connection and model-picker destinations and wire the required navigation callbacks.
- End-of-phase Pixel UAT should cover card wrapping, loading feedback, OAuth redirect, switching/removal, and offline cached catalog rendering. No real generation call should be made without owner clearance.

## Self-Check: PASSED

- All nine plan artifact paths exist.
- All seven implementation/task commits exist in git history.
- Focused plan verification passes 45/45 tests; TypeScript and color gates pass.

---
*Phase: 36-ai-configuration-prompting*
*Completed: 2026-09-14*
