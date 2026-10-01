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
