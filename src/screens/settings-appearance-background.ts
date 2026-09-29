import type { AppSettingsPatch } from "@/db/app-settings-dao";
import {
  BACKGROUND_ORDER,
  NONE_SLOT_ID,
  resolveBackground,
} from "@/theme/backgrounds";
import type {
  BackgroundSlotId,
  StoredBackgroundId,
} from "@/theme/theme-option-ids";
import type { ResolvedMode, ThemePackage } from "@/theme/theme-types";

/**
 * The background choices offered for the ACTIVE theme package (D-07). Returns
 * exactly that package's ordered slot list — `BACKGROUND_ORDER[pkg]`, which
 * already ends with the shared `none` (None/Solid) slot. The Galaxy-only slots
 * are therefore never offered while Standard is active, and vice-versa.
 *
 * This is the D-07 active-package guard as a pure, node-testable selector: the
 * monolith rendered BOTH packages' subgroups in one grid (SettingsScreen.tsx
 * pre-Plan-02); the migrated Appearance screen renders only the reactive active
 * package's choices. No theme-store change, no schema change, no theme rewrite —
 * a rendering guard over the existing per-package background model.
 */
export function backgroundChoicesForPackage(
  pkg: ThemePackage,
): readonly BackgroundSlotId[] {
  return BACKGROUND_ORDER[pkg];
}

/**
 * The package-SENSITIVE `app_settings` patch for a background selection (D-07,
 * review cycle-2 finding #5). Mirrors the monolith's `onSelectBackground`
 * (SettingsScreen.tsx:520-531 pre-Plan-02): a selection under Galaxy writes
 * `galaxyBackground`, under Standard writes `standardBackground` — so the durable
 * value lands on the ACTIVE package's column, never the other's. Factored out as
 * a pure helper so the correct-key behaviour is unit-provable (the choices list
 * alone did not prove the right durable key is written).
 */
export function backgroundPatchForPackage(
  pkg: ThemePackage,
  slot: BackgroundSlotId,
): AppSettingsPatch {
  return pkg === "galaxy"
    ? { galaxyBackground: slot }
    : { standardBackground: slot };
}

/**
 * The tile the Appearance picker highlights (38.5 D-23; research Pitfall 7). It is
 * derived from what the resolver ACTUALLY renders, not from the raw stored id:
 * NULL and an unknown/tampered id both render the package default, so both
 * highlight the default tile. So do a RETIRED id (38.5 D-19 / P-4) and another
 * package's id (38.4 D-39): both render this package's default. `none` renders
 * the solid background, so it highlights the None (Solid) tile. The stored id is untrusted input (a tampered
 * database or restored backup, T-38.5-02-01), so any string is accepted and the
 * resolver's own fallback decides.
 */
export function selectedBackgroundTile(
  pkg: ThemePackage,
  storedId: string | null,
  mode: ResolvedMode,
): BackgroundSlotId {
  const resolved = resolveBackground(
    pkg,
    storedId as StoredBackgroundId | null,
    mode,
  );
  return resolved.kind === "solid" ? NONE_SLOT_ID : resolved.slotId;
}

/**
 * The picker tile's image box (38.5 D-52). Width AND height are always explicit:
 * React Native sizes a bundled `require()` image to its intrinsic pixel size
 * unless the style sets both, and that size beats `absoluteFill`'s edges, so the
 * tile showed the art's top-left corner at full scale (every tile, and a black
 * Aurora tile). Without a focus the box is the tile and `cover` crops around the
 * centre. With one, the box is `zoom`× the tile's width and shifted so the
 * anchor `x` lines up with the tile, so the tile shows the art magnified around
 * `x`. Percentages only: no layout measurement. The full-screen render never
 * uses it.
 */
export function thumbnailImageStyle(
  focus: { x: number; zoom: number } | undefined,
): {
  position: "absolute";
  top: 0;
  left: `${number}%`;
  width: `${number}%`;
  height: "100%";
} {
  const zoom = focus ? Math.max(1, focus.zoom) : 1;
  const x = focus ? Math.min(1, Math.max(0, focus.x)) : 0;
  return {
    position: "absolute",
    top: 0,
    left: `${-(zoom - 1) * x * 100 || 0}%`,
    width: `${zoom * 100}%`,
    height: "100%",
  };
}
