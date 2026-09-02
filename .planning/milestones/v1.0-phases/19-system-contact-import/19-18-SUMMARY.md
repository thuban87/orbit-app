---
phase: 19-system-contact-import
plan: 18
subsystem: dashboard speed-dial / touch input
tags: [react-native, pointer-events, regression, dashboard, device-uat, vitest]
requires:
  - phase: 19-system-contact-import
    provides: the Phase-19 dashboard import speed-dial FAB (introduced 19-04, 57acb93)
provides:
  - Collapsed speed-dial scrim no longer intercepts dashboard touches
  - A pure, render-free helper encoding the collapsed→inert / expanded→interactive invariant
  - Device proof that the dashboard is operable again, unblocking 19-17
affects:
  - all dashboard touch targets (search, contact rows, filter chips, header nav)
  - Phase 19-17 device UAT (was blocked, now unblocked)
tech_stack:
  added: []
  patterns:
    - Mirror a reanimated shared value into React state to drive pointerEvents
    - Extract a UI interactivity decision into a pure *-logic helper for render-free testing
key_files:
  created:
    - src/components/add-speed-dial-fab-logic.ts
    - src/components/add-speed-dial-fab-logic.test.ts
  modified:
    - src/components/AddSpeedDialFab.tsx
decisions:
  - The scrim and both collapsed option buttons derive pointerEvents from open state; the FAB stays always-interactive.
  - `open` React state is a strict mirror of the `expanded` shared value, updated in the single setExpanded writer so they cannot diverge.
  - The animation model (shared-value opacity/translate on the UI thread) is unchanged; only touch gating was added.
metrics:
  duration: device-verified session
  completed: 2026-08-29
  tasks: 1
  files: 3
status: complete
requirements-completed: [IMP-01]
coverage:
  - id: D1
    description: The collapsed speed-dial scrim is inert (pointerEvents "none") so dashboard touches pass through; expanded it is "auto".
    requirement: IMP-01
    verification:
      - kind: unit
        ref: src/components/add-speed-dial-fab-logic.test.ts
        status: pass
      - kind: device
        ref: on-device uiautomator evidence (below)
        status: pass
    human_judgment: false
---

# Phase 19 Plan 18: Speed-Dial Scrim Touch-Blocking Fix

The dashboard was untouchable everywhere except the Add-contact FAB — on adb **and** physical touch
alike. Root cause: `AddSpeedDialFab`'s scrim is an `absoluteFill` `AnimatedPressable` with a hardcoded
`pointerEvents="auto"` that is always mounted and only animates *opacity*. In React Native an
opacity-0 view still captures touches, so the invisible full-screen scrim blanketed the whole
dashboard and swallowed every touch (firing a no-op `setExpanded(false)`); only the FAB button, drawn
after the scrim in JSX, sat above it and stayed reachable. Regression introduced in `57acb93`
`feat(19-04): add contact import speed dial` — after Phase 15's UAT proved the same dashboard tappable
on this Pixel. No automated gate caught it: there is no test over the FAB/scrim and the node suite is
render-free, so a pointer-blocking overlay is invisible to it. The device UAT is the only surface that
observes it — and it did, though the prior session mis-attributed it to broken adb pointer injection.

## Task Completed

1. **Gate the scrim/options pointerEvents on collapsed state** — Added a pure helper
   `speedDialScrimPointerEvents(open)` (`open ? "auto" : "none"`) with a render-free unit test, and
   rewired `AddSpeedDialFab`: mirror the `expanded` reanimated shared value into an `open` React state
   (updated in the single `setExpanded` writer), drive the scrim and both option buttons'
   `pointerEvents` from the helper, and read `open` in the FAB toggle. The FAB base stays always
   interactive; the animation model is unchanged.

## Verification

### Automated
- `npx vitest run src/components/add-speed-dial-fab-logic.test.ts` — passed (2 tests: collapsed→"none", expanded→"auto").
- `npm test` — passed (**1696** tests, up from 1694).
- `npx tsc --noEmit --pretty false` — passed.
- `npm run check:colors` — passed (no colour literal added).
- `npx biome check` on the three files — clean.

### On-device (Pixel 6 Pro `1A071FDEE002BU`, Android 17 / API 37, debug build + orbit Metro :8082)
The fix was confirmed present in the served bundle (`speedDialScrimPointerEvents` in the reloaded
`index.bundle`), then verified live via `adb input tap` + `uiautomator dump`:

- **Collapsed scrim is inert:** tapping the "Family" filter chip moved selection `All → Family`
  (mid-screen target under the scrim) — impossible before the fix.
- **Header nav works:** tapping the ⚙ Settings gear opened orbit Settings ("CONTACT METHODS",
  "CONTACTS INTEGRATION → Import contacts"). (The gear must be tapped clear of the status-bar inset —
  y≈160, not y≈105.)
- **List nav works:** tapping a dashboard list row navigated off the dashboard.
- **Speed dial intact:** tapping the FAB expanded "Import from Contacts" / "Create manually"; tapping
  an empty area then collapsed them — proving the expanded scrim (`open → "auto"`) still intercepts the
  outside tap.

**Input-tooling note (supersedes the prior handoff's blocker):** adb `input tap` **does** drive React
Native on this device. The apparent "pointer injection is dead" was the scrim eating every touch;
`sendevent` is permission-denied on this unrooted device but is not needed. adb `input` reaches only
native UI when an RN overlay swallows the touch — the fix removes that overlay while collapsed.

## Decisions Made
- Both collapsed option buttons are gated alongside the scrim, so invisible options can't steal taps near the FAB.
- `open` is updated only inside `setExpanded`, keeping the shared value and the React mirror in lockstep.

## Deviations from Plan
None.

## Known Stubs
None.

## Next Phase Readiness
- 19-17 device UAT is unblocked: the dashboard is operable and both import entry points (dashboard
  speed-dial "Import from Contacts" and Settings ▸ Contacts Integration ▸ Import contacts) are reachable.
- No migrations, packages, endpoints, or new trust boundaries introduced.

## Self-Check: PASSED
All three files exist; commit `33eefd7` is present in Git history (no AI-attribution trailer).

---
*Phase: 19-system-contact-import*
*Completed: 2026-08-29*
