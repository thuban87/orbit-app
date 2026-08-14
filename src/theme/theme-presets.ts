import type {
  ResolvedMode,
  SystemScheme,
  ThemeMode,
  ThemePalette,
  ThemePreset,
  ThemePresetId,
} from "./theme-types";

/**
 * The theme presets — THE SINGLE PLACE in the codebase where a colour hex
 * literal may appear (CLAUDE.md: all colours resolve through theme tokens).
 * Every other module reads colours via `useTheme().colors.*`.
 *
 * One space-dark preset ships this phase as INFRASTRUCTURE, not a finished
 * palette; the visual design is the owner's call (HANDOFF §7 + Q4).
 */
export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  "space-dark": {
    id: "space-dark",
    name: "Deep Space",
    dark: {
      background: "#0B0E1A",
      surface: "#141828",
      surfaceElevated: "#1D2235",
      accent: "#6C8CFF",
      textPrimary: "#E6E9F5",
      textSecondary: "#8B93B0",
      border: "#2A3048",
      borderStrong: "#3C4568",
    },
  },
};

/** The default preset used before any user selection (and outside a provider). */
export const DEFAULT_PRESET_ID: ThemePresetId = "space-dark";

/**
 * Resolve a user-selected `ThemeMode` against the OS colour scheme. PURE — no
 * `react-native` import, so it unit-tests in the node Vitest env.
 *
 * When `mode` is `"system"`, ANY scheme value other than `"light"` (`"dark"`,
 * `"unspecified"`, `null`, `undefined`) resolves to the `"dark"` default. The
 * `systemScheme` param is typed `SystemScheme` (a superset of RN's
 * `ColorSchemeName`) so `useColorScheme()`'s return — including `"unspecified"`
 * — is assignable without coercion; narrowing it to `"light" | "dark" | null`
 * would reject `"unspecified"` (TS2345) and could silently invert the default.
 */
export function resolveMode(
  mode: ThemeMode,
  systemScheme: SystemScheme,
): ResolvedMode {
  return mode === "system"
    ? systemScheme === "light"
      ? "light"
      : "dark"
    : mode;
}

/**
 * Resolve a concrete palette for a preset + resolved mode. PURE. Falls back to
 * the preset's `dark` palette when the requested mode's palette is absent — so
 * with only a dark palette shipped this phase, `resolvePalette(id, "light")`
 * deterministically returns the dark palette (`"light"`/`"system"` are DEFINED,
 * never undefined).
 */
export function resolvePalette(
  presetId: ThemePresetId,
  mode: ResolvedMode,
): ThemePalette {
  const preset = THEME_PRESETS[presetId] ?? THEME_PRESETS[DEFAULT_PRESET_ID];
  return preset[mode] ?? preset.dark;
}
