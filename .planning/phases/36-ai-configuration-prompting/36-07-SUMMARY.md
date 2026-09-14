---
phase: 36-ai-configuration-prompting
plan: 07
subsystem: ai-transparency-diagnostics
tags: [react-native, sqlite, ai-privacy, prompt-transparency, diagnostics, vitest]

requires:
  - phase: 36-01
    provides: migration-029 AI connection schema and local disclosure marker
  - phase: 36-03
    provides: closed permission-gated prompt context projection
  - phase: 36-05
    provides: active connection and provider generation paths
  - phase: 36-06
    provides: structured Writing Style and personalization prompt inputs
provides:
  - strict allowlisted AI diagnostic events and eight actionable failure categories
  - exact whole-prompt Settings preview and exact contact-only Compose review
  - one-time truthful AI data-path disclosure backed by device-local app settings
affects: [36-08-backup-format, 36-09-settings-integration, compose-ai, provider-adapters]

actuals:
  tokens: 15928
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - diagnostics copy an explicit safe-metadata allowlist and never retain raw failures
    - transparency views consume exact substrings of the immutable resolved provider payload
    - first-use disclosure state is device-local and intentionally outside portable settings

key-files:
  created:
    - src/logic/ai-diagnostics.ts
    - src/screens/AIPreviewScreen.tsx
    - src/components/AIComposeContextReview.tsx
    - src/components/AIFirstUseDisclosure.tsx
  modified:
    - src/logic/ai-suggestion-logic.ts
    - src/screens/settings-ai-logic.ts
    - src/screens/ComposeScreen.tsx
    - src/services/AiService.ts
    - src/db/app-settings-dao.ts

key-decisions:
  - "AI diagnostic records are built by explicit field copy; unknown/raw error content is discarded before state or observability receives an event."
  - "Settings retains the exact whole payload while Compose extracts only exact contact DATA blocks from the same ResolvedPrompt object used for egress."
  - "The first-use marker is local device bookkeeping, not a portable preference or generation acknowledgement gate."
  - "Custom endpoints may be intentionally unauthenticated; first-use readiness still requires a valid endpoint and model, while hosted lanes require a local SecureStore credential."

patterns-established:
  - "Failure UI: stable category copy first, opt-in safe Details second, no raw provider text and no silent failover."
  - "Prompt review: resolve once, retain the immutable object, derive views only from its canonical payload."

requirements-completed: [AICFG-11, AICFG-12, AICFG-13, AICFG-14]

coverage:
  - id: D1
    description: "Diagnostic events expose only safe metadata and map representative failures into eight human-readable categories without changing model, connection, or draft state."
    requirement: AICFG-13, AICFG-14
    verification:
      - kind: unit
        ref: "src/logic/ai-diagnostics.test.ts and src/logic/ai-suggestion-logic.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Settings and Compose transparency views derive from the same immutable resolved provider payload, exclude credentials, and distinguish whole-system from contact-only content."
    requirement: AICFG-11
    verification:
      - kind: unit
        ref: "src/screens/settings-ai-logic.test.ts#whole-system and contact-specific prompt previews"
        status: pass
    human_judgment: false
  - id: D3
    description: "First-use disclosure names OpenRouter plus model provider, a direct provider, or the configured custom host and persists once in local-only app settings."
    requirement: AICFG-12
    verification:
      - kind: unit
        ref: "src/screens/settings-ai-logic.test.ts#first-use AI disclosure and src/db/app-settings-dao.test.ts#device-local AI first-use disclosure"
        status: pass
    human_judgment: false
  - id: D4
    description: "Transparency and Details surfaces use theme tokens and remain readable with long resolved prompts and zero/one/many item counts."
    requirement: AICFG-11, AICFG-13
    verification:
      - kind: other
        ref: "npm run check:colors"
        status: pass
    human_judgment: true
    rationale: "Long-content scrolling and modal ergonomics remain part of Phase 36 end-of-phase physical-device UAT after Plan 36-09 registers the Settings route and mounts the disclosure."

duration: 22min
completed: 2026-09-14
status: complete
---

# Phase 36 Plan 07: AI Transparency and Diagnostics Summary

**Exact payload-backed transparency surfaces, truthful first-use data-path disclosure, and privacy-safe actionable diagnostics now cover AI generation without credential or private-content leakage**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-14T08:23:26Z
- **Completed:** 2026-09-14T08:45:15Z
- **Tasks:** 3
- **Files modified:** 14 implementation/test files

## Accomplishments

- Added a closed diagnostic schema carrying operation, lane/model, safe status/category, correlation/build/OS identifiers, approximate counts, and elapsed time—never prompts, contacts, credentials, output, or raw responses.
- Added eight stable failure categories and preserved meaningful HTTP outcomes through every provider adapter, with Compose presenting recovery copy and optional sanitized Details while keeping the draft and selected connection intact.
- Built the whole-system Settings preview and real-contact preview over the canonical `resolvePrompt` output, including readable exact sections and a raw resolved view.
- Added per-generation Compose context review that receives the exact object sent to the adapter, displays exact contact DATA blocks only, and handles zero/one/many counts explicitly.
- Added the first-use disclosure component with truthful OpenRouter/direct/custom path names and a dedicated local-only `ai_first_use_disclosed` DAO writer.

## Task Commits

1. **Task 1 RED: diagnostic and lifecycle tests** — `aa40dd8` (test)
2. **Task 1 GREEN: diagnostics, provider categories, and Compose Details** — `64f026d` (feat)
3. **Task 2 RED: prompt transparency tests** — `121d02f` (test)
4. **Task 2 GREEN: Settings and Compose transparency surfaces** — `3897da1` (feat)
5. **Task 3 RED: first-use disclosure policy tests** — `65b4e91` (test)
6. **Task 3 GREEN: disclosure component and local DAO marker** — `995e101` (feat)
7. **Acceptance strengthening: whole-preview global content** — `b273aee` (test)

## Files Created/Modified

- `src/logic/ai-diagnostics.ts` — strict event allowlist, safe classification, recovery copy, and Hermes-safe correlation ids.
- `src/logic/ai-diagnostics.test.ts` — eight-category and forbidden-content negative coverage.
- `src/logic/ai-suggestion-logic.ts` — elapsed failure details, sanitized diagnostic seam, and exact-prompt observation hook.
- `src/services/AiService.ts` — safe billing/model/context/provider-down status preservation without response-body parsing.
- `src/screens/settings-ai-logic.ts` — whole/contact preview derivation, zero/one/many counts, data-path naming, and first-use readiness policy.
- `src/screens/AIPreviewScreen.tsx` — local whole-prompt view, optional real-contact resolution, readable sections, and raw view.
- `src/components/AIComposeContextReview.tsx` — contact-specific exact-block modal without global boilerplate.
- `src/components/AIFirstUseDisclosure.tsx` — once-per-device disclosure using active store state, resolved connection, and credential presence.
- `src/screens/ComposeScreen.tsx` — production diagnostics, Details UI, and per-generation exact context review wiring.
- `src/db/app-settings-dao.ts` — read and dedicated local-only persistence for migration-029's disclosure flag.

## Decisions Made

- Diagnostics accept only a deliberately closed metadata shape. Raw provider errors are classified and then discarded; no spread or arbitrary context object can reach the event.
- Provider adapters retain only stable status meaning. They still do not parse or expose a failed response body.
- Compose observes the exact frozen `ResolvedPrompt` immediately before egress. Contact review extracts complete contact-related DATA blocks from it instead of rebuilding a parallel preview.
- “Nothing shared” counts independently permitted optional items. The base contact context remains visibly disclosed because it is still present in the actual contact block.
- The first-use disclosure is informational only. No `ai_ack_*` value is read by generation, and the device-local marker is absent from `PORTABLE_SETTINGS_KEYS` so a restored device re-discloses after reconnection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Preserved actionable provider status categories at the adapter boundary**

- **Found during:** Task 1
- **Issue:** Existing adapters collapsed billing, missing-model, oversized-context, and provider-outage statuses into `provider_error`, making the planned categories unreachable in production.
- **Fix:** Extended the sanitized `AiErrorCode` taxonomy and status mapper for 402, 404, 413, and 5xx while retaining the no-response-body rule.
- **Files modified:** `src/services/AiService.ts`, `src/services/AiService.test.ts`
- **Committed in:** `64f026d`

**2. [Rule 2 - Missing Critical] Wired diagnostics and contact review into the real Compose request lifecycle**

- **Found during:** Tasks 1 and 2
- **Issue:** Standalone helpers/components would not satisfy the failure Details or per-generation review behavior, and no later plan owns Compose review wiring.
- **Fix:** Compose now builds safe request metadata and retains the exact resolved object immediately before adapter egress for the contact-only review.
- **Files modified:** `src/screens/ComposeScreen.tsx`, `src/logic/ai-suggestion-logic.ts`
- **Committed in:** `64f026d`, `3897da1`

**3. [Rule 2 - Missing Critical] Exposed migration-029's disclosure flag through the application DAO**

- **Found during:** Task 3
- **Issue:** The schema column existed but `getAppSettings` could neither read it nor persist completion, so “shown once” could not work.
- **Fix:** Added the field to the explicit read projection and a dedicated device-local writer that intentionally avoids portable settings and data-revision semantics.
- **Files modified:** `src/db/app-settings-dao.ts`, `src/db/app-settings-dao.test.ts`
- **Committed in:** `995e101`

**Total deviations:** 3 auto-fixed (3 Rule 2)
**Impact on plan:** The additions connect the planned surfaces to real production boundaries and preserve existing privacy decisions; no new product scope or network path was introduced.

## Issues Encountered

- The repository-wide `npm test -- --run` check passed 3,484 tests across 366 suites and again encountered only the known Phase 30 collection failure in `src/components/orrery/orrery-controls-render.test.tsx` (`SyntaxError: Unexpected token 'typeof'`). It imports none of this plan's modules. The focused 193 tests, `npx tsc --noEmit`, and `npm run check:colors` pass; the unrelated dirty Phase 30 review files and `tsconfig.json` were preserved unchanged. The recurrence is recorded in `deferred-items.md`.

## Known Stubs

None. The placeholder strings are ordinary input affordances; no mock or empty production data source was introduced.

## Authentication Gates

None.

## User Setup Required

None - the plan adds local UI and diagnostics around whichever AI connection the user chooses later.

## Next Phase Readiness

- Plan 36-08 can preserve the explicit local-only exclusion of `aiFirstUseDisclosed` while adding the remaining portable Phase 36 settings.
- Plan 36-09 can register `AIPreviewScreen`, mount `AIFirstUseDisclosure` in the reworked Settings AI hub, and perform the consolidated physical-device transparency/disclosure UAT.
- Compose context review and sanitized failure Details are already wired into the live generation path.

## Self-Check: PASSED

- All four required new artifacts exist on disk.
- All seven plan commits exist in git history.
- The focused 193-test gate, TypeScript compile, and theme-color gate pass.

---
*Phase: 36-ai-configuration-prompting*
*Completed: 2026-09-14*
