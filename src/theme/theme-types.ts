/**
 * Theme type contract (FND-05).
 *
 * Colour VALUES live only in `theme-presets.ts`. This module declares the
 * shapes those values fill and the mode unions the provider selects with.
 * It imports nothing from `react-native`, so the pure resolvers in
 * `theme-presets.ts` (which reference these types) stay node-unit-testable.
 */

import type { AccentId, BackgroundSlotId } from "./theme-option-ids";

/** User-selectable theme mode. `system` defers to the OS colour scheme. */
export type ThemeMode = "light" | "dark" | "system";

/**
 * Theme PACKAGE — the top visual axis (THEME-01 / D-10), independent of
 * appearance mode. `galaxy` is the former `space-dark` palette (dark-first,
 * shipped); `standard` is the second package proving the axis. Package × mode
 * yields the four palette slots `resolvePalette(package, mode)` selects among.
 */
export type ThemePackage = "galaxy" | "standard";

/** A mode after `system` has been resolved against the OS scheme. */
export type ResolvedMode = "light" | "dark";

/**
 * Local mirror of React Native's `ColorSchemeName | null` — declared here so
 * the resolvers avoid a `react-native` import and remain node-testable.
 *
 * RN 0.86's `useColorScheme()` returns `ColorSchemeName | null | undefined`
 * where `ColorSchemeName = "light" | "dark" | "unspecified"` (verified against
 * node_modules/react-native/Libraries/Utilities/Appearance.d.ts). This union is
 * a SUPERSET, so `useColorScheme()`'s result is always assignable to it and can
 * be passed straight into `resolveMode` without coercion.
 */
export type SystemScheme = "light" | "dark" | "unspecified" | null | undefined;

/**
 * The base dynamic tokens every theme preset defines.
 *
 * Base scalar tokens (14): background, surface, surfaceElevated, the accent
 * OVERLAY trio (accent = fill / onAccent / accentText), textPrimary,
 * textSecondary, border, borderStrong, and the destructive PAIR (danger fill /
 * onDanger foreground). The accent trio is SEEDED per preset with the package
 * default accent's mode-resolved tone and OVERLAID at render by the provider
 * with the active accent (Plan 03); `onDanger` is authored per palette and is
 * NOT overlay-provided. The remaining members are the array/status/orrery seed
 * tokens below.
 */
export interface ThemePalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  /**
   * The filled-accent background (Primary button / active state). SEEDED per
   * preset with the package default accent's mode-resolved `fill` and OVERLAID
   * at render by the provider with the active package's accent (Plan 03 /
   * THEME-02). Consumers reading `useTheme().colors.accent` get `fill`.
   */
  accent: string;
  /**
   * The foreground drawn ON the `accent` fill (Primary button label/glyph).
   * SEEDED with the default accent's mode `onAccent`, OVERLAID at render. Tuned
   * to meet AA (>=4.5) against `accent`; distinct from `onDanger` (whose values
   * are tuned for the destructive `danger` fill, never reused here).
   */
  onAccent: string;
  /**
   * The accent-as-text/link tone for THIS palette's background (Tertiary/text
   * role). SEEDED with the default accent's mode `text`, OVERLAID at render.
   * Tuned to meet AA (>=4.5) against `background`/`surface`; one hex cannot be
   * AA on both a dark and a light background, hence a per-mode tone (THEME-02).
   */
  accentText: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  borderStrong: string;
  /**
   * Destructive/danger emphasis (galaxy-dark = owner-approved #E5484D,
   * 2026-08-14; the other three palettes author their own AA-passing hue). Used
   * as the destructive-control FILL (with `onDanger` as its label/glyph
   * foreground) AND as validation/warning-emphasis TEXT (invalid interval,
   * future date, duplicate-name). The native `Alert.alert` `style:
   * "destructive"` needs no token (OS-rendered). Consumed via
   * `useTheme().colors.danger`.
   */
  danger: string;
  /**
   * The named destructive FOREGROUND drawn on the `danger` fill (Plan 07's
   * Destructive Button / ConfirmDialog label + warning glyph). AUTHORED per
   * palette (NOT overlay-provided), distinct from the accent `onAccent` — reusing
   * onAccent would draw the configurable-accent foreground on the fixed
   * destructive fill. Tuned to meet AA (>=4.5) against `danger` in the three
   * newly-authored palettes; the galaxy-dark pair (near-white on #E5484D ≈3.9:1)
   * is an owner-decision flag, never auto-retuned (REVIEWS 23-03/23-07 cycle-4).
   */
  onDanger: string;
  /**
   * Deterministic initials-avatar swatch set (PHOTO-04). The predecessor plugin
   * coloured avatars with a free `hsl(hash(name) % 360, 65%, 45%)`, which the
   * no-hardcoded-colour rule bars (a raw hue that never restyles with the theme).
   * Instead the avatar quantizes the same name hash onto this FINITE, themed
   * array — `index = abs(hash(name)) % avatarSwatches.length` — so the same
   * person always gets the same swatch and the whole set restyles when the theme
   * profile changes, exactly like every other token. Populated in `theme-presets`
   * (the only colour-literal file). `readonly` because the pick only ever indexes
   * it. Length >= 1 (8 recommended for glance-ability across the grid/orrery).
   */
  avatarSwatches: readonly string[];
  /**
   * The single on-swatch foreground for the avatar initials glyph (PHOTO-04).
   * One readable near-white used on ALL swatches so the initials stay legible
   * regardless of which swatch the hash picks; the glyph MUST use this token,
   * never a raw colour.
   */
  avatarSwatchText: string;
  /**
   * In-app ROGUE status-label colour (owner-approved 2026-08-15). The emphasis
   * hue for the profile's "no longer in a working orbit" label (Plan 06-04) — a
   * STATUS/attention hue, DISTINCT from `danger` (danger is destructive-action
   * red; rogue is a state, not an action), so it is its own token and never
   * reuses danger. Seeded in `theme-presets` (the only colour-literal file), an
   * infrastructure default the owner may retune like avatarSwatches. Consumed via
   * `useTheme().colors.rogue`; rogue is in-app only, never a notification.
   */
  rogue: string;
  /**
   * In-app STABLE status hue (owner-approved 2026-08-16, UI-SPEC). One of the
   * three shared app-wide status tokens joining `rogue` — a STATE, not an action,
   * so DISTINCT from `danger` (danger is destructive-action red; status is a
   * state). `stable` = a healthy orbit, <80% of the contact interval elapsed
   * (`status.ts` buckets). Consumed by the dashboard `ContactCard`, the Phase-12
   * widget bitmap, and the Phase-13 orrery — one source of truth. Seeded in
   * `theme-presets` (the only colour-literal file), owner-tunable like the other
   * seeds. Consumed via `useTheme().colors.statusStable`.
   */
  statusStable: string;
  /**
   * In-app WOBBLE status hue (owner-approved 2026-08-16, UI-SPEC). Shared status
   * token beside `statusStable`/`statusDecay`/`rogue` — a STATE, not an action,
   * so DISTINCT from `danger`. `wobble` = approaching due, 80–100% of the contact
   * interval elapsed (`status.ts` buckets). Consumed by the dashboard
   * `ContactCard`, the Phase-12 widget bitmap, and the Phase-13 orrery — one
   * source of truth. Seeded in `theme-presets` (the only colour-literal file),
   * owner-tunable. Consumed via `useTheme().colors.statusWobble`.
   */
  statusWobble: string;
  /**
   * In-app DECAY status hue (owner-approved 2026-08-16, UI-SPEC). Shared status
   * token beside `statusStable`/`statusWobble`/`rogue` — a STATE, not an action,
   * so DISTINCT from `danger` (deliberately orange-shifted off `danger` so a
   * decay STATUS never reads as a destructive ACTION). `decay` = overdue, >100%
   * of the contact interval elapsed (`status.ts` buckets) — the "act now" state.
   * Consumed by the dashboard `ContactCard`, the Phase-12 widget bitmap, and the
   * Phase-13 orrery — one source of truth. Seeded in `theme-presets` (the only
   * colour-literal file), owner-tunable. Consumed via
   * `useTheme().colors.statusDecay`.
   */
  statusDecay: string;
  /**
   * Ordered GRAVITY-TIER colour ramp (owner-approved 2026-08-15). ONE entry per
   * gravity tier, indexed by the gravity `tierIndex` (Plan 06-05's GravityBar):
   * `gravityTiers[tierIndex]`. Length MUST equal Plan 05's `GRAVITY_TIERS` count
   * (4: thin/building/solid/deep) so the index is always in range. Ascending
   * thin→deep; ORDER-STABLE — reordering restyles every tier. Seeded in
   * `theme-presets` (the only colour-literal file), owner-tunable like
   * avatarSwatches. `readonly` because consumers only ever index it.
   */
  gravityTiers: readonly string[];
  /**
   * Ordered SELF-SUN star colour set (ORR-05, UI-SPEC). ~6 curated star hues the
   * user picks from for their own sun; `starPalette[0]` (gold) is the default
   * self-sun applied when `self_sun_colour` is NULL (resolved at RENDER, never in
   * the DAO/migration — Pitfall 3). ORDER-STABLE — reordering restyles every
   * self-sun; never reorder without accepting that. EVERY entry MUST be a 6-digit
   * `#RRGGBB` hex: a tapped swatch is written to `self_sun_colour`, whose DAO
   * validator (`SELF_SUN_COLOUR_RE`, app-settings-dao) rejects anything else, so
   * an 8-digit/3-digit/functional colour would throw inside `updateAppSettings`
   * (M6 — a conformance test locks this against the real validator). Seeded in
   * `theme-presets` (the only colour-literal file), owner-tunable like
   * avatarSwatches. `readonly` because the picker only ever indexes it.
   */
  starPalette: readonly string[];
  /**
   * Desaturated STABLE endpoint (ORR-04, UI-SPEC). The low-saturation SAME-HUE
   * (NOT greyscale) colour the orrery's relationship-morph fades a stable body
   * toward. Distinct from `statusStable` (the full-saturation live hue). Seeded in
   * `theme-presets` (the only colour-literal file), owner-tunable.
   */
  mutedStable: string;
  /**
   * Desaturated WOBBLE endpoint (ORR-04, UI-SPEC). The low-saturation same-hue
   * colour the morph fades a wobble body toward. Owner-tunable seed.
   */
  mutedWobble: string;
  /**
   * Desaturated DECAY endpoint (ORR-04, UI-SPEC). The low-saturation same-hue
   * colour the morph fades a decay body toward. Owner-tunable seed.
   */
  mutedDecay: string;
  /**
   * Cold, dark EXTINGUISHED-ROGUE body fill (ORR-04, UI-SPEC). The rogue planet's
   * BODY is this cold blue-grey, distinct from the warm `rogue` amber (which stays
   * the RING + in-app label hue) and from `statusDecay`. Rogue has no separate
   * muted endpoint — it reads extinguished/cold in both views. Seeded in
   * `theme-presets` (the only colour-literal file), owner-tunable.
   */
  rogueExtinguished: string;
}

/**
 * A theme preset, keyed by `ThemePackage`. Both `dark` and `light` are REQUIRED
 * (Plan 03 authored all four palettes — galaxy dark+light, standard dark+light),
 * so `resolvePalette`'s former dark-fallback for a missing `light` is no longer
 * load-bearing: every (package, mode) pair resolves to a distinct authored
 * palette.
 */
export interface ThemePreset {
  id: ThemePackage;
  name: string;
  dark: ThemePalette;
  light: ThemePalette;
}

/**
 * What `useTheme()` returns: the active palette, the resolved mode, and the
 * active package (so consumers — and Plans 03/06's accent/background overlays —
 * know which package's tones are in force).
 */
export interface ResolvedTheme {
  colors: ThemePalette;
  mode: ResolvedMode;
  package: ThemePackage;
}

/**
 * The durable theme selection hydrated from `app_settings` at boot (THEME-03 /
 * D-11). Package + per-package appearance mode + per-package accent/background
 * memory: switching package restores THAT package's own stored mode/accent/
 * background. Accent/background DATA resolution lands in Plans 03/06; this phase
 * lands the storage + the package × mode render path.
 */
export interface ThemeSelection {
  package: ThemePackage;
  galaxyMode: ThemeMode;
  standardMode: ThemeMode;
  galaxyAccent: AccentId | null;
  standardAccent: AccentId | null;
  galaxyBackground: BackgroundSlotId | null;
  standardBackground: BackgroundSlotId | null;
}
