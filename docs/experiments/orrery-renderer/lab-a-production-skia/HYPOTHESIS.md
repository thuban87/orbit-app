# Lab A — Initial visual/technical hypothesis

**Question:** How game-like can the Orrery get on its existing Skia + Reanimated + RNGH foundation while staying a plausible near-term production architecture?

## Diagnosis of the current renderer
It reads as a *chart*: flat background fill, 44 uniform dots, 1-px polylines, flat photo discs with a status outline, a circle-halo sun, and plain text labels. Every layer has equal visual weight, so there is no depth hierarchy, no light model, and no sense of place. The 2.5D camera already exists (tilt/yaw/perspective), but the visuals don't *sell* it.

## Hypothesis: "Deep-field star chart"
A premium space-strategy map comes from **layered depth + a single coherent light model + instrument-grade HUD language**, not from extra glow. All of it can be done in Skia with runtime shaders and cached pictures. There's no new dependency.

1. **Environment (3 parallax layers, mostly static).** Bottom to top:
   - a procedural nebula/dust field (one SkSL fbm shader, theme-token colour uniforms, rendered once to a cached image, low-factor parallax with pan/yaw);
   - two star layers at different parallax factors (pre-recorded pictures or Atlas, with twinkle as one uniform);
   - a vignette.
   
   Motion is driven by camera pose, which is free and stops when the camera stops. Ambient motion stays restricted to cheap uniforms.
2. **World plane / astrolabe.** A faint plane grid under the system is drawn through the camera's planar homography: concentric reference rings, radial ticks, and a fade with distance. It makes tilt and yaw legible as real 3D and grounds every body.
3. **Orbits as instruments.**
   - Rings are thin luminous lines with depth-attenuated alpha: the far side is dimmer and thinner, the near side brighter.
   - Each contact gets a *progress trail*: the arc it has already swept since last contact brightens toward the body. Angle already encodes interval progress, so the trail makes the existing semantics readable.
   - Status colour and the solid/dashed/faded ring language are preserved.
4. **Bodies lit by the sun.** The photo/initials disc gets:
   - a lighting shader with a terminator/shadow side facing away from the sun;
   - a rim light and a thin atmosphere halo in the status colour;
   - a contact shadow ellipse on the world plane under each body, the strongest 2.5D cue;
   - a depth cue where far bodies are slightly dimmer and cooler.
   
   Bodies are still clearly people: the photo stays readable and the shading is subtle.
5. **Sun as a star.** A layered corona: a radial core, a noise-shaped corona from a shader using the existing single clock and a slow uniform, plus a soft bloom. This replaces the circle halo.
6. **HUD language.**
   - Focus becomes a targeting reticle (corner brackets with a slow rotation, static under reduced motion).
   - Labels become instrument plates: small caps, a hairline leader, and a tabular status line.
   - A Lab A marker is shown in development builds only.
7. **System switch as a jump.**
   - Departing bodies streak and dim along their velocity.
   - Entering rings *draw on* with a sweep.
   - The sun flares at capture, and starfield parallax kicks with switch progress.
   
   Under reduced motion this falls back to a crossfade with no streaks.
8. **Light modes become a "chart paper" variant.** The same geometry uses ink lines and multiply-style shading in place of additive glow. It is a first-class variant, not an afterthought.

## Production guard-rails
- The renderer only *reads* the existing `frame`. Visual extents never change `radius`/`hitRadius`/label metrics.
- One clock, and live reduced motion respected.
- Theme tokens are passed as uniforms.
- Shaders are compiled lazily, never at module scope.
- Static layers are cached as pictures or images, with per-frame work kept to transforms and uniforms.
- Measure a release build on the physical phone before and after.

## What would falsify it
- Shader layers that cost visible frame time on the Pixel.
- Photos becoming hard to recognise under lighting.
- A HUD that adds clutter at density 30–40.
- Light modes that look like a degraded dark mode.
