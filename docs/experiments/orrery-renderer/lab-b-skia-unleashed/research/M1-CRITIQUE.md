# Lab B — Milestone 1 visual critique (WP-1.4)

Written 2026-10-01 from the WP-1.4 release-build evidence (`evidence/05-m1-checkpoint/`),
emulator only (1280x2856), with the 16 fictional test portraits seeded. The brief: judge it as
the art director of a premium space-strategy game would. Taste calls below are the lab's
opinion. The owner decides anything that changes product meaning (research 03 §6).

## Verdict in one line

The **world layer** (sky, sun, lit bodies, hairline orbits) now reads as a game map. The **UI
layer that sits on top of it** (glass chips, FAB column, companion popover, HUD tags) is still
a productivity app. The legacy/lab pair (`28c`; `29b` vs `02`) shows the jump is real. The next
gains come from composition and hierarchy, not from more effects.

## What reads as premium

- **The sky.** The baked nebula and the 3-depth starfield give depth with no noise. The
  blue/violet palette sits well behind the green status rings. It is the strongest single
  change from legacy (`28c`, flat navy versus a volume).
- **The sun.** The corona, limb and granulation at identity/detail (`06`–`08`) look like a
  hero object from a strategy title. Galaxy Light keeps it soft without a hard outline (`25`).
- **Hairline instrument orbits.** These replace the legacy 2–4 px bands, which read as
  tree rings or a target (`29b`). The dashed/dotted classes read as instrument traces, and the
  density fade keeps the 120-ring Dense System from turning into a solid disc (`04`).
- **Photo bodies at detail zoom.** The sphere lighting is subtle enough that faces stay
  recognisable (see §Faces). The rim plus a faint atmosphere makes a photo feel like a world
  and not an avatar sticker (`18`, `20`, `22`).
- **Moons.** These are the cheap lit moons with a sun-facing cap. At detail (`18`, `20`) they
  look like real bodies.
- **Tethers.** The dotted drift tethers from the rail to rogue/decay bodies (`14`, `18`) read
  as astrometric annotation. They look premium and also carry meaning (C-17, owner call).

## What still looks like a dashboard

- **The chrome frame.** The "Lab B Dense ▾" and "View options" glass pills, the 3-button FAB
  column plus the blue "+" FAB, the app header "Orrery" and the tab bar take ~30% of the screen
  and frame the map like a settings page. In a game map the HUD is thin, edge-anchored and
  typographic. **M2/R2:** collapse the header into the selector, give the selector a HUD-tag
  look (the same plate as the labels), and shrink or auto-hide the FAB column while idle.
- **The companion popover** ("Clear focus / Open Profile", `09`, `11`, `16`, `17`) is a
  generic card dropped over the focused body. It **hides the focused body's own label** and,
  at detail zoom, half the face (`17` → recaptured as `18` without focus). It is the least
  game-like element in the whole flow. **M2 (WP-2.2):** anchor it as a side or bottom
  "target lock" panel that never overlaps the locked body. The label should stay visible.
- **The focus ring** is a thick flat accent-blue circle (`09`, `16`). Next to the hairline
  orbits it is the heaviest stroke on screen and looks like a selection state from a form.
  **M2:** use a thin double bracket or reticle in the instrument register, plus `focusMix`.
- **The context captions** ("Stable · solid gravity", "Not contacted yet · thin g…", `12`,
  `19`, `20`) are grey pills that get truncated with an ellipsis. Truncation in the hero view
  looks cheap. **R2:** fit the caption, or move it under the plate as small caps.
- **Initials bodies** ("CO", "EN", "RB", `11`, `12`, `23`). The giant white sans initials on
  a procedural marble sphere read as a placeholder avatar, not a world. **R1/R2:** smaller,
  letter-spaced, engraved or etched initials, with more surface identity (bands, craters)
  per swatch.

## Readability issues

- **Labels collide with chrome.** In `11` (focus Cleo) the "Gus Moreau" tag slides under
  "View options". The allocator does not know the chrome's safe area.
- **No labels at identity on the Home pose of Inner Circle** (`15`, `26`). The bodies were
  off-centre and the sun filled the view, so the only labelled thing is the dog cut off at the
  top under the selector pill. Presets zoom about the camera centre, not the content. This is
  a debug-path artefact, but it shows the label budget needs a "nothing allocated" fallback.
- **Status at overview.** The status rim on small bodies (~20 px at overview, `02`, `14`) is
  hard to read. The ring colour carries status much better than the body. Decay (red ring,
  `RB`) reads; wobble (yellow dashed) and rogue (amber dotted trace) are close in hue at this
  size. That is the token hue, the same as legacy, and is still worth an a11y check (C-35).
- **Standard Dark is visually the same as Galaxy Dark in the Orrery** (`25`, `27`). The lab
  environment ignores the package difference. The Standard package promises "flatter and
  calmer", so its sky should be quieter, with no nebula or a much lower one (an owner taste
  call; flag `nebula` already exists).
- **Galaxy/Standard Light.** The rings are readable. The pale nebula is a nice touch but makes
  the light theme look washed out at the edges. The red decay ring is the only strong stroke,
  and it dominates the light composition (`25` light).

## Ugliest remaining things (ranked)

1. Companion popover over the focused body (`17`).
2. Thick accent-blue focus ring (`09`, `16`).
3. The chrome stack, especially the blue "+" FAB, which sits in the same blue as the focus
   ring and so competes with it.
4. Giant flat initials on marble spheres.
5. The FPS HUD and "LAB B" tag (lab-only, they go away, but they also hide the bottom-left
   bodies in every screenshot).

## Faces (test portraits, detail 3.2 unless noted)

- **Stable/never-contacted photos are fully readable**: the backlit golden portrait (`22`),
  the neon afro (`20`), the dog (`19`) and the low-contrast foggy portrait (`16`, focused).
  The terminator and limb darkening take maybe 10–15% off the anti-sun edge; the face
  centre is untouched. Even the very low-contrast image keeps its eyes and mouth.
- **Rogue desaturation (45%) is the biggest hit, but the faces survive**: Ada (`18`, dark skin
  on mustard) loses most of the background colour, but her face keeps its detail and reads as
  "faded". Zoe's phone-flash selfie (`23`) also stays clear. The logo graphic (`21`, rogue)
  turns brownish but is still recognisable. **No portrait became unrecognisable.**
- **Dark skin plus darkening**: Ada's face is the case to watch. On the shadow side the
  lighting floor (0.55, C-30) plus desaturation pull her skin toward the background tone. It is
  still readable on the emulator panel, but this needs the phone glance at overview size (C-30).
- **Overview size (~20–24 px)** (`14`, `02`). The faces are thumbnails here and lighting makes
  no difference. Busy backgrounds (the market street, the office) turn to mush at this size
  whatever the renderer does. That is an avatar-crop problem, not a shading one.
- **Not checked:** a **decay-status** portrait at detail (no decay portrait was in view; RB is
  a decay *initials* body). A phone panel or HDR either. Dense and Work hold 23 more
  portrait contacts for a follow-up.

## Suggestions for M2 / R1 / R2

- **M2 (switch/focus):** a target-lock panel instead of the popover; a reticle focus with
  `focusMix`; the label stays visible while focused; animate the HUD chrome out during a
  System switch so the switch reads as a cinematic beat.
- **R1 (perf + correctness):** a label safe-area that includes the top pills and the FAB
  column; re-prove AA for the plates over the brightest nebula (C-02/C-38); give Standard its
  own environment profile; investigate the ~21 fps gfx cadence of the lab renderer on the
  emulator (PERF-LOG WP-1.4), which no single layer explains.
- **R2 (art direction):** an instrument-style selector and minimal HUD; etched initials and
  richer procedural surfaces; a per-status micro-glyph on the rim at overview, so status reads
  on the body and not only the ring; decide C-04/C-05/C-16/C-17 with the owner, using this
  evidence.
