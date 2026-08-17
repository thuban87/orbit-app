---
phase: 12-home-screen-widget
plan: 07
subsystem: ui
tags: [react-native, widget, deep-link, navigation, react-native-android-widget, launch-sweep, favourites]

# Dependency graph
requires:
  - phase: 12-04
    provides: WidgetLinkingGate + resolveWidgetUri (strict orbit:// allow-list) on the shared navigationRef
  - phase: 12-06
    provides: registerWidgetSweep + notifyWidgetDataChanged / pushWidgetUpdate (event-push freshness, swallow-own-errors)
provides:
  - App-shell mount of the orbit:// deep-link gate keyed on navReady (queues pre-ready intents, flushes on settle)
  - One-shot module-guarded registration of the widget foreground-refresh sweep before the cold-start sweep
  - Settings "Add Orbit widget" row calling requestPinWidget with graceful fallback (unit-tested pure result→copy)
  - Exhaustive notifyWidgetDataChanged() publishers at EVERY widget-visible foreground mutation site (WDG-03 fix)
affects: [12-08-device-build, widget-freshness, favourites-widget]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-site fire-and-forget widget publisher at the screen/service layer (never a DAO) — keeps src/db widget-agnostic"
    - "Node test mocks @/services/widget/widget-refresh to keep the react-native-android-widget seam out of node:sqlite tests"

key-files:
  created:
    - src/screens/settings-add-widget.ts
    - src/screens/settings-add-widget.test.ts
  modified:
    - App.tsx
    - src/screens/SettingsScreen.tsx
    - src/screens/ContactProfileScreen.tsx
    - src/screens/ManageFavouritesScreen.tsx
    - src/screens/EditContactScreen.tsx
    - src/screens/CropPhotoScreen.tsx
    - src/components/PhotoSourcePicker.tsx
    - src/screens/ArchivedContactsScreen.tsx
    - src/screens/CaptureScreen.tsx
    - src/services/notifications/notification-actions.ts
    - src/services/notifications/notification-actions.test.ts

key-decisions:
  - "Called the pre-existing registerWidgetSweep() wrapper from App.tsx rather than registerSweepHook(pushWidgetUpdate) directly — the wrapper (12-06) already encapsulates the hook, keeping App.tsx symmetric with the other sweep registrations."
  - "Reorder publisher placed inside the try after the successful rewriteFavouriteRanks, NOT after the catch-only load() — a successful reorder must refresh the widget (codex/Claude HIGH)."
  - "notification-actions node test mocks widget-refresh (not react-native-android-widget globally) and asserts ACTION_MARK publishes / ACTION_SNOOZE does not — the tightest proof of the headless-safe, mark-only publish."

patterns-established:
  - "Widget-visible field set = name, photo, derived status, fuelText, unarchived-state, favourite membership, favourite_rank — the sole definition of where a publisher belongs."

requirements-completed: [WDG-02, WDG-03]

coverage:
  - id: D1
    description: "orbit:// deep-link gate mounted in NavigationContainer keyed on navReady; widget foreground-refresh sweep registered once (module-guarded) before the cold-start sweep"
    requirement: WDG-02
    verification:
      - kind: other
        ref: "npx tsc --noEmit && grep -c WidgetLinkingGate App.tsx (2) && grep -c registerWidgetSweep App.tsx (3)"
        status: pass
    human_judgment: true
    rationale: "Live cold-start orbit:// delivery, the queued pre-ready navigation flush, and 'Back → dashboard' are device/JS UATs recorded in 12-08; only the wiring is statically provable here."
  - id: D2
    description: "Pure pinResultCopy(result) → null on accept, verbatim UI-SPEC fallback copy on refuse (rejected request maps to false)"
    requirement: WDG-03
    verification:
      - kind: unit
        ref: "src/screens/settings-add-widget.test.ts#pinResultCopy"
        status: pass
    human_judgment: false
  - id: D3
    description: "Settings 'Add Orbit widget' row calls requestPinWidget inside try/catch; false OR a rejected promise shows the fallback copy — never a crash/dead button/unhandled rejection"
    requirement: WDG-03
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npm run check:colors && grep -c settings-add-widget src/screens/SettingsScreen.tsx (3)"
        status: pass
    human_judgment: true
    rationale: "The live launcher pin prompt needs the prebuilt provider (12-08) and a real device/launcher; only the pure result→copy decision is unit-provable here."
  - id: D4
    description: "Exhaustive notifyWidgetDataChanged() publishers at every widget-visible foreground mutation site (9 in ContactProfile, 1 reorder success path, edit-metadata, contact-photo set/clear, restore, 3 capture fuel writes, notification ACTION_MARK)"
    requirement: WDG-03
    verification:
      - kind: unit
        ref: "src/services/notifications/notification-actions.test.ts#handleNotificationAction — mark/snooze (asserts mark publishes once, snooze does not)"
        status: pass
      - kind: other
        ref: "grep -c 'notifyWidgetDataChanged()' across all 8 sites: ContactProfile=9, ManageFavourites=1, Capture=3, others>=1"
        status: pass
    human_judgment: true
    rationale: "That the placed widget visibly refreshes (and never stales) after a normal edit is device-observable in 12-08; the per-site wiring, branch selection (mark-not-snooze, reorder-success-not-catch), and headless-safety are unit + grep proven."

# Metrics
duration: 20min
completed: 2026-08-17
status: complete
---

# Phase 12 Plan 07: Wire the Widget into the App Shell Summary

**Mounted the orbit:// deep-link gate + one-shot foreground widget-sweep in App.tsx, added a Settings "Add Orbit widget" row with a unit-tested graceful fallback, and wired fire-and-forget notifyWidgetDataChanged() publishers at all 18 widget-visible foreground mutation sites (the exhaustive WDG-03 inventory).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-17T08:15:00Z
- **Completed:** 2026-08-17T08:27:00Z
- **Tasks:** 3
- **Files modified:** 11 (2 created)

## Accomplishments
- App.tsx now mounts `<WidgetLinkingGate isReady={navReady}/>` alongside the share + notification gates (same reactive readiness flag) and registers `registerWidgetSweep()` exactly once, module-guarded, in the ready-gated effect before `installSweepTrigger` fires the cold-start sweep — mirroring the Phase-11 notification-schedule sweep pattern.
- Settings has a themed "Home screen → Add Orbit widget" row (testID `settings-add-widget`) that calls `requestPinWidget({ widgetName: "OrbitFavourites" })` inside try/catch; a rejected promise is mapped to `false` identically to an unsupported launcher, surfacing the verbatim UI-SPEC fallback copy inline. The pure `pinResultCopy` handler is unit-tested for both paths.
- `notifyWidgetDataChanged()` is published (fire-and-forget, after the successful commit, never awaited, never on a read path) at the exhaustive inventory: ContactProfile (log, archive, favourite toggle, touchpoint edit/delete, fuel add/edit/confirm/delete — 9), ManageFavourites reorder (success path only — 1), EditContact metadata save, CropPhoto contact-photo set, PhotoSourcePicker contact-photo clear, Archived restore, Capture fuel writes (pick/multi/note — 3), and notification-actions ACTION_MARK.

## Task Commits

1. **Task 1: Mount orbit:// gate + register widget launch refresh (App.tsx)** - `3385f6e` (feat)
2. **Task 2 (TDD RED): failing test for pinResultCopy** - `5f241e8` (test)
3. **Task 2 (TDD GREEN): Settings add-widget row + pure handler** - `547b197` (feat)
4. **Task 3: exhaustive event-push publishers (WDG-03)** - `c461ea7` (feat)

_Task 2 is TDD (test → feat). No refactor commit needed._

## Files Created/Modified
- `src/screens/settings-add-widget.ts` - Pure `pinResultCopy(result)` + `ADD_WIDGET_FALLBACK_COPY` (node-testable, no RN import).
- `src/screens/settings-add-widget.test.ts` - Asserts true→null, false→verbatim fallback string.
- `App.tsx` - Gate mount + module-guarded `registerWidgetSweep()` in the ready-gated effect.
- `src/screens/SettingsScreen.tsx` - "Home screen" section + add-widget row + try/catch onPress.
- `src/screens/ContactProfileScreen.tsx` - 9 publishers (log/archive/favourite/touchpoint edit+delete/fuel add+edit+confirm+delete).
- `src/screens/ManageFavouritesScreen.tsx` - 1 publisher on the successful reorder path.
- `src/screens/EditContactScreen.tsx` - Publisher beside the committed-metadata reconcileSchedule.
- `src/screens/CropPhotoScreen.tsx` - Publisher in the `target.kind === "contact"` branch.
- `src/components/PhotoSourcePicker.tsx` - Publisher in the `case "contact"` remove branch.
- `src/screens/ArchivedContactsScreen.tsx` - Publisher after a successful restore.
- `src/screens/CaptureScreen.tsx` - 3 publishers (onPickFace, onDoneMulti, onNoteDone) on existing-contact fuel writes.
- `src/services/notifications/notification-actions.ts` - Publisher in the ACTION_MARK branch only.
- `src/services/notifications/notification-actions.test.ts` - Mocks widget-refresh; asserts mark publishes / snooze does not.

## Decisions Made
- Called the existing `registerWidgetSweep()` wrapper from App.tsx (not `registerSweepHook(pushWidgetUpdate)` directly) — the wrapper already owns the hook, keeping App.tsx symmetric with the field/photo/notification sweep registrations.
- Reorder publisher sits inside the `try` after the successful `rewriteFavouriteRanks`, never after the catch-only `load()` (the failure path) — enforcing the codex/Claude HIGH.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mocked widget-refresh in the notification-actions node test**
- **Found during:** Task 3 (wiring the ACTION_MARK publisher)
- **Issue:** Adding `import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh"` to `notification-actions.ts` made its node test (`node:sqlite`, node env) transitively import `react-native-android-widget`, which cannot parse under node — 6 tests failed with `SyntaxError: Unexpected token 'typeof'`.
- **Fix:** Added `vi.mock("@/services/widget/widget-refresh", () => ({ notifyWidgetDataChanged: h.notifyWidget }))` (hoisted spy) to the test — the intended design (the node-tested mark seam never fires a native `requestWidgetUpdate`, per the plan's must_haves). Also added two targeted assertions: ACTION_MARK publishes exactly once, ACTION_SNOOZE does not.
- **Files modified:** src/services/notifications/notification-actions.test.ts
- **Verification:** `npx vitest run` → 893 passed (75 files); the mark/snooze publish behaviour is now asserted.
- **Committed in:** `c461ea7` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Necessary and in-scope — the mock is the plan's own stated design for keeping the widget seam out of node tests, and the added assertions strengthen coverage of the headless-safe mark-only publish. No scope creep.

## Issues Encountered
- **Plan verify-command imprecision (not a code issue):** the plan's Task-3 gate uses `grep -c "notifyWidgetDataChanged" ManageFavouritesScreen.tsx -eq 1`, but `grep -c` also counts the `import` line (total = 2), so that literal check reports 2. The substantive done-criterion — exactly ONE publisher *call* on the reorder success path — is met (`grep -c 'notifyWidgetDataChanged()'` = 1, confirmed placed inside the try before the catch). All other gate checks (`-ge`/`grep -q`) pass as written. Reported here rather than "fixed" because the wiring is correct; only the counting command double-counts the import.

## User Setup Required
None - no external service configuration required. The live launcher pin prompt and cold-start deep-link delivery require the prebuilt widget provider from 12-08 and on-device UAT.

## Next Phase Readiness
- The widget is now fully wired in JS: deep-link gate mounted, launch refresh registered, event-push publishers at every widget-visible mutation, and the in-app "Add widget" affordance present.
- Only the device build (12-08) remains: prebuild the `OrbitFavourites` provider so `requestPinWidget` resolves, then UAT live navigation, cold-start orbit:// delivery, the queued pre-ready flush, the pin prompt, and observable widget freshness after edits.
- tsc, `check:colors`, and the full 893-test vitest suite are green.

## Self-Check

- Created files exist: `src/screens/settings-add-widget.ts` FOUND, `src/screens/settings-add-widget.test.ts` FOUND.
- Task commits present in git log: `3385f6e`, `5f241e8`, `547b197`, `c461ea7` all FOUND.
- tsc clean, check:colors clean, 893/893 vitest pass.

## Self-Check: PASSED

---
*Phase: 12-home-screen-widget*
*Completed: 2026-08-17*
