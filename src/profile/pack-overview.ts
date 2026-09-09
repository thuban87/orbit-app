import { SPACING } from "@/theme/tokens/spacing";
import { PROFILE_MODULE_REGISTRY } from "./module-registry";
import type { ProfileOverviewModuleId } from "./persisted-contract";
import type { ProfileModuleSize } from "./types";

/** Owner-tunable readable width for one compact Overview fact at 1x font scale. */
export const OVERVIEW_MIN_TILE_WIDTH = 144;

export interface OverviewPackInput {
  id: ProfileOverviewModuleId;
  size: ProfileModuleSize;
}

export interface OverviewPlacement extends OverviewPackInput {
  row: number;
  column: number;
  /** Rendered span may narrow on a one-column accessibility layout. */
  columnSpan: number;
}

export interface OverviewPackOptions {
  /** Measured inner width of the Relationship Overview grid. */
  width: number;
  fontScale: number;
  gap?: number;
  minTileWidth?: number;
}

export interface PackedOverviewModules {
  columns: number;
  placements: OverviewPlacement[];
}

function positiveFinite(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Packs semantic modules from their saved order. Coordinates are derived only;
 * persisted Profile layouts never store x/y positions.
 */
export function packOverviewModules(
  modules: readonly OverviewPackInput[],
  options: OverviewPackOptions,
): PackedOverviewModules {
  const width = positiveFinite(options.width, OVERVIEW_MIN_TILE_WIDTH);
  const fontScale = positiveFinite(options.fontScale, 1);
  const gap = Math.max(
    0,
    positiveFinite(options.gap ?? SPACING.sm, SPACING.sm),
  );
  const minimumWidth =
    positiveFinite(
      options.minTileWidth ?? OVERVIEW_MIN_TILE_WIDTH,
      OVERVIEW_MIN_TILE_WIDTH,
    ) * Math.max(1, fontScale);
  const columns = Math.max(1, Math.floor((width + gap) / (minimumWidth + gap)));

  let row = 0;
  let column = 0;
  const placements = modules.map((module): OverviewPlacement => {
    const definition = PROFILE_MODULE_REGISTRY[module.id];
    if (!definition.supportedSizes.includes(module.size)) {
      throw new Error(`illegal size for Profile module ${module.id}`);
    }

    const declaredSpan = module.size === "2x1" ? 2 : 1;
    const columnSpan = Math.min(declaredSpan, columns);
    if (column > 0 && column + columnSpan > columns) {
      row += 1;
      column = 0;
    }

    const placement = { ...module, row, column, columnSpan };
    column += columnSpan;
    if (column >= columns) {
      row += 1;
      column = 0;
    }
    return placement;
  });

  return { columns, placements };
}
