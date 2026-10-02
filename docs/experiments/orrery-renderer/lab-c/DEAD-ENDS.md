# Orrery Lab C — dead ends

Rejected, reverted or superseded ideas, with the reason and how to recover them. Each entry says whether
the code was recoverable when this package was written.

## 1. 2.5D-parity camera — commit 205c1462 (superseded by da5433a9)

**Tried:** the first true-3D build drew a real three.js WebGPU scene, but viewed it through
`orreryCameraRig` configured to reproduce the production ADR-077 pinhole pixel for pixel. Focal distance was
derived from scene extent (about 4.6× extent, telephoto, FOV about 2–8°), `zoom` narrowed the FOV instead of
moving the camera, default tilt was 0 (top-down), and max tilt was 60°.
**Result:** the output was indistinguishable from the Skia 2.5D Orrery. A telephoto camera at extent distance
has almost no perspective, so depth, lighting and parallax had nothing to act on. That is also why the
starfield had to be a slab *under* the plane (a sky dome showed almost no stars).
**Why it was chosen:** the orchestrator required parity so that hits and labels would match. That was a
mistake and it was withdrawn. Parity of *formula* (drawn == tappable) is what matters, not parity of *view*.
**Kept from it:** the single shared pinhole and its parity test. **Recover:** `git show 205c1462 --
src/components/orrery/three/orrery-camera-rig.ts src/logic/orrery-camera-logic.ts`.
**Visual evidence:** only in the untracked local `evidence/01-m1/`, which is not committed.

## 2. Remount / device-lost bisect switch — commit fff81462 (superseded)

`LAB_STAGE` debug switch plus `LAB_C_TRUE_3D=false` left committed, so nothing 3D rendered. It was used to
bisect a device-lost on remount. Removed in da5433a9. The real fix was the per-mount device and prewarm
lifecycle (entry 3).

## 3. Process-wide shared GPU device, and `requestDevice` during surface creation (M1, in 205c1462)

**Shared device:** three's backend hangs a `device.lost.then(...)` reaction per renderer on the device, which
roots every old renderer. Reported (code comment only) as about +200 MB Hermes external per remount and a JS
SIGSEGV on the 3rd–4th remount at 200 bodies. Replaced by one device per mount, destroyed on unmount.
**Device requested while the Orrery's SurfaceView was being created:** JS and main blocked for about 32 s.
Replaced by a prewarmed spare device.
Both are documented only in `three/orrery-gpu.ts` comments and the 205c1462 message. The cited
`_notes/M1-BUILD.md` was never committed, so treat the numbers as unverified.

## 4. Whole-disc Home fit for large Systems — 84f5d646, reverted in 9ae99523 (Checkpoint C.5)

**Tried:** for Systems with > 24 contacts, Home/destination pose = tilt 0.9 and the largest zoom at which
the whole outer ring projects inside the usable rect (MIN_ZOOM lowered 0.25 → 0.08 to allow it).
**Evidence:** `evidence/04-checkpoint-c/10-dense-overview-whole-disc-fit.png`, `11-dense-near-after-fit.png`
(vs the previous framing `07-dense-overview.png`).
**Result:** all 120 bodies technically on screen, but they are pinpricks and ~120 concentric rings form a
moiré; no contact is identifiable. Worse than the previous framing. It also overrode the production
readability floor (`zoom ≥ 10/minRadius`), which is a product rule.
**Lesson:** fitting the full extent at 120 contacts destroys legibility. A dense System needs (1) a minimum
on-screen body size (impostor/clamped billboard), (2) ring thinning / density-based ring opacity (the ring
density fade from C.5 is kept — it is inert at normal zoom), and (3) framing to the populated core rather
than the outermost ring. All three were done in D.1 (7dd23580).
**State:** code kept behind `LAB_FIT_ALL_ENABLED = false` in `src/logic/orrery-camera-logic.ts` (L104).
MIN_ZOOM went back to 0.25 in 9ae99523, then was set to 0.08 again for the D.1 core framing. A core
fraction of 0.8 (the suggested value) was also rejected in D.1 because it bottoms out at the zoom floor,
which is the same dead end. 0.5 was used instead.

## 5. Bloom post-processing — never tried (B.3)

three's `BloomNode` adds 2+ full-screen passes. The frame was already JS- and present-bound in debug, so an
additive glow sprite and a wide corona stand in for it. In release the GPU has headroom (present ≤ 1.1 ms), so
bloom is now *affordable on the GPU*. Its JS-side cost (extra passes to encode) is unmeasured. A candidate for
a renderer that is not JS-bound.

## 6. Attractive but slow: per-fragment procedural shaders — replaced in c5533857 (C.4)

- Star granulation as 2-octave `mx_fractal_noise_float` (3D gradient noise) per star fragment.
- Orbital-plane grid as `atan` + 2× `fract` + smoothsteps per fragment over most of the screen.
- Corona sprite at 16 sun radii (near full-screen additive overdraw).
- Render DPR 2.5 (1028×1813 buffer).
Together they gave 31–34 fps close-up in debug (present 4.9 → 10.6 ms). They were replaced by a baked 128²
noise texture, a baked 768² plane texture, corona at 11 radii and DPR 2.0. The look is essentially the same.
**Recover:** `git show 0219e4a8 -- src/components/orrery/three/orrery-scene3d.ts`.

## 7. Full-atlas snapshot per flush — replaced in f1d9b310

`BodyAtlas.flush` snapshotted the whole 2560² surface per photo batch (about 26 MB of image pressure each
time). Replaced by per-dirty-tile snapshots.

## 8. One ParagraphBuilder per label — replaced in e4d9e842

Each builder plus paragraph carried 2 MB of Hermes external pressure, and builders cannot be disposed.
Mount external was 1569 MB and post-gc floors rose 300–575 MB per mount. Replaced by a shared builder and a
Paragraph cache (PERFORMANCE.md E.1).

## 9. Releasing CPU buffers at dispose as the fix for the per-mount floor — did not work (1d052ca2)

The hypothesis was that the remaining +70 MB/mount was a retained scene's atlas and texture copies. Nulling
them at `dispose()` left the floor unchanged (+72 MB). The code was kept because it is harmless; the
retainer is still unidentified.

## 10. Focus framing bounded by the usable rect, and the IDENTITY_ZOOM cap on the focus dolly — replaced in 97d94229 / 4ece2978

With the perspective dolly, the `IDENTITY_ZOOM` cap kept the focused system small under the header. The
usable rect ends at the top of the side-controls column (usable height about 408 of about 720 px), so
"system above a hanging card" could only ever be small, and the over-zoomed variant left a void
(`07-checkpoint-e/s5-focus-system-framed.png`). Replaced by the docked card plus framing between the
selector and the card. The E.2 note calling the canvas-width bound "next commit" was wrong; it landed in
97d94229 itself.

## 11. Not pursued (recorded so V2 does not re-discover them)

- **R3F (`@react-three/fiber`) on WebGPU:** needs a patch-package and has an open async-gl double-renderer
  bug. It also invites React-state animation. Imperative three was used instead (RENDERER-DECISION.md).
- **`createImageBitmap` byte path for photos:** a probe exists (`runBitmapProbe`), but production used
  Skia decode → atlas. No committed log shows the probe result.
- **Per-body accessibility overlay nodes:** feasible from the projection packet, but new scope. The canvas
  is not the a11y path in production either (`_notes/A11Y.md`).
- **Spreading never-contacted members** to break the "spine" behind the star: a product layout rule, left
  for the owner.
