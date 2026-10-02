# Orrery Lab C — asset manifest

**No external, downloaded or scraped graphical assets were added, and no image files were added to the app.**
Every texture is generated at runtime, in code, from theme tokens or from the user's own local photos.
Fonts are the app's existing font provider (Inter via Skia `TypefaceFontProvider`).

**Codex was not used.** The contract allows delegating an original asset to Codex only when it genuinely
improves the prototype. Every visual need here (star granulation, plane grid, glows, rings, faces, labels)
was met by small procedural textures or TSL math that stay token-tinted and theme-switchable at no asset
cost. A bitmap asset would also have broken the "every colour resolves through theme tokens" rule unless it
was a pure alpha mask, and those are trivial to generate. So no asset was produced just to use Codex.

## Runtime-generated textures (all `THREE.DataTexture`, RGBA8, sRGB, linear filtering, no mipmaps)

| Texture | Generator | Size | Content | Purpose | Recommendation |
|---|---|---|---|---|---|
| Body atlas | `BodyAtlas` (`three/orrery-textures3d.ts`) | **2560 × 2560** (16 × 16 tiles of 160 px; `ATLAS_TILE`, `ATLAS_COLS`), ~26 MB CPU copy | Per body: photo cover-fit, or swatch disc + initials (Skia Paragraph), or sun plate (shaded `surface` disc + initials or person glyph) | Faces on all bodies, one instanced draw | **Keep the concept** (one atlas, per-tile dirty updates). Size the tile to the on-screen max; consider a GPU-side copy instead of `readPixels` |
| Label rasters | `rasterizeLabel` | text width × height × render DPR (≤ 2.0), one per allocated label, LRU 96 | `surface` token rounded backplate + Paragraph | Screen-space labels | Keep the approach (Skia shaping is the only correct Unicode path); batch into an atlas for production |
| Radial glow | `radialGlow(128)` | 128 × 128 | white, alpha `(1−d)²` | Sun glow, corona, Polaris, capture flare (tinted by tokens) | Keep |
| Star point | `radialGlow(32, 1.2)` | 32 × 32 | white, harder falloff | Star sprites | Keep |
| Focus ring | `annulus(128, 0.82, 0.98)` | 128 × 128 | white annulus with 1.5 px AA | Focus ring sprite (accent) | Keep |
| Orbital plane | `planePattern(768, 9, 24, 0.08, 0.07)` | **768 × 768** | alpha = radial dust + 9 polar rings + 24 spokes, edge-faded, stored ×4 for 8-bit precision | Plane disc (accent / textSecondary) | Keep the baked idea; reconsider the look per theme |
| Star granulation noise | `noiseTexture(128)`, `RepeatWrapping` | **128 × 128** tileable | 2-octave value noise (8 and 16 cells) in alpha | Sun surface, sampled by longitude/latitude | Keep (it replaced per-fragment `mx_fractal_noise_float`) |
| Bitmap probe (spike only) | `runBitmapProbe` (`three/orrery-gpu.ts`) | photo size | one `createImageBitmap(ArrayBuffer)` texture, disposed right after | Spike check 3 (file bytes → GPU) | **Discard.** No logged result for it is in the committed evidence (unverified whether it passed) |

## Procedural geometry (no files)

`SphereGeometry(1, 20, 14)` (bodies, moons, sun); a ring strip of 160 segments (`ringStripGeometry`);
`CircleGeometry(1, 128)` (plane); `PlaneGeometry(1,1)` (labels); 2600 star positions from a seeded hash.

## Test-fixture images (dev-only, never shipped)

| Asset | Generator | Size / format | Purpose | Recommendation |
|---|---|---|---|---|
| Procedural portraits | `portraitBytes` (`src/__dev__/lab-c-seed.ts`) | 256 × 256 JPEG q88, every 3rd of 200 synthetic contacts, written through `setContactPhoto` into the app's `avatars/` store on the device | Seed data with photos | Discard with the lab. The seed only runs in `__DEV__` on `com.bwales.orbit.labc`; the release bundle has no `lab-c-seed` strings (RUNBOOK §8) |

## Native binary weight (not an asset, but it ships)

`libwebgpu_dawn.so` 17.5 MB + `libreact-native-webgpu.so` 3.1 MB per ABI (arm64 measured). See ARCHITECTURE.md.
