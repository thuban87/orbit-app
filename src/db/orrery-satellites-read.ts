/** ADR-088 structured people; D-11 requires selected System membership, even for a sun. */
import {
  type ContactIdentity,
  readOrrerySystemMembersCore,
} from "@/db/orrery-system-read";
import { resolveRelationshipVisibility } from "@/db/relationships-read";
import { inReadSnapshot } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  ALL_CONTACTS_SYSTEM,
  buildOrrerySystemWhere,
  type OrrerySystemRef,
} from "@/logic/orrery-system-logic";

export interface OrrerySatellite {
  uid: string;
  parentId: number;
  parentUid: string;
  personName: string;
  relationType: string | null;
}
const PARENT_BATCH_SIZE = 256;
/** Read-only, one coherent snapshot; never includes notes or linked-contact content. */
export async function readOrrerySatellites(
  exec: SqlExecutor,
  parents: readonly ContactIdentity[],
  system: OrrerySystemRef = ALL_CONTACTS_SYSTEM,
): Promise<OrrerySatellite[]> {
  const unique = [
    ...new Map(
      parents
        .filter((p) => Number.isSafeInteger(p.id) && p.id > 0)
        .map((p) => [p.id, p]),
    ).values(),
  ];
  if (!unique.length) return [];
  return inReadSnapshot(exec, async (ro) => {
    // Custom membership is rule/override-derived rather than a SQL predicate.
    // Resolve it under this snapshot and constrain the relationship query to
    // those current members; never pass a custom ref to the immutable builder.
    const customMembers =
      system.kind === "custom"
        ? await readOrrerySystemMembersCore(ro, system)
        : null;
    const where =
      system.kind === "custom" ? null : buildOrrerySystemWhere(system);
    const customMemberIds =
      customMembers?.members.map((member) => member.id) ?? [];
    if (system.kind === "custom" && customMemberIds.length === 0) return [];
    const result: OrrerySatellite[] = [];
    for (let start = 0; start < unique.length; start += PARENT_BATCH_SIZE) {
      const batch = unique.slice(start, start + PARENT_BATCH_SIZE);
      const rows = await ro.getAllAsync<
        OrrerySatellite & { hidden: number | null }
      >(
        `SELECT r.uid,r.contact_id AS parentId,c.uid AS parentUid,
          r.person_name AS personName,r.relation_type AS relationType,r.hidden
         FROM relationships r JOIN contacts c ON c.id=r.contact_id
         WHERE ${where ? where.sql : `c.id IN (${customMemberIds.map(() => "?").join(",")})`}
           AND c.id IN (${batch.map(() => "?").join(",")})
           AND r.deleted_at IS NULL AND r.linked_contact_id IS NULL
         ORDER BY r.uid`,
        [
          ...(where ? where.params : customMemberIds),
          ...batch.map((p) => p.id),
        ],
      );
      for (const { hidden, ...row } of rows)
        if (
          resolveRelationshipVisibility(hidden) === "show" &&
          batch.some((p) => p.id === row.parentId && p.uid === row.parentUid)
        )
          result.push(row);
    }
    return result.sort(
      (a, b) =>
        a.parentId - b.parentId || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0),
    );
  });
}
