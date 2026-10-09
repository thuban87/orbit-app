---
audit_acknowledged:
  milestone: v1.0
  at: 2026-09-02
  status: unknown
---

# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## android17-blank-main-activity — Metro startup was judged before the React Native dashboard became ready

- **Date:** 2026-08-29
- **Error patterns:** Android 17, blank MainActivity, dark background, empty FrameLayout, Metro bundle, React Native startup, SQLite not initialized
- **Root cause(s):** Premature device-UAT observation during Metro/React Native debug startup; no persistent blank-MainActivity defect reproduces in the exact 19-17 APK.
- **Fix:** No source change. Use a semantic device-ready assertion (for example, uiautomator finds 'Your week') with a bounded wait before judging launch success.
- **Files changed:** .planning/debug/resolved/android17-blank-main-activity.md
- **Why not caught:** No Phase 19 device-UAT readiness gate existed; the verification step used an immediate visual/content probe rather than a bounded semantic wait.
- **Recurrence guard:** Phase 19 Android UAT waits, with a bounded timeout, for `uiautomator` text `Your week` before recording launch failure; this knowledge-base pattern is the durable fallback because MemPalace is unavailable.

---

## missing-system-switch-animation — Loading unmounted the Orrery transition owner

- **Date:** 2026-09-09
- **Error patterns:** System switch, no animation, settled destination, missing spin, missing shedding/capture, OrreryWorld unmount
- **Root cause(s):** The System store published `snapshot=null` while a different System loaded, so OrreryScreen unmounted OrreryWorld—the sole owner of the outgoing world and transition shared values—and the destination remounted already settled.
- **Fix:** Retain the last ready snapshot while a System load is pending; explicitly clear it if a different-System load fails.
- **Files changed:** src/stores/orrery-system-store.ts, src/stores/orrery-system-store.test.ts
- **Why not caught:** Pure transition math, renderer wiring, type checking, and review had no integration gate covering the pending store snapshot together with OrreryScreen's conditional OrreryWorld mount.
- **Recurrence guard:** Regression test `keeps the prior world mounted while a different System loads, then clears it if the switch fails` in `src/stores/orrery-system-store.test.ts`; revert-and-reconfirm proves it fails against the former lifecycle.

---

## g1-history-reveal-no-settle — A layout-settle callback that only fired after a measured-width re-render

- **Date:** 2026-10-09
- **Error patterns:** History reveal stops short, collapsed History, Last Interaction, View history, Loading history placeholder, scrollTo clamped, onLayout fires once, onLaidOut never fires, Year lens, settle scroll missing
- **Root cause(s):** `ActivityHeatmap` reported `onLaidOut` only from a layout whose render already had a measured width. The Year grid (fixed cell edge) and the no-cadence Cycles explanation do not depend on the width, so their first layout is final and the width re-render changes no size: no second layout event, so `historyContentLayout` never ran and the expanding reveal stayed pending at its clamped first scroll.
- **Fix:** Report `onLaidOut` on any layout whose grid is final: `gridWaitsOnWidth = lens === "cycles" ? cycles.available : lens !== "year"`; fire when `!gridWaitsOnWidth || availableWidth > 0` (`9bcb48b7`, RED tests `5fed8265`).
- **Files changed:** src/components/history/ActivityHeatmap.tsx, src/components/history/HistorySection.tsx (comment only), src/components/history/activity-heatmap-render.test.tsx
- **Why not caught:** The first fix's tests covered the width-dependent lenses only; the device check ran in the Year lens, where the screen-level behaviour differs. A component test cannot see that RN delivers no second `onLayout` when nothing changes size.
- **Recurrence guard:** `activity-heatmap-render.test.tsx` "ActivityHeatmap reports its laid-out grid (D-72)" covers Year and Cycles-without-cadence first layouts plus the width-dependent boundary cases. Rule of thumb: a "content is ready" layout signal must fire on the first final layout, never assume a second layout will follow.

---
