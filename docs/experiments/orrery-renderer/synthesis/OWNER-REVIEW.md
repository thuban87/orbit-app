# Orrery V2 — Owner Device Review (primary product evidence)

The owner tested all three labs hands-on, on a **Pixel 6 Pro** and a **Pixel 3a**, on release builds, on 2026-10-02. He used the field sheet artifact (claude.ai, private; db collections `scores` and `decisions`). This file is a verbatim export of that sheet, plus the chat notes and rulings given alongside it. Where it conflicts with lab write-ups or agent analysis, **this file wins on product questions** (Prototype D brief: "The owner's device reactions are primary product evidence").

## Test setup

- **Builds.** Each lab ran as its own release package beside the real app: `com.bwales.orbit.laba`, `.labb`, `.labc`.
  - Lab A: release `5fb0f0d7`.
  - Lab B: release built 2026-10-02 03:43. It may predate the tilt-fix hybrid commit `9aa7e725`, which only affects the untilted path.
  - Lab C: release built 2026-10-01 20:11.
- **Comparison Systems.** All labs were seeded from one shared cast of 120 fictional contacts. Lab C has only Size 32 and Size 120.
  - Systems: "Size 5 / 10 / 20 / 32 / 120".
  - Status mix: 30% stable, 20% wobble, 20% decay, 20% rogue, 10% never contacted.
  - Photos and moons are the same in every lab.
  - Seed commits: A `62ed49c1`, B `8fed9f82`, C `930042c4`.
- **Answers are feature-level design decisions, not votes for a lab** (owner instruction, 2026-10-02).

## Chat notes (2026-10-02, verbatim intent)

- **Lab A.** Favourite version of the sun. The background is alright, but there aren't enough visible stars and the nebula is "a little too everywhere".
- **Lab B.**
  - Loves the transition: "the stars warping in and out is amazing".
  - Likes the animations on the orbit circles ("like the line is being traced"). He later clarified he meant the ambient light pulses (FLOW), and likes the switch-time draw-on too.
  - Doesn't love the grid behind the Systems; it can go.
- **Lab C.** Its grid overlay is his favourite of the three, but he is "not 100% sure I want one of those".

### Pass 1, Pixel 6 Pro

Scores run from 1 (poor) to 5 (great). A blank cell means no answer; 0 means a score was cleared.

| Step | A | B | C |
|---|---|---|---|
| Cold open | **3**: Don't love the loading box but still pretty quick | **3**: Don't love the loading box but it's just a split second | **4**: Oddly one of the faster load times |
| Overview | **4**: Love reticle when selecting somebody. Also like the name tags | **3**: Background is too busy, makes finding people difficult . Also like the name tags | **2**: Hard to find people, most are too dark. Also, many circle are not on an actual orbit line, which makes it tough to see that a red line correlates to whichever contact. |
| Pinch through zoom levels | **4**: Love the zooming here, smooth as butter | **2**: Little janky on the zooming, faces are too dark to see generally | **5**: Smoothest zooming yet, but I don't love the gestures required, see below |
| Camera (pan, tilt, Recenter) | **4**: No issues anywhere really, very smooth | **3**: Little bit of jank bit overall not bad | **3**: Am not a fan of the different gestures in this lab. 1 finger to rotate is awful. 2 fingers to pan and tilt is very sensitive which makes it appear janky. Zoom is about the only gesture that wasn't changed and is fine |
| Focus | **5**: Love the reticle. Card shows up above the contact which isn't ideal, should be below. | **5**: Love the reticle around the focused contact and the chevrons or whatever they're called in the corner of the boxes everywhere  | **4**: The single contact focus is the best of the 3 labs. It centers the contact front and center and large and puts the card underneath. PErfect. The downfall is the multi-contact select. When zoomed out and selecting a contact cluster, it doesn't zoom into the cluster at all, leaving you to choose just from the contact card list that comes up, from a very far away view, not ideal. |
| Moon | **4**: Love that moons are represented by a tiny bubble on the contacts main circle from far zoom, but then they break off into little moons when you zoom in, that's PERFECT! Doesn't list connected moons when you click a contact though. | **1**: Virtually impossible to see there's moons attached from high zoom level. Focusing a contact did not immediately list it's moons either, I had to specifically click the moons. | Wasn't able to find any moon so not idea |
| Switch Systems | **5**: Love the animation the planets make, where they streak around in their orbits. Also like that the camera does a little whirly going back to the center, that's fun. | **3**: Pretty janky between systems. I really love the animation but the whole thing is a bit sloppy looking. | **4**: Oddly enough closest to the current prod version of the switching. Very few animations, but what's there works well, very smooth. But I want those animations I mentioned from the other 2 labs |
| Reorder | **4** | **3**: I like the reticle around the planet when moving and the outline of the projected orbit is best here. I don't like that contacts are apparently offset visually from their orbit though. Like the first orbit has a line going out past the 3rd orbit which is where the first orbits contact circle is. That's horrible, the contacts need to be on their actual orbit line | **1**: Terrible, almost no indicator of where they're moving to, it's barely highlighted. |
| Themes | **5**: The background image on galaxy dark is pretty underwhelming honestly. The lab b one is too much though. Need more stars, not as crazy of a nebula. | **5**: Couple things, the orbit lines are fantastic in light mode, much easier to see colors than in dark modes or lab A's light mode. Also, the background in light mode looks good here. Also, the subdued background of the standard dark theme should be the regular background, it's subdued but not too much. | **5**: Dark modes are basically the same which is fine, light modes are also the same which isn't ideal, galaxy light should ahve more flavor. |
| Reduced Motion | **5** | **5**: Fine | **5** |
| Leave and come back | **5** | **3**: Slow to reload when coming back from other page and background. Phone is good bit warmer than lab a, which was not warm at all really. | **3**: Very slow to reload when coming back from anywhere else |
| Faces in shadow | **4**: No real images to gauge really | **4**: Looks fine to me | **2**: Way too dark but no real photos to judge from either |

### Pass 1, Pixel 3a

Scores run from 1 (poor) to 5 (great). A blank cell means no answer; 0 means a score was cleared.

| Step | A | B | C |
|---|---|---|---|
| Cold open | **3**: Sluggish | **4**: Fastest of the bunch on this phone, still a little sluggish though | **4**: Oddly faster than lab a |
| Overview | **5**: Great, very smooth switching on systems under 100, slower above that | **4**: Finding people is relatively easy but the switching itself is very janky on this phone in this lab | **2**: Hard to find in general in this lab, not very different in this phone |
| Pinch through zoom levels | **4**: Excellent at low count systems, slower/jankier at higher-count systems | **3**: Smoothish at low-count systems but very janky on high-counts. Also janky when switching to a low-count system after having been on a high-count one | **5**: Very smooth |
| Camera (pan, tilt, Recenter) | **5**: Excellent, slightly slower at higher-count systems  | **3**: Love the gestures as usual here but the speeds are janky after switching systems for a few seconds | **3**: Love the actual speed and movements but the gestures chosen for this lab are awful, as I mentioned on the pixel 6 pro page |
| Moon |  |  | **1**: Actually saw some moons this time and they're just bad all around. Nothing worth keeping there that I see |
| Switch Systems | **4**: Mostly fine, slower at higher-count systems being spun up | **3**: Janky on this phone | **4**: Mostly fine, slower at higher-count systems being spun up |
| Reorder | **4** | **5** | **1**: Awful, virtually zero visual indication of what's happening |
| Leave and come back | **2**: Slow to reload | **3**: Slow to reload but better than other labs on this phone | **2**: Slow to reload |

### Pass 2, decisions D1–D30 (as recorded in the field sheet)

| Code | Picks | Note |
|---|---|---|
| D1 | Skia 2.5D | I liked the visuals of 3D initially, I still think it looks more modern, but overall that lab seemed to perform worse than the others and the other items you add here about size and such make the decision final I think. |
| D2 | A · calm star chart, B · cinematic, C · 3D strategy map | Cinematic during transitions, calm star chart with 3D strat on normal views is my overall aim here. |
| D3 | Steep ~62° (C) | I'm not totally sold on the angle honestly. I may switch back to flat eventually, let's design this so it's easily changeable. |
| D4 | Pans the map (today, A, B) | From Pass 1: C's one-finger orbit is out. C's two-finger pan and tilt was too sensitive and looked janky. |
| D5 |  | There was no coast in any of them that I'm seeing. I would prefer a tiny bit of coast but not the msot important thing really |
| D6 | Yes |  |
| D7 |  | From Pass 1: wants a sky. More stars than A, much quieter nebula than A, B is too busy. B's Standard Dark sky ('subdued but not too much') suggested as the default. B's light-mode sky works. Still or drifting: not answered yet. |
| D8 | Yes |  |
| D9 | C orbital grid | From Pass 1: B's gravity-well grid is out. C's orbital grid is the best of the three, but not sure about having a grid at all. |
| D10 | Light pulses along orbits (B) | Decided 2026-10-02: keep B's light pulses travelling along the orbits, but make them not very obvious. Other idle motion not answered yet. |
| D11 | Thin, brighter near the sun | From Pass 1: B's orbit lines, which are thin and brighter near the sun. 'Fantastic in light mode', colours easier to see than in the dark themes or Lab A's light mode. |
| D12 |  | Decided 2026-10-02: contacts stay ON their orbit line; ring colour and position around the ring are the status indicators. This reverses HANDOFF §7 'decayed contacts drift outward past their ring', so the tether has nothing left to show. Wake: not answered yet. |
| D13 | Lighter shading | From Pass 1: B's and C's faces are too dark to see. Seed photos aren't real faces, so recheck with real photos. |
| D14 | B rim + glow |  |
| D15 | A star | From Pass 1: Lab A's sun is the favourite. |
| D16 | Yes |  |
| D17 | A lit moons | From Pass 1: A's moons are 'PERFECT': a small bump on the person at far zoom that splits off into moons when you zoom in. B's moons are nearly invisible and C's are bad. New: focusing a person should list their moons (no lab does). |
| D18 | A reticle | From Pass 1: loved the reticle in both A and B. C's fly-in framing goes under D19 instead. |
| D19 | Docked at the bottom (C) | From Pass 1: C's single-person focus is the best: person centred and large, card underneath. A's card sits above the person, which is wrong. New: tapping a cluster at far zoom should zoom into the cluster (C doesn't). |
| D20 | No | I like the glassiness of A |
| D21 | Yes |  |
| D22 | Corner-bracket controls | From Pass 1: loved B's corner brackets on the boxes. Map under the header: not answered yet. |
| D23 | Charge arc + glowing orbit (B) | From Pass 1: B is best (reticle while moving, outline of the projected orbit). C's reorder is awful, with almost no indication. |
| D24 | A jump (trails, ink-in, warp), B hyperspace (streaks, sparks, comets, shockwave) | From Pass 1: B's star warp in and out is amazing. Also A's planets streaking around their orbits and the camera swirl back to centre. B as built is janky and looks a bit sloppy, especially on the 3a. C is smooth but too plain. |
| D25 |  | I don't see any of these, which lab are they in and at which point? |
| D26 | Good enough in one lab | From Pass 1: B's light mode (sky and orbit lines) looks good. C's light themes are the same as each other; Galaxy Light needs more flavour. |
| D27 | Yes | Yes but the nebula in galaxy can be a little more subdued I think |
| D28 | Yes, a hard gate |  |
| D29 |  | From Pass 1: A kept the 6 Pro cool. B ran a good bit warmer. On the 3a every lab was slow to come back after leaving; A strains on big Systems, B's switches are janky. |
| D30 |  | From Pass 1: B's gravity-well grid; C's gestures (one-finger orbit, twitchy two-finger pan and tilt); B's and C's moons; C's reorder; the loading box when the Orrery opens; faces too dark (B, C); C's poor findability at overview. |

## Rulings given in chat (2026-10-02)

| Ruling | Decision |
|---|---|
| Drift | **Reverse the drift-outward rule.** Contacts stay on their orbit line. Ring colour and angular position are the status indicators. The owner was not aware that prod already pushes decay/rogue bodies outward (`orrery-world-logic.ts:136`); it does. |
| Light pulses | **Keep B's ambient orbit light pulses, but make them not very obvious.** |
| D25 camera effects | Off. He never saw them; they only exist in B's "Everything" preset. |
| M1 Moons | Build the far-zoom moon bump that splits into moons on zoom-in as a **new** feature. Also keep Lab A's stack pips, which mark hidden co-angular contacts. What he saw in Lab A was the stack pip, not a moon feature. |
| W1 Switch | The star-warp switch replaces phase-08's "not light-speed" rule. Spin, shed and capture stay underneath. |
| I1 Initials | Fix initials (today "El…") with emoji-safe handling. This changes the Phase 29 full-name fallback. |
| S1 Skia | Build V2 on the current `@shopify/react-native-skia` 2.x line. A Skia 3 / Graphite upgrade is its own later phase. |
| G1 Card glass | Keep today's translucent cards (ADR-149). They must pass 4.5:1 over the new sky. |
| O1 Sky | Barely drifts, with slight camera parallax. Frozen under Reduced Motion. |
| O2 Ambient motion | Keep prod's twinkle and sun pulse. The subtle orbit pulses are the only new idle motion. |
| O3 Wake | No progress wake. |
| O4 Header | The map runs up under the Orrery title (B IMMERSE). |
| O5 Idle | When nothing moves, stop drawing apart from the low-rate ambient. The Orrery must not run noticeably warmer than today's Orbit on either phone. |
| Fixes | The main-line bug fixes the labs found are folded into V2, not shipped as a separate port phase. |
| Platforms | Cross-platform portability (iOS and web are planned) is a required evaluation criterion. Android comes first. |
| Process | V2 becomes Phase 38.7. Claude writes the dossier; codex reviews it. |
