/**
 * Theme type contract (FND-05).
 *
 * Colour VALUES live only in `theme-presets.ts`. This module declares the
 * shapes those values fill and the mode unions the provider selects with.
 * It imports nothing from `react-native`, so the pure resolvers in
 * `theme-presets.ts` (which reference these types) stay node-unit-testable.
 */

/** User-selectable theme mode. `system` defers to the OS colour scheme. */
export type ThemeMode = "light" | "dark" | "system";

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

/** The 11 base dynamic tokens every theme preset defines. */
export interface ThemePalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  borderStrong: string;
  /**
   * Destructive/danger emphasis (owner-approved #E5484D, 2026-08-14). Used by
   * in-app rendered destructive controls (the Archived "Delete permanently"
   * button) and validation/warning emphasis (invalid interval, future date,
   * duplicate-name). The native `Alert.alert` `style: "destructive"` needs no
   * token (OS-rendered). Added in Phase-4 wave 1 so Plans 03/04/06/09 consume
   * it via `useTheme().colors.danger`; none re-adds it.
   */
  danger: string;
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
}

/** Identifier union for the shipped presets. Only one preset ships this phase. */
export type ThemePresetId = "space-dark";

/**
 * A theme preset. `dark` is required — the app is dark-first this phase — while
 * `light` is optional so `resolvePalette` can fall back to `dark` until a light
 * palette is authored (the owner's visual design, HANDOFF §7 + Q4).
 */
export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  dark: ThemePalette;
  light?: ThemePalette;
}

/** What `useTheme()` returns: the active palette plus the resolved mode. */
export interface ResolvedTheme {
  colors: ThemePalette;
  mode: ResolvedMode;
}
