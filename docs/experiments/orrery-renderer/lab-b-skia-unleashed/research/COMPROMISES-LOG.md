# Lab B — compromises log

Intentional production compromises (IDs follow research 03 §5 where they exist).

| ID | Compromise | Where | Production would need |
|---|---|---|---|
| C-08 | Lab panel + FPS HUD are gated on applicationId `com.bwales.orbit.labb`, not `__DEV__`, so they ship in lab release builds. Renderer defaults to `lab` regardless of build (the branch only builds Lab B). | `labb/debug/LabFxPanel.tsx`, `orrery-labb-fx-store.ts` | Remove, or `__DEV__` gate; default renderer decided by V2. |
| C-09 | Labels keep the legacy per-label saveLayer (`OrreryLabel` reused unchanged). | `LabBRenderer.tsx` L6 | Pre-rasterised labels or glyph path. |
| C-20 | `resolveTap` side-writes `fxTap` (x, y, seq, intent kind); intent unchanged. Not yet consumed. | `OrreryWorld.tsx` | A clean feedback event channel. |
| C-21 | Reduced-motion lab override is a module-level mutable in `src/theme/` consumed by the shared hooks (null by default = OS). | `src/theme/reduced-motion-override.ts`, `use-reduced-motion.ts` | Delete with the panel. |
| C-22 | Lab bodies fade via Group opacity (no saveLayer): during switch fades the status disc shows through a semi-transparent photo. Invisible bodies collapse to scale 0. | `LabBodies.tsx` | Alpha as a shader uniform on a single lit-surface draw (WP-1.2 plans this). |
| C-23 | `labInitials` takes the first code point per word (Hermes lacks `Intl.Segmenter`), so combining-mark / ZWJ initials can split. | `LabBodies.tsx` | A grapheme segmenter polyfill or native shaping. |
| C-24 | `orrery-scene.test.ts` mocks `use-orrery-photo` (the lab body slot imports it). | `src/services/orrery-scene.test.ts` | Keep, or split lab bodies behind a lazily-loaded module. |
| C-25 | Camera debug presets go through `camera.recover` (animated, clamped); they reach exact zoom levels but are a debug path, not a product gesture. | `LabFxPanel.tsx` | Delete. |
| C-01 | Departs from ADR-114/179 (art-free solid Orrery background): procedural nebula + dense starfield on the Orrery route (WP-1.1). | `LabEnvironment.tsx` | Owner decision + superseding ADR. |
| C-02 | ADR-149 overlay-contrast proof was made against the brightest raw Orrery star; the nebula cores and near stars are brighter. Not re-measured yet (R1). | `LabEnvironment.tsx`, `orrery-lab-fx.ts` env | Re-prove AA for the glass overlays / label plates over the brightest sky pixels. |
| C-03 | Nebula/vignette/star colours are numeric mixes of existing tokens (incl. a sky token scaled toward zero for the dark vignette) and `starPalette` indices chosen in `LabEnvProfile`; none owner-approved. | `orrery-lab-fx.ts` (`LabEnvProfile`), `LabEnvironment.tsx` `nebulaStatic` | Authored per-palette sky tokens. |
| C-13 | Baked textures: 768² RGBA nebula density (~2.3 MB) + 96×32 star atlas per Orrery mount. | `LabEnvironment.tsx` | Budget under the high-count rules; consider 512² if R1 shows no visible loss. |
| C-26 | LAB-ONLY sprite mask colours (`LAB_SPRITE_MASK`, `_HALO`, `_CLEAR`): white alpha masks for the star atlas, tinted by token colour buffers; they are colour literals that never reach the screen untinted. | `src/theme/orrery-lab-fx.ts` | Keep (masks are not palette colours) or generate the atlas from a token with `modulate`-neutral maths. |
| C-27 | The sky's rotation pivot is the viewport centre, not the exact projection centre (`usableCameraRect` centre); the difference is a constant offset. | `labb-sky.ts` | Export the projection centre from `orrery-camera-logic` (or carry it on the frame). |
| C-28 | `setLabEffectForceFallback` is called during render (idempotent module flag) — a render-phase side effect, debug-only. | `LabBRenderer.tsx` | Delete with the panel. |
| C-29 | The ambient clock still replays the whole canvas every frame under reduced motion although L0 is static (twinkle/drift frozen inside the worklets). | `LabCanvas.tsx` | R2 experiment: unmount the clock subtree while reduced motion is on. |
