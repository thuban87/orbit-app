---
status: resolved
trigger: "38.8 gap G1: collapsed History reveal (Last Interaction / View history) scrolls once during 'Loading history…' and never scrolls again after History loads (anchor stuck at y=1342, app bar bottom y=231; 11/11 on the Pixel 3a, global lens Year). Attempted fix 83203b0b (historyContentLayout via ActivityHeatmap onLaidOut) did not change device behaviour."
created: 2026-10-09T15:32:00-05:00
updated: 2026-10-09T16:40:00-05:00
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "In the Year lens the heatmap root's only onLayout has closure width 0 (the grid is already there, so no size change follows the width re-render); onLaidOut is gated on closure width > 0, so it never fires and the reveal never settles."
  confirming_evidence:
    - "diag-year-1: exactly one heatmap onLayout {lens:year, closureW:0, h:562.9}, no historyContentLayout, anchor y=1342"
    - "diag-month-1: two heatmap onLayouts (h 96 -> 313.8), historyContentLayout fires, second scrollTo, anchor y=232"
  falsification_test: "With onLaidOut also firing for a grid that does not wait on the width, a Year-lens collapsed reveal still stops at y=1342 (would mean the scroll is clamped or dropped instead)."
  fix_rationale: "Report onLaidOut on any layout whose render already shows its final grid: measured width for 7 Days/Month/Cycles, every layout for Year and the no-cadence Cycles explanation. That is the signal D-72 intended; host model and screen stay unchanged."
  blind_spots: "Whether the ScrollView content height is already updated when scrollTo is issued from the first (same-commit) Year onLayout — to verify on device."
  candidate_causes:
    - "code: ActivityHeatmap onLaidOut gate assumes every lens's grid waits on the width (confirmed)"
    - "data/config: persisted global lens Year selects the width-independent grid (contributing condition — Month passes)"
  and_gate: "yes — needs both the closure-width gate (code) AND a width-independent grid lens (Year / no-cadence Cycles explanation, persisted global setting). Fixing the gate removes the failure for every lens."
hypothesis (prior): ActivityHeatmap.onLaidOut never fires in the Year lens: the year grid does not depend on the measured width, so the heatmap root gets only ONE onLayout (closure availableWidth=0); setAvailableWidth re-renders but nothing changes size, so no second onLayout and historyContentLayout is never called.
test: temporary console.log at heatmap onLayout (lens, closure width, event width), at historyContentLayout/historyLayout/reveal/expandSettled (pending state) and at the screen scrollTo; run collapsed-History Last Interaction on History Long in the Year lens and in the Month lens.
expecting: Year lens -> one heatmap onLayout with closure width 0 and no historyContentLayout log; Month lens -> second onLayout with width>0, historyContentLayout logs and a second scrollTo.
next_action: none — resolved. Device re-check passed (38.8-DEVICE-PASS.md "## G1 fix re-check (Plan 07)", ea983264); closed out in 38.8-07-SUMMARY.md; knowledge-base entry appended.
bug_class: Bohrbug (deterministic 11/11)

## Symptoms

expected: From a fresh Profile visit with History collapsed, Last Interaction / Orbit Status -> View history expands History and the History title lands just under the app bar (y~232) after History loads.
actual: History expands, one scroll fires while "Loading history…" shows and stops with the History anchor at y=1342 (title y=1388); History loads ~1 s later and no second scroll follows. Already-open History lands correctly (y=232). A manual swipe still moves it up (not end of page).
errors: none (logcat ReactNativeJS clean)
reproduction: Pixel 3a 943AY0JR4P, DEBUG build, Metro :8082; History Long (and History Sparse), global lens Year, History collapsed; fresh Profile visit; tap Last Interaction (or Orbit Status -> View history); wait 5 s; uiautomator dump.
started: always (check 8 in 38.8-06; attempted fix 83203b0b did not change it)

## Eliminated

- hypothesis: the screen drops the second scrollTo (ContactProfileScreen scroll handling)
  evidence: Month-lens run diag-month-1 — the second scroll reached `screen scrollTo {"y":1512,"target":1456,"animated":true,"hasRef":true}` and the anchor landed at y=232. The screen honours a second request ~2 s after the first.
  timestamp: 2026-10-09T15:36:05-05:00

- hypothesis: the pending state is cleared before content lays out (first-layout scroll, collapse/re-render path, stale guard), or HistorySection remounts and loses the callback
  evidence: diag-year-1 — after the first scroll, pending stays "content" through every later hostLayout/historyLayout (`historyLayout {"expanded":true,"pending":"content"}`); HistorySection renders with hasCb:true each time; nothing resets it. The callback is simply never invoked.
  timestamp: 2026-10-09T15:40:00-05:00

## Evidence

- timestamp: 2026-10-09T15:30:00-05:00
  checked: ActivityHeatmap.tsx onLayout / grid render
  found: onLaidOut is called only from an onLayout whose render closure already had availableWidth > 0. The Year grid renders at fixed HEATMAP_GEOMETRY.yearCellEdge regardless of availableWidth (only Cycles and 7 Days/Month wait on a measured width). The G1 re-check runs used global lens Year.
  implication: in the Year lens (and Cycles-unavailable) the heatmap root may never get a second onLayout, so onLaidOut would never fire. Needs device confirmation.

- timestamp: 2026-10-09T15:30:00-05:00
  checked: ContactProfileScreen onRequestScrollTo
  found: plain scrollRef.current?.scrollTo({ y: profileScrollTargetY(y), animated: !reducedMotion }); no dedupe or in-flight guard. onCollapseCommitted reloads the Profile snapshot (historyRevision bump) without unmounting the host.
  implication: a second scrollTo would not be dropped by the screen code itself; still to confirm on device.

- timestamp: 2026-10-09T15:36:05-05:00
  checked: device run diag-month-1 (History Long, global lens Month, History collapsed, Last Interaction), G1DBG logs via Metro + logcat (both channels moved)
  found: reveal(needsExpand) -> expandSettled(true) -> historyLayout(1060, expanded) -> scroll (pending expand->content) -> screen scrollTo y=1512 while loading; loaded render; heatmap onLayout #1 {"lens":"month","closureW":0,"h":96}; heatmap onLayout #2 {"closureW":326.5,"h":313.8} -> historyContentLayout {"pending":"content"} -> scroll -> screen scrollTo y=1512. Anchor lands at y=232.
  implication: the D-72 settle works when the heatmap grid waits on the measured width (Month); the second layout comes from the grid appearing.

- timestamp: 2026-10-09T15:40:00-05:00
  checked: device run diag-year-1 (same, global lens Year)
  found: identical up to the loaded render; then exactly ONE heatmap onLayout {"lens":"year","closureW":0,"w":326.5,"h":562.9} (the year grid is already in that layout) and no further heatmap onLayout, no historyContentLayout log, no second scrollTo. Anchor stuck at y=1342, title y=1388 — the exact G1 symptom.
  implication: ROOT CAUSE CONFIRMED. ActivityHeatmap.onLayout reports onLaidOut only when its render closure already had availableWidth > 0. The Year grid (fixed yearCellEdge) never waits on the width, so its only layout has closure width 0 and the setAvailableWidth re-render changes no size, so no second layout event ever arrives. Same for the no-cadence Cycles explanation (text, no grid). The G1 re-check ran entirely in the Year lens.

- timestamp: 2026-10-09T15:41:00-05:00
  checked: src/components/heatmap-fit.ts fitHeatmapCell
  found: returns null only for width <= 0 / non-finite; any measured width gives an edge >= 1, so a width-dependent grid always appears on the measured render and changes the root's height (second layout guaranteed for 7 Days / Month / Cycles with cadence).
  implication: the set of lenses with no second layout is exactly: Year, and Cycles without a cadence.

## Resolution

root_cause: src/components/history/ActivityHeatmap.tsx onLayout (83203b0b) calls onLaidOut only when the render closure already had availableWidth > 0. The Year grid (fixed yearCellEdge) and the no-cadence Cycles explanation do not wait on the measured width, so their first layout is already final and no second layout event follows; onLaidOut never fires, HistorySection's onContentLayout -> scroller.historyContentLayout never runs, and the expanding reveal stays pending ("content") after its clamped first scroll.
fix: ActivityHeatmap reports onLaidOut on any layout whose grid is final — `gridWaitsOnWidth = lens === "cycles" ? cycles.available : lens !== "year"`; `if (!gridWaitsOnWidth || availableWidth > 0) onLaidOut?.()`. Host model, HistorySection wiring and the screen are unchanged (comment-only touch in HistorySection). Commits: 5fed8265 (RED tests), 9bcb48b7 (fix), ea983264 (device-pass record).
oracle_type: specified (D-72: the reveal settles once History's loaded content lays out; heatmap contract: report the first layout that shows the final grid)
verification:
  target_test: { result: pass, test: "src/components/history/activity-heatmap-render.test.tsx: ActivityHeatmap reports its laid-out grid (D-72) — Year / Cycles without a cadence first layout; boundary neighbours 7 Days / Month / Cycles unmeasured (not reported) and measured (reported)" }
  mutation_check: { result: pass, reason_if_skipped: "Stryker not installed; ran 5 manual mutants at the fix site instead", mutant_killed: "5/5 (revert gate -> 2 fail; drop Year -> 1; drop cadence -> 1; always report -> 3; invert -> 5)" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: n/a (additive condition) }
  adjacent_tests: { result: pass, suites_run: ["full vitest: 576 files / 7038 tests"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, note: "unit: gate revert -> RED; device: diag-year-1 (pre-fix, y=1342) vs diag-yearfix-1 (fix, y=232) on the same instrumented path" }
  gates: { tsc: pass, check_colors: pass, biome_changed_files: pass }
  device: "Pixel 3a 943AY0JR4P DEBUG, HEAD 9bcb48b7, clean bundle (fix present, probes absent): LI 5/5, VH 5/5 (+1), Sparse Year 1/1, already-open LI+VH one scroll, Cycles 1/1, Month 1/1, G2 pass"
  guardrail_verdict: accepted
files_changed: [src/components/history/ActivityHeatmap.tsx, src/components/history/HistorySection.tsx, src/components/history/activity-heatmap-render.test.tsx]
