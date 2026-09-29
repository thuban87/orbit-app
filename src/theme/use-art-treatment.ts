/**
 * `useArtTreatment(component?)` (38.5-06; D-08, D-28).
 *
 * The runtime read of the per-combination art treatment table for one of the
 * five v2-marked components. It reads the active package and resolved mode from
 * `useTheme()` and the active package's STORED background from the theme store,
 * resolves the rendered background through `resolveBackground` (so a retired or
 * unknown id reads the default slot's row, exactly as the host renders it), and
 * returns the cell plus its backing opacity.
 *
 * No component (the default prop of every shared primitive) returns null, and
 * the caller renders today's tree. The hooks run unconditionally either way, so
 * the hook order never depends on the prop.
 *
 * A render failure in `BackgroundHost` (decode error) paints the solid fallback
 * but keeps the art row here: every backing sits over the mode's own background
 * colour, so the text stays readable.
 */
import { useThemeStore } from "@/stores/theme-store";
import { useTheme } from "@/theme";
import {
  type ArtComponent,
  type ArtTreatment,
  resolveArtTreatment,
} from "./art-treatments";

export function useArtTreatment(component?: ArtComponent): ArtTreatment | null {
  const { mode, package: themePackage } = useTheme();
  const storedBackground = useThemeStore((state) =>
    themePackage === "galaxy"
      ? state.galaxyBackground
      : state.standardBackground,
  );
  if (component === undefined) return null;
  return resolveArtTreatment(themePackage, mode, storedBackground, component);
}
