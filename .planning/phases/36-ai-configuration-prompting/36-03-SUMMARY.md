---
phase: 36-ai-configuration-prompting
plan: 03
subsystem: ai-prompting
tags: [ai, privacy, prompt-assembly, react-native, sqlite]

# Dependency graph
requires:
  - phase: 36-ai-configuration-prompting
    plan: 01
    provides: active AI connection and Compose generation lifecycle
  - phase: 35-messaging-ai-compose
    provides: sole prompt resolver and three-variant Compose review flow
provides:
  - "Prompt transmission of every AI-permitted shared Memory and interaction note through bounded DATA fences"
  - "Ephemeral Compose Adjust guidance with quick actions, freeform input, and exactly three revised alternatives"
  - "Removal of the obsolete AI-proposed fuel confirmation writer and UI state"
affects: [36-06, 36-07, 36-08, ai-egress, compose]

# Actuals (#2632)
actuals:
  tokens: 11994
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every permitted Memory and interaction note is independently DATA-fenced and per-value bounded without whole-item omission"
    - "Adjust guidance is request-scoped lifecycle state and remains subordinate to Orbit's immutable prompt contract"

key-files:
  created: []
  modified:
    - src/ai/prompt-template.ts
    - src/ai/prompt-template.test.ts
    - src/ai/prompt-types.ts
    - src/db/ai-context-read.ts
    - src/logic/ai-suggestion-logic.ts
    - src/logic/ai-suggestion-logic.test.ts
    - src/logic/ai-suggestion-compose-integration.test.ts
    - src/screens/ComposeScreen.tsx
    - src/components/FuelEditor.tsx
    - src/db/fuel-dao.ts
    - src/db/fuel-dao.test.ts
    - src/screens/CreateContactScreen.tsx
    - src/screens/EditContactScreen.tsx

key-decisions:
  - "Render each permitted Memory and gated interaction note in its own stable DATA fence; keep only the disclosed per-value abuse bound and never omit whole permitted items to meet the legacy total ceiling."
  - "Keep Adjust guidance in Compose/lifecycle memory only, include the current editor body as source-draft continuity, and reuse the existing exactly-three generation fan-out."
  - "Delete the inert fuel confirmation writer and presentation state while preserving ordinary fuel and Off Limits behavior."

patterns-established:
  - "Permitted-context arrays bypass the legacy TOTAL_LIMIT omission loop; selected-model capacity handling belongs to Plan 36-06."
  - "Temporary user guidance is sanitized, bounded, DATA-delimited, and cannot replace system/privacy/output instructions."

requirements-completed: [AICFG-08, AICFG-09]

coverage:
  - id: D1
    description: "AI-permitted Memories and allow_ai-gated interaction notes are transmitted without Off Limits or Group Notes, preserving byte-identical sole-resolver output"
    requirement: "AICFG-08"
    verification:
      - kind: unit
        ref: "src/ai/prompt-template.test.ts#permitted knowledge and gated note DATA blocks"
        status: pass
      - kind: integration
        ref: "src/db/ai-context-read.test.ts#interaction note consent gate"
        status: pass
    human_judgment: false
  - id: D2
    description: "Compose Adjust applies ephemeral quick-action or freeform guidance and returns exactly three revised alternatives without persistence"
    requirement: "AICFG-09"
    verification:
      - kind: unit
        ref: "src/logic/ai-suggestion-logic.test.ts#ephemeral Adjust lifecycle"
        status: pass
      - kind: integration
        ref: "src/logic/ai-suggestion-compose-integration.test.ts#Adjust generation fan-out"
        status: pass
      - kind: integration
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D3
    description: "The obsolete AI-fuel confirm/dismiss writer, UI state, props, call sites, and tests are removed without changing manual fuel flows"
    verification:
      - kind: unit
        ref: "src/db/fuel-dao.test.ts"
        status: pass
      - kind: other
        ref: "grep confirmFuel|confirmFuelCore|isAiUnconfirmed src/"
        status: pass
    human_judgment: false

# Metrics
duration: 18m
completed: 2026-09-14
status: complete
---

# Phase 36 Plan 03: Prompt Transmission and Ephemeral Adjust Summary

**Consent-gated Contact Knowledge now reaches the sole prompt payload through independent DATA fences, while Compose gains session-only three-option Adjust and the retired AI-fuel confirmation path is gone.**

## Performance

- **Duration:** 18m
- **Started:** 2026-09-14T06:03:37Z
- **Completed:** 2026-09-14T06:21:37Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Serialized all shared Memories and `allow_ai=1` recent-interaction notes into deterministic, sanitized, per-value-bounded DATA blocks. Empty context adds no bytes, permitted arrays are not silently omitted for a fixed total ceiling, and prompt/inspector/payload remain the same deeply frozen string.
- Kept the egress boundary closed: `PromptContext` has no Off Limits shape, the read projection does not read Group Notes, and interaction notes remain strictly gated by `allow_ai === 1`.
- Added a minimal Compose Adjust surface with Shorter, Warmer, More direct, and freeform guidance; Adjust reuses the existing exactly-three variant generation and retains guidance only for the active request/retry lifecycle.
- Removed `confirmFuel`, `confirmFuelCore`, AI-unconfirmed FuelEditor styling/actions, the `onConfirm` prop, its two no-op call sites, and the obsolete tests while leaving generic confirmation components untouched.

## Task Commits

1. **Task 1 RED: Prompt egress behavior coverage** - `e4a7599` (test)
2. **Task 1 GREEN: Permitted Memory and gated-note transmission** - `c15bf14` (feat)
3. **Task 2: Ephemeral Compose Adjust** - `cb05f8a` (feat)
4. **Task 3: Retire AI-fuel confirmation surface** - `f03bc54` (refactor)

**Plan metadata:** committed separately before STATE/ROADMAP closeout.

## Files Created/Modified

- `src/ai/prompt-template.ts` - renders independent permitted-context DATA blocks and the subordinate temporary Adjust block.
- `src/ai/prompt-template.test.ts` - covers empty/idempotent assembly, byte identity, fence sanitization, per-value bounds, adjacency, no whole-item omission, and ephemeral guidance.
- `src/ai/prompt-types.ts` - documents the now-transmitted closed PromptContext fields without adding Off Limits.
- `src/db/ai-context-read.ts` - preserves the strict interaction-note consent gate and Group Note exclusion.
- `src/logic/ai-suggestion-logic.ts` - adds request-scoped Adjust/retry handling without persistence.
- `src/logic/ai-suggestion-logic.test.ts`, `src/logic/ai-suggestion-compose-integration.test.ts` - prove ephemeral guidance continuity and exactly-three generation.
- `src/screens/ComposeScreen.tsx` - provides quick actions and freeform session-only Adjust UI.
- `src/components/FuelEditor.tsx`, `src/db/fuel-dao.ts`, `src/db/fuel-dao.test.ts`, `src/screens/CreateContactScreen.tsx`, `src/screens/EditContactScreen.tsx` - remove the obsolete fuel confirmation surface and its tests/call sites.

## Decisions Made

- **Never trade permitted context for an artificial total ceiling.** Each new value retains the disclosed per-value injection/abuse bound; Plan 36-06 owns selected-model capacity estimation and retirement of the remaining legacy total governor.
- **Treat Adjust as temporary generation input.** Guidance is held in component/lifecycle memory, is subordinate to Orbit's immutable prompt instructions, and is preserved only for an explicit retry of the same request.
- **Keep historical fuel source values inert.** Removing the old confirm path requires no migration and does not widen fuel eligibility or change Off Limits handling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added lifecycle and Compose seam coverage for Adjust**
- **Found during:** Task 2 (Ephemeral Adjust layer)
- **Issue:** Resolver-only tests would not prove that temporary guidance reaches the existing three-variant generation path or remains available on explicit retry without persistence.
- **Fix:** Extended the lifecycle and Compose integration suites alongside the planned prompt-template and screen changes.
- **Files modified:** `src/logic/ai-suggestion-logic.test.ts`, `src/logic/ai-suggestion-compose-integration.test.ts`
- **Verification:** Combined six-suite run passed 89 tests; TypeScript passed.
- **Committed in:** `cb05f8a`

---

**Total deviations:** 1 auto-fixed (1 Rule 2)
**Impact on plan:** Correctness coverage expanded without changing product scope or adding persistence.

## Issues Encountered

- The optional repository-wide test run completed with 3,399 passing tests and one pre-existing Phase 30 Orrery suite collection failure: `src/components/orrery/orrery-controls-render.test.tsx` reports `SyntaxError: Unexpected token 'typeof'`. This plan does not touch that subsystem; the issue is recorded in `deferred-items.md`, and the owner's dirty Phase 30 review files plus `tsconfig.json` were left unchanged.
- Vitest emitted the existing Vite native-config and Node SQLite experimental warnings. All plan-targeted suites passed.

## Known Stubs

None introduced by this plan.

## Threat Flags

None. The device-to-provider and untrusted-text prompt surfaces were declared in the plan threat model and are covered by the closed allowlist, consent gate, DATA fences, sanitization, and sole-resolver identity tests.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run src/ai/prompt-template.test.ts src/db/ai-context-read.test.ts src/logic/ai-suggestion-logic.test.ts src/logic/ai-generate-variants.test.ts src/logic/ai-suggestion-compose-integration.test.ts src/db/fuel-dao.test.ts` - 6 files, 89 tests passed.
- `npx tsc --noEmit` - passed.
- `npm run check:colors` - passed.
- Fuel-specific symbol grep returned no `confirmFuel`, `confirmFuelCore`, or `isAiUnconfirmed` references under `src/`.
- Prompt-shape grep found no Off Limits field/block in the resolver; the sole remaining mention in `prompt-types.ts` documents the pre-existing ranked-fuel exclusion.
- `ai-context-read.ts` contains no Group Event/Group Note query and retains the exact `if (r.allow_ai !== 1)` note gate.
- `git diff --check` - passed.

## Next Phase Readiness

- Plan 36-06 can remove the remaining legacy fixed-total governor and add selected-model context-window estimation without revisiting the permitted-array behavior established here.
- Plan 36-07 can build transparency/permission UI against the now-complete egress projection.
- No external setup or authentication gate blocks subsequent plans.

## Self-Check: PASSED

- Verified every modified key file exists on disk.
- Verified commits `e4a7599`, `c15bf14`, `cb05f8a`, and `f03bc54` exist on `main` in task order.
- Verified the summary's test, typecheck, color, consent-gate, no-Off-Limits, no-Group-Notes, byte-identity, exactly-three-alternatives, and retired-fuel-symbol claims against the current working tree.

---
*Phase: 36-ai-configuration-prompting*
*Completed: 2026-09-14*
