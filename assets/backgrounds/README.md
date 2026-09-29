# Background assets — provenance & license manifest

In-project provenance/license record for every bundled background (THEME-04 /
dossier §E [DERIVED]). Backgrounds are **local, bundled `require()` assets only** —
no network, no CDN, no downloadable path (D-04). Every variant the `backgrounds.ts`
manifest resolves via `require()` has a committed asset here **and** a row below.

## Slots and variants (38.5 D-23)

A background **slot** is a pair of **variants**, one per resolved appearance mode:
`<slot>-light.webp` and `<slot>-dark.webp`. The stored setting
(`app_settings.galaxy_background` / `standard_background`) is the slot id; the mode
picks the file at render. Lineup (38.5 D-17 / D-18 / D-19, owner sign-off
2026-09-28, `.planning/phases/38.5-background-art-text-contrast/38.5-ART-SIGNOFF.md`):

- **Galaxy:** `galaxy-quiet` (label "Deep Space", the package default), `galaxy-aurora`,
  `galaxy-starfield`, then None.
- **Standard:** `standard-dawn` (the package default), `standard-paper`, `standard-dusk`,
  then None.

## Declared extrema (composited-AA bounds)

Each variant declares a **brightest** and a **darkest** pixel in `backgrounds.ts`.
They are the bounds the contrast proofs in `src/theme/tokens/surface.test.ts`
composite over, under every regime of the variant's own package and mode:

- **card** and **chrome**: the glass tint at `cardTintOpacity` / `chromeScrimOpacity`;
- **veil**: the BackgroundHost veil under bare text, at every density
  (`BACKGROUND_VEIL_OPACITY`);
- **profile**: the Profile route's own `profileBackgroundScrim` (its colour at its
  alpha byte / 255).

`scripts/measure-background-extrema.py --check` decodes every shipped file (Pillow),
composites every pixel under each of those regimes (`scripts/background-extrema-regimes.json`)
and fails if a declared bound does not enclose the decoded composite extrema. Run it
whenever an asset or a regime changes.

**Feature allowance (38.5 D-20 / D-31).** Only the two `galaxy-starfield` variants
carry one: owner-signed `18 px / 0.5%`. For them the declared extrema are the
**text-bearing bound**: every pixel outside it belongs to an allowed star, and
`--check` measures the union of those pixels (8-connected components ≤ 18 px, ≤ 0.5%
of the canvas). Each Starfield file has an empty luminance band between its stars and
its text-bearing pixels; its declared bound sits inside that band, and `--check`
reproduces the signed union exactly (dark: 2,680 px, 0.170%, largest 9 px; light:
446 px, 0.028%, largest 13 px).

Every shipped file also passes the per-pixel art checker as shipped
(`uv run --no-project --with numpy --with pillow python3 scripts/check-background-art.py --all
--exclude-galaxy-dark-danger --accepted-exclusions .planning/phases/38.5-background-art-text-contrast/38.5-ART-SIGNOFF.md`,
and again with `--margin 0.1`). If a future asset exceeds its declared bound, re-make
the art or record a new owner ruling — **never weaken AA** and never retune an
opacity, veil or hue to make art pass (38.5 D-06).

## Provenance rows

All twelve files are the owner-picked candidates from the 38.5 art loop, saved from
their approved PNG masters as lossless WebPs (`lossless=True, method=6`), decoded and
verified pixel-identical to the master, with metadata and text chunks dropped.

**Exception — the two `galaxy-aurora` files are mirrored (owner ruling 2026-09-29, 38.5 D-35).** They were
flipped left↔right on the decoded pixels (no regeneration), so the ribbon sits on the right, away from the
left-aligned list and Digest content, and re-saved the same way; each is pixel-identical to `np.fliplr` of its
master. A mirror leaves the pixel set unchanged, so the declared extrema and every checker result stand.

| Slot id | Package | Mode | File | Dimensions | Measured brightest pixel | Measured darkest pixel | Feature allowance | Source | License | Author |
|---------|---------|------|------|------------|--------------------------|------------------------|-------------------|--------|---------|--------|
| `galaxy-quiet` | galaxy | light | `galaxy-quiet-light.webp` | `941x1672` | `#F8F6FF` | `#E3DDF9` | none | Codex `gpt-6-astra` via `codex-edu`; 38.5 art sign-off 2026-09-28, DeepSpace-L1 (`galaxy-quiet-light-route1-strict-r2`); Pillow lossless WebP | OpenAI Terms of Use | OpenAI image generation (Codex); orbit-app |
| `galaxy-quiet` | galaxy | dark | `galaxy-quiet-dark.webp` | `941x1672` | `#262149` | `#000000` | none | Codex `gpt-6-astra` via `codex-edu`; 38.5 art sign-off 2026-09-28, DeepSpace-D1 (`galaxy-quiet-dark-base-strict-r1`); Pillow lossless WebP | OpenAI Terms of Use | OpenAI image generation (Codex); orbit-app |
| `galaxy-aurora` | galaxy | light | `galaxy-aurora-light.webp` | `941x1672` | `#F6F8F9` | `#CEE5E4` | none | Codex `gpt-6-astra` via `codex-edu`; 38.5 art sign-off 2026-09-28, Aurora-L1 (`galaxy-aurora-light-route1-strict-r2`), mirrored left↔right 2026-09-29 (D-35); Pillow lossless WebP | OpenAI Terms of Use | OpenAI image generation (Codex); orbit-app |
| `galaxy-aurora` | galaxy | dark | `galaxy-aurora-dark.webp` | `941x1672` | `#123035` | `#000000` | none | Codex `gpt-6-astra` via `codex-edu`; 38.5 art sign-off 2026-09-28, Aurora-D7 (`galaxy-aurora-dark-base-strict-r4e`), mirrored left↔right 2026-09-29 (D-35); Pillow lossless WebP | OpenAI Terms of Use | OpenAI image generation (Codex); orbit-app |
| `galaxy-starfield` | galaxy | light | `galaxy-starfield-light.webp` | `941x1672` | `#FFFFFF` | `#D3DDE0` (text-bearing) | 18 px / 0.5% (signed 2026-09-28) | Codex `gpt-6-astra` via `codex-edu`; 38.5 art sign-off 2026-09-28, Starfield-L5 (`galaxy-starfield-light-route2-visible-r4d`); Pillow lossless WebP | OpenAI Terms of Use | OpenAI image generation (Codex); orbit-app |
| `galaxy-starfield` | galaxy | dark | `galaxy-starfield-dark.webp` | `941x1672` | `#262452` (text-bearing) | `#000000` | 18 px / 0.5% (signed 2026-09-28) | Codex `gpt-6-astra` via `codex-edu`; 38.5 art sign-off 2026-09-28, Starfield-D3 (`galaxy-starfield-dark-base-visible-r3`); Pillow lossless WebP | OpenAI Terms of Use | OpenAI image generation (Codex); orbit-app |
| `standard-dawn` | standard | light | `standard-dawn-light.webp` | `941x1672` | `#FFF6E8` | `#F8D8C0` | none | Codex `gpt-6-astra` via `codex-edu`; 38.5 art sign-off 2026-09-28, Dawn-L1 (`standard-dawn-light-base-strict-r0`); Pillow lossless WebP | OpenAI Terms of Use | OpenAI image generation (Codex); orbit-app |
| `standard-dawn` | standard | dark | `standard-dawn-dark.webp` | `941x1672` | `#4D201C` | `#2D0711` | none | Codex `gpt-6-astra` via `codex-edu`; 38.5 art sign-off 2026-09-28, Dawn-D1 (`standard-dawn-dark-route1-strict-r2`); Pillow lossless WebP | OpenAI Terms of Use | OpenAI image generation (Codex); orbit-app |
| `standard-paper` | standard | light | `standard-paper-light.webp` | `941x1672` | `#F7F3E9` | `#E4E0D7` | none | Codex `gpt-6-astra` via `codex-edu`; 38.5 art sign-off 2026-09-28, Paper-L2 (`standard-paper-light-base-strict-r4a`); Pillow lossless WebP | OpenAI Terms of Use | OpenAI image generation (Codex); orbit-app |
| `standard-paper` | standard | dark | `standard-paper-dark.webp` | `941x1672` | `#312E2C` | `#191415` | none | Codex `gpt-6-astra` via `codex-edu`; 38.5 art sign-off 2026-09-28, Paper-D5 (`standard-paper-dark-route1-strict-r4f`); Pillow lossless WebP | OpenAI Terms of Use | OpenAI image generation (Codex); orbit-app |
| `standard-dusk` | standard | light | `standard-dusk-light.webp` | `941x1672` | `#FEF5EA` | `#DEDAFD` | none | Codex `gpt-6-astra` via `codex-edu`; 38.5 art sign-off 2026-09-28, Dusk-L2 (`standard-dusk-light-base-strict-r4a`); Pillow lossless WebP | OpenAI Terms of Use | OpenAI image generation (Codex); orbit-app |
| `standard-dusk` | standard | dark | `standard-dusk-dark.webp` | `941x1672` | `#3E253F` | `#24143F` | none | Codex `gpt-6-astra` via `codex-edu`; 38.5 art sign-off 2026-09-28, Dusk-D1 (`standard-dusk-dark-route1-strict-r2`); Pillow lossless WebP | OpenAI Terms of Use | OpenAI image generation (Codex); orbit-app |

The measured pixels are the variant's declarations in `backgrounds.ts`, taken from
`measure-background-extrema.py`'s report (for Starfield, the text-bearing bound
above) and proven by its `--check` to enclose every regime's decoded composite. The
report's channel-wise bound can differ from a declaration by one channel step where
`--check` shows the declaration already encloses the composite luminance (for
example `galaxy-aurora` light `#F7F8F9` reported vs `#F6F8F9` declared).

**None / Solid** (`none` slot id) ships **no asset** — it resolves to the solid theme
background (`colors.background`) at render, so it has no row here.

## Retired slot ids

`galaxy-deep-space`, `galaxy-nebula` and `standard-mesh` were cut in 38.5 (D-19), and
their files were deleted. Their ids live on in `RETIRED_BACKGROUND_SLOT_IDS`
(`src/theme/theme-option-ids.ts`): the settings DAO still **accepts** them on write and
on restore (so an older backup restores cleanly), stored values are never rewritten,
the resolver **renders the package default** for them, and the picker never offers
them. The new quiet Galaxy slot reuses the display label "Deep Space" but not the id.

Future replacements must update **Source / License / Author**, re-run
`measure-background-extrema.py --check` and the art checker, and record the new
declared extrema here (then rerun the device UAT).
