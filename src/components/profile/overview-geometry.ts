/**
 * Relationship Overview geometry shared by the real overview grid and the
 * Profile layout editor's preview (RG-033 `ui-accessibility/AUD-UIA-021`,
 * D-13) so the preview's rows, spans and gaps are a faithful picture of the
 * Profile.
 *
 * PURE — no react-native import.
 */
import {
  type OverviewPackInput,
  type PackedOverviewModules,
  packOverviewModules,
} from "@/profile/pack-overview";
import { SPACING } from "@/theme/tokens/spacing";

/** Row and column gap of the overview grid. */
export const OVERVIEW_GAP = SPACING.sm;

/**
 * Total horizontal inset between the window edge and the rendered Relationship
 * Overview grid, summed over its full ancestor chain:
 *  - `ContactProfileScreen.tsx` `styles.content.padding` — SPACING.base per side.
 * The Overview's top-level `ProfileSection` has no card and its body
 * (`ProfileModuleHost.tsx` `styles.pageBody`) carries no horizontal padding
 * (38.14 D-51 layout P-D, D-55), so the tiles sit 16 dp from the screen edges.
 * = 2·16 = 32dp. `overview-geometry.test.ts` reads those style sites and fails
 * if any of them changes without this constant.
 */
export const PROFILE_OVERVIEW_HORIZONTAL_INSET = 2 * SPACING.base;

/** The width the Profile's Relationship Overview grid measures in a window. */
export function profileOverviewWidthBasis(windowWidth: number): number {
  return Math.max(0, windowWidth - PROFILE_OVERVIEW_HORIZONTAL_INSET);
}

/** One column's width: `(width − gap·(columns − 1)) / columns`, never negative. */
export function overviewColumnWidth(width: number, columns: number): number {
  if (columns <= 0) return width;
  return Math.max(0, (width - OVERVIEW_GAP * (columns - 1)) / columns);
}

/** A tile spanning `span` columns: `span·column + (span − 1)·gap`. */
export function overviewTileWidth(span: number, columnWidth: number): number {
  return columnWidth * span + OVERVIEW_GAP * (span - 1);
}

/**
 * Packs the preview's modules against the PROFILE overview's width basis (not
 * the narrower preview card), so row membership and spans match what the real
 * Profile shows at this window width and font scale.
 */
export function packProfileOverviewPreview(
  modules: readonly OverviewPackInput[],
  windowWidth: number,
  fontScale: number,
): PackedOverviewModules {
  return packOverviewModules(
    modules.map(({ id, size }) => ({ id, size })),
    { width: Math.max(1, profileOverviewWidthBasis(windowWidth)), fontScale },
  );
}
