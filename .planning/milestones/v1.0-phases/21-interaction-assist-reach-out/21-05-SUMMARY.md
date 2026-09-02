---
phase: 21-interaction-assist-reach-out
plan: 05
subsystem: interaction-assist-cross-phase-wiring
tags: [sqlite, merge, purge, widget, deep-link, react-navigation]
requires:
  - phase: 21-interaction-assist-reach-out
    provides: durable interaction assists and the shared Reach Out router
  - phase: 20-contact-reconciliation-merge
    provides: transactional contact merge and purge lifecycle writers
provides:
  - Merge-safe reparenting and purge-safe removal of pending interaction assists
  - Strict widget Contact deep-link routing into the shared Reach Out router
  - Distinct stale-target handling for purged and archived widget contacts
affects: [interaction-assist-device-uat, widget-navigation, contact-lifecycle]
actuals:
  tokens: 3361.75
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [transactional-child-reparenting, discriminated-deep-link-guard, consumed-once-route-param]
key-files:
  created: []
  modified:
    - src/db/merge-dao.ts
    - src/db/merge-dao.test.ts
    - src/db/purge-dao.test.ts
    - src/navigation/widget-linking.ts
    - src/navigation/widget-linking.test.ts
    - src/services/widget/widget-quick-action-guard.ts
    - src/services/widget/widget-quick-action-guard.test.ts
    - src/services/widget/widget-render.tsx
    - src/screens/ContactProfileScreen.tsx
    - src/navigation/types.ts
key-decisions:
  - "interaction_assists is reparented inside the existing merge transaction; confirmation never needs a survivor lookup."
  - "A missing Reach target resets to Home with explicit copy, while an archived target remains a silent drop consistent with widget policy."
  - "Profile consumes openReachOut only after actionable methods are loaded, then clears the serializable param in the same focus effect."
patterns-established:
  - "Untrusted widget intents use anchored URI parsing followed by a typed live-contact guard before navigation."
  - "Widget route parameters that launch transient UI are consumed once with navigation.setParams before a future focus can replay them."
requirements-completed: [IAS-03, IAS-04]
coverage:
  - id: D1
    description: "Pending assists move to the survivor during merge and are cascade-removed during purge."
    requirement: IAS-03
    verification:
      - kind: unit
        ref: npx vitest run src/db/merge-dao.test.ts src/db/purge-dao.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "The widget Contact URI is strictly parsed, guarded by lifecycle state, and opens the Profile Reach Out route exactly once."
    requirement: IAS-04
    verification:
      - kind: integration
        ref: npx vitest run src/navigation/widget-linking.test.ts src/services/widget/widget-quick-action-guard.test.ts && npx tsc --noEmit && npm run check:colors
        status: pass
    human_judgment: true
    rationale: "Widget rendering, Android launcher delivery, navigation reset behavior, and the profile modal require device UAT in Plan 06."
duration: 8min
completed: 2026-08-31
status: complete
---

# Phase 21 Plan 05: Cross-Phase Assist and Widget Wiring Summary

**Merge-safe pending assists and a strict widget Contact deep-link that opens the shared Reach Out router without resurrecting stale contacts.**

## Performance

- **Duration:** 8 min
- **Completed:** 2026-08-31T22:38:17Z
- **Tasks:** 2/2
- **Files modified:** 10

## Accomplishments

- Added `interaction_assists` to merge's transactional child reparent loop, with a test proving later confirmation logs against the survivor.
- Extended merge and purge test fixtures through migration 014; purge continues to rely on the contact foreign-key cascade, proven by a pending-assist test.
- Replaced the large widget's Message button with Contact and `orbit://reach/<id>`, parsed only through an anchored, safe-integer allow-list.
- Added a discriminated widget guard: purged/missing Contact targets route home with clear copy, archived targets stay silently dropped, and existing Profile/Compose/Favourites decisions remain unchanged.
- Added a consumed-once `openReachOut` Profile parameter so a valid widget route opens the shared router without re-opening on later focus events.

## Task Commits

1. **Task 1: Merge reparent + purge cascade for interaction_assists** — `78c158e`
2. **Task 2: Widget Message→Contact + orbit://reach allow-list + deep-link nav + purged fail-safe** — `42fdd8b`

## Files Created/Modified

- `src/db/merge-dao.ts` — reparents pending assist rows before deleting the absorbed contact.
- `src/db/merge-dao.test.ts` and `src/db/purge-dao.test.ts` — migrate local fixtures through 014 and prove merge/purge lifecycle outcomes.
- `src/navigation/widget-linking.ts` and `src/navigation/widget-linking.test.ts` — strict Reach URI resolver and stale-target Dashboard fail-safe.
- `src/services/widget/widget-quick-action-guard.ts` and `src/services/widget/widget-quick-action-guard.test.ts` — typed missing/archived/ineligible guard outcomes.
- `src/services/widget/widget-render.tsx` — large-widget Contact action now emits the Reach URI only.
- `src/screens/ContactProfileScreen.tsx` and `src/navigation/types.ts` — serializable, consumed-once Reach Out route parameter.

## Decisions Made

- `interaction_assists` participates only in reparenting, not merge conflict resolution or tombstones.
- The widget never creates an assist or interaction; it only emits a URI and delegates channel choice to the in-app router.
- Purged targets are explicitly surfaced and routed home, while archived targets retain the established silent-drop behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected stale Message/Compose widget documentation after the Contact route swap.**

- **Found during:** Task 2 verification
- **Issue:** The implementation comment still described the removed Message action and `orbit://compose` URI.
- **Fix:** Updated the comment to describe the Contact action and `orbit://reach` URI.
- **Files modified:** `src/services/widget/widget-render.tsx`
- **Verification:** Structural grep confirms no widget `orbit://compose` URI remains; focused tests, TypeScript, and color check pass.
- **Committed in:** `42fdd8b`

**Total deviations:** 1 auto-fixed (Rule 1).

## Issues Encountered

- The focused Vitest run emits the repository's existing Vite native-config deprecation warning; all 64 focused tests passed.
- A non-required Biome check reports pre-existing formatting/import-order diagnostics in existing files; no unrelated formatting churn was introduced.

## User Setup Required

None - this work uses local SQLite, existing widget intents, and existing navigation.

## Next Phase Readiness

- Plan 06 can device-test widget Contact launch, Back-to-dashboard reset, purged/archived behavior, and the consumed-once reopen guard.
- The automated merge, purge, URI parser, typed guard, TypeScript, and color-policy checks are green.

## Self-Check: PASSED

- All ten modified implementation and test files exist.
- Task commits `78c158e` and `42fdd8b` exist in git history.
