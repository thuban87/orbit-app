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
