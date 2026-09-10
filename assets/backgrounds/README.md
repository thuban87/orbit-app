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

**Measured delivery (Phase 31 Plan 12):** every committed `.webp` was decoded to
RGB24 with ffmpeg and scanned byte-for-byte. Its measured per-channel maximum equals
the declared pixel below, so the declared composited-AA proof remains valid without
changing a shared tint or opacity token. Release Pixel screenshots remain the visual
proof for the renderer itself. If a future asset's actual brightest region exceeds
its declared pixel, re-master/darken the art or retune its declared pixel + tint
opacity — **never weaken AA**.

## Current assets — approved local art

The eight production WebPs are the owner-approved Phase 31 candidate board,
transcoded losslessly at `941x1672` and remastered per RGB channel so no decoded
pixel exceeds its slot's declared AA bound. They replace only the established asset
paths; IDs, resolver mappings, package order/defaults, and the bundled-local-only
boundary are unchanged.

## Provenance rows

| Slot id | Package | File | Dimensions | Measured brightest pixel | Source | License | Author |
|---------|---------|------|-----------------|--------|---------|--------|
| `galaxy-deep-space` | galaxy | `galaxy-deep-space.webp` | `941x1672` | `#1A1F35` | Approved `31-12-art/galaxy-deep-space.png`, ffmpeg lossless WebP remaster | OpenAI Terms of Use | OpenAI image generation; orbit-app remaster |
| `galaxy-starfield` | galaxy | `galaxy-starfield.webp` | `941x1672` | `#202545` | Approved `31-12-art/galaxy-starfield.png`, ffmpeg lossless WebP remaster | OpenAI Terms of Use | OpenAI image generation; orbit-app remaster |
| `galaxy-nebula` | galaxy | `galaxy-nebula.webp` | `941x1672` | `#2A2148` | Approved `31-12-art/galaxy-nebula.png`, ffmpeg lossless WebP remaster | OpenAI Terms of Use | OpenAI image generation; orbit-app remaster |
| `galaxy-aurora` | galaxy | `galaxy-aurora.webp` | `941x1672` | `#16303A` | Approved `31-12-art/galaxy-aurora.png`, ffmpeg lossless WebP remaster | OpenAI Terms of Use | OpenAI image generation; orbit-app remaster |
| `standard-dawn` | standard | `standard-dawn.webp` | `941x1672` | `#E8D8C0` | Approved `31-12-art/standard-dawn.png`, ffmpeg lossless WebP remaster | OpenAI Terms of Use | OpenAI image generation; orbit-app remaster |
| `standard-paper` | standard | `standard-paper.webp` | `941x1672` | `#EDE6D8` | Approved `31-12-art/standard-paper.png`, ffmpeg lossless WebP remaster | OpenAI Terms of Use | OpenAI image generation; orbit-app remaster |
| `standard-dusk` | standard | `standard-dusk.webp` | `941x1672` | `#C8B0C0` | Approved `31-12-art/standard-dusk.png`, ffmpeg lossless WebP remaster | OpenAI Terms of Use | OpenAI image generation; orbit-app remaster |
| `standard-mesh` | standard | `standard-mesh.webp` | `941x1672` | `#B8C4D0` | Approved `31-12-art/standard-mesh.png`, ffmpeg lossless WebP remaster | OpenAI Terms of Use | OpenAI image generation; orbit-app remaster |

**None / Solid** (`none` slot id) ships **no asset** — it resolves to the solid theme
background (`colors.background`) at render, so it has no row here.

Future replacements must update **Source / License / Author**, record decoded RGB
maxima, and confirm the actual brightest region stays at or below the declared pixel
(then rerun the device-UAT).
