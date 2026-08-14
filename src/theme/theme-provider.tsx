import type React from "react";
import { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { useThemeStore } from "@/stores/theme-store";
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
 * persisted `useThemeStore` is the source of truth, so a rehydrated
 * `mode`/`presetId` re-renders the provider and restyles the app.
 *
 * `system` is resolved HERE at the app boundary via `useColorScheme()`; its
 * `ColorSchemeName | null | undefined` result is passed straight into the pure
 * `resolveMode` (whose `SystemScheme` param is a superset), with no coercion
 * that could drop the `"unspecified"` path or invert the dark default.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const mode = useThemeStore((s) => s.mode);
  const presetId = useThemeStore((s) => s.presetId);
  const scheme = useColorScheme();

  const theme = useMemo<ResolvedTheme>(() => {
    const resolved = resolveMode(mode, scheme);
    return {
      colors: resolvePalette(presetId, resolved),
      mode: resolved,
    };
  }, [mode, presetId, scheme]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

/**
 * Access the active theme. Outside a provider (stray callers, tests) it falls
 * back to the default preset's dark palette — never null, never a bare hex.
 */
export function useTheme(): ResolvedTheme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    return {
      colors: resolvePalette(DEFAULT_PRESET_ID, "dark"),
      mode: "dark",
    };
  }
  return theme;
}
