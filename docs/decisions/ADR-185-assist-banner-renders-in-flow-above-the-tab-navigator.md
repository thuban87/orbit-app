# ADR-185: Assist Banner Renders in Flow Above the Tab Navigator

**Status:** Accepted
**Date:** 2026-09-30
**Phase:** 38.6-photo-handling
**Source decisions:** D-38 (device pass S12); D-42 recorded as a follow-up
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

While a "Did you reach …?" question was pending, `App.tsx` drew the assist banner as an absolute overlay. It covered the top of every screen, including the Profile's Back/star/⋮ and the dashboard search. The owner ruled that the banner must not block other screens' top bars.

## Decision

`RootNavigator` mounts `<AssistBanner />` once, in flow inside the navigator's safe-area column above `Tab.Navigator`. It has no absolute position, zIndex or elevation. Every screen therefore lays out below the banner. The banner root stays non-collapsable and `box-none`, and is hidden from accessibility while the FAB dial is open (ADR-173). It publishes its height to `shell-offset-store`, and `useWindowMeasurement` treats a change as a re-measure trigger, so window obstacles stay current (review WR5-01). Crop Photo sizes its canvas to the space left below the banner, so its footer stays on screen (WR5-02).

## Alternatives Considered

- **Keep the overlay and add per-screen top insets** — not chosen. Every top bar would have to know about the banner; laying it out in flow fixes all screens at once.

## Consequences

### Positive

- No screen's top-bar controls can be covered by a pending assist question.

### Negative

- Screens shrink by the banner's height while it shows. The Orrery's older 200 dp reserved control column then squeezes the system to the left (D-42, logged for later).

### Risks

- Any measured-window consumer must re-measure when the banner appears or disappears; `shell-offset-store` exists for that.

## Implementation

**Key files:**
- `src/navigation/RootNavigator.tsx` — mounts the banner in flow above the tab navigator.
- `App.tsx` — no longer mounts the banner as an overlay.
- `src/components/AssistBanner.tsx` — in-flow layout; publishes its height.
- `src/stores/shell-offset-store.ts` — the banner's height as a shell offset.
- `src/navigation/use-window-measurement.ts` — re-measures on a shell-offset change.
- `src/components/universal-fab-logic.ts` — FAB placement with the in-flow banner.
- `src/screens/CropPhotoScreen.tsx` — sizes the crop canvas under the banner.
- `src/screens/crop-photo-layout.ts` — crop canvas sizing from the measured space below the banner.

**Depends on:** ADR-070 (Durable Pending Interaction-Assist Lifecycle and Portable Opt-Out); ADR-173 (Universal FAB Semantic Visibility, Open-Dial Containment, Non-Collapsable Shell Overlays, Border, and Bottom Clearance)
**Required by:** None
