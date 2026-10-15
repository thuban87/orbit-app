# ADR-184: Width-Derived Contacts Grid Photo Geometry, Edge Corner Controls, Two-Line Names and 72 List Photos

**Status:** Accepted
**Date:** 2026-09-30
**Phase:** 38.6-photo-handling
**Source decisions:** D-05, D-06, D-07, D-08, D-09, D-36 (dossier § Owner Requests and Derived Constraints)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The owner asked for Contacts List photos 50 % bigger and Grid photos about 2× bigger, with the Grid's star and selection checkbox 5 px from the card edges and names wrapping to two lines. On a 360 dp phone with 3 columns a card is only about 104 dp wide, so a fixed 96 photo plus its status ring does not fit. `FlatList` `numColumns` lays out each row on its own.

## Decision

List rows use a 72 avatar (`LIST_AVATAR_SIZE` = 48 × 1.5) with 12 padding, and `minHeight` counts padding and border.

Grid geometry comes from a pure module, `grid-card-geometry.ts`. The photo is sized from the card width, clamped to 48–96, with card padding 8 and ring gap 4. `avatarTop` is solved in closed form so the round photo clears the corner glyphs. `gridColumnCount` moves into that module and is swept over widths 320–1024 and font scales 1.0–2.0.

The star and checkbox are absolute 48×48 boxes whose visible glyphs sit 5 px from the edges (`GRID_CORNER_INSET`, optical offset 0), with no hitSlop. Names use `numberOfLines={2}` with a greedy simple break, so line 1 fills first. Each row gets one height without text measurement: the FlatList row stretches, the card grows, `GlassSurface` gains an optional layout-only `contentStyle`, and the secondary block is pinned to the bottom. Rows with no wrap keep their natural height. The D-36 sign-off kept 72/12 and 96/8/4/0.

## Alternatives Considered

- **A hard-coded 96 photo** — rejected because it does not fit 3-column cards at 360 dp. The size has to come from the available width.
- **A fixed two-line name height for every row** — simpler, but rejected because it contradicts D-09's "only rows that need it".
- **Per-row `onTextLayout` measurement** — not needed. Flex stretch gives one height per row without measuring text.
- **Shrinking the 48×48 hit areas to reach the edges** — rejected because the 38.4 accessibility targets stay. Only the visible glyph moves.

## Consequences

### Positive

- Photos fill the available card width at 2–5 columns and at large font scales, and the corner controls frame them evenly.

### Negative

- Cards and rows grow a little taller, which was accepted by D-08/D-36.

### Risks

- Grid columns at a font scale of exactly 1.4 were logged as a follow-up (S13).

## Implementation

**Key files:**
- `src/components/grid-card-geometry.ts` — Grid tunables, `gridCardGeometry`, `gridColumnCount`.
- `src/components/CardGrid.tsx` — memoises the geometry; re-exports `gridColumnCount`.
- `src/components/GridCard.tsx` — absolute 48×48 corner controls, two-line names, row-filling layout.
- `src/components/ui/GlassSurface.tsx` — optional layout-only `contentStyle`.
- `src/components/ListRow.tsx` — `LIST_AVATAR_SIZE` 72 and `LIST_ROW_PADDING` 12.

**Depends on:** ADR-101 (Avatar-First Accessible Dashboard Card Renderer); ADR-153 (Two-Row Normal Contacts Grid); ADR-098 (Scan-First, Accessible Dashboard List Rows)
**Required by:** None
