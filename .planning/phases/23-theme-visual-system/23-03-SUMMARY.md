---
phase: 23-theme-visual-system
plan: 03
subsystem: theme
tags: [theme, palettes, accents, contrast, wcag, aa, onDanger, owner-escalation]

# Dependency graph
requires:
  - phase: 23-01
    provides: package-axis theme layer + theme-option-ids ACCENT_IDS single source + resolvePalette + provider/store selection
  - phase: 23-02
    provides: token vocabulary (typography/spacing/radii) — sibling wave, not consumed here
provides:
  - contrast.ts — pure WCAG relative-luminance + contrastRatio + AA_NORMAL(4.5)/AA_LARGE(3.0) (node-tested, RN-free)
  - four authored palettes (galaxy dark+light, standard dark+light), ThemePreset.light REQUIRED, dark-fallback retired
  - ThemePalette gains onDanger (authored destructive foreground) + onAccent/accentText (accent overlay, seeded per palette)
  - accents.ts — curated ACCENTS (per-resolved-mode {fill,onAccent,text}) keyed by ACCENT_IDS, package defaults, resolveAccent(id|null,pkg,mode), applyAccent overlay
  - theme-provider overlays the active package's mode-resolved accent tone onto palette.accent/onAccent/accentText (per-package accent memory)
  - split AA gate (accents.test.ts): HARD-FAIL curated accents + 3 new palettes' required tokens; FLAG-FOR-OWNER audit for legacy galaxy-dark
affects: [23-05 status glyphs, 23-06 backgrounds/glass AA extension, 23-07 buttons/destructive (palette.accent/onAccent/accentText + danger/onDanger), Phase 15 screen adoption]

actuals:
  tokens: 12263
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Pure RN-free WCAG contrast module (contrast.ts) mirroring the contact-card-ring.ts node-testable sibling idiom; AA thresholds locked against weakening"
    - "Per-mode accent tone triple {fill,onAccent,text} (not a single hex) so accent-as-text meets 4.5:1 on both dark and near-white backgrounds"
    - "Accent overlay trio SEEDED per palette (package default tone) + OVERLAID at render by the provider — palette stays self-consistent even on the useTheme() no-provider fallback; a drift test pins seed == accents.ts default"
    - "Split AA gate: hard-fail for newly-authored tokens (fix by retuning the discretion value); read-only owner-escalation audit for pre-existing owner-approved galaxy-dark hues (measured, never retuned)"

key-files:
  created:
    - src/theme/contrast.ts
    - src/theme/contrast.test.ts
    - src/theme/accents.ts
    - src/theme/accents.test.ts
  modified:
    - src/theme/theme-types.ts
    - src/theme/theme-presets.ts
    - src/theme/theme-presets.test.ts
    - src/theme/theme-provider.tsx
    - scripts/check-colors.sh

key-decisions:
  - "Status hues gated at AA_LARGE (3.0) as glyph/large-element colours (UI-SPEC: colour is never the only status cue — glyph + border weight carry it); text/accent-text/onAccent/danger-as-text/onDanger gated at AA_NORMAL (4.5)"
  - "Accent tones keyed by RESOLVED MODE (dark|light), shared across packages — the four palettes' dark (and light) backgrounds sit at comparable luminance so one mode tone meets AA against both packages (asserted per-combo)"
  - "galaxy-dark keeps accent fill #6C8CFF (= the former single `accent`) so existing colors.accent consumers see zero regression; palette.accent now means FILL, palette.accentText is the link tone (Plan 07/Phase 15 migrate text-role consumers)"
  - "danger-as-text gated vs {background, surface, surfaceElevated} (stricter than the must_have's {background,surface}) to match the escalations note's surfaceElevated flag and because danger labels render on elevated cards"
  - "On DARK palettes a single `danger` hex cannot be light-enough for danger-as-text AND dark-enough for a white onDanger; standard-dark therefore pairs a light-red danger with a near-black onDanger. galaxy-dark keeps its owner white onDanger (flagged)."

requirements-advanced: [THEME-01, THEME-02, THEME-11]

duration: 16min
completed: 2026-09-03
status: complete
---

# Phase 23 Plan 03: Four Palettes, Curated Accents & AA Contrast Gate Summary

**Authored all four real palettes (Galaxy/Standard × Light/Dark) with `ThemePreset.light` now required, added the named destructive `onDanger` foreground and the accent overlay trio (`accent`=fill/`onAccent`/`accentText`) to `ThemePalette`, built the curated per-mode accent system (`accents.ts`, separate from the star colour) resolving through the provider, and gated every accent/status/text/danger token against WCAG AA in all four combos via a pure `contrast.ts` — with the two pre-existing galaxy-dark owner hues that miss AA surfaced as owner decisions (never auto-retuned).**

## Performance

- **Duration:** ~16 min
- **Tasks:** 3 (all `tdd="true"`, executed test+impl per task)
- **Commits:** 3 task commits + 1 docs commit

## Accomplishments

- **Task 1 — `contrast.ts` (b9d7aca):** Pure, RN-free WCAG module — `relativeLuminance` (throws on malformed/empty hex, never a silent pass), symmetric `contrastRatio` (larger luminance as numerator), `meetsAA`, and locked `AA_NORMAL=4.5`/`AA_LARGE=3.0`. `contrast.test.ts` covers symmetry, identity=1.0 (fails AA), the 21:1 black/white reference, near-equal (ratio→1.0) rejection, and malformed-input rejection.
- **Task 2 — four palettes + type changes (a9a0b80):** `ThemePreset.light` made **REQUIRED** and `resolvePalette` made total (dark-fallback retired). `ThemePalette` gained `onDanger` (authored per-palette destructive foreground) plus `onAccent`/`accentText` (accent overlay trio, seeded per palette with the package default accent's mode tone). Authored **galaxy-light** + **standard dark & light** as full palettes (galaxy stays glass/deep-space, standard flatter); galaxy-dark keeps its owner-approved `danger #E5484D` and accent fill `#6C8CFF`. Status hue families (stable green / wobble gold / decay coral / rogue amber) preserved, luminance-retuned for AA on each background. Presets test asserts four distinct complete palettes, light-required (not a fallback), and `onDanger` present.
- **Task 3 — curated accents + split AA gate + provider overlay (1c4c38e):** `accents.ts` — `ACCENTS` keyed by the **imported** `ACCENT_IDS` (Plan 01 single source, no parallel list), each id → per-resolved-mode `{fill,onAccent,text}`; package defaults (galaxy→nebula-blue, standard→slate-indigo); `resolveAccent(id|null,pkg,mode)` (NULL/unknown → package default, T-23-06); `applyAccent` overlay. `theme-provider.tsx` overlays the active package's mode-resolved tone onto `palette.accent`(=fill)/`onAccent`/`accentText`, reading the per-package accent-id from the store (accent-id→hex resolution lives only here, never in the DAO). `accents.test.ts` runs the **split gate**: HARD-FAIL for all 8 curated accents (`onAccent` vs `fill`, `text` vs {background,surface}) across all four combos, plus every required token in the three newly-authored palettes over the real opaque compositing pairs (text @4.5, status @3.0, danger-as-text @4.5, onDanger/danger @4.5); a read-only **owner-escalation audit** for the legacy galaxy-dark tokens; an id-**drift** guard (ACCENTS keys ≡ ACCENT_IDS); and `resolveAccent` NULL/known/unknown behaviour.

## Verification

- `npx vitest run src/theme` — **149/149 pass** (7 files: contrast, accents, theme-presets, + existing theme suites).
- `npx vitest run` (full) — **2024/2024 pass** (204 files); no cross-file regressions (widget-colors, logic tests, etc.).
- `npm run check:colors` (default full scan) — **exit 0**; per-file form now also exit 0 (see deviation 1).
- `npx tsc --noEmit` — **clean** (confirms nothing else constructs a `ThemePalette` literal now missing `onDanger`/`onAccent`/`accentText`).
- `npx @biomejs/biome check` on all 8 changed source files — **clean**.
- Acceptance greps: `accents.ts` imports `ACCENT_IDS` from `theme-option-ids` (no parallel id list); `AA_NORMAL`/`AA_LARGE` = 4.5/3.0 unchanged; provider resolves accent-id → tone (no hex in the DAO).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `check:colors` single-file invocation bypassed the `/theme/` exemption**
- **Found during:** Task 2 (the plan's `npm run check:colors src/theme/theme-presets.ts` verify)
- **Issue:** The gate's `/theme/` exemption filters on `grep`'s `path:` field, but `grep` omits the filename prefix when handed a **single** file argument — so a lone theme file (the sanctioned colour-literal location) was reported as a violation and exited 1. **Pre-existing** (the committed `theme-presets.ts` fails identically before this plan; the default full-scan and multi-file forms pass), directly hit by this plan's per-file verify command.
- **Fix:** Added `-H` to the `grep` invocation in `scripts/check-colors.sh` so the filename prefix is always present; the exemption now behaves identically for a single file, a multi-file list, and a directory recursion. Verified: single theme file → exit 0, default full scan → exit 0, a non-theme file with a hex still → exit 1 (negative control).
- **Files modified:** scripts/check-colors.sh
- **Commit:** a9a0b80

**2. [Rule 3 - Blocking] Existing presets test encoded the retired dark-fallback**
- **Found during:** Task 2 (presets suite)
- **Issue:** `theme-presets.test.ts`'s "falls back to the dark palette when the requested mode is absent" asserted `resolvePalette(pkg,'light') === preset.dark` — the behaviour Plan 03 explicitly retires by making `light` required.
- **Fix:** Rewrote it to assert `light` resolves to the authored light palette (and is not the dark object).
- **Files modified:** src/theme/theme-presets.test.ts
- **Commit:** a9a0b80

## Owner Escalations (FLAG-FOR-OWNER — do NOT auto-apply)

Per the plan's escalation mechanism and the owner-bucket firewall (REVIEWS 23-03 HIGH), the AA gate MEASURES the pre-existing owner-approved **galaxy-dark** required hues but never edits them. Two pairs miss AA-normal (4.5) — exactly the two the plan's escalation note predicted. These are recorded here for an owner decision; the executor did **not** retune the owner hue and did **not** weaken AA. Each is presented with a concrete nearest AA-passing candidate (with its measured ratio) so the owner's call is a yes/no, not an open design task.

| Token / pair | Measured ratio | Threshold | Note |
|---|---|---|---|
| galaxy-dark `onDanger` (near-white `#FFFFFF`) vs `danger` fill `#E5484D` | **3.91:1** | 4.5 (AA-normal) | Plan 07 draws the Destructive Button/ConfirmDialog label + glyph on `danger`. A near-white foreground on the owner-fixed `#E5484D` cannot reach AA-normal. |
| galaxy-dark `danger`-as-text `#E5484D` vs `surfaceElevated` `#1D2235` | **4.03:1** | 4.5 (AA-normal) | `danger` doubles as validation/warning text; on an elevated card it lands at 4.03. (It passes on `background` 4.91 and `surface` 4.51.) |

**Concrete candidates (measured; NOT applied):**
- For `onDanger`/`danger`: keep the owner `danger #E5484D` fill and switch galaxy-dark `onDanger` from near-white to a **near-black `#1E0405`** → **4.99:1** (passes). This changes the destructive-button label colour from white to near-black — a visual/product taste call, hence owner-bucket.
- For `danger`-as-text on `surfaceElevated`: nudge the fill brighter to **`#F05A5F`** → text/elevated **4.75:1** (passes all three surfaces) — but that drops white-onDanger to 3.32, so it pairs with the near-black onDanger above. Alternatively **accept 4.03** (still ≥ AA-large 3.0; only the elevated-surface pair, and only when danger is used as small text rather than a glyph).

Both are single-hue changes to owner-approved values, so applying either remains the owner's decision. The three newly-authored palettes (galaxy-light, standard dark+light) author their own AA-passing `danger`/`onDanger` and are on the hard-fail path (all pass).

## Known Stubs

None new. The accent **picker UI** and the appearance **Settings screen** (where a user actually taps a package/mode/accent) are later work (Phase 15 by design, per the 23-02 scope note) — this plan delivers the palette + accent DATA, the resolver, and the provider overlay; the store setters for accent are wired for live preview but have no Settings caller yet (a recorded scope boundary carried from 23-01, not a stub this plan introduces).

## Requirements

- **THEME-02** (curated accent palette, separate from the star colour) — DATA + resolver + provider overlay delivered; the picker UI is Phase 15. Advanced.
- **THEME-11** (AA-equivalent contrast in all four combos) — the pure gate + four palettes that pass (minus the two flagged owner hues) delivered. Advanced.
- **THEME-01** (four combos) — the four-palette + `light`-required half is delivered here; the user-facing package/mode selection UI spans 23-01 (restore) and later Settings work. Partial.

These are **advanced**, not marked fully complete at the requirement checkbox level, because each carries a user-facing selection surface that lands in a later plan/phase; the phase-level traceability row stays Pending until Phase 23 completes.

## Self-Check: PASSED

- Created files exist: `src/theme/contrast.ts`, `src/theme/contrast.test.ts`, `src/theme/accents.ts`, `src/theme/accents.test.ts`, and this SUMMARY.
- Task commits present in git history: b9d7aca, a9a0b80, 1c4c38e.
