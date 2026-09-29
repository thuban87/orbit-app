/**
 * `useArtTreatment(component?)` (38.5-06; D-08, D-28).
 *
 * The runtime read of the per-combination art treatment table for one of the
 * five v2-marked components. It reads the active package, the resolved mode and
 * the active package's STORED background from `useTheme()` (the provider reads
 * the background from the theme store, the same selection the host renders),
 * resolves the rendered background through `resolveBackground` (so a retired or
 * unknown id reads the default slot's row, exactly as the host renders it), and
 * returns the cell plus its backing opacity.
 *
 * No component (the default prop of every shared primitive) returns null, and
 * the caller renders today's tree. The one hook (`useTheme`) runs
 * unconditionally, so the hook order never depends on the prop. Reading the
 * background through the theme context (not a store subscription) keeps the
 * ~90 shared-primitive instances off an extra subscription; the provider
 * already re-renders them on a background change.
 *
 * A render failure in `BackgroundHost` (decode error) paints the solid fallback
 * but keeps the art row here: every backing sits over the mode's own background
 * colour, so the text stays readable.
 */
import { useTheme } from "@/theme";
import {
  type ArtComponent,
  type ArtTreatment,
  resolveArtTreatment,
} from "./art-treatments";

export function useArtTreatment(component?: ArtComponent): ArtTreatment | null {
  const theme = useTheme();
  if (component === undefined) return null;
  return resolveArtTreatment(
    theme.package,
    theme.mode,
    theme.backgroundId ?? null,
    component,
  );
}
