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

/** The 8 base dynamic tokens every theme preset defines. */
export interface ThemePalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  borderStrong: string;
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
