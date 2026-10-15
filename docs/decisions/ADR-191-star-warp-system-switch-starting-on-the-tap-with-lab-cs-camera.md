# ADR-191: Star-Warp System Switch Starting on the Tap, with Lab C's Camera

**Status:** Accepted
**Date:** 2026-10-05
**Phase:** 38.7-orrery-v2
**Source decisions:** D-24, D-32, D-53, D-76, D-77, D-79 (SW-2; the D-76 viewport hold removed) (dossier `phase-38.7-orrery-v2-dossier.md`)
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

Production switched Systems with a spin, shed and capture by membership change, and phase-08 ruled the switch "not light-speed" (`:568`). The owner wanted a cinematic blend: Lab B's star warp, Lab A's orbit streaks and a camera swirl, clean and smooth. Early V2 builds waited 2–2.5 s between the tap and any motion on an All Contacts switch, which the owner refused ("I absolutely don't want a 2+ second wait").

## Decision

**Effects.** We will play the switch as a star warp, with planets streaking along their orbits. The warp runs at Lab B's own numbers (`WARP_STRENGTH` 1). The streaks are weaker than Lab A's (`TRAIL_STRENGTH` 0.5) (D-24, D-76). The warp uses the sky's own stars within a fixed sprite budget: no particles, comets or shockwave (D-53).

**What stays from production (D-32).** The spin, shed and capture choreography stays underneath. So do the 2100 ms and 180 ms (reduced-motion) durations, landing exactly at Home, and readiness at progress 0.82.

**Camera (D-77).** The camera is copied from Lab C's code. It uses Lab C's raw linear yaw return to Home (`SWITCH_YAW_PATH` "lab-c"; "shortest" stays available). Lab C's breath is composed on top: pull-back 0.24, yaw swing 0.38 rad, tilt −0.1, scaled by sin²(πp)·(0.5 + 0.5·intensity) and zero at both ends. The switch starts from the camera drawn that frame. Reduced motion is a plain crossfade with no breath.

**Start on the tap.** A lead-in spins up the current scene as the destination loads, then hands off its momentum to the choreography (D-76, Plan 15). Setup is O(N) with keyed maps, the renderer does not re-render during the switch, and photos are kept across it (D-53).

**Smoothness and framing.** On release, motion starts within about 100 ms in both directions. The owner accepted the All Contacts smoothness as it is: 8–16 frames/s for about 1–1.25 s (SW-2). The viewport hold through a switch is removed, because framing no longer changes with panels (ADR-188).

## Alternatives Considered

- **"Not light-speed" (phase-08 `:568`).** Superseded by D-32's star warp.
- **D-53's shortest-arc yaw plus an authored spin, and D-24's "Lab A's camera swirl".** Superseded by D-77. The swirl the owner remembered was Lab C's ("more of a zigzag to get back to center and then pull back"), and OWNER-REVIEW had filed it under Lab A.
- **A calmer (0.19) or stronger (1.0) yaw swing.** Rejected after a side-by-side clip (SW-A).
- **Warp at 1.6× ("by eye").** Reverted to Lab B's numbers (S-WARP).
- **Simpler rings while moving.** This was offered to smooth the All Contacts switch. Not built, because the owner accepted the smoothness (SW-2).
- **Lab C's bodies falling below and rising above the plane.** Not built; the owner did not ask for it.
- **Lab B's switch as built.** Rejected as janky and "a bit sloppy" (D-24).

## Consequences

### Positive

- The switch responds on the tap and lands exactly at Home. The long-way yaw travel is deliberate.

### Negative

- Around All Contacts the switch drops to 8–16 frames/s. The Size 120 ↔ All Contacts stall is 174.7 ms against a 100 ms gate, accepted as a near miss (D-79).

### Risks

- The lead-in and the hand-off share state across JS and the UI thread. Ordering bugs surfaced during three DEBUG rounds, including a worklet default-parameter crash, now guarded by a test.

## Implementation

**Key files:**
- `src/components/orrery/use-orrery-switch-runtime.ts` — the switch runtime, the lead-in hand-off and the displayed-camera retarget.
- `src/logic/orrery-switch-choreography.ts` — O(N) keyed choreography setup.
- `src/logic/orrery-switch-fx-logic.ts` — warp and streak strengths over progress.
- `src/logic/orrery-switch-lead-logic.ts` — the tap lead-in.
- `src/logic/orrery-camera-logic.ts` — Lab C's switch camera and breath.
- `src/components/orrery/v2/draw-switch.ts` — the warp and streak picture.
- `src/components/orrery/orrery-worklet-default-params.test.ts` — guards the worklet default-parameter crash.

**Depends on:** ADR-170 (Bounded Your Week Reads and Settled Orrery Resource Retirement); ADR-186 (Orrery V2 Imperative Picture Renderer Behind a Platform Render Host)
**Required by:** None
