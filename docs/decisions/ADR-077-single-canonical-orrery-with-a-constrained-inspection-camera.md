# ADR-077: Single Canonical Orrery with a Constrained Inspection Camera

**Status:** Accepted
**Date:** 2026-09-01
**Phase:** milestone-2 pre-build audit (oa-audit-dossiers)
**Source decisions:** dossier `phase-08-orrery-camera-scale-exploration` §A, §B, Notes for GSD; owner ratification 2026-09-01
**Reversibility:** costly
**Migration:** None
**Supersedes:** ADR-048 (partial — dual view/morph)
**Superseded by:** None

## Context

ADR-048 opened a status-default orrery and morphed it on one Skia canvas into a calm relationship view, selected by a Status / Relationship segmented toggle. The Phase 8 dossier judges the existing Relationship mode insufficiently intuitive to keep as a first-class product mode and calls for removing the mode toggle and the relationship-mode morph rather than preserving them because the code exists (audit finding E-03). The owner ratified the removal on 2026-09-01.

## Decision

The Orrery has one canonical, unnamed spatial visualization centred on relationship-health/status semantics. The Status / Relationship segmented toggle and the relationship-mode morph are removed rather than redesigned. Per-contact ring radius keeps its `ring_seq` meaning from ADR-046, contact bodies remain timestamp-placed on focus, the subtle starfield and sun pulse remain the sole ambient animation with a single unmountable owner, and that subtree still unmounts on blur or background. Phase 8 replaces ADR-048's static canvas with a constrained 2.5D inspection camera over a finite, sun-centered world.

## Alternatives Considered

- **Keep the dual view and amend Phase 8 §A** — Rejected because the owner ratified the removal; the relationship mode is an even angular spread with muted colour, not a distinct relationship map worth a first-class mode.
- **Redesign Relationship mode as a second Orrery mode now** — Rejected and explicitly deferred; Phase 8 is a camera, scale, and exploration phase, not a second-visualization phase.
- **Unrestricted true-3D / free-flight navigation** — Rejected because the Orrery is a finite world inspected by a transient camera, not a scene to fly through.

## Consequences

### Positive

- One visualization means one placement rule, one colour treatment, and no morph interpolation to keep coherent as camera work lands.
- Removing the toggle frees the control area for the Orrery-specific view controls Phase 8 introduces.

### Negative

- Work spent on the morph and its selector is discarded, and the owner loses the calm relationship layout with nothing offered in its place this milestone.

### Risks

- Camera state must stay separate from world/layout state; folding yaw or pan into a contact's angular placement would mutate the very positions the canonical world is supposed to hold stable.
- The ambient clock must keep its single unmountable owner through the camera rewrite — gating derived values without unmounting the subtree leaves the loop running on blur.

## Implementation

**Key files:**
- `src/screens/OrreryScreen.tsx` — loses the status/relationship view state and toggle; hosts the camera and canvas lifecycle.
- `src/components/orrery/OrreryCanvas.tsx` — renders the single canonical visualization and retains ownership of the ambient clock.
- `src/components/orrery/OrbitBody.tsx` — loses the morph interpolation; keeps its `ring_seq` radius and focus-time placement.
- `src/components/SegmentedControl.tsx` — retired with its only consumer; provided the Status / Relationship selector.

**Depends on:** ADR-046 (Query-Time Orrery Placement and Transactional Ring Ordering); ADR-047 (App-Level Assignable Sun and Themed Self Identity)
**Required by:** ADR-085 (Live Reduced-Motion Signal for Skia Ambient Animation)
