/** Read sources for the Manage Members editor; all filtering stays local. */

import type { ReadOnlyExecutor } from "@/db/transaction";
import { DASHBOARD_POPULATION_SCOPE_WHERE } from "@/logic/dashboard-query-logic";

/** Local, display-ready row; `photo` remains an app-relative path. */
export interface SystemMemberRow {
  readonly id: number;
  readonly name: string | null;
  readonly photo: string | null;
  readonly searchMethods: readonly string[];
  readonly available: boolean;
}

type RawMemberRow = {
  id: number;
  name: string | null;
  photo: string | null;
  available: 0 | 1;
};

const MEMBER_ROW_SELECT = `SELECT c.id, c.name, c.photo,
  CASE WHEN c.archived_at IS NULL AND c.tracking_enabled = 1 THEN 1 ELSE 0 END AS available
  FROM contacts c`;

function mapMemberRow(row: RawMemberRow): SystemMemberRow {
  return {
    id: row.id,
    name: row.name,
    photo: row.photo,
    searchMethods: row.name?.trim() ? [row.name] : [],
    available: row.available === 1,
  };
}

/**
 * Add People source: all active contacts (including never-contacted ones),
 * using the shared dashboard population scope rather than a local predicate.
 */
export async function listActiveMemberRows(
  exec: ReadOnlyExecutor,
): Promise<SystemMemberRow[]> {
  const rows = await exec.getAllAsync<RawMemberRow>(
    `${MEMBER_ROW_SELECT} WHERE ${DASHBOARD_POPULATION_SCOPE_WHERE}
     ORDER BY c.name COLLATE NOCASE, c.id`,
  );
  return rows.map(mapMemberRow);
}

/**
 * Read display cards for arbitrary member/override ids. No eligibility clause
 * belongs here: a never-contacted candidate and archived inclusion must remain
 * available to the editor's union even when they cannot be added anew.
 */
export async function readMemberRowsByIds(
  exec: ReadOnlyExecutor,
  ids: readonly number[],
): Promise<SystemMemberRow[]> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return [];
  const rows = await exec.getAllAsync<RawMemberRow>(
    `${MEMBER_ROW_SELECT} WHERE c.id IN (${uniqueIds.map(() => "?").join(", ")})
     ORDER BY c.id`,
    uniqueIds,
  );
  return rows.map(mapMemberRow);
}
