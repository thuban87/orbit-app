---
phase: 31-profile-experience
plan: 12
status: approved
created: 2026-09-09
generation: built-in-imagegen
---

# Phase 31 Profile Background Art Review

This is one complete, phase-local candidate board for the eight existing bundled
background slots. Nothing in this review replaces a production WebP. Task 3 may
only adopt art after the owner approves the full direction below.

## Board

The labeled [contact sheet](evidence/31-12-art/contact-sheet.png) is the primary
review surface. It shows the exact eight-slot mapping, in the stable manifest
order:

| Package | Slot ID | Candidate | Intended production filename | Declared brightest-pixel constraint |
| --- | --- | --- | --- | --- |
| Galaxy | `galaxy-deep-space` | [galaxy-deep-space.png](evidence/31-12-art/galaxy-deep-space.png) | `assets/backgrounds/galaxy-deep-space.webp` | `#1A1F35` |
| Galaxy | `galaxy-starfield` | [galaxy-starfield.png](evidence/31-12-art/galaxy-starfield.png) | `assets/backgrounds/galaxy-starfield.webp` | `#202545` |
| Galaxy | `galaxy-nebula` | [galaxy-nebula.png](evidence/31-12-art/galaxy-nebula.png) | `assets/backgrounds/galaxy-nebula.webp` | `#2A2148` |
| Galaxy | `galaxy-aurora` | [galaxy-aurora.png](evidence/31-12-art/galaxy-aurora.png) | `assets/backgrounds/galaxy-aurora.webp` | `#16303A` |
| Standard | `standard-dawn` | [standard-dawn.png](evidence/31-12-art/standard-dawn.png) | `assets/backgrounds/standard-dawn.webp` | `#E8D8C0` |
| Standard | `standard-paper` | [standard-paper.png](evidence/31-12-art/standard-paper.png) | `assets/backgrounds/standard-paper.webp` | `#EDE6D8` |
| Standard | `standard-dusk` | [standard-dusk.png](evidence/31-12-art/standard-dusk.png) | `assets/backgrounds/standard-dusk.webp` | `#C8B0C0` |
| Standard | `standard-mesh` | [standard-mesh.png](evidence/31-12-art/standard-mesh.png) | `assets/backgrounds/standard-mesh.webp` | `#B8C4D0` |

## Candidate record

All eight candidates are `941x1672` RGB PNG review images (portrait, generated
locally from the built-in image generation tool and copied into this phase
evidence directory). The contact sheet is `640x2272` PNG and contains labels only;
the individual candidates contain no text. No source art was supplied or imported.

**Provenance and rights:** Generated as original review candidates with OpenAI's
built-in image generation tool on 2026-09-09. No third-party stock, copyrighted
character, logo, person, UI, or input image was used. Distribution/adoption remains
subject to the applicable OpenAI Terms of Use; these files are local review evidence
until owner approval and final remastering.

**Brightness handling:** These are visual-direction candidates, not shipped assets.
The values in the board are the existing declared composited-AA ceilings from
`src/theme/backgrounds.ts` and `assets/backgrounds/README.md`. Before an approved
candidate can be adopted, Task 3 must transcode/remaster it to WebP and measure its
actual brightest region against the corresponding ceiling (or retune the declared
bound and AA proof together). This review does not claim that the unremastered PNGs
already satisfy those byte-level bounds.

### `galaxy-deep-space`

**Prompt:** Abstract deep-space atmosphere for a portrait mobile Profile
background: dark indigo-black cosmic depth, subtle midnight-blue gradients, sparse
dim particulate stars, large dark areas, no central object, and exceptionally
subdued highlights. Abstract art only; no text, logos, people, UI, planets,
spacecraft, recognizable characters, or copyrighted imagery. Final remaster target:
at or below `#1A1F35`.

### `galaxy-starfield`

**Prompt:** Abstract starfield atmosphere for a portrait mobile Profile background:
deep blue-black field of tiny sparse dim points and soft far-away dust, no
constellations or focal object, visual interest toward outer edges and a quiet
center. Abstract art only; no text, logos, people, UI, planets, spacecraft,
recognizable characters, or copyrighted imagery. Final remaster target: at or below
`#202545`.

### `galaxy-nebula`

**Prompt:** Abstract nebula atmosphere for a portrait mobile Profile background:
dark plum-indigo cloudscape with feathered violet haze and barely visible dusty
bloom, a diffuse diagonal drift, and a quiet center. Abstract art only; no text,
logos, people, UI, literal celestial bodies, recognizable characters, or
copyrighted imagery. Final remaster target: at or below `#2A2148`.

### `galaxy-aurora`

**Prompt:** Abstract aurora atmosphere for a portrait mobile Profile background:
smooth faint translucent teal ribbons dissolved into black-teal depth, placed to
one side with expansive dark regions. Abstract art only; no text, logos, people,
UI, landscape, horizon, planets, recognizable characters, or copyrighted imagery.
Final remaster target: at or below `#16303A`.

### `standard-dawn`

**Prompt:** Abstract dawn atmosphere for a portrait mobile Profile background:
calm warm-paper field with subtle peach, cream, and pale sand gradient bands,
restrained tonal movement, and no focal point. Abstract art only; no text, logos,
people, UI, sun, horizon, landscape, recognizable characters, or copyrighted
imagery. Final remaster target: at or below `#E8D8C0`.

### `standard-paper`

**Prompt:** Abstract paper atmosphere for a portrait mobile Profile background:
quiet pale linen-paper field with delicate natural fibers, soft off-white warmth,
and minimal tonal variation, scaled as a background rather than a literal page.
Abstract art only; no text, logos, people, UI, stationery, book, document,
recognizable characters, or copyrighted imagery. Final remaster target: at or below
`#EDE6D8`.

### `standard-dusk`

**Prompt:** Abstract dusk atmosphere for a portrait mobile Profile background:
soft dusty mauve and muted lavender gradient with gentle charcoal-plum shadow,
broad calm tonal transitions, and no bright focal element. Abstract art only; no
text, logos, people, UI, horizon, landscape, recognizable characters, or
copyrighted imagery. Final remaster target: at or below `#C8B0C0`.

### `standard-mesh`

**Prompt:** Abstract mesh atmosphere for a portrait mobile Profile background:
soft slate-blue and cool-grey broad blurred translucent gradients with gentle matte
depth, intentionally not a wireframe, grid, or technical diagram. Abstract art
only; no text, logos, people, UI, recognizable characters, or copyrighted imagery.
Final remaster target: at or below `#B8C4D0`.

## Owner decision

**Status:** Approved — complete eight-slot direction.

**Recorded:** 2026-09-10

**Owner response (verbatim):** “love the bacjground designs, approved. please continue”

This is recorded as approval of every candidate shown together on the linked
[contact sheet](evidence/31-12-art/contact-sheet.png): Galaxy deep-space,
starfield, nebula, and aurora; and Standard dawn, paper, dusk, and mesh. Task 3
may now remaster those exact local candidates into the established production WebP
slots, preserving their IDs, package mapping, local-only boundary, and AA contract.
