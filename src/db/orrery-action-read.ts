/**
 * ADR-011: truthful status predicates; D-05 widens All/Not Contacted explicitly.
 * ADR-047: validate the current global sun with the shared lifecycle fallback.
 * ADR-093: reuse population predicate semantics only, not Dashboard state.
 * ADR-077: fresh identity guards inspection/Profile over the canonical world.
 */

import {
  type ContactIdentity,
  readOrrerySystemMembersCore,
} from "@/db/orrery-system-read";
import { inReadSnapshot } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import type { OrreryContactTarget } from "@/logic/orrery-focus-logic";
import {
  buildOrrerySystemWhere,
  type OrrerySystemRef,
  systemRefId,
} from "@/logic/orrery-system-logic";
import { sunOccupantIsSelf } from "@/logic/sun-occupant-logic";

export interface OrreryTargetValidation {
  status: "ready" | "missing-category" | "missing-custom";
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
  // Preserve the synchronous closed-token boundary before opening a snapshot.
  systemRefId(system);
  return inReadSnapshot(exec, async (ro) => {
    // Custom definitions have rules and overrides, so their membership cannot
    // be represented by the immutable System WHERE predicate. Resolve them in
    // this same snapshot before checking the narrow target identity.
    const customMembers =
      system.kind === "custom"
        ? await readOrrerySystemMembersCore(ro, system)
        : null;
    const where =
      system.kind === "custom" ? null : buildOrrerySystemWhere(system);
    const row = where
      ? await ro.getFirstAsync<ContactIdentity & { member: number }>(
          `SELECT c.id,c.uid,CASE WHEN (${where.sql}) THEN 1 ELSE 0 END AS member FROM contacts c WHERE c.id=? AND c.uid=?`,
          [...where.params, target.id, target.uid],
        )
      : await ro.getFirstAsync<ContactIdentity>(
          "SELECT c.id,c.uid FROM contacts c WHERE c.id=? AND c.uid=?",
          [target.id, target.uid],
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
    const status =
      customMembers?.status === "missing-custom"
        ? "missing-custom"
        : system.kind === "category" &&
            !(await ro.getFirstAsync("SELECT id FROM categories WHERE uid=?", [
              system.uid,
            ]))
          ? "missing-category"
          : "ready";
    const customMemberIds = new Set(
      customMembers?.members.map((member) => member.id),
    );
    return {
      status,
      identity: row ? { id: row.id, uid: row.uid } : null,
      isMember:
        status === "ready" &&
        (where
          ? (row as (ContactIdentity & { member: number }) | null)?.member === 1
          : customMemberIds.has(target.id)),
      resolvedSunIdentity:
        !self && sun.id !== null && sun.uid !== null
          ? { id: sun.id, uid: sun.uid }
          : null,
    };
  });
}
