# Background assets — provenance & license manifest

In-project provenance/license record for every bundled background (THEME-04 /
dossier §E [DERIVED]). Backgrounds are **local, bundled `require()` assets only** —
no network, no CDN, no downloadable path (D-04). Every slot the `backgrounds.ts`
manifest resolves via `require()` has a committed asset here **and** a row below.

## Declared worst-case brightest pixel (composited-AA bound)

Each asset row records a **declared worst-case (brightest representative) pixel**
(cycle-3 MEDIUM). This is the composited-AA design bound the shipped asset must not
exceed: `src/theme/tokens/surface.test.ts` composites the live glass tint over this
pixel and asserts every text/status foreground still meets AA-equivalent contrast.

**Declared-not-decoded (REVIEWS 23-06 cycle-4 MEDIUM):** nothing decodes the
committed `.webp` bytes. The node test proves AA only under the DECLARED pixel; the
shipped bytes are enforced against it by the per-asset **device-UAT** on the Pixel
(body + caption text over glass on each Galaxy asset's brightest region — recorded in
`23-VALIDATION.md` Manual-Only). A build-time `.webp`-luminance gate is a Phase-15
candidate. If a shipped asset's actual brightest region exceeds its declared pixel,
re-master/darken the art or retune its declared pixel + tint opacity — **never weaken
AA**.

## Current assets — PLACEHOLDER

The committed `.webp` files are **placeholder uniform-fill images** (a single solid
colour equal to the declared brightest pixel), generated locally so the `require()`
paths resolve and bundle. They are honest for the composited-AA bound (a uniform fill
cannot exceed its own colour). Final curated art is an asset-production item; when it
lands it must stay **at or below** the declared brightest pixel for its slot (or the
declared pixel + tint opacity are retuned together, AA never weakened).

## Provenance rows

| Slot id | Package | File | Brightest pixel | Source | License | Author |
|---------|---------|------|-----------------|--------|---------|--------|
| `galaxy-deep-space` | galaxy | `galaxy-deep-space.webp` | `#1A1F35` | Placeholder solid fill (generated in-project via ffmpeg lavfi) | Project-internal (CC0) | orbit-app |
| `galaxy-starfield` | galaxy | `galaxy-starfield.webp` | `#202545` | Placeholder solid fill (generated in-project via ffmpeg lavfi) | Project-internal (CC0) | orbit-app |
| `galaxy-nebula` | galaxy | `galaxy-nebula.webp` | `#2A2148` | Placeholder solid fill (generated in-project via ffmpeg lavfi) | Project-internal (CC0) | orbit-app |
| `galaxy-aurora` | galaxy | `galaxy-aurora.webp` | `#16303A` | Placeholder solid fill (generated in-project via ffmpeg lavfi) | Project-internal (CC0) | orbit-app |
| `standard-dawn` | standard | `standard-dawn.webp` | `#E8D8C0` | Placeholder solid fill (generated in-project via ffmpeg lavfi) | Project-internal (CC0) | orbit-app |
| `standard-paper` | standard | `standard-paper.webp` | `#EDE6D8` | Placeholder solid fill (generated in-project via ffmpeg lavfi) | Project-internal (CC0) | orbit-app |
| `standard-dusk` | standard | `standard-dusk.webp` | `#C8B0C0` | Placeholder solid fill (generated in-project via ffmpeg lavfi) | Project-internal (CC0) | orbit-app |
| `standard-mesh` | standard | `standard-mesh.webp` | `#B8C4D0` | Placeholder solid fill (generated in-project via ffmpeg lavfi) | Project-internal (CC0) | orbit-app |

**None / Solid** (`none` slot id) ships **no asset** — it resolves to the solid theme
background (`colors.background`) at render, so it has no row here.

When replacing a placeholder with final art, update its **Source / License / Author**
and confirm its actual brightest region stays at or below the **Brightest pixel**
recorded above (re-run the device-UAT).
