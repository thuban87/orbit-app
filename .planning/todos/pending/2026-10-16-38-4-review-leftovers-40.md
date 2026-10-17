---
created: 2026-10-16
title: 38.4 code-review Info findings left for release hardening (glass palette scope, FAB unmount, dialog re-measure)
area: ui
severity: minor
files:

  - src/theme/theme-provider.tsx
  - src/components/profile/ProfileBackgroundManager.tsx
  - src/components/profile/ProfileLayoutEditor.tsx
  - src/components/UniversalFab.tsx
  - src/navigation/RootNavigator.tsx
  - src/components/ui/ConfirmDialog.tsx

target_phase: 40
source: 38.4-REVIEW.md Info findings, from todo 2026-09-28-38-4-review-info-findings (now in completed/). Re-checked against the code on main @ 33cdad8d, 2026-10-16; owner approved routing them to Phase 40, 2026-10-16.
---

Still present on 2026-10-16. Numbers are the original todo's; review ids in brackets. Phase 40 should decide on each one: fix it, or leave it on purpose.

- **11 [B2 IN-04]:** the glass foreground palette is keyed on the *stored* background, not the one actually rendered (`theme-provider.tsx:83-93`, `backgroundIsAsset` from `resolveBackground(…, storedId)`). That affects three cases: the Orrery (which forces `none`); after a background image fails and falls back to solid; and glass cards inside opaque sheets (`ProfileBackgroundManager.tsx:267`, `ProfileLayoutEditor.tsx:125`). In all three, secondary text flattens to primary and status/accent text darkens. Contrast still passes. The review suggested 38.5, but 38.5 did not take it.
- **5 [A IN-07]:** nothing happens today. `UniversalFab` never closes its dial on unmount (`closeDial` exists, but no unmount cleanup calls it), while `RootNavigator.tsx:157-158` hides the whole app from TalkBack while the dial is open. If the + were remounted with its menu open, the app would stay hidden from TalkBack.
- **8 [B2 IN-01]:** no current screen triggers this. `ConfirmActions` decides row-vs-stacked once and never re-measures (`ConfirmDialog.tsx:219-236`; `measure` returns early once the layout is set). If a dialog's labels got longer, or the font size changed while it was open, the side-by-side buttons could spill out of the card.

Full write-ups are in `.planning/phases/38.4-audit-remediation-ui-performance-release/38.4-REVIEW.md`.
