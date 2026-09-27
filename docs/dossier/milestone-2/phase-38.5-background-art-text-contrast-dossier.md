# Phase 38.5 --- Background Art & Text-on-Art Contrast Dossier

**Status:** DEFERRED PLANNING. It needs a discuss-phase first. **Prerequisite:** the owner-signed scrim combination
sheet (38.4 D-40). Authored 2026-09-26 at phase insertion, from the owner rulings 38.4 D-38..D-41 and the 38.4
background-art brief. No discuss session has run yet.

## Decision Legend

-   **[DECIDED]** explicitly chosen by the owner.
-   **[OPEN]** an owner decision still to be made (discuss-phase).
-   **[DERIVED]** a consequence of a decision or of a measured fact.
-   **[PLANNING NOTE]** a repository finding or engineering follow-up to verify at planning time.

## Objective

Every piece of text over shipped background art is readable, meeting the WCAG floors (4.5:1 for text and links, 3:1 for
status glyphs and large text), in every theme × mode × background combination. The primary lever is the art itself:
separate light and dark versions of each background. Scrims apply only where the owner's signed-off combination sheet
puts them. User-uploaded custom backgrounds are excluded.

## Why This Phase Exists

-   38.4 Plan 03's RG-029 inventory found functional text sitting directly on the veiled background art, with no glass
    and no opaque backing (finding **F-1**). It fails contrast.
-   38.4 first planned a scrim for it: D-29 (Standard Light, Dusk/Mesh), D-35 (Standard Dark, all four backgrounds) and
    D-36 (a complete AST site list). The scrim task was never executed.
-   The 38.4 background-art brief then showed that **one image cannot serve both light and dark mode** (numbers below).
    The owner moved the whole problem here (D-38).
-   This work belongs to RG-029's desired outcome, "functional content meets the approved contrast contract under real
    compositions." 38.4 closes RG-029's glass proof (`ui-accessibility/AUD-UIA-001`) and the Backup/Restore role
    foregrounds (`ui-accessibility/AUD-UIA-002`). This phase carries the bare-text remainder.

## Carried Decisions (owner, from Phase 38.4, 2026-09-26)

-   **[DECIDED · 2026-09-26] 38.4 D-38 --- Bare text on art leaves 38.4 for this phase.** The Plan 16 scrim task
    (D-29/D-35/D-36) is cancelled, and D-38 supersedes those three decisions. Bare text on art is not a 38.4 failure. 38.4
    ships no artwork, glass or veil change (38.4 D-12 still holds there). 38.4 Plan 16 still swaps accent-fill text
    misroles to `accentText`, including on bare art (ADR-084 role; the brief's bands assume it, OD-6).
-   **[DECIDED · 2026-09-26] 38.4 D-39 --- Both packages keep both modes; separate light and dark art.** Galaxy and
    Standard each keep a light and a dark mode. The earlier "theme merge" meant restricting backgrounds to their own
    package, which is already implemented. It never meant collapsing the packages into one Dark/Light switch; do not
    propose that. The fix direction is separate light and dark art per background. The owner may cut one background per
    theme, giving about 12 images (3 per package × 2 modes). Galaxy light mode may use **different pictures** rather than
    recoloured dark ones.
-   **[DECIDED · 2026-09-26] 38.4 D-40 --- Scrims are not abolished; the owner picks each combination from a sheet.**
    Buttons that open overlay menus (for example the Contacts top action buttons and the Orrery dropdown buttons), and
    the overlay menus themselves, keep their scrims. The treatment per combination (full scrim, transparent scrim or no
    scrim; per component, per theme × mode × background) comes from a **screenshot sign-off sheet**. A separate agent
    produces it during 38.4 execution. The owner-signed sheet is a **prerequisite for starting this phase**. The planner
    does not choose scrim placement.
-   **[DECIDED · 2026-09-26] 38.4 D-41 --- User-uploaded backgrounds are excluded.** Custom uploads (for example contact
    profile background photos) carry no contrast guarantee. If a user's picture makes text hard to read, the user picks a
    different picture, which is the industry-standard behaviour. There is no engineering to adapt text to arbitrary uploads.
-   **[DERIVED] Who decides, as in 38.4.** Any fix that retunes a protected hue (ADR-084), changes glass or veil opacity
    (ADR-115), or reverses a recorded ADR/HANDOFF decision is the owner's call. Art direction and look are the owner's.

## Primary Input: the 38.4 Background-Art Brief

**Path:** `.planning/phases/38.4-audit-remediation-ui-performance-release/38.4-BACKGROUND-ART-BRIEF.md`. The supporting
files are in `38.4-art-brief/` next to it: per-image heat maps, band example sheets (`band-examples-galaxy.png`,
`band-examples-standard.png`), CSV grids, the bare-site list `bare-text-sites.csv` and the self-check script `check_art.py`.
It was written against `738ae12`. Its numbers carry MEASURED / COMPUTED / ESTIMATED labels; keep them.

### Target art bands per package × mode (brief §E.2; presentation veil, pre-veil art; COMPUTED)

| Package × mode | Allowed art lightness | Grey edge | Binding colour | Design target | If red `danger` were exempt (E-1 extended) |
|---|---|---|---|---|---|
| Galaxy Dark | L\* ≤ 8.2 | `#181818` | `danger` `#E5484D` | L\* 0–6 | L\* ≤ 18.5 (`#2D2D2D`); target ≤ 16 |
| Galaxy Light | L\* ≥ 87.1 | `#DADADA` | coral link `#AC3925` | L\* 89–97 | same |
| Standard Dark | L\* ≤ 21.7 | `#343434` | `danger` `#FF6B6B` | L\* 3–19 | `textSecondary` ≤ 24.4 |
| Standard Light | L\* ≥ 86.7 | `#D9D9D9` | coral link `#AC3925` | L\* 89–97 | same |

-   **No single band works across modes** (brief §E.4). For Galaxy the ranges are ≥ 87.1 vs ≤ 8.2 (or 18.5); for Standard,
    ≥ 86.7 vs ≤ 21.7. Even with `textPrimary` as the only bare colour they do not overlap: Galaxy ≥ 55.5 vs ≤ 45.2,
    Standard ≥ 53.2 vs ≤ 46.8. That is why D-39 chose separate light and dark art.
-   A denser veil barely helps (§E.3). Bare text also appears on presentation-density routes, so the presentation band
    governs.
-   Art that meets its bare band keeps every existing card and app-bar proof passing, because those ranges are looser (§D).

### How far the current art is from its band (brief §F; COMPUTED from MEASURED pixels)

-   **Galaxy art** passes Galaxy Dark except red `danger` text on the brightest wisps (under 0.1% to 1.3% of pixels). It fails
    Galaxy Light on 100% of pixels.
-   **Standard art** fails Standard Light on 94–100% of pixels, **including Dawn and Paper** (brief OD-3). Bare
    `textSecondary` is 2.95:1 on Dawn and 2.60:1 on Paper. It fails Standard Dark on 87–100% of pixels.
-   Standard Dark bare ratios per density are tabulated in 38.4 CONTEXT D-35. Every cell fails, including 3:1.

### Bare-text inventory (brief §C)

-   **294 bare sites across 50 routes.** 100 are VERIFIED (the render chain was read by hand) and 194 are ESTIMATED
    (AST-traced, not hand-read). There are also 24 components that are bare only under some parents (all verified).
-   Colours that sit bare: `textSecondary` 142, `textPrimary` 105, `danger` 27, accent **fill** used as text 23 (a misrole;
    14 at 4.5:1 and 9 at 3:1, 8 of them spinners), `accentText` 21 (19 are tertiary buttons, including header Back buttons).
-   **Placement does not help** (§G). Bare text spans nearly the full width (x = 16 … W−16 dp), and 62% of it sits in
    scrolling content over fixed art. Equalizing each image's luminance range has to carry the fix.
-   The Profile route has its own heavy `profileBackgroundScrim` (about 0.72–0.77 opaque), so its 9 bare rows are not in
    the shell bands. The Orrery route forces the `none` background and is out of scope.

### Art format and acceptance (brief §H, §I)

-   941 × 1672 px portrait, sRGB, no alpha, lossless WebP (or a lossless PNG master). Only the central 717 px (x 112–829)
    is guaranteed to show on every phone, and foldables crop top and bottom, so the band must hold over the whole canvas.
    File names are the slot ids; the naming for the light/dark sets is settled together with the code change.
-   Acceptance: H1 `check_art.py` passes on the final shipped WebP in each target mode; H2 it also passes with
    `--margin 0.1`; H3 the measure script plus the `darkestPixel`/`brightestPixel` update, then `--check`; H4
    `surface.test.ts` and `backgrounds.test.ts` green; H5 a bare-text proof (does not exist yet, see P-1); H6 owner look
    sign-off on the Pixel 6 Pro and Pixel 3a.
-   The brief's original request to Codex ("pending OD-1") was one band per package. **[DERIVED]** D-39 chose the brief's
    option OD-1(a), so the deliverable is a light **and** a dark set per kept background.

## Open Items (owner, for the discuss-phase)

-   **[OPEN] O-1 --- Which background to cut per theme.** The owner may cut one per package (4 → 3), giving about 12 images.
    Which one in each package?
-   **[OPEN] O-2 --- Galaxy light-mode imagery.** D-39 allows different pictures rather than recoloured dark art. Capture
    the owner's own ideas for what Galaxy light pictures should be. The brief's pale-Galaxy remaps
    (`band-examples-galaxy.png`) are mechanical feasibility previews, not a proposal.
-   **[OPEN] O-3 --- Standard light pale band.** Owner leaning (2026-09-26), **not a decision**: the pale remaps in
    `band-examples-standard.png` look acceptable in principle. Discuss before it becomes a decision. The band puts the whole
    image at about L\* 89–97.
-   **[OPEN] O-4 --- Galaxy Dark red error text (exclusion E-1).** Should ADR-084's owner-accepted Galaxy Dark `danger`
    `#E5484D` limitation (E-1, today cards and chrome only; `38.4-RG029-INVENTORY.md` §4) extend to bare text? If yes, the
    Galaxy Dark art ceiling is L\* 18.5 and today's Galaxy art already passes everything else. If no, it is L\* 8.2. The
    owner asked for this question to be clarified (brief OD-4).
-   **[OPEN] O-5 --- Scrim sign-off sheet outcome (D-40).** Which components get a full scrim, a transparent scrim or no scrim
    in each theme × mode × background. This is a prerequisite: planning does not start without the signed sheet.
-   **[OPEN] O-6 --- Deep Space / Starfield replacement.** The owner said these two Galaxy images are too dark anyway and
    plans to change two Galaxy images (brief OD-5). Which images are replaced, and does this overlap the O-1 cut?
-   **[OPEN] O-7 --- Owner idea: dynamic text colour ("stained-glass layers").** The owner's idea, recorded as described:
    -   Regions of each background image are mapped as **layers**.
    -   Each layer has a **"tinted window"** that sets the colour of any text passing between the art and that window.
    -   Constraints keep it workable, for example a minimum region size and no sharp turns in a region's outline.
    -   Text changes colour as it scrolls from one region into another.
    -   The owner asked whether this is a phase-sized feature or a milestone-sized one. **Feasibility assessment pending**
        (the orchestrator is preparing it). Not decided and not scoped into this phase yet.
    -   *Context from the brief (facts, not an assessment):* the art is fixed while content scrolls over it; the `cover`
        crop differs per device (for example Pixel 3a x 63–878 vs Pixel 6 Pro x 84–857 of the 941 px width, and
        foldables crop top and bottom); bare text spans nearly the full width.
-   **[OPEN] O-8 --- Card-blend (more translucent content cards).** Carried from the 31.1 parked list, which the owner's
    2026-09-26 correction (D-39) says rides with this phase. It has not been re-confirmed for 38.5 scope. It interacts with
    this work: ADR-115 makes cards glassy only when the art tone matches the mode, and with separate light and dark art every
    package × mode would have matching art. 38.4 D-12 kept Standard Light glass at 0.5 for 38.4 only. Any opacity change is
    the owner's.

## Engineering Follow-ups

-   **[PLANNING NOTE] P-1 --- Bare-text contrast proof.** The brief's H5: the §E maths as a vitest test over the declared
    extrema, for every bare colour, in every package × mode. It does not exist. Its intended home, 38.4 Plan 16's
    bare-foreground contract, was cancelled by D-38, so this phase owns it.
-   **[PLANNING NOTE] P-2 --- New-asset contract.** For every new asset: run `scripts/measure-background-extrema.py`; update
    `darkestPixel`/`brightestPixel` in `src/theme/backgrounds.ts` and the rows in `assets/backgrounds/README.md`; pass
    `--check`; keep `src/theme/tokens/surface.test.ts` and `src/theme/backgrounds.test.ts` green. Today the measure script
    (`scripts/background-extrema-regimes.json`) and `surface.test.ts` check each asset against **both** modes' card regimes
    of its package, so mode-specific assets need that model changed (brief §H caveat).
-   **[PLANNING NOTE] P-3 --- One asset per slot today.** A slot resolves to one image used in both modes
    (`src/theme/backgrounds.ts`, `src/components/ui/BackgroundHost.tsx`). The selection is per package: `galaxyBackground`
    / `standardBackground` in the theme store, persisted as `app_settings.galaxy_background` / `standard_background`
    (migration 015) and carried in backups (`src/backup/backup-schema.ts`). Separate light and dark art means resolving the
    asset by slot × mode, and possibly changing the Settings → Appearance picker. Governing decisions to check with
    `npm run graph:ask -- governs src/theme/backgrounds.ts`:
    -   ADR-087 (bundled background slots), partly superseded by ADR-115
    -   ADR-113 (one shared library of the eight bundled WebPs)
    -   ADR-114 (route-aware app-wide composition)
    -   ADR-115 (cards are glassy only when the art tone matches the mode; mismatched package/mode keeps opaque cards)

    A mode-specific art model likely needs a new ADR superseding parts of these.
-   **[PLANNING NOTE] P-4 --- Cut slots must keep resolving safely.** If O-1 removes a slot, a persisted or restored slot id
    for it must still resolve safely. ADR-113 already requires invalid ids to fall back to the package default or solid;
    verify that at planning. Any schema or backup-format change is forward-only, verified against head+1 on disk, and a
    backup-format bump is an owner decision.
-   **[PLANNING NOTE] P-5 --- Confirm the misrole swap landed.** The brief's bands assume 38.4 Plan 16 swapped the
    accent-fill text misroles to `accentText` (OD-6). Check every `accent` row of `bare-text-sites.csv` against the tree. If
    any remain on the fill token, the bands tighten to L\* ≥ 94 (light) and ≤ 15 (dark).
-   **[PLANNING NOTE] P-6 --- Re-verify the site list.** 194 of the 294 bare sites are ESTIMATED, and line numbers drift as
    38.4 lands. Re-run or hand-verify the list before relying on it for scrim placement or the proof.
-   **[PLANNING NOTE] P-7 --- Asset size.** The current WebPs are 0.4–1.5 MB each. About 12 images instead of 8 changes
    the APK size; record the before and after.
-   **[PLANNING NOTE] P-8 --- Profile and Orrery.** The Profile route's `profileBackgroundScrim` sits over the same shell art;
    re-measure it with the new art. The Orrery route forces `none` and stays out of scope. App-owned profile photo
    backgrounds (ADR-112) fall under D-41.

## Explicitly Out of Scope

-   Contrast guarantees for user-uploaded backgrounds (D-41).
-   Collapsing Galaxy and Standard into a single Dark/Light switch (D-39: not the owner's intent).
-   The Orrery route (it forces `none`).
-   The glass-card, chrome and role-foreground work already done in 38.4 (D-12, D-24, D-26, D-28, D-34).

## Prerequisites

-   Phase 38.4 complete, including Plan 16's misrole swap and Plan 20's glass-scope read-site sweep.
-   The owner-signed scrim combination sheet (D-40).

## Revision Log

-   2026-09-26 --- Created at phase insertion from 38.4 owner rulings D-38..D-41 and the 38.4 background-art brief.
    Discuss-phase not yet run. O-7 feasibility assessment pending.
