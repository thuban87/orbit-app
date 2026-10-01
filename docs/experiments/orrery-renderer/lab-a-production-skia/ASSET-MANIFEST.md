# Lab A: Asset manifest

**Summary:** Lab A adds **no shipped asset files**. Everything it draws is procedural: generated in code at runtime from theme tokens, or compiled from SkSL strings. No external, downloaded, AI-generated or Codex-supplied images, fonts or textures were added. No `assets/` entries, native resources or new fonts were added; the existing bundled Inter is used through the app's font provider.

Checked with `git diff --name-status 3492092..HEAD`. Outside `evidence/`, the only binary files the branch adds are the five CanvasKit preview JPEGs listed in §3, which are documentation.

## 1. Runtime-generated resources (in-app, nothing on disk)

| Resource | Where it is made | Format / size | Provenance | Lifetime | Keep / discard |
|---|---|---|---|---|---|
| Nebula texture | `lab/nebula-bake.ts` `bakeNebulaPixels` → `Skia.Image.MakeImage` | 256×256 RGBA8 premultiplied (256 KB), drawn bilinear-upscaled to the sky disc (≈2·(half-diagonal+140 dp) square) | Procedural value-noise fbm in JS float64, coloured only by tokens (`orreryNebulaA/B`, `orreryStarlight`, `orreryGrid`) | Module cache keyed by ink: one per palette per process, never disposed (≤ 4 presets) | **Keep the technique** (precision-proof on Mali, no pop on remount). The look is the owner's call (VISUAL-DESIGN). |
| Star layers (far, near A, near B) | `lab/sky-resources.ts` `scatter` + `recordStars` | `SkPicture`s, bounds ±(half-diagonal+140 dp); 240 + 70 stars dark, 90 + 26 light; 7 hero stars with glow and spikes in dark mode | Deterministic `sin`-hash scatter; token star palette | Per `LabScene` mount, per size/palette | Keep |
| Vignette | `LabScene` `sky` memo | Radial gradient shader | `orreryVoid` token | Per size/palette | Keep |
| Plane unit geometry | `lab/world-plane.ts` `makePlaneShapes` | Six unit n-gon `SkPath`s (40, 48, 64, 96, 128, 192); **30 `SkVertices` annulus strips** (128 segments, ε = 0.001·1.25^k); one disc fan (128 segments) | Analytic | Per `LabScene` mount | **Keep** (the core of the camera-pass win) |
| Base texture | `LabScene` `below` via `Skia.Surface.MakeOffscreen` | Device-pixel RGBA, 1440×3120 ≈ 18 MB on the Pixel 6 Pro | Rasterised `below` picture | Created when the scene goes static; re-created on size change; disposed on unmount | Keep the pattern; budget the memory |
| Compiled shaders | `lab/deep-field-shaders.ts` `labEffect` | 6 `SkRuntimeEffect`s (`corona`, `sunDisc`, `body`, `ring`, `ringWorld`, `grid`) | Hand-written SkSL with no colour literals | Module cache | Keep `ringWorld`, `grid`, `body`, `sunDisc` and `corona`; `ring` is a fallback only |
| Initials and label paragraphs | `lab/scene-specs.ts`, `prepareOrreryText` (existing) | `SkParagraph` | Existing Inter font provider | Per spec / label memo | Keep |
| Polaris star path | `LabScene` (`POLARIS_STAR` SVG string, copied from `Polaris.tsx`) | `SkPath` | Existing production glyph | Per mount | Keep |

Contact photos are **not** new assets. They are the user's own photos, loaded through the unchanged `useOrreryPhoto` (512 px on-disk derivative, D-11/D-41). Only their disposal custody changed.

## 2. Theme tokens (data, not files)

Six new `ThemePalette` colour tokens in all four presets (`src/theme/theme-presets.ts`, `202b0d6`): `orreryVoid`, `orreryNebulaA`, `orreryNebulaB`, `orreryGrid`, `orreryStarlight` and `orreryShadow`. They are the only place the Lab's colour literals live (`check:colors` = 0). **Production adoption needs owner sign-off** (the preset comment says so).

## 3. Committed non-evidence binaries

| File | Format / dimensions | Provenance | Purpose | Keep / discard |
|---|---|---|---|---|
| `_notes/canvaskit-previews/body-lighting-and-corona-dark-light.jpg` | JPEG 780×1130, 47 KB | Off-device CanvasKit 0.41 render (CPU raster, fake photo gradient, synthetic data) by the harness in `_notes/canvaskit-previews/harness/*.cjs` | Direction-1 *intended look*, before the device existed | Keep as research history; not evidence |
| `…/galaxy-dark-flat-vs-tilted.jpg` | JPEG 829×840, 104 KB | same | same | same |
| `…/galaxy-light-flat-tilted__galaxy-dark-mid-switch.jpg` | JPEG 996×672, 103 KB | same | same | same |
| `…/nebula-4-palettes.jpg` | JPEG 1230×650, 33 KB | same; shows the **removed** GPU fbm nebula | same | same |
| `…/standard-dark__standard-light__galaxy-dark-switch.jpg` | JPEG 996×672, 102 KB | same | same | same |

## 4. Test-data assets (tools, never shipped)

| Item | Where | Format | Provenance | Purpose | Keep / discard |
|---|---|---|---|---|---|
| Synthetic avatar photos | Generated at seed time by `tools/seed-lab-a.py` `make_avatar(path, seed)` and pushed to the device at `files/avatars/contact-<id>.jpg`. **Not committed.** | JPEG 512×512, quality 88 | Pillow procedural art: a two-colour vertical gradient plus six random ellipses, seeded per contact. **No faces, no real people.** | 15 avatars (4 core contacts + every third of the 32 Lab Dense) to exercise photo bodies, the cross-fade and custody | Keep the tool; regenerate on demand |
| Seed data | `tools/seed-lab-a.py` | SQLite rows written into the lab package's own DB | Synthetic names, statuses, interactions, 5 satellites, custom System "Lab Inner Circle" | Repeatable device scenes | Keep (experiment tooling) |

## 5. Evidence (not assets)

Screenshots, screen recordings, contact sheets, gfxinfo/SF/meminfo dumps, simpleperf reports and one Perfetto trace sit under `evidence/` (about 154 MB across `baseline`, `direction-1`, `pass-1`, `pass-2`, `perf`, `pass-3`, `final`, `arch-perf` and `camera-perf`). They are listed in each pass's index or notes:
- [`evidence/final/INDEX.md`](evidence/final/INDEX.md) and [`PERF-RESULTS.md`](evidence/final/PERF-RESULTS.md);
- [`evidence/direction-1/REVIEW.md`](evidence/direction-1/REVIEW.md);
- [`evidence/perf/latency-summary.txt`](evidence/perf/latency-summary.txt);
- the "Evidence" sections of `_notes/PASS-1.md`, `PASS-2.md`, `PASS-3.md`, `ARCH-PERF-PASS.md` and `CAMERA-PERF-PASS.md`.

**Recommendation:** keep the evidence on the experiment branch only. Do not carry it to `main`.
