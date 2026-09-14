---
phase: 36-ai-configuration-prompting
plan: 02
subsystem: ai-openrouter
tags: [openrouter, oauth, pkce, securestore, expo, local-first]

requires:
  - phase: 36-01
    provides: OpenRouter provider identity, multi-connection schema, and SecureStore-compatible provider contract
provides:
  - Strict OpenRouter browser authorization with PKCE S256 and mandatory anti-CSRF state validation
  - Exact orbit://openrouter-auth Android callback routing and SecureStore-only key persistence
  - Separate offline-safe OpenRouter model catalog with live pricing and local-day refresh gating
affects: [36-05, 36-06, ai-settings, ai-generation]

actuals:
  tokens: 9312
  tasks: 3
  commits: 3

tech-stack:
  added: [expo-web-browser, expo-auth-session, expo-crypto]
  patterns:
    - Inject native browser, crypto, fetch, storage, and key-store boundaries for node-pure tests
    - Validate OAuth destination, complete parameter set, and state before exposing or exchanging a code
    - Write catalog snapshots only after a complete response validates

key-files:
  created:
    - src/ai/openrouter-oauth.ts
    - src/ai/openrouter-oauth.test.ts
    - src/ai/openrouter-catalog.ts
    - src/ai/openrouter-catalog.test.ts
  modified:
    - app.config.ts
    - package.json
    - package-lock.json

key-decisions:
  - "OpenRouter callback validation remains fail-closed: a missing or mismatched state is rejected before code exchange, with no PKCE-only fallback."
  - "OpenRouter remains a separate catalog and pricing source; the LiteLLM CatalogProvider union is unchanged."
  - "Catalog models may retain partial metadata, while malformed top-level responses and empty usable catalogs fail without replacing the prior cache."

patterns-established:
  - "Attempt-only OAuth material is generated with expo-crypto, held in function memory, and cleared on every exit path."
  - "OpenRouter catalog reads resolve cache-or-null without throwing; manual or daily refresh throws while preserving the last good snapshot."

requirements-completed: [AICFG-04]

coverage:
  - id: D1
    description: OpenRouter browser authorization uses PKCE S256, exact callback routing, mandatory matching state, one-time code handling, and SecureStore-only key persistence.
    requirement: AICFG-04
    verification:
      - kind: unit
        ref: "src/ai/openrouter-oauth.test.ts (15 tests)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit; npx expo config --type public --json"
        status: pass
    human_judgment: true
    rationale: "The native browser redirect must still be exercised in a new custom dev client on the physical Pixel; a non-echoed state must fail and be escalated, never silently accepted."
  - id: D2
    description: OpenRouter model metadata and decimal pricing cache offline, survive failed refreshes, and refresh at most once per local calendar day unless explicitly requested.
    requirement: AICFG-04
    verification:
      - kind: unit
        ref: "src/ai/openrouter-catalog.test.ts (8 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: Official SDK-57 Expo browser-auth and crypto modules are version-locked in package metadata and the exact callback filter is present in resolved Expo config.
    requirement: AICFG-04
    verification:
      - kind: other
        ref: "npx expo config --type public --json; package-lock inspection"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-14
status: complete
---

# Phase 36 Plan 02: OpenRouter OAuth and Catalog Summary

**Fail-closed OpenRouter PKCE authorization with SecureStore-only credentials and an offline-safe live pricing catalog**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-14T07:11:00Z
- **Completed:** 2026-09-14T07:23:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Installed the three verified SDK-57 Expo modules and registered exact Android callback routing for `orbit://openrouter-auth`.
- Implemented PKCE S256 with expo-crypto, mandatory in-memory state, strict callback rejection, one-time exchange, and provider-scoped SecureStore persistence.
- Added a separate OpenRouter catalog that parses live context/pricing metadata, deduplicates ids, reads cache without throwing, preserves good cache on refresh failure, and gates automatic refresh by local calendar date.

## Task Commits

1. **Task 1 RED: OpenRouter OAuth contract tests** - `9c3ae53`
2. **Task 1 GREEN: OpenRouter OAuth PKCE and native configuration** - `4a9bc90`
3. **Task 2: OpenRouter catalog, pricing, and cache semantics** - `286bb39`

## Files Created/Modified

- `src/ai/openrouter-oauth.ts` - Generates PKCE/state, validates the exact callback, exchanges one code, and stores the returned key through ai-key-store.
- `src/ai/openrouter-oauth.test.ts` - Covers verifier/challenge shape, required state, malicious callbacks, duplicate consumption, exchange shape, and key-store routing.
- `src/ai/openrouter-catalog.ts` - Parses and caches OpenRouter models, context windows, decimal pricing, daily freshness, and input-cost estimates.
- `src/ai/openrouter-catalog.test.ts` - Covers public fetch shape, cache preservation, cache-or-null reads, deduplication, local-day refresh, and pricing math.
- `app.config.ts` - Registers expo-web-browser and the exact browsable OpenRouter callback filter.
- `package.json`, `package-lock.json` - Lock the official SDK-57 Expo auth/browser/crypto modules.

## Decisions Made

- Enforced D-13 exactly: callbacks without one matching state are rejected before exchange; no fallback weakens the control.
- Kept OpenRouter catalog and pricing independent from the direct-provider LiteLLM catalog.
- Retained partial upstream model metadata so later cards can display available fields, while rejecting unusable catalog responses as a whole.

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

- The repository-wide suite passed 3,434 tests but retains the already-recorded Phase 30 collection failure in `src/components/orrery/orrery-controls-render.test.tsx` (`SyntaxError: Unexpected token 'typeof'`). This plan does not touch that subsystem; the focused OpenRouter suites pass 23/23, TypeScript passes, and the color check passes. The existing entry remains in `deferred-items.md`.

## Known Stubs

None.

## User Setup Required

None. Native redirect UAT requires the planned new custom dev-client build during end-of-phase Pixel verification.

## Next Phase Readiness

- Plan 36-05 can wire the connection and model-picker UI to the OAuth/catalog boundaries.
- Plan 36-06 can consume `contextLength`, pricing, and `estimateOpenRouterInputCost` for model-capacity and input-cost presentation.
- Physical-Pixel UAT must confirm the real OpenRouter redirect echoes `state`; if it does not, connection fails by design and requires an owner security-posture decision.

## Self-Check: PASSED

- All seven claimed files exist.
- Commits `9c3ae53`, `4a9bc90`, and `286bb39` exist on the current branch.
- Focused tests pass 23/23; TypeScript, color checks, Biome, and resolved Expo config validation pass.

---
*Phase: 36-ai-configuration-prompting*
*Completed: 2026-09-14*
