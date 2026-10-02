# Orrery Lab C — recommendations

## Verdict: is true 3D better *enough* to justify the complexity?

**Not yet. Harvest the ideas, don't ship this renderer.** Pending the owner's hands-on judgment of feel,
which is the one input this lab could not supply.

True 3D clearly wins at **near/close range, focus and transitions**. Depth hierarchy, lit people-spheres, the
orbit camera, the fly-in and the fall-away/streak-in switch are visibly more "game star-map" than the Skia
2.5D Orrery. Release performance is good: about 60 fps steady and GPU time ≤ 1.1 ms. But:

- **The biggest visual wins come from ideas that do not need 3D.** Camera tilt and orbit, lens-shift
  composition, minimum on-screen size, ring density fade, projected-size label tiers, docked focus card,
  switch beats, moon orbits and the sun medallion are camera, layout and choreography decisions. Most can be
  rebuilt in a Skia 2.5D V2 on the UI thread without a new native stack.
- **What 3D uniquely adds** is true lighting and terminators, perspective scale with depth, fog, star
  parallax, and the vertical axis for switching. That is real, but incremental over a well-composed 2.5D map.
- **The costs are structural.** +20.6 MB of native code, minSdk 24 → 26, a young dependency (renamed in
  May 2026), a JS-thread render loop with a 60 Hz ceiling that contends with gestures, an unexplained per-mount
  Hermes external floor, and a second rendering stack beside Skia (text still has to go through Skia
  rasters).
- **It made some things worse.** Dense overview needs three compensations to be readable. Light themes are
  weaker. The production never-contacted "spine" becomes more visible under foreshortening.

If the owner's hands-on feel says the 3D moments (orbit, fly-in, switch) are *the* product, the right next
step is a V2 spike that moves rendering off the JS thread **before** any productionization. Not this
branch.

## Lessons

1. **Parity of formula, not of view.** Sharing one pinhole between drawing and hit testing is what keeps a
   richer camera correct. Reproducing the old *view* (205c1462) wasted the first build.
2. **Legibility at density is a layout problem.** Specks (whole-disc fit) and moiré were solved by minimum
   size, ring fade and core framing, not by the renderer.
3. **Debug badly understates release on this stack.** Dense overview ran at 47 fps in debug (thermal SEVERE) and 52–56 (cool), against 59.6–60.6 in release. Never judge feel or perf on debug. Thermal
   state must be recorded, and a SEVERE debug session produced misleading numbers.
4. **`gfxinfo` is blind to a WebGPU surface** presented from the JS thread. Instrument the loop itself.
5. **RN Skia host objects report flat 1 MB JSI memory pressure** (Paragraph *and* ParagraphBuilder). Build
   once, reuse, dispose. This applies to the production Orrery today.
6. **adb cannot test this UI fully:** no multi-touch, flaky flings, TalkBack swipes become camera orbits. Plan
   owner hands-on time for gestures and a11y.
7. **Write the notes you cite.** Code comments reference a `_notes/M1-BUILD.md` that was never committed. The
   M1 device-lifecycle numbers survive only in comments.

## Carry forward (to V2, renderer-agnostic unless noted)

- Shared projection plus parity test (H1). Tilted, lens-shifted composition and one-finger orbit with
  inertia (H2, H3, pending owner gesture check).
- Projected-size label tiers, nearest-first allocation, body exclusions (H4, H18).
- Minimum on-screen size, ring density fade, top-inset fade (H5, H6, H17). Core framing as an owner proposal (H7).
- Docked focus card plus system framing (H8).
- Paragraph cache plus shared ParagraphBuilder, worth porting to the production Skia Orrery now (H9).
- Switch beats: depart / arrive / capture flare / camera breath, zero-ended and reduced-motion gated (H11).
- Moons on inclined revolving orbits with hit parity (H12). Sun medallion (H13). Light-theme blending rule (H19).
- Lab tooling: separate app id, dev-only seed through real DAOs, in-loop frame stats, camera presets (H21).

## Reject (or do not repeat)

- Shipping *this* renderer as-is: a JS-thread loop, the lab gating spread across shared logic, an unidentified
  memory floor.
- 2.5D-parity camera; whole-disc fit for dense Systems; per-fragment procedural noise and grid shaders; DPR
  above 2.0 on this device; one ParagraphBuilder per label; a process-wide shared GPU device; `requestDevice`
  during surface creation.
- R3F for this scene (a reconciler invites React-driven animation).
- Bloom as a full-screen pass while the loop is JS-bound (the additive glow sprite is enough).

## Open owner decisions surfaced by this lab

1. Is the 3D feel worth +20.6 MB native, minSdk 26 and a young dependency? (The core verdict.)
2. Dense Home framing (core framing vs the production readability floor).
3. Spread never-contacted members off `NEUTRAL_RESTING_ANGLE = 0`?
4. Fix "Unavailable System" for restored custom Systems on main (pre-existing bug, lab-only fix f608d35d)?

## What I would do with one additional day

1. **Two-hour owner hands-on session** on the release build: pinch, two-finger pan, twist, TalkBack swipe-nav,
   and an A/B of the same Systems against the production Skia Orrery. That decides the verdict.
2. **Fix the face-tile initials** (verify `Intl.Segmenter` on Hermes; use a grapheme-safe fallback). It is
   cheap, it affects every overview shot, and it may affect production.
3. **Spike rendering off the JS thread.** Try worklets Bundle Mode with three (or raw WebGPU on the UI runtime
   for just rings and spheres) and measure whether 120 Hz and gesture-independence are achievable. That is
   the single biggest structural risk.
4. **Heap-snapshot the per-mount external floor** with a debug build and Hermes sampling, to name the retainer.
5. **Port H5, H6 and H8 to the Skia world on a branch** and screenshot it next to Lab C at the same poses. If
   2.5D with the harvested layout ideas closes most of the gap, that settles the renderer question cheaply.
