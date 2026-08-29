/**
 * Dedicated Bound/Unbound lifecycle read for the dormant-contact population.
 *
 * This query intentionally owns the live-Unbound predicate rather than asking a
 * screen to filter a broader contact collection. Its rows are presentation-neutral:
 * dormant contacts retain direct profile/history retrieval but carry no cadence
 * status, progress, or favourite chrome into the dedicated list.
 */
import type { ProfileStatus } from "@/db/contact-status-read";
import type { SqlExecutor } from "@/db/types";

export interface UnboundRow {
  id: number;
  name: string;
  photo: string | null;
  modified_at: string;
  trackingEnabled: number;
  favourite_rank: null;
  status: ProfileStatus | null;
  progress: number | null;
}

/** List live Unbound contacts alphabetically for the dedicated lifecycle surface. */
export function listUnbound(exec: SqlExecutor): Promise<UnboundRow[]> {
  return exec.getAllAsync<UnboundRow>(
    `SELECT id,
       name,
       photo,
       modified_at,
       tracking_enabled AS trackingEnabled,
       NULL AS favourite_rank,
       NULL AS status,
       NULL AS progress
     FROM contacts
    WHERE archived_at IS NULL
      AND tracking_enabled = 0
    ORDER BY name COLLATE NOCASE, id`,
  );
}

/** Count the same live-Unbound population presented by the dashboard footer. */
export async function countUnbound(exec: SqlExecutor): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM contacts
      WHERE archived_at IS NULL
        AND tracking_enabled = 0`,
  );
  return row?.n ?? 0;
}
