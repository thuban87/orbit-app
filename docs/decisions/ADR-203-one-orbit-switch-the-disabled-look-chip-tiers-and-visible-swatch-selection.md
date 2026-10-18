# ADR-203: One Orbit Switch, the Disabled Look, Chip Tiers and Visible Swatch Selection

**Status:** Accepted
**Date:** 2026-10-11
**Phase:** 38.9-ux-standards
**Source decisions:** D-25, D-26, D-47, D-60, D-62 (38.9-CONTEXT.md; ledger Q-22, Batch 8, Batch 9); carried D-05
**Reversibility:** reversible
**Migration:** None
**Supersedes:** None
**Superseded by:** None

## Context

The app had 30 RN `<Switch>` sites, 29 with an identical inline `thumbColor={colors.surfaceElevated}`; in dark themes an off switch was all but invisible (E-22, K-29). The palette had no selected, disabled or switch tokens. The selected accent swatch in Settings > Appearance drew its ring in `colors.accent`, the same colour as the swatch, so the selection could not be seen (K-28). The two-tier chip rule decided for Phase 39 (D-05) had no shared helper.

## Decision

Every switch is `OrbitSwitch` (D-25, D-47, look SW-C): off is an outlined `borderStrong` track with a small `textSecondary` thumb; on is an `accent` track with a large `onAccent` thumb and an `accentText` check. The thumb animates from a Reanimated shared value over `MOTION.fast`; colours change at render, never per frame, and reduced motion jumps. A disabled control is dimmed and a disabled switch draws Off, while its announced state stays the stored value (D-26). No new palette tokens were added; a per-palette contrast test covers the off thumb, on thumb and check in every package × mode, including curated accents (D-25). The off-state outline (~1.8–1.9:1 against the card) stays as chosen; the thumb carries the state (D-62). A source contract rejects any RN `Switch` in production. `chipTone(tier, selected)` encodes D-05: top-level choices fill solid accent with an `onAccent` label, sub-options take an accent outline with `accentText`. The selected colour swatch (accent and star rows) shows an outer `textPrimary` ring, a `surface` gap and a check on the fill (D-60). Applying the disabled look on Notifications is 38.12's.

## Alternatives Considered

- **SW-A, today's look** (`surfaceElevated` thumb) — Rejected; it is the invisible off state (Q-22).
- **SW-B, native Switch with a token pair** (`borderStrong` / `textSecondary` off) — Not chosen; the owner picked the drawn SW-C (Q-22).
- **Raise the off-state outline contrast now** — Rejected; kept as chosen and noted for a later look pass (D-62).
- **The other swatch options offered at plan check** — Not chosen; the owner picked ring plus check (Batch 8).

## Consequences

### Positive

- An off switch reads in every theme, and switch, chip and swatch selection share one rule set.

### Negative

- OrbitSwitch is custom-drawn, so it owns its own accessibility state and animation rules instead of inheriting the platform's.

### Risks

- A new package or accent that fails the switch contrast test blocks the build until its tokens are tuned.

## Implementation

**Key files:**
- `src/components/ui/OrbitSwitch.tsx` — the one switch, its geometry and shared-value animation.
- `src/components/ui/orbit-switch-logic.ts` — `resolveSwitchVisual`, `resolveSwitchA11yState` and the SW-C constants.
- `src/components/ui/orbit-switch-logic.test.ts` — the per-palette contrast gate.
- `src/components/ui/orbit-switch-contract.test.ts` — no RN `Switch` in production; animation rules.
- `src/components/ui/chip-tone.ts` — `chipTone(tier, selected)`.
- `src/components/touchpoint-refine-logic.ts` — `durationChipTone` built on `chipTone`.
- `src/screens/settings-appearance-swatch.ts` — the selected-swatch ring, gap and check model.
- `src/screens/SettingsAppearanceScreen.tsx` — renders the selected swatches.
- `src/components/icons/icon-registry.ts` — the semantic `check` glyph.

**Depends on:** ADR-084 (Four Semantic Theme Palettes, Curated Accents, and Contrast Validation); ADR-086 (Semantic Icons and Accessible Interaction Primitives)
**Required by:** ADR-222 (Add Contact Opens Bound, Monthly and Not Yet, with Relationship Basics Open); ADR-247 (Quiet Hours Move Birthday Alerts and the Weekly Digest to the Quiet-Hours End on the Same Day, and Notifications Shows When Reminders Really Arrive)
