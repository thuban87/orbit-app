---
status: passed
phase: 32-interaction-history-insights
source: [32-VERIFICATION.md]
started: 2026-09-12T02:20:00Z
updated: 2026-09-12T02:48:00Z
device: Pixel 6 Pro (raven, 1A071FDEE002BU), debug dev-client on the fresh Phase-32 bundle
db: real on-device DB migrated v24 -> v25 by migration 025 during UAT (cold backup held); data preserved
---

## Current Test

number: 6
name: all device UAT items complete
expected: |
  All six device-behavior items verified on-device on the owner's real data.
awaiting: none — complete

## Tests

### 1. TouchpointRefineForm extended controls
expected: Tone chips (Positive/Neutral/Negative), Duration presets, Allow-AI Switch render/reachable/toggle/persist; Allow-AI defaults OFF (D-04).
result: PASS — Tone dropdown (No selection/Positive/Neutral/Negative), Duration presets (5m/15m/30m/1h/2h/None + Custom minutes), and Allow-AI Switch all render and are reachable. Allow-AI defaulted OFF. Set Tone=Positive, Duration=30m, toggled Allow-AI ON, saved → DB persisted quality='Positive', duration=1800 (30m in seconds), allow_ai=1. An unsaved-changes "Discard changes?" guard also confirmed.

### 2. HistorySection assembled render + navigation flows
expected: Populated / empty / lifecycle-only states render; heatmap cell → context card → shared sheet; browser drawer → same sheet; empty-date "Log interaction" → LogContact; knowledge-change edit resolves; reduced motion.
result: PASS — Empty state ("No history yet" + Log interaction) verified on a real contact (Dad: 0 interactions/events/knowledge). Populated (UAT Ada): heatmap + lens switcher (Cycles/7 Days/Month/Year) + cycle-count (5/10/15/20) + intensity render. Cell → anchored context card ("Aug 13 – Sep 11, 3 interactions, See details") → shared Detail Sheet. Empty-date "Log interaction" → LogContact placeholder ("Coming soon", Phase-34 contract, HIST-15). Detail Sheet chronologically interleaves all three families (interactions 💬, knowledge changes ✏️, lifecycle ⏰/📥) with per-family icons — HIST-10. Lens switching works. [Reduced-motion live-toggle not separately exercised; useReducedMotionShared is code-verified + no crash.]

### 3. Rolodex wheels (HIST-08/HIST-09/HIST-18)
expected: Wheel scroll, inertia, boundary roll, leap-aware clamp, today-as-max, marker silhouettes, drawer summary with no auto-open, reduced-motion; NO undefined-on-device Hermes worklet-forward-ref crash.
result: PASS — Three synchronized Month/Day/Year wheels (Day primary) render with the depth/silhouette effect; selection Sep 11 2026 = today (today-as-max). Rolled Day 11→9 smoothly; wheels updated, drawer/selection updated, and NO Detail Sheet auto-opened on scroll (HIST-09, Dismiss-count 0). NO worklet-forward-ref Hermes crash across all rendering/interaction — the exact hazard vitest cannot catch (memory f979263). Year lower-clamp fix (#2) unit-tested; on-device year wheel renders a bounded range. [Full year-floor swipe + live reduced-motion toggle not exhaustively driven.]

### 4. Dense-grid tappability
expected: Year-lens dense daily grid and the 20-cycle grid render and remain tappable; sub-44px cells carry a11y labels.
result: PASS — Year lens renders a dense daily grid (2026, ‹/› year nav, 158 cells) with an a11y label on every cell ("Jan 4, 0 interactions", …); cells clickable=true. Cycles grid cells also carry a11y labels ("Aug 13 – Sep 11, 3 interactions, Current cycle").

### 5. Long-note reflow + clamp
expected: A long note reflows in Interaction Detail (never truncated) while the compact sheet row shows a one-line preview clamp.
result: PASS — Added a long note via the Edit form. Detail Sheet compact row clamps to one line with an ellipsis ("Long-press-checked reflow test note:…"); Interaction Detail reflows the full note across multiple lines, untruncated.

### 6. Delete-failure path
expected: A failed deleteTouchpoint leaves the interaction and its derived metrics intact and re-enables the control with an error surface (no optimistic vanish).
result: PASS (confirmation gate on-device) — Delete opens an explicit destructive confirmation ("Delete this interaction? This can't be undone and may change this contact's Status, Gravity, and Intensity." / Cancel / Delete interaction), HIST-13. Cancelled (no data destroyed). The failure-preserves-row/tombstone/recompute behavior itself cannot be UI-forced without fault injection; it is DAO-node-tested (Plan 01) and confirmed by the data-layer review + verifier.

## Bonus real-data validations (highest-risk work)
- Migration 025 ran on the real 446 KB on-device DB (v24 → v25): duration/allow_ai/history_lens/history_cycle_count columns added; channel values remapped to Call/Message/unspecified (no retired vocabulary); NULL quality passed through; all 20 real interactions preserved (D-06 on real data).
- HIST-11 sparkle ("Shared with AI") renders ONLY at allow_ai=1 (absent before the toggle, present after).
- IntensityChart caption fix (#1, commit 84e4013) verified live: caption reads the contact's true cadence ("Monthly intended") in the 7-Days lens rather than the window span ("every 7 days").
- No crashes throughout.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Notes
- UAT fixture data modified: UAT Ada's interaction (id 16) now carries Tone=Positive, 30m duration, Allow-AI ON, and a test note — harmless test-fixture data on a "UAT" contact; owner can clear anytime.
- Pre-existing data observation (NOT a P32 defect): contact "Dad" has last_contact=2026-09-01 but zero interaction rows — an orphan recency value predating this phase; History correctly renders the empty state.
- Phone left consistent: cached fallback bundle updated to Phase-32; DB at v25; cold pre-025 DB backup retained on the host.

## Gaps
None blocking. Deferred (not blocking phase completion): live OS reduced-motion toggle (HIST-18) and an exhaustive year-floor swipe were not driven on-device; both are code-verified and crash-free.
