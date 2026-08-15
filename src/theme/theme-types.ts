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
