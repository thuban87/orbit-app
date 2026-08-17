---
phase: 12-home-screen-widget
plan: 06
subsystem: widget
tags: [react-native-android-widget, headless-task, requestWidgetUpdate, sqlite, launch-sweep]

# Dependency graph
requires:
  - phase: 12-05
    provides: renderFavourites(widgetInfo?) render + widgetMarkContacted single-writer mark seam
  - phase: 12-04
    provides: resolveWidgetUri positive/safe-id boundary (the guard analog)
  - phase: 11
    provides: notification headless-task module-scope registration + openAndMigrate-before-getExecutor bootstrap pattern
  - phase: 02
    provides: launch-sweep registry (registerSweepHook, runLaunchSweep, installSweepTrigger)
provides:
  - "pushWidgetUpdate(): always-resolving event-push refresh of every placed OrbitFavourites instance"
  - "notifyWidgetDataChanged(): fire-and-forget foreground freshness publisher (wired in 12-07)"
  - "registerWidgetSweep(): foreground launch recompute hook (registered in App.tsx by 12-07)"
  - "widgetTaskHandler: the library headless entry routing WIDGET_MARK clicks and render events"
  - "index.ts registerWidgetTaskHandler(widgetTaskHandler) at module scope"
affects: [12-07, 12-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Headless widget task handler mirrors the Phase-11 notification headless-task: openAndMigrate before getExecutor, Logger-guarded try/catch that never rethrows, module-scope library registration."
    - "Freshness by event-push (requestWidgetUpdate), never polling; the refresh wrapper ALWAYS resolves so it is safe on the un-isolated launch-sweep loop and as a fire-and-forget foreground publisher."
    - "Durable-action-first ordering: the mark commits via the single-writer DAO BEFORE the error-swallowing re-render, so a slow/failed/timed-out render can never roll it back."

key-files:
  created:
    - src/services/widget/widget-refresh.ts
    - src/services/widget/widget-task-handler.tsx
  modified:
    - index.ts

key-decisions:
  - "widgetAction is a string-literal union in the installed types (not an enum) — switch on the literal strings 'WIDGET_ADDED'/'WIDGET_UPDATE'/'WIDGET_RESIZED'/'WIDGET_CLICK'/'WIDGET_DELETED', confirmed first-hand against register-widget-task-handler.d.ts."
  - "contactId coerced with Number(...) then guarded Number.isSafeInteger(id) && id > 0 BEFORE opening SQLite — rejects negative/zero/non-numeric/unsafe ids, matching the 12-04 resolveWidgetUri boundary."
  - "pushWidgetUpdate passes NO widgetInfo (defaults to small layout); the OS re-fires WIDGET_RESIZED with real size when a large instance is placed."

patterns-established:
  - "Pattern 1: error-swallowing refresh wrapper — pushWidgetUpdate wraps its whole body in a Logger-guarded try/catch so it never rejects the un-isolated sweep loop or a fire-and-forget publisher."
  - "Pattern 2: headless import purity — the task handler imports only the mark seam, render, refresh wrapper, and DB bootstrap; nothing reaching the foreground launch-sweep runner/trigger (grep-verified 0)."

requirements-completed: [WDG-01, WDG-02, WDG-03]

coverage:
  - id: D1
    description: "pushWidgetUpdate() re-renders every placed OrbitFavourites via requestWidgetUpdate, no-ops via widgetNotFound when none placed, and ALWAYS resolves (Logger-guarded try/catch that swallows)."
    requirement: "WDG-03"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean); grep gates: widgetNotFound x3, try/catch present, notifyWidgetDataChanged x2"
        status: pass
    human_judgment: true
    rationale: "requestWidgetUpdate is native-runtime bound and cannot be exercised in the vitest/node harness (no widget host); the killed-app round-trip is a 12-08 on-device Pixel UAT."
  - id: D2
    description: "notifyWidgetDataChanged() fire-and-forget foreground publisher (void pushWidgetUpdate(), unawaited) so a user write is never blocked/rolled back by a render failure."
    requirement: "WDG-03"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean); code review: void pushWidgetUpdate() unawaited"
        status: pass
    human_judgment: true
    rationale: "Wiring at concrete foreground mutation call sites lands in 12-07; the delivered helper's runtime effect is only observable on-device."
  - id: D3
    description: "widgetTaskHandler routes render events to renderFavourites(props.widgetInfo) and WIDGET_MARK to openAndMigrate->getExecutor->widgetMarkContacted->pushWidgetUpdate, id-guarded, Logger-guarded, mark committed before refresh."
    requirement: "WDG-02"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean); grep gates: 0 refs to launch-sweep runner/trigger, openAndMigrate present, isSafeInteger present"
        status: pass
    human_judgment: true
    rationale: "The killed-app headless mark round-trip runs in a native headless JS context absent from the vitest harness (same constraint as the Phase-11 notification headless path); proven on the physical Pixel in 12-08."
  - id: D4
    description: "index.ts registers the handler at module scope with registerWidgetTaskHandler(widgetTaskHandler); registerRootComponent(App) preserved and first."
    requirement: "WDG-02"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean); grep -c 'registerWidgetTaskHandler(widgetTaskHandler)' index.ts == 1"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-08-17
status: complete
---

# Phase 12 Plan 06: Widget Headless Brain Summary

**The OrbitFavourites widget's headless brain — a task handler that turns an OS click into a committed one-tap mark or a size-selected re-render, an always-resolving event-push refresh wrapper (requestWidgetUpdate, no polling), a fire-and-forget foreground publisher, and the module-scope registerWidgetTaskHandler entry.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-17T08:00:00Z (approx)
- **Completed:** 2026-08-17T08:14:15Z
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `widget-refresh.ts`: `pushWidgetUpdate()` re-renders every placed OrbitFavourites instance (widgetNotFound no-op when none placed) inside a Logger-guarded try/catch that ALWAYS resolves — safe on the un-isolated launch-sweep loop (launch-sweep.ts:82) and as a fire-and-forget foreground publisher (Claude M3). Plus `notifyWidgetDataChanged()` (void, unawaited) and `registerWidgetSweep()`.
- `widget-task-handler.tsx`: `widgetTaskHandler` routes render events (ADDED/UPDATE/RESIZED) to `renderFavourites(props.widgetInfo)` for size-selected layout, and WIDGET_MARK clicks to the committed headless mark — `Number.isSafeInteger(id) && id > 0` guard BEFORE SQLite, `openAndMigrate()` before `getExecutor()`, `widgetMarkContacted()` COMMITS, THEN the error-swallowing `pushWidgetUpdate()`.
- `index.ts`: registers the handler at module scope via the library's own `registerWidgetTaskHandler(widgetTaskHandler)`; `registerRootComponent(App)` preserved and first.
- All constraints from the cross-AI review are honored: safe-integer id guard (codex MED), mark-before-refresh ordering (codex MED), always-resolving wrapper (Claude M3), enum spellings confirmed against installed types (Claude L1), and zero imports reaching the launch-sweep runner/trigger (T-12-07).

## Task Commits

Each task was committed atomically:

1. **Task 1: Event-push freshness wrapper + fire-and-forget publisher (widget-refresh.ts)** - `1c1758a` (feat)
2. **Task 2: Widget task handler (widget-task-handler.tsx)** - `95ebc40` (feat)
3. **Task 3: Register the handler in the app entry (index.ts)** - `f732182` (feat)

## Files Created/Modified
- `src/services/widget/widget-refresh.ts` - pushWidgetUpdate (always-resolving), notifyWidgetDataChanged (fire-and-forget), registerWidgetSweep (foreground launch recompute hook).
- `src/services/widget/widget-task-handler.tsx` - widgetTaskHandler: the library headless entry routing render events + the committed WIDGET_MARK.
- `index.ts` - registerWidgetTaskHandler(widgetTaskHandler) at module scope, alongside the preserved registerRootComponent(App).

## Decisions Made
- **widgetAction is a string-literal union, not an enum** — confirmed against `node_modules/react-native-android-widget/lib/typescript/api/register-widget-task-handler.d.ts` (`'WIDGET_ADDED' | 'WIDGET_UPDATE' | 'WIDGET_RESIZED' | 'WIDGET_DELETED' | 'WIDGET_CLICK'`). The switch uses the literal strings; `clickAction`/`clickActionData` are optional, `widgetInfo` is the field name. No dossier-guessed spelling was trusted.
- **Guard uses `Number(...)` coercion then `Number.isSafeInteger(id) && id > 0`** — `clickActionData?.contactId` is typed `unknown`; coercing first yields a clean `number` for the DAO and rejects `undefined`/objects/strings as `NaN`, matching the resolveWidgetUri positive/safe-id boundary.
- **requestWidgetUpdate's `renderWidget` accepts `renderFavourites` directly** — the library's `renderWidget: (props: WidgetInfo) => Promise<WidgetRepresentation> | WidgetRepresentation` is satisfied by `renderFavourites(widgetInfo?)` returning `Promise<React.JSX.Element>` (WidgetRepresentation is `React.JSX.Element | {...}`), so no adapter wrapper is needed.

## Deviations from Plan

None affecting behavior. One authoring adjustment worth recording:

- The plan's Task-2 verify gate is `test $(grep -rc "runLaunchSweep\|installSweepTrigger" widget-task-handler.tsx) -eq 0`. My initial doc comment named those two symbols literally to explain the negative invariant, which tripped the proxy gate (it counts any textual occurrence, not just imports). I reworded the comment to describe "the foreground launch-sweep runner / its trigger" without the literal identifiers. The invariant itself is unchanged and stronger than the grep: the file imports ONLY `pushWidgetUpdate` from widget-refresh, `renderFavourites` from widget-render, `widgetMarkContacted` from widget-mark, and the DB bootstrap — none reaches the sweep runner or trigger. Gate now reports 0.

## Issues Encountered
None. tsc clean across all three files at each step; the only friction was the grep-gate wording above, resolved before committing Task 2.

## Verification Run
- `npx tsc --noEmit` — clean (all three files, run after each task).
- `npm run check:colors` — exit 0 (no hardcoded colours introduced; the handler/refresh touch no colour values).
- `npx vitest run` — 74 files, 890 tests passed. No new unit tests: the widget task handler and requestWidgetUpdate run in a native headless JS context absent from the vitest harness, matching the Phase-11 notification headless-task precedent (device-verified, not asserted). The killed-app headless mark round-trip is the 12-08 on-device Pixel UAT must-have (bundled with the deferred Phase-11 headless-action device check).
- `npx biome check` on the three files — no fixes needed.

## Next Phase Readiness
- The widget is functionally complete in JS: headless mark + event-push freshness + library registration are in place.
- **12-07** wires `notifyWidgetDataChanged()` at the concrete foreground mutation call sites (manual log, favourite toggle, favourite reorder, fuel edits) and calls `registerWidgetSweep()` once, module-guarded, in App.tsx.
- **12-08** owns the device build, boot receiver / force-stop re-push (the SEPARATE native path), and the on-device Pixel UATs — including the killed-app headless mark round-trip verified via `run-as com.bwales.orbit`.

## Self-Check: PASSED

- Files: widget-refresh.ts, widget-task-handler.tsx, index.ts, 12-06-SUMMARY.md — all present on disk.
- Commits: 1c1758a, 95ebc40, f732182 — all present in git history.

---
*Phase: 12-home-screen-widget*
*Completed: 2026-08-17*
