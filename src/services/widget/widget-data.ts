/**
 * widget-data — the PURE favourites → widget-tile shaper (WDG-01), the first of
 * this phase's two node-testable correctness cores. It reads the EXISTING
 * `listDashboard({filter:'favourites'})` projection and maps each row to a flat
 * `WidgetTile` the 12-05 RemoteViews render consumes.
 *
 * IT RE-USES, NEVER RE-DERIVES:
 *   - status: taken VERBATIM from the DashboardRow (`ProfileStatus | null`). The
 *     favourites branch already CASE-wraps a never-contacted favourite to
 *     status=null (dashboard-read.ts HIGH-1); re-deriving it here would resurrect
 *     the never-contacted='stable' bug. This module never imports status.ts.
 *   - the ranked fuel line: carried through as `fuelText` unchanged.
 *   - the manual favourite order: the favourites branch orders by
 *     `favourite_rank ASC` regardless of the sort arg (dashboard-read.ts:226-230),
 *     so slicing the head of the array truncates by rank.
 *
 * It is node-loadable and file-I/O-free: NO react-native, NO expo, NO DB import
 * beyond the pure `listDashboard` read. The relative photo path is carried as-is;
 * base64 thumbnail encoding happens later in the render (12-03's encoder), keeping
 * this shaper pure so the never-re-derive contract is unit-tested without a device.
 */
import type { ProfileStatus } from "@/db/contact-status-read";
import { getInitials, swatchIndex } from "@/components/avatar-initials";
import { type DashboardRow, listDashboard } from "@/db/dashboard-read";
import type { SqlExecutor } from "@/db/types";

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
 * Map favourites rows (already ordered favourite_rank ASC) to widget tiles,
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
 * Read the favourites projection and shape it into widget tiles. Calls
 * `listDashboard(exec, { filter: 'favourites', sort: 'status' })` — the favourites
 * branch ignores the sort arg and orders by `favourite_rank ASC`, the required
 * static manual rank — then pipes the rows through `shapeWidgetTiles`. `capacity`
 * defaults to `WIDGET_GRID_CAPACITY`.
 */
export async function loadWidgetTiles(
  exec: SqlExecutor,
  opts: { swatchCount: number; capacity?: number },
): Promise<WidgetTile[]> {
  const rows = await listDashboard(exec, {
    filter: "favourites",
    sort: "status",
  });
  return shapeWidgetTiles(rows, {
    capacity: opts.capacity ?? WIDGET_GRID_CAPACITY,
    swatchCount: opts.swatchCount,
  });
}
