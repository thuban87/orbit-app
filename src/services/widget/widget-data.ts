/**
 * widget-data — the PURE favourites → widget-tile shaper (WDG-01), the first of
 * this phase's two node-testable correctness cores. It reads the EXISTING
 * Favorites-population Default-order projection and maps each row to a flat
 * `WidgetTile` the 12-05 RemoteViews render consumes.
 *
 * IT RE-USES, NEVER RE-DERIVES:
 *   - status: taken VERBATIM from the DashboardRow (`ProfileStatus | null`). The
 *     favourites branch already CASE-wraps a never-contacted favourite to
 *     status=null (dashboard-read.ts HIGH-1); re-deriving it here would resurrect
 *     the never-contacted='stable' bug. This module never imports status.ts.
 *   - the ranked fuel line: carried through as `fuelText` unchanged.
 *   - the Dashboard Default order: `listDashboardPopulation` owns the shared
 *     relationship-health ordering for the Favorites population. This service
 *     only truncates that already-ordered projection (ADR-075).
 *
 * It is node-loadable and file-I/O-free: NO react-native, NO expo, NO DB import
 * beyond the pure `listDashboardPopulation` read. The relative photo path is carried as-is;
 * base64 thumbnail encoding happens later in the render (12-03's encoder), keeping
 * this shaper pure so the never-re-derive contract is unit-tested without a device.
 */

import { getInitials, swatchIndex } from "@/components/avatar-initials";
import type { ProfileStatus } from "@/db/contact-status-read";
import {
  type DashboardRow,
  listDashboardPopulation,
} from "@/db/dashboard-read";
import type { SqlExecutor } from "@/db/types";
import { formatLocalDate } from "@/utils/dates";

/**
 * The default favourites-grid capacity — how many tiles the widget renders before
 * truncating by rank. Device-spike-tunable (UI-SPEC / RESEARCH A3: the real
 * bitmap-memory ceiling is a physical-Pixel limit); kept at the file top so tuning
 * is a single-number edit.
 */
export const WIDGET_GRID_CAPACITY = 6;

/**
 * One favourites-grid tile. `status` is carried VERBATIM from the row (never
 * re-derived) and stays `ProfileStatus | null` so a never-contacted favourite is
 * null, not 'stable'. `relativePhoto` is the row's stored relative path (or null);
 * the render encodes it to a base64 data URI, not this module.
 */
export interface WidgetTile {
  id: number;
  name: string;
  status: ProfileStatus | null;
  initials: string;
  swatchIndex: number;
  relativePhoto: string | null;
  fuelText: string | null;
}

/**
 * Map Favorites-population rows (already in Dashboard Default order) to widget tiles,
 * truncating to `opts.capacity`. Pure: status is copied straight from the row;
 * only the presentational `initials` + `swatchIndex` are computed via the shared
 * avatar helpers. An empty list maps to [].
 */
export function shapeWidgetTiles(
  rows: DashboardRow[],
  opts: { capacity: number; swatchCount: number },
): WidgetTile[] {
  return rows.slice(0, opts.capacity).map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    initials: getInitials(r.name),
    swatchIndex: swatchIndex(r.name, opts.swatchCount),
    relativePhoto: r.photo,
    fuelText: r.fuelText,
  }));
}

/**
 * Read the Favorites population in the shared Dashboard Default order and shape it
 * into widget tiles. The caller may inject `now` for deterministic tests; widget
 * rendering otherwise supplies the current local wall-clock timestamp here.
 */
export async function loadWidgetTiles(
  exec: SqlExecutor,
  opts: { swatchCount: number; capacity?: number; now?: string },
): Promise<WidgetTile[]> {
  const date = new Date();
  const now =
    opts.now ??
    `${formatLocalDate(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
  const rows = await listDashboardPopulation(
    exec,
    {
      viewMode: "list",
      populations: ["favourites"],
      filters: {},
      sort: "default",
    },
    now,
  );
  return shapeWidgetTiles(rows, {
    capacity: opts.capacity ?? WIDGET_GRID_CAPACITY,
    swatchCount: opts.swatchCount,
  });
}
