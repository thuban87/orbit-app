# 38.4 deferred items (out-of-scope discoveries)

**Dispositions (owner rulings 2026-09-26, D-29..D-41).** Every item below now has a home. None is left undispositioned.
D-38 (2026-09-26) supersedes D-29, D-35 and D-36: bare text on the background art leaves 38.4 and moves to Phase 38.5.

| Item | Disposition |
|---|---|
| F-1 bare text on Standard art (Plan 03) | **Moved to Phase 38.5 (D-38).** Was Plan 16 Task 3 (D-29, which superseded D-27); that task is cancelled |
| F-1 in Standard Dark (owner, 2026-09-26) | **Moved to Phase 38.5 (D-38).** Was Plan 16 Task 3 (D-35); cancelled. The D-35 Standard Dark measurements are a 38.5 input |
| F-1 site list incomplete: §5 came from a six-token grep (owner, 2026-09-26) | **Moved to Phase 38.5 (D-38).** Was Plan 16 Task 3 (D-36); cancelled. The art brief's AST inventory (`38.4-art-brief/bare-text-sites.csv`, 294 sites) is the current list and a 38.5 input |
| E-7 Galaxy Light coral (Plan 03) | **Resolved** (D-28), commits `f446484`/`d8a9ba1` |
| Touchpoint duration chips, border-only selection (Plan 06) | **Plan 20 Task 2** — filled accent chip + `onAccent` label (D-30; moved from Plan 16 by D-34) |
| `RelationshipEditor.tsx` unused `Pressable` import (Plan 06) | **Plan 20 Task 3** (planner-bucket nit; moved from Plan 16 by D-34) |
| Bare `TYPOGRAPHY.<role>.family` outside the contact renderers (Plan 08) | **Plan 20 Task 3** (planner-bucket nit; moved from Plan 16 by D-34) |
| Glass-scope colours read above the scope, so the D-24 variants never render (owner, 2026-09-26) | **Plan 20 Task 1** (G3, D-34): read-site sweep plus an AST source contract |
| Open FAB dial does not trap keyboard focus (Plan 11) | **Plan 12 Task 3** (D-31) |
| `Sheet` detail variant clips its actions at large text (Plan 11) | **Plan 18** (G1, D-32) |
| Stale Profile scroll after a warm deep link / Quick Log snackbar (Plan 11) | **Plan 19 Task 3**, check E (G2, D-33) |
| Contacts screen freeze on population/filter/sort (owner report, 2026-09-26) | **Plan 19** (G2, D-33, `GAP-G2`) |

## From Plan 03 (RG-029)

- **F-1 — DISPOSITION: moved to Phase 38.5 (D-38, 2026-09-26; supersedes D-29, D-35 and D-36).** Not fixed in 38.4, and not a 38.4
  failure. The art brief (`38.4-BACKGROUND-ART-BRIEF.md`) showed that one image cannot serve both light and dark mode, so 38.5 regenerates
  the art as separate light and dark versions (D-39) and applies scrims only where the owner's signed-off combination sheet says (D-40).
  *History:* D-27 deferred it to the Plan 17 device review; D-29 then scheduled a Plan 16 scrim on Standard-Light Dusk/Mesh, D-35 extended
  it to Standard Dark on all four backgrounds, and D-36 required a complete AST site list. D-38 cancelled that task.
  Original note follows. Functional text sits bare on the Standard-Light
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

- **Touchpoint duration chips: selection shown by border colour only. DISPOSITION: Plan 20 Task 2 (D-30; moved from
  Plan 16 by D-34): the selected chip is filled with the accent fill and gets an `onAccent` label.** `TouchpointRefineForm.tsx`
  preset/None chips carry `accessibilityState.selected` (so TalkBack is correct), but the visible
  selected mark is only the `colors.accent` border. Not among the AUD-UIA-005 cited sites and not in
  Plan 06's behavior list, so it was left as is. Candidate fix: a filled `select` glyph or a fill
  change on the selected chip.
- **`RelationshipEditor.tsx` unused `Pressable` import. DISPOSITION: Plan 20 Task 3** (moved from Plan 16 by D-34; biome `noUnusedImports` warning). It predates
  Plan 06 and Plan 06 did not cause it. It was left alone to keep the task diff scoped.

## From Plan 08 (2026-09-26)

- **Bare semantic `TYPOGRAPHY.<role>.family` still assigned outside the contact renderers. DISPOSITION:
  Plan 20 Task 3** (moved from Plan 16 by D-34; swap plus typography source-scan extension). Plan 08
  moved `resolveFontFamily` into `src/theme/tokens/typography.ts` and put `ListRow`/`GridCard` (the
  AUD-UIA-015 cited "contact renderers") on the registered keys. The same unregistered-family pattern
  remains in `HomeScreen.tsx` (selection count, selection action label, bulk-picker title/label),
  `CardContextMenu.tsx` (title, label) and `BulkActionSurface.tsx` (pending label, action label, sheet
  title). Not cited by AUD-UIA-015 and outside Plan 08's file scope. Candidate fix: the same one-line
  `fontFamily: resolveFontFamily(TYPOGRAPHY.<role>.family, TYPOGRAPHY.<role>.weight)` swap, plus
  extending the `typography.test.ts` source scan to cover those files.

## From Plan 11 (2026-09-26)

- **Open FAB dial does not trap keyboard focus. DISPOSITION: Plan 12 Task 3 (D-31).** The background is hidden
  from accessibility while the dial is open, and the dial gets a keyboard focus cycle. With the speed dial OPEN, keyboard TAB still walks
  the background screen (Digest filters, tab bar) before reaching the scrim and the six actions
  (`ev11/rg039-fix-tab-open.log`). The dial's only modal marker is the iOS-only
  `accessibilityViewIsModal`. This predates Plan 11 and is not the RG-039 closed-state defect
  (AUD-UIA-023), which Plan 11 fixed. Whether TalkBack swipe traversal also escapes the open dial is
  part of the Plan 17 owner TalkBack check. Candidate fix: while open, mark the tab navigator /
  screen content `importantForAccessibility="no-hide-descendants"` (the 38.3 RG-020 shell-transient
  pattern) or close the dial when focus leaves it.
- **`Sheet` `detail` variant clips its actions at large text, with no scroll. DISPOSITION: Plan 18 (G1, D-32).**
  Compact and detail sheets get a bounded scroll body. At font_scale 2.0 on
  the Pixel 3a (≈320dp and ≈349dp), InteractionDetail's detail sheet (`maxHeight: 60%`,
  `overflow: "hidden"`, no ScrollView in `Sheet.tsx`/`InteractionDetail.tsx`) clips its Edit/Delete
  row below the sheet edge. The buttons are absent from the accessibility dump and touch cannot
  reach them. Only keyboard focus reaches them (`38.4-INVESTIGATIONS.md` RG-034,
  `rg034-B-detail-sheet.xml`). Found while driving the RG-034 long-body confirmation. This is not the
  ConfirmDialog defect, and no 38.4 plan owns `Sheet` large-text overflow. Candidate fix: a
  ScrollView body for non-expanded Sheet variants (`Sheet.tsx` already notes the large-font clip
  risk at `overlayContent`). It needs its own device check across the Sheet consumers.
- **Stale profile scroll after a warm `orbit://contact/<id>` deep link (automation observation). DISPOSITION:
  Plan 19 Task 3, check E (G2, D-33)** — recorded as not reproduced, same cause, or distinct; fixed or surfaced. Twice in the Plan 11 session, a warm deep link or a Quick Log snackbar left the
  profile ScrollView ignoring injected swipes until a cold start. It may be an adb-injection
  artifact. Worth a finger check before treating it as an app bug.

## Owner report (2026-09-26)

- **Contacts (Home) screen freeze. DISPOSITION: Plan 19 (G2, D-33, `GAP-G2`).** Choosing a population, filter or
  sort-order action at the top of the Contacts screen makes the app unresponsive: tabs cannot be switched and a
  force-restart is needed. The setting change is persisted. The owner reproduced it on the Pixel 3a by changing
  population. It was not tracked anywhere before. Plan 19 is investigation-first.

## Owner findings (2026-09-26, after the D-29..D-33 replan)

- **Glass-scope colours read above the scope. DISPOSITION: Plan 20 Task 1 (G3, D-34).**
  - Plan 03's `GlassForegroundScope` changes only colours read by a hook called inside the scope. Many hosts read `colors`
    at the top of the screen and use them inside a `GlassSurface`/`ChromeScrim`, so those foregrounds render the root tone.
    The D-24 variants and the secondary→primary override never reach them.
  - Confirmed: `AIPersonalizationScreen.tsx:139` → `:655` (`danger`), `DigestScreen.tsx:227` → `:249` (`danger`), and the
    `GridCard` captions (the inventory §6 "secondary → primary" claim does not hold for them today).
  - Planning-time AST scan: 48 out-of-scope reads in 17 files. The owner estimated about 77 across about 30 by a coarser grep.
  - Plan 20 moves each read inside the scope (`ScopedPalette` or an extracted child) and adds an AST source contract.
- **F-1 also fails in Standard Dark, on all four Standard backgrounds. DISPOSITION: moved to Phase 38.5 (D-38); was Plan 16 Task 3 (D-35).** Bare
  Standard Dark `textPrimary` measures 1.15–2.97:1 over the veiled art (numbers in CONTEXT D-35). The scrim there is opaque
  `surface` (`chromeScrimOpacity` 1.0), giving 14.41:1. These measurements are a Phase 38.5 input.
- **F-1 site list was incomplete. DISPOSITION: moved to Phase 38.5 (D-38); was Plan 16 Task 3 (D-36).**
  - The §5 list came from a grep of six tokens. Missed examples: `TouchpointRefineForm` labels under LogInteraction/EditInteraction,
    the Your Week metric labels, the UpdateContact editor text and the "Add photo" link.
  - The planned Plan 16 enumeration (Table D), wrapping and contract test are cancelled (D-38). The art brief's AST inventory
    (294 bare sites on 50 routes: 100 hand-verified, 194 script-found; plus 24 mixed components) is the current list, carried to 38.5.
