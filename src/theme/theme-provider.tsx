import type React from "react";
import { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { useThemeStore } from "@/stores/theme-store";
import { applyAccent, resolveAccent } from "./accents";
import { resolveBackground } from "./backgrounds";
import {
  glassScopedTheme,
  resolveGlassForegroundPalette,
  unscopedTheme,
} from "./glass-foregrounds";
import { useNativeColorSchemeSync } from "./native-color-scheme";
import {
  DEFAULT_PRESET_ID,
  resolveMode,
  resolvePalette,
} from "./theme-presets";
import type { ResolvedTheme, ThemePalette } from "./theme-types";

export const ThemeContext = createContext<ResolvedTheme | null>(null);

/**
 * The ROOT resolved theme (RG-029 / D-24). Provided once by `ThemeProvider` with
 * the same value as the root `ThemeContext` and NEVER overridden, so an opaque
 * overlay nested inside a glass scope can restore the normal hierarchy via
 * `UnscopedTheme`.
 */
export const RootThemeContext = createContext<ResolvedTheme | null>(null);

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
 * The active package's mode SETTING also drives the native night mode (D-50),
 * so RN `Alert` and the date/time pickers match Orbit. "system" maps to
 * `"unspecified"`, so `useColorScheme()` keeps reporting the device scheme
 * (see `native-color-scheme.ts`).
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
  const galaxyBackground = useThemeStore((s) => s.galaxyBackground);
  const standardBackground = useThemeStore((s) => s.standardBackground);
  const scheme = useColorScheme();
  // Per-package memory: the active package's OWN remembered mode drives render.
  const activeMode = themePackage === "galaxy" ? galaxyMode : standardMode;
  // D-50: native dialogs follow this mode SETTING ("system" → the device), never
  // the resolved mode, so `useColorScheme()` keeps reporting the device scheme.
  useNativeColorSchemeSync(activeMode);

  const theme = useMemo<ResolvedTheme>(() => {
    const resolved = resolveMode(activeMode, scheme);
    // The active package's OWN stored accent-id (NULL -> package default tone).
    const accentId = themePackage === "galaxy" ? galaxyAccent : standardAccent;
    const tone = resolveAccent(accentId, themePackage, resolved);
    const colors = applyAccent(resolvePalette(themePackage, resolved), tone);
    // Glass foreground scope (RG-029 / D-12 / D-24): active only when the
    // active package's background resolves to a bundled asset (not `none`).
    const backgroundId =
      themePackage === "galaxy" ? galaxyBackground : standardBackground;
    const glassColors = resolveGlassForegroundPalette({
      palette: colors,
      package: themePackage,
      mode: resolved,
      accentId,
      backgroundIsAsset:
        resolveBackground(themePackage, backgroundId).kind === "asset",
    });
    return {
      colors,
      mode: resolved,
      package: themePackage,
      ...(glassColors ? { glassColors } : {}),
    };
  }, [
    themePackage,
    activeMode,
    galaxyAccent,
    standardAccent,
    galaxyBackground,
    standardBackground,
    scheme,
  ]);

  return (
    <RootThemeContext.Provider value={theme}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </RootThemeContext.Provider>
  );
}

/**
 * Re-provide the theme with the glass foreground palette (RG-029 / D-24) for a
 * GlassSurface card, ChromeScrim or ShellAppBar subtree. When the override is
 * inactive (`glassColors` unset — Galaxy, Standard Dark, the `none` background)
 * this renders its children unchanged. Nested scopes are idempotent.
 */
export function GlassForegroundScope({
  children,
}: {
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const scoped = useMemo(() => glassScopedTheme(theme), [theme]);
  if (scoped === theme) {
    return <>{children}</>;
  }
  return (
    <ThemeContext.Provider value={scoped}>{children}</ThemeContext.Provider>
  );
}

/**
 * Restore the ROOT theme for an opaque surface (sheet, dialog, menu) rendered
 * inside a glass scope, so it keeps the normal text hierarchy (RG-029 / D-24).
 * Outside a provider it renders its children unchanged.
 */
export function UnscopedTheme({ children }: { children?: React.ReactNode }) {
  const current = useTheme();
  const value = unscopedTheme(current, useContext(RootThemeContext));
  if (value === current) {
    return <>{children}</>;
  }
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * The ROOT theme for a component that paints an OPAQUE surface itself and reads
 * colours above its own `UnscopedTheme` boundary (ConfirmDialog's body text,
 * OverflowMenu's sheet). Same value `UnscopedTheme` provides.
 */
export function useUnscopedTheme(): ResolvedTheme {
  return unscopedTheme(useTheme(), useContext(RootThemeContext));
}

/**
 * The glass foreground palette for a component that draws its OWN glass/chrome
 * backing (ShellAppBar) and so cannot sit inside its own scope: `glassColors`
 * when the override is active, otherwise the current `colors`.
 */
export function useGlassForegroundColors(): ThemePalette {
  const theme = useTheme();
  return theme.glassColors ?? theme.colors;
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
