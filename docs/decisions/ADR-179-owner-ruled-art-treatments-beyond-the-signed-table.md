# ADR-179: Owner-Ruled Art Treatments Beyond the Signed Table

**Status:** Accepted
**Date:** 2026-09-26
**Phase:** 38.5-background-art-text-contrast
**Source decisions:** D-46, D-48, D-50, D-54 from phase CONTEXT.md (code review IN-06, WR-01; UAT gaps G-38.5-11; end-of-phase rulings)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

ADR-177 limits the signed per-combination table to five components, and D-28 routes any change outside them to the owner's gap list rather than into a plan. The code review, device pass and UAT raised four such items after the table shipped: active Population/Filters/Sort triggers had no fill (H-3 / I1), a see-through List row showed the swipe action panel through its content, four persistent red `danger` strings fell to 3.58–4.00:1 over Galaxy Dark art (D-25), and the Events tab still painted an opaque page over the art. The owner ruled on each.

## Decision

- **Active triggers are filled (D-46).** An active Population/Filters/Sort trigger keeps the regular `surface` fill; its border switches to `accent` and its label and summary to `accentText`. `activeTriggerBacking` is `full` in every combination. `accentText` on `surface` clears AA for every accent in all four package × mode pairs (COMPUTED).
- **A swiped see-through List row is backed at 50% (D-48, option R1a).** While the swipe translation is non-zero, the row's tint steps (not ramps) to `SWIPE_ROW_BACKING_OPACITY = 0.5`, driven from the Reanimated swipe shared value on the UI thread, never React state. At rest the signed level (0.05) is unchanged; `full` and `none` rows have no tint. Row text clears AA at 0.5 in all 11 signed see-through List cells. Accepted exemption, icons and ring only, never text: the trailing favourite/status icons and the ring border cross the panel glyphs in motion at 1.20–4.38:1.
- **Persistent Galaxy Dark danger strings are backed (D-50, D25-A + D25-B).** "Discard", "Unlink source", "Remove photo" and "{absorbed} will be retired." sit on an opaque root-`background` backing in Galaxy Dark only (4.91:1). The 25 transient or error red strings stay accepted under `E-1-bare`. Other package × mode pairs already clear 4.5:1 bare and draw nothing extra.
- **The Events tab shows the art (D-54).** The Group Events list and detail drop their opaque root fill. Their content sits in full (opaque `surface`) cards: the event rows, the summary card, the "No participants yet" card and the participant cards. The header keeps its glass backing; the "Participants" label sits on the art like the Digest section headings. The Orrery keeps its solid background.

## Alternatives Considered

- **Inverted active trigger (`accent` fill, `onAccent` text)** — the owner's first suggestion. Not chosen; noted in `trigger-look.ts` as a one-branch change.
- **A full backing while a row is swiped** — Rejected by the owner: "that'll look funny". Passing the icon/ring overlap would need about 0.95, effectively full.
- **Leave all 29 Galaxy Dark red strings under `E-1-bare`** — Rejected for the four persistent strings (D25-B); kept for the transient ones (D25-A).
- **An opaque `surface` backing for the danger strings** — Not chosen: 4.50:1, no margin, against 4.91:1 on `background`.

## Consequences

### Positive

- Each item has a signed, device-checked answer instead of a standing D-28 gap.

### Negative

- Three more rules sit beside the signed table and ADR-115: the trigger look, the swipe step and the danger-string list.

### Risks

- A new persistent `danger` string in Galaxy Dark must use `persistentDangerScrim` and join `PERSISTENT_DANGER_SCRIM_SITES`, or it ships at under 4.5:1.

## Implementation

**Key files:**
- `src/components/control-surface/trigger-look.ts` — `controlTriggerLook`, the active and inactive trigger colours.
- `src/components/control-surface/DashboardControlRow.tsx` — applies the trigger look and fill.
- `src/theme/art-treatments.ts` — `activeTriggerBacking: "full"` in every cell.
- `src/components/list-row-swipe-backing.ts` — `SWIPE_ROW_BACKING_OPACITY` and the `swipeRowTintOpacity` worklet.
- `src/components/ListRow.tsx` — the animated tint layer on a see-through row.
- `src/screens/HomeScreen.tsx` — feeds the swipe translation to the row.
- `src/theme/tokens/surface.test.ts` — the "Swiped see-through List row" proof and exemption.
- `src/theme/danger-scrim.ts` — `PERSISTENT_DANGER_SCRIM_SITES` and `persistentDangerScrim`.
- `src/theme/danger-scrim.test.ts` — the 4.5:1 proof and site guard.
- `src/screens/BulkImportSetupScreen.tsx` — the "Discard" string.
- `src/screens/ReconcileDetailScreen.tsx` — the "Unlink source" string.
- `src/components/PhotoSourcePicker.tsx` — the "Remove photo" string.
- `src/components/MergeImpactSummary.tsx` — the "will be retired." string.
- `src/screens/GroupEventsScreen.tsx` — the Events list on the art with full row cards.
- `src/screens/GroupEventDetailScreen.tsx` — the Event detail on the art with full cards.

**Depends on:** ADR-177 (Mode-Specific Background Art and Signed Per-Combination Art Treatments); ADR-115 (Visible Mode-Aware Background Surface Composition)
**Required by:** None
