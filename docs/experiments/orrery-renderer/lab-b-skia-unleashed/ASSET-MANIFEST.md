# Lab B — Asset manifest

Lab B is **procedural by design**. Every visual in the renderer comes from SkSL runtime
effects, Skia primitives, Atlases and pictures, coloured from theme tokens. No network
assets, scraped images or stock art were used.

The only binary assets added on the branch are **16 test-portrait fixtures**. They exist only
for the dev seed and **never ship**.

## 1. Added binary assets

All in `docs/experiments/orrery-renderer/lab-b-skia-unleashed/assets/test-portraits/`, commit
`83e8b4b3`, wired into the dev seed in `80a9650b`. Full provenance, prompts and the
conversion script are in `assets/test-portraits/PROVENANCE.md`.

| File | Purpose (test intent) | Format | Recommendation |
|---|---|---|---|
| `01-older-woman-black-mustard.jpg` | Dark skin on a bright warm background | 512×512 baseline JPEG, sRGB, q88, 44 KB | Keep as a test fixture; never ship |
| `02-young-man-east-asian-bright-cyan.jpg` | Saturated background, even light | same, 34 KB | same |
| `03-teen-girl-south-asian-dark.jpg` | Dark background, low-key light | same, 42 KB | same |
| `04-older-man-white-busy-street.jpg` | Busy background, pale skin | same, 93 KB | same |
| `05-woman-latina-backlit-golden.jpg` | Backlit, underexposed face | same, 50 KB | same |
| `06-man-black-glasses-office.jpg` | Busy indoor background, glasses | same, 74 KB | same |
| `07-child-red-hair-green.jpg` | Child, saturated hair and background | same, 71 KB | same |
| `08-woman-middle-eastern-hijab-pastel.jpg` | Head covering, pastel background | same, 37 KB | same |
| `09-man-indigenous-long-hair-dusk.jpg` | Cool dusk background, long hair | same, 41 KB | same |
| `10-woman-blonde-flash-selfie.jpg` | Phone-flash selfie, tilted, off-centre | same, 49 KB | same |
| `11-man-southeast-asian-profile.jpg` | Three-quarter profile (turned right, not left as briefed; harmless) | same, 49 KB | same |
| `12-low-contrast-foggy.jpg` | Very low contrast | same, 32 KB | same |
| `13-pet-dog.jpg` | Non-face: pet | same, 69 KB | same |
| `14-logo-graphic.jpg` | Non-face: invented logo, no text | same, 16 KB | same |
| `15-landscape-mountains.jpg` | Non-face: landscape | same, 71 KB | same |
| `16-man-curly-afro-neon.jpg` | Coloured neon light on face | same, 63 KB | same |

**Provenance.**

- Generated 2026-10-01 by the Codex CLI (`codex-cli 0.158.0`, model `gpt-5.6-sol`, built-in
  `image_generation`), from a brief requiring clearly **fictional** people and no real
  brands.
- Converted locally with Pillow: ICC → sRGB, centre crop, Lanczos resize to 512², q88.
- The raw 1254² PNGs were not kept.

**How they are used.**

- `src/__dev__/lab-b-seed.ts` `require`s them under `__DEV__` only, via `App.tsx`. 30 seeded
  contacts get a portrait through the normal `avatars/contact-<id>.jpg` contract.
- They were verified absent from the Lab B release APK: no jpg drawables, and no seed strings
  in the Hermes bundle (RUNBOOK §10, C-42).

**Recommendation.** **Keep** them as Orrery face-legibility fixtures for V2 device checks,
but move them to a test-only fixture path. Production code must never `require` anything
under `docs/`. Discard them once V2 has a sanctioned fixture set.

## 2. Generated at runtime (not files)

| Thing | Where | Size | Recommendation |
|---|---|---|---|
| Nebula density texture | `LabEnvironment.tsx` `nebulaBake` via `useTexture` | 768² RGBA ≈ 2.3 MB per Orrery mount (C-13) | Keep the technique. Consider 512² if the phone shows no visible loss. |
| Star sprite atlas (soft dot, crisp dot, spike) | `LabEnvironment.tsx` `StarSprites` | 96×32, white alpha mask | Keep |
| Streak band texture (32 bands) | `LabSwitchFx.tsx` `useStreakTexture` | small | Keep with the switch FX |
| FX sprite atlas (soft glow, glint) | `LabSwitchFx.tsx` `FxSprites` | 64×32 | Keep with the switch FX |
| Procedural synthetic avatar JPEGs (dev seed: ~41 contacts + every 4th stress contact) | `lab-b-seed.ts` `renderAvatarJpeg` | per-contact 512 cap | Dev only; discard with the seed |

Sprite masks are drawn in the LAB-ONLY white mask colours (`LAB_SPRITE_MASK*`,
`src/theme/orrery-lab-fx.ts`, C-26) and tinted per instance by token colour buffers. These
are the only colour literals added, and they are legal under `/theme/`.

## 3. Codex usage

Codex was used once, for the 16 portraits. It was justified because the seeded flat
silhouettes could not answer whether faces survive the lit-sphere shaders. No other asset
was commissioned, because the procedural approach covered every visual.
