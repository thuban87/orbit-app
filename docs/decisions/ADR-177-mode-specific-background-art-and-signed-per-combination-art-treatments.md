# ADR-177: Mode-Specific Background Art and Signed Per-Combination Art Treatments

**Status:** Accepted
**Date:** 2026-09-29
**Phase:** 38.5-background-art-text-contrast
**Source decisions:** D-03, D-08..D-10, D-13, D-15, D-17..D-28, D-30..D-37, D-42..D-45 from phase CONTEXT.md
**Reversibility:** reversible
**Migration:** None
**Supersedes:** ADR-115 (partial — the D-15 parts only: see-through Contacts entries in Galaxy Light / Standard Dark, see-through List rows, and no backing on the count label and the Contacts/Digest headers, where signed); ADR-087 (partial — one asset per slot used in both modes); ADR-113 (partial — the one-asset-per-slot library of eight WebPs)
**Superseded by:** None

## Context

Before 38.5 each background slot shipped one image for both modes, so Galaxy Light and Standard Dark put text over art of the opposite tone, and ADR-115 kept those pairings readable with opaque cards and a local `ChromeScrim`. The owner signed the scrims per combination on sheet v2 (D-08), ruled that the art comes first (D-13), and then re-signed every Contacts and Digest cell over the new art on sheet v3 (D-36, D-37). D-15 asks this phase to record the supersession.

## Decision

- **Slot × mode art (D-23, D-30, D-35).** Each slot has a `light` and a `dark` variant, and the resolver picks the one for the resolved mode. There is no new setting and no migration: `app_settings.galaxy_background` / `standard_background` keep the slot id. Signed lineup, 12 images: Galaxy `galaxy-quiet` ("Deep Space", the new default), Aurora and Starfield; Standard Dawn (default), Paper and Dusk. Both Aurora images are mirrored left to right. Every variant sits in its own mode's band (`38.5-ART-SIGNOFF.md`).
- **Retired ids (D-17..D-19, P-4).** `galaxy-deep-space`, `galaxy-nebula` and `standard-mesh` are accepted on write and restore and render as the package default; they are never offered. Another package's id also resolves to the default. The picker shows only the active package's slots plus None, and the image follows the mode.
- **Contrast bounds (D-20, D-24, D-31).** `D24_RESULT: extend`: red `danger` bare sites are under 10%, so the ADR-084 Galaxy Dark `danger` limitation extends to bare text (entry `E-1-bare`). E-1 itself stays scoped to card and chrome, and the Galaxy Dark art ceiling is L\* 18.5. One owner allowance exists, for Starfield (both modes): 18 px / 0.5%. Under the union semantics the declared extrema enclose every composite except the allowed specks. So an allowance is a real weakening: text is not guaranteed over a speck, which the owner accepted in `38.5-ART-SIGNOFF.md`. No exclusion record was signed.
- **Proofs.** Bare text is proven over the BackgroundHost veil at every density, over every shipped variant and over None. The veil, Profile-scrim and signed art-treatment regimes join the extrema table that `measure-background-extrema.py --check` decodes.
- **The per-combination table (D-08, D-36, D-37, D-42, D-43).** Five components are table-driven: Contacts List entries, Contacts Card entries, the count label, the Contacts header and the Digest header. They take their backing from `ART_TREATMENTS`, transcribed from `38.5-scrim-signoff-v3.json`; a sync guard fails on any drift. Every see-through level is the owner's `treatmentValues`. The ⋯ follows the header. The table carries no opacity number.
- **Text colour (D-10, D-44).** D-10 resolved to the mode default on the mode-matched art: no cell is inverse, and no inverse palette exists.
- **Everything else in ADR-115 stands (D-28).** `cardMatchesMode`, `CARD_GLASS_OPACITY` and `chromeScrimOpacity` still govern every other card and chrome. Red-string scrims (D-25), the active top-button fill (I1) and any change outside the five components go to the owner's gap list, not into code.
- **Documentation sync (ADR-113).** Phase 37 had already replaced the all-slots picker with the active-package picker (D-07, `fb734eb`). The owner's 38.4 D-39 ruling had already superseded ADR-113's cross-package clause and its rejection of a "package-filtered picker"; 38.5-05's cross-package fallback enforces that ruling.

## Alternatives Considered

- **One image for both modes** — Rejected: half the pairings put text over art of the wrong tone (brief §E.4).
- **Collapsing Galaxy and Standard into one light/dark switch** — Rejected by the owner (D-03): both packages keep both modes.
- **Keep scrims only in the mismatched pairings** — Rejected (brief OD-1(c)): the owner signed each cell instead.
- **Dynamic per-region text colour** — Parked (O-7): one foreground per combination × component (D-26).
- **A global `cardMatchesMode` retune** — Rejected (D-28): only the marked components change.

## Consequences

### Positive

- The art is visible behind the Contacts entries in every art combination, and every signed see-through or bare cell is proven over the shipped art (tightest text margin 4.65:1).

### Negative

- Two rules now coexist: the signed table for five components and ADR-115's mode rule for everything else.

### Risks

- A new foreground painted by a table-driven component must join `TABLE_DRIVEN_FOREGROUNDS` in `surface.test.ts`, or it ships unproven.

## Implementation

**Key files:**
- `src/theme/backgrounds.ts` — slot × mode variants, declared extrema, the Starfield allowance and the mode-aware resolver.
- `src/theme/theme-option-ids.ts` — the active and retired background slot ids.
- `src/db/app-settings-dao.ts` — accepts retired ids on write and restore.
- `src/screens/settings-appearance-background.ts` — the active-package picker model.
- `src/theme/art-treatments.ts` — `ART_TREATMENTS`, `SIGNED_V3_BACKINGS` and `TABLE_DRIVEN_COMPONENTS`.
- `src/theme/art-treatments.test.ts` — the v3 sync guard.
- `src/theme/use-art-treatment.ts` — the runtime read for the five opt-ins.
- `src/theme/tokens/surface.ts` — `ART_SEE_THROUGH_OPACITY` and `artBackingOpacity`; the unchanged ADR-115 rule.
- `src/theme/tokens/surface.test.ts` — the bare, Profile-scrim and signed art-treatment proofs and the regime sync guard.
- `src/components/ui/ChromeScrim.tsx` — the count label's opt-in.
- `src/components/ShellAppBar.tsx` — the Contacts and Digest header opt-ins.
- `src/components/ui/GlassSurface.tsx` — the `contact-entry` treatment.
- `src/components/ListRow.tsx` — the table-driven List row.
- `src/components/GridCard.tsx` — the Contacts Card-view card.
- `scripts/measure-background-extrema.py` — validates declared extrema under every regime.
- `scripts/background-extrema-regimes.json` — the regime table, including `listEntry` / `cardEntry` / `artChrome`.
- `scripts/check-background-art.py` — the per-pixel art acceptance checker.

**Depends on:** ADR-115 (Visible Mode-Aware Background Surface Composition); ADR-169 (Standard-Light Glass Foreground Scope, Both-Extrema Contrast Proof, and Accent Role Contract)
**Required by:** None
