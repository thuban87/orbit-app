# ADR-169: Standard-Light Glass Foreground Scope, Both-Extrema Contrast Proof, and Accent Role Contract

**Status:** Accepted
**Date:** 2026-09-23
**Phase:** 38.4-audit-remediation-ui-performance-release
**Source decisions:** dossier Workstream C; 38.4-CONTEXT D-03, D-12, D-24, D-26, D-28, D-34, D-38, D-61, D-63; RG-029 (`ui-accessibility/AUD-UIA-001`, `AUD-UIA-002`); review B1 WR-01/WR-02, C WR-01, D WR-02
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The glass contrast proof checked only each background's brightest pixel, so dark text over Standard Dusk and Mesh passed on paper while secondary text rendered at about 2.3:1 on Dusk. Once the proof tested both extrema, status hues, rogue, `danger`-as-text and every curated `accentText` failed on Standard-Light glass. Backup/Restore labelled accent fills with `textPrimary`, and many screens painted the accent fill colour as text or put `background`-coloured labels on accent fills.

## Decision

The fix is foreground-only (D-12). Standard Light glass opacity (0.5), the veil and all artwork stay as they are. Every background slot declares `darkestPixel` beside `brightestPixel`, validated against the decoded art by `scripts/measure-background-extrema.py --check`, and the proof requires each foreground to clear its floor at both extrema. A glass foreground scope (`GlassForegroundScope`, entered by `GlassSurface`, `ChromeScrim` and `ShellAppBar`) resolves a Standard-Light-only palette over asset backgrounds:
- `textSecondary` resolves to `textPrimary`.
- Status hues, rogue and `danger` use darker variants.
- `accentText` uses a lightness-only variant per curated accent (`STANDARD_LIGHT_GLASS_ACCENT_TEXT`). The owner accepted all eight, including aurora-teal `#05312E` and emerald `#083319` below the L 12% floor (D-26).

Colours reach the scope only when read inside it. Content inside a glass or chrome scope reads through an in-scope `useTheme()`, a child component or the zero-node `ScopedPalette`, and an AST contract rejects out-of-scope reads (D-34). Overlays reset the scope with `UnscopedTheme`. Coral's shared light link tone darkens from `#B03A26` to `#AC3925` (D-28). Placeholders use a dedicated `textPlaceholder` token, which is never glass-overridden.

Accent roles are fixed repo-wide (D-63):
- Text or glyphs on a non-accent surface use `accentText`, glass-scoped when on glass.
- Labels on an accent fill use `onAccent`; the Restore Preview Replace-all label uses `onDanger`.
- Fills, borders and tracks use `accent`.
- An AST contract that follows ternaries, fallbacks, call arguments and aliases enforces this. Its allowlist covers only graphic tints and Skia paints, each with a reason.

Android `GlassSurface` blur is explicitly off (`ANDROID_BLUR_METHOD = "none"`, D-61). This is pixel-identical to the silent fallback and stops the per-render warning. Text sitting bare on the background art is out of scope here and moved to Phase 38.5 (D-38).

## Alternatives Considered

- **Raise Standard glass opacity or add an opaque wash** — rejected by the owner (D-12); it reverses the approved translucency.
- **Hue or saturation moves for failing accents** — rejected (D-26); it partly reverses D-24's lightness-only direction.
- **Flatten links to `textPrimary`** — rejected (D-26); links lose hue identity.
- **Document a contrast exception for teal and emerald** — rejected (D-26); links would keep failing.
- **A bare-text scrim on Dusk/Mesh, then all Standard Dark backgrounds (D-29, D-35, D-36)** — superseded by D-38. One image cannot serve both modes, so the fix is new art in 38.5.

## Consequences

### Positive

- The proof tests real composites, and the two AST contracts stop both out-of-scope reads and accent role misuse from coming back.

### Negative

- Any new glass-hosted screen must read colours inside the scope; a top-of-screen `useTheme()` silently renders the root tone.

### Risks

- The glass palette follows the stored background, not the rendered one. The Orrery, solid fallbacks and glass inside opaque sheets therefore flatten secondary text (review B2 IN-04, a 38.5 item).
- The themed Switch OFF state stays about 1.1–1.5:1 by owner ruling D-65.
- The Galaxy Dark `onDanger` limitation (about 3.91:1) remains an ADR-084 owner-accepted exception.

## Implementation

**Key files:**
- `src/theme/glass-foregrounds.ts` — Standard-Light glass resolver, per-accent `accentText` table and scoped/unscoped themes.
- `src/theme/theme-provider.tsx` — `GlassForegroundScope`, `UnscopedTheme`, `useUnscopedTheme`.
- `src/theme/backgrounds.ts` — declared `brightestPixel`/`darkestPixel` per slot.
- `src/theme/accents.ts` — coral light link tone (D-28).
- `src/theme/theme-types.ts` — `textPlaceholder` and `glassColors`.
- `src/theme/theme-presets.ts` — `textPlaceholder` in all four palettes.
- `scripts/measure-background-extrema.py` — measures and checks declared art extrema.
- `scripts/background-extrema-regimes.json` — per-package veil/glass regimes for the measurement.
- `src/theme/tokens/surface.test.ts` — both-extrema contrast proof.
- `src/components/ui/GlassSurface.tsx` — enters the scope; Android blur off.
- `src/components/ui/ChromeScrim.tsx` — enters the scope.
- `src/components/ShellAppBar.tsx` — enters the scope.
- `src/components/ui/overlay-base.tsx` — resets the scope for overlays.
- `src/components/OverflowMenu.tsx` — resets the scope for its sheet.
- `src/components/ui/ScopedPalette.tsx` — in-scope render-prop read helper.
- `src/theme/__contract__/glass-scope-reads.ts` — out-of-scope read analyzer.
- `src/theme/glass-scope-read-contract.test.ts` — glass-scope read contract.
- `src/theme/__contract__/accent-foreground-roles.ts` — accent role analyzer.
- `src/theme/accent-foreground-role-contract.test.ts` — repo-wide accent role contract.
- `src/theme/placeholder-contract.test.ts` — every placeholder reads `textPlaceholder`.
- `src/theme/accent-text-glass-contract.test.ts` — inventory-driven on-glass `accentText` check.
- `src/screens/BackupScreen.tsx` — `onAccent` action labels.
- `src/screens/RestorePreviewScreen.tsx` — `onAccent` / `onDanger` apply label.
- `src/screens/RestoreResultScreen.tsx` — `onAccent` action label.
- `src/screens/backup-presentation-contract.test.ts` — Backup/Restore role-foreground contract.
- `src/components/ui/glass-surface-blur.contract.test.ts` — pins Android blur off.

**Depends on:** ADR-084 (Four Semantic Theme Palettes, Curated Accents, and Contrast Validation); ADR-115 (Visible, Mode-Aware Background Surface Composition)
**Required by:** ADR-177 (Mode-Specific Background Art and Signed Per-Combination Art Treatments)
