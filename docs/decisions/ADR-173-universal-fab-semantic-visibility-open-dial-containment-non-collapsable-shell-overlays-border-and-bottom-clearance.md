# ADR-173: Universal FAB Semantic Visibility, Open-Dial Containment, Non-Collapsable Shell Overlays, Border, and Bottom Clearance

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.4-audit-remediation-ui-performance-release
**Source decisions:** dossier Workstream G; 38.4-CONTEXT D-04, D-20, D-31, D-33, D-42(A), D-43, D-45, D-52, D-56, D-68; RG-039 (`ui-accessibility/AUD-UIA-023`); GAP-G2; OA-C2, OA-E3
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The device investigation confirmed that the closed speed dial's scrim and six rows stayed mounted, hidden only by opacity and `pointerEvents`. They left seven invisible keyboard focus stops, and ENTER invoked a hidden action. While the dial was open, focus could escape to the tab navigator and to the same-window overlays.

Separately, the "Contacts freeze" (GAP-G2) was an app-wide touch wedge after the first dial open→close. Fabric flattened the full-screen `pointerEvents="box-none"` dial container while it was open. On close, Android re-created it with default pointer events, and it swallowed every touch below the FAB until a cold start. The same fault stopped the Profile scrolling after a Quick Log or deep link.

The accent-filled FAB also merged visually with accent buttons, and the last item on scrolling screens could sit under it.

## Decision

The FAB's semantic visibility matches its visual visibility:
- While closed, the scrim and rows container is `no-hide-descendants` and `accessibilityElementsHidden`, and the scrim and each row are `accessible={open}` and `focusable={open}`. In RN 0.86, `accessible` is what clears native focusability.
- The FAB announces `expanded`, and its glyph uses `onAccent` (D-20).

While the dial is open (D-31, D-42A):
- The tab navigator container and the same-window shell overlays (the undo Snackbar and the AssistBanner) are hidden from accessibility, read from the shell transient `selectFabDialOpen`.
- `nextFocus*` ids form a keyboard ring over the FAB and its rows.
- RN `Modal` prompts are exempt because they are separate windows holding a modal choice, and a contract pins that exemption.

Every static `pointerEvents="box-none"` View whose accessibility props toggle is `collapsable={false}`: the dial container, the Snackbar root and the AssistBanner root. An AST contract enforces this.

The main FAB disk carries a permanent `FAB_BORDER_WIDTH` (2dp) ring in `colors[FAB_BORDER_COLOR_KEY]` (`onAccent`) on every screen (D-56). Every FAB-bearing scroll screen ends its content with `useBottomClearance()`. FAB-bearing screens are derived from the five tab stacks minus `FOCUSED_WORKFLOW_ROUTES`, and a route-derived contract enumerates them. System Builder and Edit Interaction join the focused routes (D-68).

## Alternatives Considered

- **A dynamic `pointerEvents` on the dial container** — rejected in G2; it keeps the flatten/re-create churn.
- **Unmount the dial on close** — rejected in G2; it loses the close animation.
- **Border the FAB on Backup settings only (D-45)** — superseded by D-56; one component-level ring instead of route keying.
- **Hide RN Modal prompts while the dial is open** — rejected (D-42A); it would hide a modal choice from a screen reader.

## Consequences

### Positive

- The closed dial is inert to assistive technology, and the shell no longer wedges touches after the dial closes.
- A new FAB-bearing screen cannot omit its bottom clearance without failing the contract.

### Negative

- The dial's semantic state is spread across the FAB, the navigator container and two overlays, all keyed on one shell transient.

### Risks

- The keyboard TAB cycle is not effective on the device; the owner accepted it (D-43 C7).
- A TalkBack swipe through the open dial reaches only three of the six actions (todo `2026-09-28-fab-dial-talkback-swipe-skips-actions.md`).
- Native view flattening has no node test path; the source contract plus device proof stand in.

## Implementation

**Key files:**
- `src/components/UniversalFab.tsx` — closed-dial hiding, `expanded`, focus ring, `collapsable={false}`, border.
- `src/components/universal-fab-logic.ts` — `FAB_DIAL_TRANSIENT_ID`, `selectFabDialOpen`, `dialFocusCycle`, `fabDialBackgroundA11y`, border tunables.
- `src/navigation/RootNavigator.tsx` — hides the tab navigator container while the dial is open.
- `src/components/Snackbar.tsx` — hidden while the dial is open; non-collapsable root.
- `src/components/AssistBanner.tsx` — hidden while the dial is open; non-collapsable root.
- `src/types/react-native-android-focus.d.ts` — `nextFocus*` prop typing.
- `src/navigation/use-bottom-clearance.ts` — shared FAB clearance on the `SPACING.base` edge gap.
- `src/navigation/focused-route-classification.ts` — focused routes that hide the FAB and tab bar.
- `src/components/FieldDefForm.tsx` — required `bottomClearance` for the Custom fields form.
- `src/components/universal-fab-contract.test.ts` — closed-dial and border contract.
- `src/components/fab-dial-shell-overlays-contract.test.ts` — overlay hiding and Modal exemption.
- `src/components/control-surface/dashboard-controls-responsiveness.test.ts` — box-none overlays must be non-collapsable.
- `src/navigation/fab-clearance-contract.test.ts` — route-derived clearance contract.

**Depends on:** ADR-082 (Universal Capture FAB, Canonical Picker, and Truthful Quick Log); ADR-086 (Semantic Icons and Accessible Interaction Primitives); ADR-084 (Four Semantic Theme Palettes, Curated Accents, and Contrast Validation)
**Required by:** None
