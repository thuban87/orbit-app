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

- **E-7 — Galaxy Light coral `accentText` on the presentation-density card: RESOLVED (D-28, 2026-09-26).**
  Found when D-26 put `accentText` under the both-extrema proof in every package and mode: `#B03A26`
  measured 4.48:1 (floor 4.5) against the 0.88 opaque Galaxy Light card over the darkest Galaxy pixel.
  The owner ruled (D-28) to darken coral's shared light tone about 1% HSL lightness, same hue and
  saturation. `ACCENTS.coral.light.text` is now `#AC3925` (L 41.96 → 40.98). Galaxy Light: presentation
  card 4.63, comfortable 5.18, dense 5.67, chrome 5.67. Standard Light opaque links (shared tone):
  5.62 / 6.24 / 6.14 (background / surface / elevated). The held proof exclusion is removed, so the
  proof asserts coral everywhere. Commits `f446484` (test) and `d8a9ba1` (fix). Details:
  `38.4-RG029-INVENTORY.md` §4 E-7; device check in §6.

## From Plan 06 (2026-09-26)

- **Touchpoint duration chips: selection shown by border colour only.** `TouchpointRefineForm.tsx`
  preset/None chips carry `accessibilityState.selected` (so TalkBack is correct), but the visible
  selected mark is only the `colors.accent` border. Not among the AUD-UIA-005 cited sites and not in
  Plan 06's behavior list, so it was left as is. Candidate fix: a filled `select` glyph or a fill
  change on the selected chip.
- **`RelationshipEditor.tsx` unused `Pressable` import** (biome `noUnusedImports` warning). It predates
  Plan 06 and Plan 06 did not cause it. It was left alone to keep the task diff scoped.
