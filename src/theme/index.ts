/**
 * Public `@/theme` barrel. Re-exports the theme API so `@/theme` resolves
 * (`@/*` maps to `src/*`, which needs an `index.ts` entry). Logic-free — it
 * only re-exports. The resolver test imports `./theme-presets` directly, not
 * this barrel, so it never pulls `react-native` in through the provider.
 */

export * from "./theme-presets";
export { ThemeContext, ThemeProvider, useTheme } from "./theme-provider";
export * from "./theme-types";
