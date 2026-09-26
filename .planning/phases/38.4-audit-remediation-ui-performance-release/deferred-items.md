# 38.4 deferred items (out-of-scope discoveries)

## From Plan 03 (RG-029)

- **F-1 — owner device review in Plan 17 (D-27).** Functional text sits bare on the Standard-Light
  shell background (not glass). Owner ruling D-27 (2026-09-26): not fixed in Plan 03; the owner reviews
  it on the device in Plan 17 and then decides defer vs fix. Site list: `38.4-RG029-INVENTORY.md` §5. The RG-029
  inventory trace found many functional text sites with no glass and no opaque backing:
  - load-error and helper captions
  - Your Week's error
  - `DashboardControlRow` errors
  - Settings AI/Notifications helpers
  - `MergeImpactSummary`
  - LogInteraction/EditInteraction form errors

  These sit directly on the veiled asset (veil 0.05–0.30). Over the darkest Dusk/Mesh pixels even
  `textPrimary` measures 1.31–4.41:1. They are outside RG-029's glass proof and outside Plan 03's file
  scope, because the fix touches consumer files other plans own (wrap them in
  `ChromeScrim`/`GlassSurface` or give them opaque backings). Full list and numbers:
  `38.4-RG029-INVENTORY.md` §5 and Table A (class *bare*). This goes to the owner and the Plan 17
  device pass.

- **E-7 — Galaxy Light coral `accentText` on the presentation-density card: HELD for the owner.** Found
  when D-26 put `accentText` under the both-extrema proof in every package and mode. `#B03A26` measures
  4.48:1 (floor 4.5) against the 0.88 opaque Galaxy Light card over the darkest Galaxy pixel. Comfortable,
  dense and chrome clear it. Fixing it means either retuning a curated accent tone in `accents.ts`,
  widening the glass scope, or accepting an exception. All three are owner-bucket under the D-24 STOP
  rule, so it is held as a scoped proof exclusion. Details: `38.4-RG029-INVENTORY.md` §4 E-7.
