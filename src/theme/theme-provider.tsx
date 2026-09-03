import type React from "react";
import { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { useThemeStore } from "@/stores/theme-store";
import { applyAccent, resolveAccent } from "./accents";
import {
  DEFAULT_PRESET_ID,
  resolveMode,
  resolvePalette,
} from "./theme-presets";
import type { ResolvedTheme } from "./theme-types";

export const ThemeContext = createContext<ResolvedTheme | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Provides the resolved theme to the tree. It takes NO palette props — the
 * boot-hydrated `useThemeStore` selection is the source of truth, so a hydrated
 * (or later live-changed) package/mode re-renders the provider and restyles the
 * app. The package × mode axes are independent (THEME-01 / D-10): the active
 * package selects a preset and its OWN remembered mode selects the light/dark
 * slot. Accent/background overlays land in Plans 03/06.
 *
 * `system` is resolved HERE at the app boundary via `useColorScheme()`; its
 * `ColorSchemeName | null | undefined` result is passed straight into the pure
 * `resolveMode` (whose `SystemScheme` param is a superset), with no coercion
 * that could drop the `"unspecified"` path or invert the dark default.
 *
 * The active package's stored accent-id (NULL = package default) is resolved to
 * a `{ fill, onAccent, text }` tone for the resolved mode and OVERLAID onto
 * `palette.accent`(=fill)/`onAccent`/`accentText` at render (Plan 03 / THEME-02).
 * Per-package accent memory: switching package reads THAT package's accent-id, so
 * an accent change previews live because the provider re-renders from store state.
 * The accent-id -> hex resolution happens ONLY here (never in the DAO).
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const themePackage = useThemeStore((s) => s.package);
  const galaxyMode = useThemeStore((s) => s.galaxyMode);
  const standardMode = useThemeStore((s) => s.standardMode);
  const galaxyAccent = useThemeStore((s) => s.galaxyAccent);
  const standardAccent = useThemeStore((s) => s.standardAccent);
  const scheme = useColorScheme();

  const theme = useMemo<ResolvedTheme>(() => {
    // Per-package memory: the active package's OWN remembered mode drives render.
    const mode = themePackage === "galaxy" ? galaxyMode : standardMode;
    const resolved = resolveMode(mode, scheme);
    // The active package's OWN stored accent-id (NULL -> package default tone).
    const accentId = themePackage === "galaxy" ? galaxyAccent : standardAccent;
    const tone = resolveAccent(accentId, themePackage, resolved);
    return {
      colors: applyAccent(resolvePalette(themePackage, resolved), tone),
      mode: resolved,
      package: themePackage,
    };
  }, [
    themePackage,
    galaxyMode,
    standardMode,
    galaxyAccent,
    standardAccent,
    scheme,
  ]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

/**
 * Access the active theme. Outside a provider (stray callers, tests) it falls
 * back to the default package's dark palette — never null, never a bare hex.
 */
export function useTheme(): ResolvedTheme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    return {
      colors: resolvePalette(DEFAULT_PRESET_ID, "dark"),
      mode: "dark",
      package: DEFAULT_PRESET_ID,
    };
  }
  return theme;
}
