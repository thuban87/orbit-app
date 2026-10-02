# Orrery Lab C — visual design

## Visual language

The aim was a **space-strategy star-system map**. The camera leans about 62° from vertical over a
lit orbital plane. The system recedes into haze toward the top of the canvas, and the near rings run off
the bottom. People are the heroes: large lit spheres with their photo or initials on the camera-facing
side, orbiting a star that holds the System's "sun" person in a gold medallion. Orbit stays recognizable
because the information architecture is unchanged. Ring = Gravity tier and status colour, dashes = the
production stroke styles, sun = System centre, moons = relationships, labels = the production semantic
tiers.

Best overall shots: `evidence/08-final/02-inner-overview.png` (small System) and
`evidence/08-final/05b-dense-focus-chloe-with-moons-dana-cy.png` (focus with moons).

## Elements and tunables

Tunables sit at the top of their files. Values below are as read on disk.

| Element | Design | Tunables (file) |
|---|---|---|
| **Background / environment** | Clear colour = `background` token. 2600 star sprites on a sphere around the camera, coloured from `textSecondary`/`textPrimary`/`starPalette`, constant pixel size 1.6–4.6 px, twinkle. Yaw and tilt give real rotational parallax. Range fog toward the background token makes the far rim hazier | `STAR_COUNT`, `STAR_PX_MIN/MAX`, `TWINKLE_SPEED`, `FOG_NEAR_FRACTION 0.8`, `FOG_FAR_EXTENTS 1.9` (`orrery-scene3d.ts`) |
| **Orbital plane** | Additive disc of 1.18 extents under the plane: radial dust plus 9 polar grid rings plus 24 spokes, edge-faded, tinted `accent` (dark) or `textSecondary` (light) | `PLANE_*` (`orrery-scene3d.ts`) |
| **Orbit rings** | Thin strips in the plane. Width is in *screen* px (production stroke × 0.45 + 1 px AA). Dashes follow arc length. Far rings fade to 18% with view distance. **Density fade:** when orbits are packed tighter than 20 px on screen, alpha and width scale by a squared ramp (floor 5%, light 35%), so 120 rings become a texture instead of a moiré | `RING_STROKE_SCALE`, `RING_DASH_PX 12`, `RING_FAR_OPACITY`, `RING_MIN_SPACING_PX 20`, `RING_DENSITY_FLOOR 0.05` |
| **Contact bodies** | Lit spheres (roughness 0.38) in the status fill token. Point key light at the sun gives a lit side and a terminator. Hero scale ×1.9 over the 2.5D radius. **Minimum on-screen size** 18 px (moons 10, star 34), applied to the *world* radius so hits and labels follow | `CONTACT_HERO_SCALE`, `MIN_CONTACT_PX`, `MIN_SATELLITE_PX`, `MIN_SUN_PX` (`OrreryWorld3D.tsx`), `KEY_LIGHT_INTENSITY 3.2`, `AMBIENT_INTENSITY 0.22` |
| **Faces** | Photo (cover-fit) or swatch plus initials disc, 62% of the body diameter, set on the camera-facing surface. Shaded per pixel as a hemisphere toward the sun, so the face shares the sphere's lighting | `FACE_FRACTION 0.62`, `FACE_AMBIENT 0.3`, `FACE_DIFFUSE 0.95` |
| **Star (sun)** | Emissive sphere with limb darkening, slowly drifting baked granulation and a hot core. Additive glow (×6.5 radius, pulse ±8%) and wide corona (×11). The occupant sits in a **framed medallion**: face inset to 80%, gold bezel with bevel in the star's glow token, warm vignette, interior 86% opaque so the star glows through. With no photo, the tile is a shaded `surface` plate with initials or a person glyph | `SUN_HERO_SCALE 1.45`, `SUN_FACE_FRACTION 0.74`, `SUN_RIM_INNER 0.8`, `SUN_PLATE_OPACITY 0.86`, `SUN_GLOW_SCALE`, `SUN_CORONA_SCALE` |
| **Moons** | Spheres on a **tilted local orbit** (inclination 0.5 rad), 40% of the parent radius, emissive floor `textSecondary`×0.4 so the night side is not a black blot, plus a face tile. The focused parent's moons revolve, about one turn per 21 s | `MOON_INCLINATION`, `MOON_SPEED`, `MOON_PARENT_FRACTION` (`OrreryWorld3D.tsx`), `MOON_EMISSIVE`, `MOON_FACE_FRACTION 0.84` |
| **Depth** | Perspective dolly (near bodies are bigger), fog, ring depth fade, star parallax, lit terminators, lens shift (pivot at about 31% of the camera rect) so the far half fills the sky | `LAB_FOCAL_PX 720`, `LAB_HOME_TILT 1.08`, camera rect height ×0.62 (`OrreryScreen.tsx`) |
| **Labels** | Production rule unchanged (overview: focused/cluster only; identity tier: names; detail tier: names + context). The tier *input* is re-derived as the median on-screen magnification of visible contacts. Labels are Skia-rasterized on the `surface` backplate and drawn as a screen-space overlay at the UI-thread allocation rects. Nearer labels win space. Every body disc (padded ×1.15) is an exclusion | `effectiveLabelZoom`, `SILHOUETTE_PAD`, `LABEL_BODY_GAP 4` |
| **Focus** | Accent-token focus ring sprite. The camera flies the pivot to the contact and dollies until the contact's *system* (body plus moon orbit) fills up to 70% of the space between the selector row and the **docked focus card** (bottom of canvas, left of the controls column). Neighbours and orbit arcs stay in view | `FOCUS_SYSTEM_FILL 0.7`, `FOCUS_MOON_SYSTEM_WIDTH 0.3`, `FOCUS_BODY_WIDTH 0.15` (`OrreryScreen.tsx`), `orrery-focus-card-layout.ts` |
| **Motion / transitions** | Switch: departing bodies spiral out *and fall below the plane into the fog*. Arriving bodies *streak in from above* and land. A ring flare and accent halo play at capture. The camera "breathes" (dolly out 24%, yaw +0.38, tilt −0.1, sin² envelope). See INTERACTIONS.md | `SWITCH_*` (`OrreryWorld3D.tsx`) |
| **Themes** | Light mode (background luminance > 0.5): fog tinted and pushed 2.6× farther, ambient 0.75, glow/corona/flare/plane use normal blending (additive vanishes on pale ground), plane ink `textSecondary`, ring floor 0.35, faces never fogged | `LIGHT_*` (`orrery-scene3d.ts`), `applyColors` |

## Compared with the Skia 2.5D Orrery (candid)

**What true 3D genuinely improved**

1. **Depth hierarchy at near and close range.** Near bodies are bigger and lit, far ones recede into haze,
   so the map has a foreground and a background (`08-final/02-inner-overview.png`, `03b`, `04b`). The
   2.5D Skia view is legible but flat.
2. **Camera feel.** One-finger orbit with inertia around a tilted system feels like a strategy-game map
   (`rec-02-orbit-drag-then-focus-fly-in-14s.mp4`). The star sphere and lit terminators turn with the camera.
3. **Focus "arrival".** The fly-in dollies into a lit sphere with the person on it, and the docked card
   leaves the system framed above (`05a`, `05b`).
4. **Switch choreography.** The fall-away and streak-in on a vertical axis read as departure and arrival
   in space, which is more expressive than a planar spiral (`rec-01`, `04-checkpoint-c/04-switch-mid-*`).
5. **Lit bodies and the star.** The star with a medallion occupant is a strong landmark.
6. **Moons as real satellites.** Moons on inclined, revolving orbits pass in front of and behind the parent.

**What it made worse, or left at risk**

1. **Dense overview readability.** At 120 contacts the overview only works because of three additions:
   minimum on-screen body size, ring density fade, and core framing (`08-final/01-dense-overview.png`).
   Without them it was ~30 of 121 bodies on screen, or specks and moiré
   (`04-checkpoint-c/07`, `10`). Bodies at the dense overview are about 18 px dots with truncated face text.
2. **The "spine" behind the star.** Never-contacted members all rest at the production
   `NEUTRAL_RESTING_ANGLE = 0` (`src/logic/orrery-world-logic.ts:26`), one per ring. At yaw 0 the tilted
   camera looks straight along that line, so foreshortening stacks them into a column behind the sun
   (`08-final/01-dense-overview.png`). It is a product layout rule, so it was **not changed**. Spreading
   neutrals is an **open owner decision**.
3. **Light themes are weaker.** The sun-lit spheres have dark night sides that read as near-black smudges
   on a pale ground (`08-final/07a`, `07b`). A thin outline instead of glow was not tried. Standard-light
   was only shot before the light fix.
4. **No labels at the dense overview.** The overview tier shows only focused and cluster labels, so the
   dense map is faces-only until you dolly in.
5. **Face text truncation (found while writing this package; cause not verified on device).** On the device
   shots, face tiles show ellipsized name fragments ("Ch…", "Xl…") instead of two-letter initials
   (`08-final/01`, `05b`). `orreryInitials` (`src/logic/orrery-label-logic.ts:21`, unchanged from main)
   returns the **whole name** when `Intl.Segmenter` is unavailable. That fits Hermes, but it was not
   checked on device. The tile paragraph then ellipsizes at 160 px.
6. **Moons read slightly faded** next to the parent at 10–14 px (E.2b note). Not tuned further.
7. **Visual cost.** It adds a 20.6 MB native dependency and a JS-thread render loop with a 60 Hz ceiling.
   See ARCHITECTURE.md and PERFORMANCE.md.

## Reduced motion

Moon revolution, star twinkle, sun pulse and granulation drift stop (`starTime`/`sunTime` = 0). Switch
lift, flare and breath are gated off, so the production 180 ms crossfade plays. Verified pixel-identical
5 s apart (`07-checkpoint-e/s4-*`).
