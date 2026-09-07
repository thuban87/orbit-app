/**
 * ADR-011: truthful status predicates; D-05 widens All/Not Contacted explicitly.
 * ADR-047: validate the current global sun with the shared lifecycle fallback.
 * ADR-093: reuse population predicate semantics only, not Dashboard state.
 * ADR-077: fresh identity guards inspection/Profile over the canonical world.
 */

import type { ContactIdentity } from "@/db/orrery-system-read";
import { inReadSnapshot } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import type { OrreryContactTarget } from "@/logic/orrery-focus-logic";
import {
  buildOrrerySystemWhere,
  type OrrerySystemRef,
} from "@/logic/orrery-system-logic";
import { sunOccupantIsSelf } from "@/logic/sun-occupant-logic";

export interface OrreryTargetValidation {
  status: "ready" | "missing-category";
  identity: ContactIdentity | null;
  isMember: boolean;
  resolvedSunIdentity: ContactIdentity | null;
}
/** Owns ONE snapshot; no nested mutex, media, history or full population read.
 * The FIFO wait can include a backup snapshot; bounded statements are not a
 * latency promise. Callers logically cancel publication, never bypass this read.
 */
export function readOrreryContactTargetValidation(
  exec: SqlExecutor,
  system: OrrerySystemRef,
  target: OrreryContactTarget,
): Promise<OrreryTargetValidation> {
  const where = buildOrrerySystemWhere(system);
  return inReadSnapshot(exec, async (ro) => {
    const row = await ro.getFirstAsync<ContactIdentity & { member: number }>(
      `SELECT c.id,c.uid,CASE WHEN (${where.sql}) THEN 1 ELSE 0 END AS member FROM contacts c WHERE c.id=? AND c.uid=?`,
      [...where.params, target.id, target.uid],
    );
    const sun = await ro.getFirstAsync<{
      saved: number | null;
      id: number | null;
      uid: string | null;
      archived_at: string | null;
      tracking_enabled: number | null;
    }>(
      "SELECT s.sun_contact_id AS saved,c.id,c.uid,c.archived_at,c.tracking_enabled FROM app_settings s LEFT JOIN contacts c ON c.id=s.sun_contact_id WHERE s.id=1",
    );
    if (!sun) throw new Error("Missing Orrery settings");
    const self = sunOccupantIsSelf({
      sunContactId: sun.saved,
      occupant:
        sun.id === null
          ? null
          : {
              archived: sun.archived_at !== null,
              trackingEnabled: sun.tracking_enabled ?? 0,
            },
    });
    const categoryExists =
      system.kind !== "category" ||
      !!(await ro.getFirstAsync("SELECT id FROM categories WHERE uid=?", [
        system.uid,
      ]));
    return {
      status: categoryExists ? "ready" : "missing-category",
      identity: row ? { id: row.id, uid: row.uid } : null,
      isMember: categoryExists && row?.member === 1,
      resolvedSunIdentity:
        !self && sun.id !== null && sun.uid !== null
          ? { id: sun.id, uid: sun.uid }
          : null,
    };
  });
}
