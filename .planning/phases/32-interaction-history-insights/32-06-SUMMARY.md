---
phase: 32-interaction-history-insights
plan: 06
subsystem: ui
tags: [history, rolodex, wheels, reanimated, gesture-handler, reduced-motion, markers, react-native]

requires:
  - phase: 32-interaction-history-insights
    plan: 03
    provides: "src/db/history-read.ts date-indexed HistoryDateMarker map (interaction/lifecycle-only/multiple + counts); consumed, never re-derived"
  - phase: 23-theme
    provides: "useReducedMotionShared() worklet-safe reduced-motion SharedValue; markerInteraction/markerLifecycle/accentText/borderStrong tokens"
  - phase: 29-orrery-camera
    provides: "the proven Reanimated + Gesture-Handler render-loop discipline (conditional-mount pause-on-blur, worklet-forward-ref safety) copied here"
provides:
  - "src/components/history/rolodex-logic.ts — pure node-tested wheel date math: rollDate (Day-primary Month/Year carry), clampDate (leap-aware conventional invalid-date clamp), clampToToday (today-as-max), markerFor + formatDrawerSummary from Plan 03 markers"
  - "src/components/history/RolodexWheel.tsx — one gesture-driven roller: Reanimated shared-value pan scroll, per-row depth via useAnimatedStyle, worklet-forward-ref-safe depth worklet, reduced-motion flattening, non-gesture +/- steppers, silhouette markers (filled/ring/filled+count)"
  - "src/components/history/RolodexBrowser.tsx — three synchronized Month/Day/Year wheels (Day primary) + summary drawer; owns the useIsFocused + AppState + measure lifecycle and conditionally mounts the animated subtree; drawer counts are lifecycle-inclusive; never auto-opens the sheet"
affects: [phase-32-plan-07-detail-sheet, phase-32-plan-08-history-section-integration]

actuals:
  tokens: 8144
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Gesture-driven wheel: pan drives a Reanimated shared `offset`; the committed selection is lifted to parent React state ONLY on settle (runOnJS) or a stepper press — never per-frame setState"
    - "Worklet-forward-ref safety: the depth worklet (`rowDepthStyle`) is defined at module scope ABOVE its `WheelRow` caller (Hermes undefined-on-device hazard vitest cannot catch, MEMORY f979263)"
    - "Pause-on-blur ownership lives in the composing parent (RolodexBrowser): it consumes useIsFocused + AppState + onLayout-measure and conditionally MOUNTS the animated subtree; leaf wheels never infer focus (Orrery pattern)"
    - "Correctness-critical date/marker math node-tested in a `.ts` sibling the animated `.tsx` cannot load under vitest (repo convention, mirrors services/history/* and heatmap-cell.ts)"

key-files:
  created:
    - src/components/history/rolodex-logic.ts
    - src/components/history/rolodex-logic.test.ts
    - src/components/history/RolodexWheel.tsx
    - src/components/history/RolodexBrowser.tsx
  modified: []

key-decisions:
  - "Optional Galaxy Skia glow DROPPED (UI-SPEC says 'MAY add'; plan prohibition: read a theme token prop or drop). Dropping keeps mechanics identical across themes, avoids a colour-literal risk in a Skia draw, and removes a second worklet-forward-ref surface. The wheels are Reanimated + Gesture-Handler only."
  - "Wheel settle uses an instant offset re-centre + a settle-time state commit (delta), not an animated snap, to eliminate a double-count race between the offset reset and the async React state update. Live neighbor fade/scale during the drag is the animated behaviour; device UAT tunes feel."
  - "Day-axis Month/Year boundary roll is delegated to rollDate's local-Date arithmetic (Jan 31 +1 -> Feb 1; Dec 31 +1 -> next Jan 1); Month/Year wheels carry the year via modular month math. Markers attach only to Day-wheel rows (a marker is a full date)."
  - "Year wheel browses BROWSE_YEARS_BACK=30 years, capped at today's year (today-as-max); rollDate clamps any forward roll that would pass today back to today."

patterns-established:
  - "A leaf animated component (RolodexWheel) takes `reduced: SharedValue<boolean>` + resolved `colors` as props and stays presentational; the parent owns lifecycle, state, and data"
  - "Silhouette-primary markers as plain Views (filled dot = interaction, ring = lifecycle-only, filled + count = multiple) with counts/types in the accessibilityLabel — no colour-only encoding"

requirements-completed: [HIST-08, HIST-09, HIST-18]

coverage:
  - id: D1
    description: "Pure wheel date/marker logic: Day-primary Month/Year boundary rolls, leap-aware conventional invalid-date clamp, today-as-max clamp, marker classification (none/interaction/lifecycle/multiple) and lifecycle-inclusive drawer summary — all from Plan 03 markers"
    requirement: "HIST-08"
    verification:
      - kind: unit
        ref: "src/components/history/rolodex-logic.test.ts (18 cases: boundary rolls, leap/non-leap Feb clamps, 30-day-month clamp, today-max clamp, 4 marker classes incl. empty, drawer summary)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RolodexWheel + RolodexBrowser: three synchronized wheels (Day primary), pre-selection markers, summary drawer with See details / Log interaction, pause-on-blur conditional mount, reduced-motion flattening, non-gesture stepper path; never auto-opens the sheet"
    requirement: "HIST-08"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (exit 0); npm run check:colors src/components/history/Rolodex*.tsx (exit 0); grep asserts useSharedValue/useAnimatedStyle in wheel + useIsFocused/AppState in browser; depth worklet above caller"
        status: pass
    human_judgment: true
    rationale: "Wheel scroll/inertia, marker rendering, pause-on-blur, reduced-motion simplification, and the absence of an undefined-on-device worklet crash can only be judged on the physical Pixel (emulator cannot assess Skia/render-loop or Hermes worklet behaviour). Phase-gate device UAT — the Pixel is not attached this session."
  - id: D3
    description: "HIST-09 no-auto-open: scrolling/selecting a wheel updates only the committed selection; the detail sheet opens exclusively via the drawer's explicit callbacks"
    requirement: "HIST-09"
    verification:
      - kind: other
        ref: "Source review: setSelected is the only effect of onStep/steppers; onSeeDetails/onLogInteraction are invoked solely from the drawer Button onPress"
        status: pass
    human_judgment: false
  - id: D4
    description: "HIST-18 accessibility: non-gesture +/- steppers on every wheel, marker counts/types in accessibilityLabel, reduced motion keeps navigation while flattening depth"
    requirement: "HIST-18"
    verification:
      - kind: other
        ref: "Source review + grep: per-wheel Pressable steppers with Next/Previous labels; WheelRow a11yLabel includes marker.a11yLabel; rowDepthStyle branches on reduced.value without disabling navigation"
        status: pass
    human_judgment: true
    rationale: "Screen-reader focus order and stepper operability on-device are a phase-gate a11y check (TalkBack on the Pixel); deferred with the rest of D2's device UAT."

duration: 9min
completed: 2026-09-11
status: complete
---

# Phase 32 Plan 06: Rolodex History Browser Summary

**Three synchronized Month/Day/Year wheels (Day primary) with leap-aware conventional date clamping and today-as-max, silhouette-primary pre-selection markers from Plan 03, and a lifecycle-inclusive summary drawer that never auto-opens the sheet — built Reanimated + Gesture-Handler only (no Skia), with the date math node-tested in a pure `.ts` and the pause-on-blur lifecycle owned by the composing browser.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-09-12T01:14:26Z
- **Completed:** 2026-09-12T01:23Z
- **Tasks:** 2 (Task 1 `tdd="true"`, RED→GREEN)
- **Files created:** 4 (3 source + 1 test)

## Accomplishments

- **Task 1 — pure wheel logic (node-tested).** `rolodex-logic.ts` owns the correctness-critical math outside the un-loadable `.tsx`: `rollDate` turns the Day axis via local-`Date` arithmetic so a boundary crossing carries Month (and Year at the Dec/Jan seam), while the Month/Year axes carry the year through modular month math; `clampDate` is the leap-aware conventional invalid-date clamp (Aug 31 → Feb → 28/29; a 31st in a 30-day month → 30th); `clampToToday` enforces today-as-max via chronological `YYYY-MM-DD` string comparison. `markerFor` maps Plan 03's `HistoryDateMarker` to a silhouette kind (none/interaction/lifecycle/multiple) plus counts and an a11y label; `formatDrawerSummary` is the lifecycle-inclusive drawer line ("{n interactions · m events}" / "0 events logged"). 18 cases green; the source-discipline grep gate (`toISOString`) is empty.
- **Task 2 — the wheels + browser.** `RolodexWheel.tsx` is one gesture-driven roller: a Gesture-Handler pan drives a Reanimated shared `offset`, each row's depth (opacity/scale) is a single `useAnimatedStyle` reading that offset, and the settle commits a signed step delta to the parent via `runOnJS` — never a per-frame `setState`. The depth worklet `rowDepthStyle` is defined ABOVE its `WheelRow` caller (worklet-forward-ref hazard). Reduced motion (read from the `useReducedMotionShared` `.value` inside the worklet) flattens depth without removing navigation; explicit +/- steppers give the non-gesture a11y path. `RolodexBrowser.tsx` composes Month/Day/Year (Day primary) through `rollDate`, OWNS the `useIsFocused` + `AppState` + `onLayout`-measure lifecycle and conditionally mounts the animated subtree, and renders the drawer with `See details` (populated) / `Log interaction` (empty) callbacks that are the ONLY path to the sheet.

## Task Commits

1. **Task 1 RED** — `f649070` (test): failing rolodex date/marker specs
2. **Task 1 GREEN** — `7015a37` (feat): pure roll/clamp/marker/drawer logic
3. **Task 2** — `c92d378` (feat): RolodexWheel + RolodexBrowser

**Plan metadata:** (docs commit for this SUMMARY + STATE/ROADMAP)

## Files Created/Modified

- `src/components/history/rolodex-logic.ts` — pure date roll/clamp + marker/drawer helpers
- `src/components/history/rolodex-logic.test.ts` — 18 node tests
- `src/components/history/RolodexWheel.tsx` — one gesture-driven roller column
- `src/components/history/RolodexBrowser.tsx` — three synchronized wheels + drawer + lifecycle owner

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed RED (`f649070`, failing `test(...)`) → GREEN (`7015a37`, `feat(...)`); the RED commit precedes the GREEN commit in git log. No refactor commit needed.

## Decisions Made

- **Optional Galaxy Skia glow dropped** — UI-SPEC marks it "MAY add" and the plan prohibits a hardcoded colour in a Skia draw ("read a theme token prop or drop it"). Dropping keeps mechanics identical across themes, avoids a colour-literal risk, and removes a second worklet-forward-ref surface. Wheels are Reanimated + Gesture-Handler only. (This is the review Plan-06 MEDIUM's sanctioned outcome, not a scope cut.)
- **Instant settle re-centre, settle-time state commit** — on release the shared `offset` resets instantly and a signed step delta is committed to React state; an animated snap was rejected because the offset-reset vs. async-state-update ordering risks a visible double-count. Live neighbor fade/scale during the drag is the animated behaviour; feel is a device-UAT tuning point.
- **Year wheel range** — browses 30 years back, capped at today's year; `rollDate` clamps any forward roll past today back to today.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - source discipline] Banned-API + colour literal tokens tripped the gates**
- **Found during:** Task 1 / Task 2
- **Issue:** (a) a doc comment in `rolodex-logic.ts` named `toISOString`, which the plan's source-discipline grep gate expects to return nothing; (b) the lifecycle-marker ring in `RolodexWheel.tsx` set `backgroundColor: "transparent"`, and `transparent` is a `check:colors`-forbidden quoted named colour.
- **Fix:** Reworded the comment to describe the banned API without the literal token (matching Plan 03's precedent); removed the `"transparent"` fill — a View's default background is already transparent, so the ring silhouette is unchanged.
- **Files modified:** `src/components/history/rolodex-logic.ts`, `src/components/history/RolodexWheel.tsx`
- **Verification:** `grep -n toISOString rolodex-logic.ts` empty; `npm run check:colors` on both `.tsx` files exit 0.
- **Committed in:** `7015a37` (comment), `c92d378` (transparent removal)

---

**Total deviations:** 1 auto-fixed (source-discipline tidy, no behaviour change).
**Impact on plan:** None on behaviour or scope. All LOCKED invariants honoured (Day primary; conventional leap-aware clamp; today-as-max; markers silhouette-primary with counts to a11y; no per-frame setState; worklet-forward-ref safe; pause-on-blur owned by the browser; no auto-open).

## Issues Encountered

None beyond the pre-existing, documented `src/components/orrery/orrery-controls-render.test.tsx` load failure (unrelated `Unexpected token 'typeof'` transform issue, logged in 32-01 / 32-03; imports none of this plan's files). Full suite otherwise: **3050 tests pass** across 334 files.

## Known Stubs

None. The wheels are fully wired to Plan 03's markers and the pure logic; the only intentional non-build is the dropped optional Skia glow (documented decision above). The `onSeeDetails` / `onLogInteraction` callbacks are consumer contracts fulfilled by Plan 08's Profile History integration — a seam, not a stub.

## Next Plan Readiness

- **Plan 07** (Shared Detail Sheet + Interaction Detail) provides the sheet the drawer's `See details` opens; the browser already emits the selected `YYYY-MM-DD` for it.
- **Plan 08** (Profile History section integration) mounts `RolodexBrowser`, supplies `markers` from `readContactHistory`, `today = formatLocalDate(new Date())`, and wires `onSeeDetails`/`onLogInteraction` to the sheet and the Log flow.
- **Device UAT (phase gate):** on the Pixel — verify wheel scroll/inertia, marker rendering, pause on blur/background, reduced-motion simplification, and the absence of an undefined-on-device worklet crash. Deferred (device not attached this session).

## Self-Check: PASSED

- Created files verified on disk: `rolodex-logic.ts`, `rolodex-logic.test.ts`, `RolodexWheel.tsx`, `RolodexBrowser.tsx` (+ this SUMMARY).
- Commits verified in git log: `f649070`, `7015a37`, `c92d378`.

---
*Phase: 32-interaction-history-insights*
*Completed: 2026-09-11*
