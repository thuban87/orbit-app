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
 *
 * DEV-ONLY OVERRIDE (38.5-06 Task 3; D-27; T-38.5-06-01). On a DEBUG build the
 * re-sign-off capture (38.5-07) edits
 * `src/theme/__dev__/art-treatment-dev-overrides.json` to render any cell,
 * candidate opacity, card-blend variant or ⋯ local backing over the new art.
 * Committed as `{ "enabled": false }`. Schema (every field optional except
 * `enabled`; invalid values are ignored by `applyArtDevOverrides`):
 *
 *   {
 *     "enabled": true,
 *     // applied in memory on mount by ArtSheetComboSync (never written to the DB)
 *     "combo": { "package": "galaxy", "mode": "light", "background": "aurora" },
 *     // per combination key (<theme>-<mode>-<bg>) and v2 component name
 *     "cells": {
 *       "galaxy-light-aurora": {
 *         "contactsHeader": { "backing": "none", "overflowLocalBacking": true },
 *         "contactsTopButtons": { "activeTriggerBacking": "full" }
 *       }
 *     },
 *     // see-through candidate / card-blend opacity per "<pkg>-<mode>" and group
 *     "opacity": { "galaxy-light": { "listEntry": …, "cardEntry": …, "artChrome": … } }
 *   }
 *
 * `backing` is `full` | `seeThrough` | `none`; `activeTriggerBacking` is `full` |
 * `none`; opacities are numbers in [0, 1]. A change to the JSON triggers a Metro
 * reload, which re-applies it. The file is reached ONLY through the
 * `__DEV__ ? require(...) : null` guard below, which Metro folds to `null` in a
 * release bundle (the SettingsStack ThemePreview precedent);
 * `dev-override-release-guard.test.ts` enforces the guard.
 */
import { useTheme } from "@/theme";
import {
  type ArtComponent,
  type ArtTreatment,
  resolveArtTreatment,
} from "./art-treatments";

// Kept behind a compile-time guard so Metro removes the DEV-only override from
// release bundles.
const artDevOverrides: unknown = __DEV__
  ? require("./__dev__/art-treatment-dev-overrides.json")
  : null;

export function useArtTreatment(component?: ArtComponent): ArtTreatment | null {
  const theme = useTheme();
  if (component === undefined) return null;
  return resolveArtTreatment(
    theme.package,
    theme.mode,
    theme.backgroundId ?? null,
    component,
    artDevOverrides,
  );
}
